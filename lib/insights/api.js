// Database access for Insights. Every query runs as the signed-in artist and
// row-level security limits it to their own rows; the explicit user filters
// below just keep queries efficient.

import { supabase } from "../supabase.js";

export const INSIGHTS_BUCKET = "insights-imports";

const PAGE_SIZE = 1000;
const MAX_STORED_ISSUES = 100;
// Keep a single import request comfortably below API size limits.
const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024;

// PostgREST returns at most 1,000 rows per request, so page through.
const fetchAll = async (query) => {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query().range(from, from + PAGE_SIZE - 1);
    if (error) {
      throw error;
    }
    rows.push(...data);
    if (data.length < PAGE_SIZE) {
      return rows;
    }
  }
};

export const loadInsights = async (userId) => {
  const [imports, daily, period] = await Promise.all([
    fetchAll(() =>
      supabase
        .from("insights_imports")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .order("id")
    ),
    fetchAll(() =>
      supabase
        .from("insights_daily_metrics")
        .select("import_id, scope, song_key, song_name, country, metric_date, streams, listeners, followers, saves, playlist_adds")
        .eq("user_id", userId)
        .order("metric_date")
        .order("scope")
        .order("song_key")
        .order("country")
    ),
    fetchAll(() =>
      supabase
        .from("insights_period_metrics")
        .select("import_id, report_type, entity_key, entity_name, playlist_curator, song_name, release_date, release_precision, added_date, country, period_preset, period_start, period_end, streams, listeners, saves, playlist_adds, followers")
        .eq("user_id", userId)
        .order("period_end")
        .order("report_type")
        .order("entity_key")
        .order("country")
        .order("period_preset")
        .order("period_start")
    ),
  ]);

  return { imports, daily, period };
};

export const sha256Hex = async (buffer) => {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

// Spotify exports are UTF-8; also accept UTF-16 files saved by spreadsheet apps.
export const decodeCsvBuffer = (buffer) => {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(buffer);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(buffer);
  return new TextDecoder("utf-8").decode(buffer);
};

const recordFailure = async ({ id, userId, file, typeId, sha, message }) => {
  // Best effort: a failed import is logged so it shows in the history.
  await supabase.from("insights_imports").insert({
    id,
    user_id: userId,
    report_type: typeId,
    status: "failed",
    file_name: file.name.slice(0, 255),
    file_size_bytes: file.size,
    file_sha256: sha,
    error_message: message.slice(0, 2000),
  });
};

const friendlyError = (error) => {
  const message = error?.message ?? "";
  if (/too many rows/i.test(message)) return "This file has too many rows to import at once (the limit is 50,000).";
  if (/signed in|JWT|401/i.test(message)) return "Your session has expired. Sign in again and retry the import.";
  if (/violates check constraint/i.test(message)) return "Some values in this file are outside the allowed range, so nothing was imported.";
  return "The import couldn't be saved, so nothing was imported. Please try again.";
};

// Store the original file privately, then commit all rows in one transaction.
// Returns { importId, newCount, replacedCount } or throws an Error with a
// message suitable for the artist.
export const commitImport = async ({ userId, file, sha, typeId, normalized, options, mapping, unsupported, issues, rowCount }) => {
  const id = crypto.randomUUID();
  const storagePath = `${userId}/${id}.csv`;

  const payload = {
    p_import: {
      id,
      report_type: typeId,
      file_name: file.name.slice(0, 255),
      file_size_bytes: file.size,
      file_sha256: sha,
      storage_path: storagePath,
      row_count: rowCount,
      skipped_count: normalized.skipped,
      coverage_start: normalized.coverage.start,
      coverage_end: normalized.coverage.end,
      period_preset: options.period?.preset ?? null,
      song_name: options.songName?.trim() || null,
      column_mapping: { ...mapping, unsupported },
      issues: issues.slice(0, MAX_STORED_ISSUES),
    },
    p_daily: normalized.daily,
    p_period: normalized.period,
  };

  if (new Blob([JSON.stringify(payload)]).size > MAX_PAYLOAD_BYTES) {
    throw new Error("This file is too large to import in one go. Export a shorter date range from Spotify for Artists and import it in parts.");
  }

  const bucket = supabase.storage.from(INSIGHTS_BUCKET);
  const { error: uploadError } = await bucket.upload(storagePath, file, { contentType: "text/csv" });
  if (uploadError) {
    await recordFailure({ id, userId, file, typeId, sha, message: "The original file couldn't be stored." });
    throw new Error("The file couldn't be uploaded. Check your connection and try again.");
  }

  const { data, error } = await supabase.rpc("insights_commit_import", payload);
  if (error) {
    await bucket.remove([storagePath]);
    const message = friendlyError(error);
    await recordFailure({ id, userId, file, typeId, sha, message });
    throw new Error(message);
  }

  return { importId: data.import_id, newCount: data.new_count, replacedCount: data.replaced_count };
};

// Removes the import, every metric row it currently supplies, and its file.
export const deleteImport = async (importRecord) => {
  const { error } = await supabase.from("insights_imports").delete().eq("id", importRecord.id);
  if (error) {
    throw error;
  }
  if (importRecord.storage_path) {
    await supabase.storage.from(INSIGHTS_BUCKET).remove([importRecord.storage_path]);
  }
};
