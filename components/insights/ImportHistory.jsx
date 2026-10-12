import { useMemo, useState } from "react";
import { Panel } from "../PageShell";
import { REPORT_TYPES } from "../../lib/insights/reportTypes";
import { formatDay, periodLabel } from "../../lib/insights/analytics";
import { INSIGHTS_BUCKET, deleteImport } from "../../lib/insights/api";
import { formatBytes, formatCount, formatTimestamp } from "../../lib/insights/format";
import { supabase } from "../../lib/supabase";

const coverageText = (entry) => {
  if (REPORT_TYPES[entry.report_type]?.kind === "period" && entry.period_preset) {
    return periodLabel({
      period_preset: entry.period_preset,
      period_start: entry.coverage_start,
      period_end: entry.coverage_end,
    });
  }
  if (entry.coverage_start && entry.coverage_end) {
    return `${formatDay(entry.coverage_start)} – ${formatDay(entry.coverage_end)}`;
  }
  return null;
};

const ImportHistory = ({ data, demo, onChanged }) => {
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState("");

  // How many stored rows each upload currently supplies. A later upload that
  // covers the same days takes those rows over.
  const suppliedRows = useMemo(() => {
    const counts = {};
    for (const row of [...data.daily, ...data.period]) {
      counts[row.import_id] = (counts[row.import_id] ?? 0) + 1;
    }
    return counts;
  }, [data]);

  const remove = async (entry) => {
    const supplied = suppliedRows[entry.id] ?? 0;
    const confirmed = window.confirm(
      `Delete "${entry.file_name}"?\n\n` +
        (supplied
          ? `This removes the ${formatCount(supplied)} rows it currently supplies. Data from other uploads isn't affected, but days this file had replaced won't come back unless you re-upload the older file.`
          : "It doesn't currently supply any rows.")
    );
    if (!confirmed) return;

    setBusyId(entry.id);
    setMessage("");
    try {
      await deleteImport(entry);
      setMessage(`Deleted ${entry.file_name}.`);
      onChanged();
    } catch {
      setMessage("Couldn't delete that upload. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const downloadOriginal = async (entry) => {
    const { data: signed, error } = await supabase.storage
      .from(INSIGHTS_BUCKET)
      .createSignedUrl(entry.storage_path, 60, { download: entry.file_name });
    if (error) {
      setMessage("Couldn't download the original file.");
      return;
    }
    window.location.assign(signed.signedUrl);
  };

  return (
    <Panel>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-['Space_Grotesk'] text-xl font-bold uppercase tracking-[0.08em] text-white">Import history</h2>
        {message ? <p className="text-sm text-stone-400" aria-live="polite">{message}</p> : null}
      </div>

      {data.imports.length === 0 ? (
        <p className="text-sm text-stone-500">No uploads yet.</p>
      ) : (
        <ul className="space-y-3">
          {data.imports.map((entry) => {
            const coverage = coverageText(entry);
            const supplied = suppliedRows[entry.id] ?? 0;
            const failed = entry.status === "failed";

            return (
              <li key={entry.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-all font-semibold text-white">{entry.file_name}</p>
                    <p className="mt-1 text-sm text-stone-400">
                      {REPORT_TYPES[entry.report_type]?.label ?? entry.report_type}
                      {entry.song_name ? ` · ${entry.song_name}` : ""}
                      {coverage ? ` · ${coverage}` : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${
                      failed ? "border-red-300/30 bg-red-300/10 text-red-200" : "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                    }`}
                  >
                    {failed ? "Failed" : "Imported"}
                  </span>
                </div>

                <p className="mt-2 text-xs text-stone-500">
                  Uploaded {formatTimestamp(entry.created_at)}
                  {entry.file_size_bytes ? ` · ${formatBytes(entry.file_size_bytes)}` : ""}
                  {failed
                    ? ""
                    : ` · ${formatCount(entry.new_count)} new, ${formatCount(entry.replaced_count)} replaced, ${formatCount(entry.skipped_count)} skipped · currently supplies ${formatCount(supplied)} rows`}
                </p>
                {failed && entry.error_message ? <p className="mt-2 text-sm text-red-200">{entry.error_message}</p> : null}

                {demo ? null : (
                  <div className="mt-3 flex flex-wrap gap-4">
                    {entry.storage_path && !failed ? (
                      <button
                        type="button"
                        onClick={() => downloadOriginal(entry)}
                        className="text-xs font-semibold uppercase tracking-[0.15em] text-orange-300 hover:text-orange-200"
                      >
                        Download original
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busyId === entry.id}
                      onClick={() => remove(entry)}
                      className="text-xs font-semibold uppercase tracking-[0.15em] text-stone-500 hover:text-red-300 disabled:opacity-50"
                    >
                      {busyId === entry.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
};

export default ImportHistory;
