import { useEffect, useState } from "react";
import GrowthTracker from "./GrowthTracker";
import { LoadingText, PageShell, Panel, SignInPrompt, Tabs } from "./PageShell";
import StatusBadge from "./StatusBadge";
import PlanDetail from "./PlanDetail";
import PlanList from "./PlanList";
import { STATUS_LABELS, SUBMISSIONS_BUCKET, supabase } from "../lib/supabase";
import { PLAN_LIST_SELECT } from "../lib/releasePlans";
import { formatShortDate, formatSize } from "../lib/songVault";
import { REVIEW_TEMPLATES, fillTemplate } from "../lib/reviewTemplates";
import {
  GROWTH_METRICS,
  formatMetricValue,
  formatMonth,
  seriesFor,
} from "../lib/growth";

const SIGNED_URL_SECONDS = 60 * 60;

// Supabase free plan file storage, shared by every bucket.
const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;

const BUCKET_LABELS = {
  submissions: "Release submissions",
  "song-vault": "Artists' song vaults",
};

const StorageMeter = ({ usage }) => {
  const used = usage.reduce((total, bucket) => total + Number(bucket.bytes), 0);
  const percent = Math.min(100, (used / STORAGE_LIMIT_BYTES) * 100);
  const level = percent >= 90 ? "critical" : percent >= 75 ? "warning" : "ok";

  return (
    <div className="mb-8 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-400">
          File storage
        </p>
        <p className="text-sm text-stone-200">
          <span className="font-semibold text-white">{formatSize(used)}</span> of 1 GB used (
          {percent < 1 ? "<1" : Math.round(percent)}%)
        </p>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"
        role="img"
        aria-label={`${Math.round(percent)}% of file storage used`}
      >
        <div
          className={`h-full rounded-full ${level === "critical" ? "bg-red-400" : level === "warning" ? "bg-amber-300" : "bg-orange-400"}`}
          style={{ width: `${Math.max(percent, 1)}%` }}
        />
      </div>
      <p className="mt-3 text-xs text-stone-500">
        {usage
          .map((bucket) => `${BUCKET_LABELS[bucket.bucket_id] ?? bucket.bucket_id}: ${formatSize(Number(bucket.bytes))}`)
          .join(" · ")}
      </p>
      {level !== "ok" ? (
        <p className={`mt-2 text-sm ${level === "critical" ? "text-red-300" : "text-amber-200"}`}>
          {level === "critical" ? "⚠ Storage is almost full." : "⚠ Storage is filling up."} Delete
          the files of releases you've sent to the distributor or rejected to free up space.
        </p>
      ) : null}
    </div>
  );
};

const getDownloadName = (submission, path, suffix) => {
  const base = `${submission.artist_name} - ${submission.track_title}`
    .replace(/[\\/:*?"<>|]/g, "")
    .trim();
  const extension = path.split(".").pop();
  return `${base}${suffix}.${extension}`;
};

const formatDetailsForCopy = (submission) =>
  [
    ["Artist", submission.artist_name],
    ["Track title", submission.track_title],
    ["Genre", submission.genre],
    ["Preferred release date", submission.release_date],
    ["Language", submission.language],
    ["Explicit", submission.explicit ? "Yes" : "No"],
    ["Songwriters", submission.songwriters],
    ["Producers", submission.producers],
    ["Featured artists", submission.featured_artists],
    ["ISRC", submission.isrc],
    ["UPC", submission.upc],
    ["Contact email", submission.contact_email],
    ["Lyrics", submission.lyrics ? `\n${submission.lyrics}` : null],
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");

const Detail = ({ label, value }) => {
  if (!value) {
    return null;
  }

  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm text-stone-200">{value}</dd>
    </div>
  );
};

const smallButtonClass =
  "rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-stone-200 transition hover:border-orange-300 hover:text-orange-200 disabled:cursor-wait disabled:opacity-50";

const EMAILED_STATUSES = ["approved", "changes_requested", "sent_to_distributor", "rejected"];

const FILTERS = ["pending", "changes_requested", "approved", "sent_to_distributor", "rejected", "follow_up", "all"];
const FILTER_LABELS = { all: "All", follow_up: "Follow-up due" };

const SORTS = [
  { id: "waiting", label: "Waiting longest" },
  { id: "newest", label: "Newest first" },
  { id: "release", label: "Release date soonest" },
];

const STATUS_ACTIONS = [
  { status: "approved", label: "Approve" },
  { status: "changes_requested", label: "Request changes" },
  { status: "sent_to_distributor", label: "Mark sent to distributor" },
  { status: "rejected", label: "Reject" },
  { status: "pending", label: "Move back to pending" },
];

const todayString = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
};

const daysSince = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));

const followUpDue = (submission, tracking) =>
  Boolean(tracking?.follow_up_on && tracking.follow_up_on <= todayString() && !["rejected"].includes(submission.status));

const EVENT_TEXT = {
  submitted: () => "Submitted",
  resubmitted: () => "Resubmitted with changes",
  status_changed: (event) => `Status: ${STATUS_LABELS[event.from_status] ?? event.from_status} → ${STATUS_LABELS[event.to_status] ?? event.to_status}`,
  message_updated: () => "Message to artist updated",
  files_removed: (event) => `Files deleted${event.details?.bytes ? ` (${formatSize(Number(event.details.bytes))})` : ""}`,
  tracking_updated: (event) =>
    `Distribution details: ${[
      event.details?.distributor,
      event.details?.reference ? `ref ${event.details.reference}` : null,
      event.details?.sent_on ? `sent ${event.details.sent_on}` : null,
      event.details?.follow_up_on ? `follow up ${event.details.follow_up_on}` : null,
    ]
      .filter(Boolean)
      .join(", ") || "cleared"}`,
};

const groupEvents = (rows) =>
  rows.reduce((all, row) => {
    (all[row.submission_id] ??= []).push(row);
    return all;
  }, {});

const History = ({ events }) => {
  if (!events?.length) return null;
  return (
    <details className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
      <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-400">
        History ({events.length})
      </summary>
      <ol className="mt-3 space-y-2 text-sm">
        {[...events].reverse().map((event) => (
          <li key={event.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1">
            <span className="text-stone-200">
              {EVENT_TEXT[event.event]?.(event) ?? event.event}
              <span className="text-stone-500"> · {event.actor_role}</span>
            </span>
            <span className="text-xs text-stone-500">{new Date(event.created_at).toLocaleString()}</span>
          </li>
        ))}
      </ol>
    </details>
  );
};

const trackingInputClass =
  "mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-100 focus:border-orange-300 focus:outline-none [color-scheme:dark]";

const TrackingPanel = ({ submission, tracking, onSave }) => {
  const [values, setValues] = useState({
    distributor: tracking?.distributor ?? "",
    distribution_reference: tracking?.distribution_reference ?? "",
    sent_on: tracking?.sent_on ?? "",
    follow_up_on: tracking?.follow_up_on ?? "",
  });
  const [state, setState] = useState("");

  useEffect(() => {
    setValues({
      distributor: tracking?.distributor ?? "",
      distribution_reference: tracking?.distribution_reference ?? "",
      sent_on: tracking?.sent_on ?? "",
      follow_up_on: tracking?.follow_up_on ?? "",
    });
  }, [tracking]);

  const changed = Object.entries(values).some(([key, value]) => value !== (tracking?.[key] ?? ""));
  const due = followUpDue(submission, tracking);

  const save = async () => {
    setState("saving");
    const error = await onSave(submission.id, {
      distributor: values.distributor.trim() || null,
      distribution_reference: values.distribution_reference.trim() || null,
      sent_on: values.sent_on || null,
      follow_up_on: values.follow_up_on || null,
    });
    setState(error ? "error" : "saved");
  };

  const field = (key, label, props = {}) => (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">{label}</span>
      <input
        {...props}
        value={values[key]}
        onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
        className={trackingInputClass}
      />
    </label>
  );

  return (
    <div className={`mt-6 rounded-2xl border p-4 ${due ? "border-amber-300/40 bg-amber-300/5" : "border-white/10 bg-black/20"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-400">Distribution tracking (admin only)</p>
        {due ? <p className="text-xs font-semibold text-amber-200">Follow-up due</p> : null}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {field("distributor", "Distributor", { maxLength: 120, placeholder: "e.g. your distributor" })}
        {field("distribution_reference", "Reference / ID", { maxLength: 200 })}
        {field("sent_on", "Sent on", { type: "date" })}
        {field("follow_up_on", "Follow up on", { type: "date" })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" disabled={!changed || state === "saving"} onClick={save} className={smallButtonClass}>
          {state === "saving" ? "Saving…" : "Save tracking"}
        </button>
        {state === "saved" && !changed ? <span className="text-sm text-stone-500">Saved.</span> : null}
        {state === "error" ? <span className="text-sm text-red-300">Couldn't save. Try again.</span> : null}
      </div>
    </div>
  );
};

// Every file that could be deleted to free space, shown file by file before
// anything is removed. Files still used by an active submission never appear.
const CleanupPanel = ({ onChanged }) => {
  const [candidates, setCandidates] = useState(null);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState("");

  const load = async () => {
    const { data, error } = await supabase.rpc("admin_cleanup_candidates");
    setCandidates(error ? [] : data);
  };

  useEffect(() => {
    load();
  }, []);

  if (!candidates) return null;

  const groups = Object.values(
    candidates.reduce((all, file) => {
      const key = file.kind === "orphan" ? "orphan" : file.submission_id;
      all[key] ??= { key, kind: file.kind, submission_id: file.submission_id, title: file.track_title, artist: file.artist_name, status: file.status, files: [] };
      all[key].files.push(file);
      return all;
    }, {})
  );
  const total = candidates.reduce((sum, file) => sum + Number(file.bytes), 0);

  const remove = async (group) => {
    const list = group.files.map((file) => `• ${file.file_name.split("/").slice(1).join("/")} (${formatSize(Number(file.bytes))})`).join("\n");
    const confirmed = window.confirm(
      `${group.kind === "orphan" ? "Delete these unused files?" : `Delete the files for "${group.title}"?`}\n\n${list}\n\n` +
        (group.kind === "orphan"
          ? "No submission uses them (they're left over from uploads that didn't finish)."
          : "Make sure you've kept your own copy. The submission details, status and messages are kept.") +
        "\nThis can't be undone."
    );
    if (!confirmed) return;

    setBusy(group.key);
    setMessage("");
    const names = group.files.map((file) => file.file_name);
    const { data: removed, error } = await supabase.storage.from(SUBMISSIONS_BUCKET).remove(names);
    if (error || !removed?.length) {
      setMessage("Couldn't delete those files. Nothing was changed.");
      setBusy(null);
      return;
    }
    const bytes = group.files.filter((file) => removed.some((entry) => entry.name === file.file_name)).reduce((sum, file) => sum + Number(file.bytes), 0);
    if (group.kind === "release" && removed.length === names.length) {
      await onChanged.markRemoved(group.submission_id, bytes);
    }
    setMessage(
      removed.length === names.length
        ? `Deleted ${removed.length} file${removed.length === 1 ? "" : "s"}, freeing ${formatSize(bytes)}.`
        : `Only ${removed.length} of ${names.length} files could be deleted. The release keeps its files listed so you can retry.`
    );
    setBusy(null);
    await load();
    onChanged.refreshStorage();
  };

  return (
    <details className="mb-8 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
      <summary className="cursor-pointer text-sm font-semibold text-stone-200">
        Storage clean-up · {groups.length ? `${formatSize(total)} can be freed` : "nothing to clean up"}
      </summary>
      <p className="mt-3 text-sm leading-6 text-stone-400">
        Only files of releases you've sent to the distributor or rejected, and files no submission uses that are over a
        day old, are listed. Files of pending, approved or changes-requested submissions are never shown here.
      </p>
      {message ? <p className="mt-3 text-sm text-stone-300" aria-live="polite">{message}</p> : null}
      {groups.length ? (
        <ul className="mt-4 space-y-3">
          {groups.map((group) => {
            const bytes = group.files.reduce((sum, file) => sum + Number(file.bytes), 0);
            return (
              <li key={group.key} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">
                      {group.kind === "orphan" ? "Unused files from unfinished uploads" : `${group.title} · ${group.artist}`}
                    </p>
                    <p className="text-xs text-stone-500">
                      {group.kind === "orphan" ? "Not linked to any submission" : STATUS_LABELS[group.status]} · {group.files.length} file{group.files.length === 1 ? "" : "s"} · {formatSize(bytes)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" aria-expanded={open === group.key} onClick={() => setOpen(open === group.key ? null : group.key)} className={smallButtonClass}>
                      {open === group.key ? "Hide files" : "Preview files"}
                    </button>
                    <button
                      type="button"
                      disabled={busy === group.key}
                      onClick={() => remove(group)}
                      className="rounded-full border border-red-300/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-red-200 transition hover:border-red-300 hover:bg-red-400/10 disabled:opacity-50"
                    >
                      {busy === group.key ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
                {open === group.key ? (
                  <ul className="mt-3 space-y-1 text-sm text-stone-300">
                    {group.files.map((file) => (
                      <li key={file.file_name} className="flex flex-wrap justify-between gap-2">
                        <span className="break-all font-mono text-xs">{file.file_name.split("/").slice(1).join("/")}</span>
                        <span className="text-xs text-stone-500">
                          {formatSize(Number(file.bytes))} · uploaded {formatShortDate(file.uploaded_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </details>
  );
};

const SubmissionCard = ({
  submission,
  adminNote,
  fileBytes,
  signedUrls,
  onUpdate,
  onSaveNote,
  onRemoveFiles,
  tracking,
  events,
  onSaveTracking,
}) => {
  const [notes, setNotes] = useState(adminNote ?? "");
  const [artistMessage, setArtistMessage] = useState(submission.artist_message ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const posterUrl = signedUrls[submission.poster_path];
  const audioUrl = signedUrls[submission.audio_path];
  const notesChanged = notes !== (adminNote ?? "");
  const artistMessageChanged = artistMessage !== (submission.artist_message ?? "");

  // The artist message is saved with the status so the email includes it.
  const save = async (changes) => {
    if (changes.status === "changes_requested" && !artistMessage.trim()) {
      setMessage("Write what the artist needs to change first. It's sent in the email.");
      return;
    }
    setSaving(true);
    setMessage("");
    const errors = await Promise.all([
      changes.status || artistMessageChanged
        ? onUpdate(submission.id, {
            ...changes,
            artist_message: artistMessage.trim() ? artistMessage.trim() : null,
          })
        : null,
      notesChanged ? onSaveNote(submission.id, notes.trim()) : null,
    ]);
    setSaving(false);

    if (errors.some(Boolean)) {
      setMessage("Couldn't save. Please try again.");
    } else {
      setMessage("Saved.");
    }
  };

  const download = async (path, suffix) => {
    const { data, error } = await supabase.storage
      .from(SUBMISSIONS_BUCKET)
      .createSignedUrl(path, 60, {
        download: getDownloadName(submission, path, suffix),
      });

    if (error) {
      setMessage("Couldn't start the download. Please try again.");
      return;
    }

    window.location.assign(data.signedUrl);
  };

  const [removingFiles, setRemovingFiles] = useState(false);

  const removeFiles = async () => {
    const confirmed = window.confirm(
      `Delete the audio and poster for "${submission.track_title}"${fileBytes ? ` (${formatSize(fileBytes)})` : ""}?\n\n` +
        "Make sure you've kept your own copy. They can't be downloaded again. The submission details, status and messages are kept."
    );
    if (!confirmed) {
      return;
    }

    setRemovingFiles(true);
    setMessage("");
    const error = await onRemoveFiles(submission, fileBytes);
    setRemovingFiles(false);
    setMessage(error ? "Couldn't delete the files. Please try again." : "Files deleted.");
  };

  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(formatDetailsForCopy(submission));
      setMessage("Details copied.");
    } catch {
      setMessage("Couldn't copy. Select the text manually instead.");
    }
  };

  return (
    <Panel>
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="shrink-0">
          {submission.files_removed_at ? (
            <div className="flex h-40 w-40 items-center justify-center rounded-2xl border border-dashed border-white/15 p-4 text-center text-xs text-stone-500">
              Files removed to free up space
            </div>
          ) : posterUrl ? (
            <img
              src={posterUrl}
              alt={`Poster for ${submission.track_title}`}
              className="h-40 w-40 rounded-2xl object-cover"
            />
          ) : (
            <div className="h-40 w-40 rounded-2xl bg-white/5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-['Space_Grotesk'] text-2xl font-bold text-white">
                {submission.track_title}
              </h2>
              <p className="mt-1 text-stone-400">
                {submission.artist_name} · {submission.submitted_at && submission.submitted_at !== submission.created_at ? "resubmitted" : "submitted"}{" "}
                {new Date(submission.submitted_at ?? submission.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {submission.status === "pending" ? (
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                    daysSince(submission.submitted_at ?? submission.created_at) > 7
                      ? "bg-red-400/15 text-red-200"
                      : daysSince(submission.submitted_at ?? submission.created_at) > 3
                        ? "bg-amber-300/15 text-amber-200"
                        : "bg-white/10 text-stone-300"
                  }`}
                >
                  Waiting {daysSince(submission.submitted_at ?? submission.created_at)} day
                  {daysSince(submission.submitted_at ?? submission.created_at) === 1 ? "" : "s"}
                </span>
              ) : null}
              {submission.status === "changes_requested" ? (
                <span className="rounded-full bg-fuchsia-300/15 px-3 py-1 text-[11px] font-semibold text-fuchsia-200">
                  With the artist {daysSince(submission.updated_at)} day{daysSince(submission.updated_at) === 1 ? "" : "s"}
                </span>
              ) : null}
              <StatusBadge status={submission.status} />
            </div>
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Genre" value={submission.genre} />
            <Detail label="Release date" value={submission.release_date} />
            <Detail label="Language" value={submission.language} />
            <Detail label="Explicit" value={submission.explicit ? "Yes" : "No"} />
            <Detail label="Songwriters" value={submission.songwriters} />
            <Detail label="Producers" value={submission.producers} />
            <Detail label="Featured" value={submission.featured_artists} />
            <Detail label="ISRC" value={submission.isrc} />
            <Detail label="UPC" value={submission.upc} />
            <Detail
              label="Contact"
              value={
                <a
                  href={`mailto:${submission.contact_email}`}
                  className="text-orange-200 underline-offset-4 hover:underline"
                >
                  {submission.contact_email}
                </a>
              }
            />
          </dl>

          {submission.lyrics ? (
            <details className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.25em] text-stone-300">
                Lyrics
              </summary>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-stone-300">
                {submission.lyrics}
              </p>
            </details>
          ) : null}

          {audioUrl && !submission.files_removed_at ? (
            <audio
              controls
              preload="none"
              src={audioUrl}
              className="mt-6 w-full"
            />
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            {submission.files_removed_at ? null : (
              <>
                <button
                  type="button"
                  onClick={() => download(submission.audio_path, "")}
                  className="rounded-full bg-orange-500 px-5 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-orange-400"
                >
                  Download audio
                </button>
                <button
                  type="button"
                  onClick={() => download(submission.poster_path, " (poster)")}
                  className="rounded-full bg-orange-500 px-5 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-orange-400"
                >
                  Download poster
                </button>
              </>
            )}
            <button type="button" onClick={copyDetails} className={smallButtonClass}>
              Copy details
            </button>
          </div>

          {submission.files_removed_at ? (
            <p className="mt-4 text-sm text-stone-400">
              Audio and poster deleted on{" "}
              {formatShortDate(submission.files_removed_at)}
              {submission.files_removed_bytes
                ? `, freeing ${formatSize(Number(submission.files_removed_bytes))}`
                : ""}
              . The details above are kept.
            </p>
          ) : ["sent_to_distributor", "rejected"].includes(submission.status) ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-stone-300">
                {submission.status === "rejected"
                  ? "This release was rejected. You can delete its audio and poster to free up storage."
                  : "This release is with the distributor. Once you've kept your own copy, you can delete the audio and poster here to free up storage."}
              </p>
              <button
                type="button"
                disabled={removingFiles}
                onClick={removeFiles}
                className="mt-3 rounded-full border border-red-300/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-red-200 transition hover:border-red-300 hover:bg-red-400/10 disabled:cursor-wait disabled:opacity-50"
              >
                {removingFiles
                  ? "Deleting…"
                  : `Delete files to free up space${fileBytes ? ` (${formatSize(fileBytes)})` : ""}`}
              </button>
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-500">Message to artist</span>
                <select
                  aria-label="Use a message template"
                  value=""
                  onChange={(event) => {
                    const template = REVIEW_TEMPLATES.find((entry) => entry.key === event.target.value);
                    if (template) setArtistMessage(fillTemplate(template, submission));
                  }}
                  className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-stone-300 focus:border-orange-300 focus:outline-none"
                >
                  <option value="">Use a template…</option>
                  {REVIEW_TEMPLATES.map((template) => (
                    <option key={template.key} value={template.key}>
                      {STATUS_LABELS[template.status]}: {template.label}
                    </option>
                  ))}
                </select>
              </span>
              <textarea
                rows={3}
                maxLength={2000}
                placeholder="Included in the email when you change the status, and shown on their submissions page."
                value={artistMessage}
                onChange={(event) => setArtistMessage(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-stone-100 placeholder:text-stone-600 focus:border-orange-300 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-500">
                Private notes (only admins see these)
              </span>
              <textarea
                rows={3}
                maxLength={5000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-stone-100 focus:border-orange-300 focus:outline-none"
              />
            </label>
          </div>

          <p className="mt-4 text-xs text-stone-500">
            {submission.artist_notified_status
              ? `Artist emailed about “${STATUS_LABELS[submission.artist_notified_status]}” · ${new Date(submission.artist_notified_at).toLocaleString()}. `
              : ""}
            Approving, requesting changes, rejecting or marking it sent emails the artist at{" "}
            {submission.contact_email}.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {STATUS_ACTIONS.filter(
              (action) => action.status !== submission.status
            ).map((action) => (
              <button
                key={action.status}
                type="button"
                disabled={saving}
                onClick={() => save({ status: action.status })}
                className={smallButtonClass}
              >
                {action.label}
              </button>
            ))}
            {notesChanged || artistMessageChanged ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => save({})}
                className={smallButtonClass}
              >
                Save without emailing
              </button>
            ) : null}
            {message ? (
              <span className="text-sm text-stone-400" aria-live="polite">
                {message}
              </span>
            ) : null}
          </div>

          {["approved", "sent_to_distributor"].includes(submission.status) || tracking ? (
            <TrackingPanel submission={submission} tracking={tracking} onSave={onSaveTracking} />
          ) : null}
          <History events={events} />
        </div>
      </div>
    </Panel>
  );
};

const ArtistPlansTab = () => {
  const [plans, setPlans] = useState(null);
  const [openPlanId, setOpenPlanId] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (openPlanId) {
      return undefined;
    }

    let cancelled = false;

    supabase
      .from("release_plans")
      .select(PLAN_LIST_SELECT)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) {
          return;
        }
        if (error) {
          setLoadError("Couldn't load artist plans. Refresh to try again.");
          setPlans([]);
          return;
        }
        setPlans(data);
      });

    return () => {
      cancelled = true;
    };
  }, [openPlanId]);

  if (openPlanId) {
    return (
      <PlanDetail
        planId={openPlanId}
        readOnly
        onBack={() => {
          setOpenPlanId(null);
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {loadError ? <p className="text-red-300">{loadError}</p> : null}
      {plans === null ? (
        <LoadingText />
      ) : plans.length === 0 ? (
        <p className="text-stone-400">No artist has made a release plan yet.</p>
      ) : (
        <PlanList
          plans={plans}
          onOpen={(planId) => {
            setOpenPlanId(planId);
            window.scrollTo({ top: 0 });
          }}
        />
      )}
    </div>
  );
};

const ArtistGrowthTab = () => {
  const [profiles, setProfiles] = useState(null);
  const [openUserId, setOpenUserId] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (openUserId) {
      return undefined;
    }

    let cancelled = false;

    supabase
      .from("growth_profiles")
      .select("user_id, artist_name, currency, growth_entries(*)")
      .order("artist_name")
      .then(({ data, error }) => {
        if (cancelled) {
          return;
        }
        if (error) {
          setLoadError("Couldn't load artist growth. Refresh to try again.");
          setProfiles([]);
          return;
        }
        setProfiles(data);
      });

    return () => {
      cancelled = true;
    };
  }, [openUserId]);

  if (openUserId) {
    const profile = profiles?.find((item) => item.user_id === openUserId);

    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => {
            setOpenUserId(null);
            window.scrollTo({ top: 0 });
          }}
          className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-300 transition hover:text-orange-200"
        >
          ← All artists
        </button>
        {profile ? (
          <h2 className="font-['Space_Grotesk'] text-3xl font-bold uppercase tracking-[0.06em] text-white">
            {profile.artist_name}
          </h2>
        ) : null}
        <GrowthTracker userId={openUserId} readOnly />
      </div>
    );
  }

  const listeners = GROWTH_METRICS[0];

  return (
    <div className="space-y-6">
      {loadError ? <p className="text-red-300">{loadError}</p> : null}
      {profiles === null ? (
        <LoadingText />
      ) : profiles.length === 0 ? (
        <p className="text-stone-400">No artist has started tracking their growth yet.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {profiles.map((profile) => {
            const series = seriesFor(profile.growth_entries, listeners.key);
            const latest = series[series.length - 1];
            const lastLogged = [...profile.growth_entries].sort((a, b) =>
              b.month.localeCompare(a.month)
            )[0];

            return (
              <button
                key={profile.user_id}
                type="button"
                onClick={() => {
                  setOpenUserId(profile.user_id);
                  window.scrollTo({ top: 0 });
                }}
                className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-left transition hover:border-orange-300/60 sm:p-8"
              >
                <p className="font-['Space_Grotesk'] text-xl font-bold uppercase tracking-[0.06em] text-white">
                  {profile.artist_name}
                </p>
                <p className="mt-1 text-sm text-stone-400">
                  {lastLogged
                    ? `Last logged ${formatMonth(lastLogged.month)} · ${profile.growth_entries.length} month${profile.growth_entries.length === 1 ? "" : "s"}`
                    : "Nothing logged yet"}
                </p>
                {latest ? (
                  <p className="mt-6 text-sm text-stone-300">
                    <span className="text-2xl font-bold text-white">
                      {formatMetricValue(listeners, latest.value, profile.currency)}
                    </span>{" "}
                    {listeners.label.toLowerCase()}
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const AdminPage = ({ session, authReady, isAdmin, onOpenAuth }) => {
  const [tab, setTab] = useState("submissions");
  const [submissions, setSubmissions] = useState(null);
  const [adminNotes, setAdminNotes] = useState({});
  const [notice, setNotice] = useState("");
  const [storageUsage, setStorageUsage] = useState(null);
  const [fileSizes, setFileSizes] = useState({});
  const [signedUrls, setSignedUrls] = useState({});
  const [filter, setFilter] = useState("pending");
  const [sort, setSort] = useState("waiting");
  const [tracking, setTracking] = useState({});
  const [events, setEvents] = useState({});
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    document.title = "Review Submissions | EklautA Records";
  }, []);

  // Storage totals and per-release file sizes, for the meter and delete buttons.
  const loadStorage = async () => {
    const [usageResult, sizesResult] = await Promise.all([
      supabase.rpc("admin_storage_usage"),
      supabase.rpc("admin_submission_file_sizes"),
    ]);

    if (!usageResult.error) {
      setStorageUsage(usageResult.data);
    }
    if (!sizesResult.error) {
      setFileSizes(
        Object.fromEntries(
          sizesResult.data.map((entry) => [entry.submission_id, Number(entry.bytes)])
        )
      );
    }
  };

  useEffect(() => {
    if (isAdmin !== true) {
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      const [{ data, error }, notesResult, trackingResult, eventsResult] = await Promise.all([
        supabase.from("submissions").select("*").order("created_at", { ascending: false }),
        supabase.from("submission_admin_notes").select("submission_id, notes"),
        supabase.from("submission_tracking").select("*"),
        supabase.from("submission_events").select("*").order("created_at"),
      ]);

      if (cancelled) {
        return;
      }

      if (error || notesResult.error) {
        setLoadError("Couldn't load submissions. Refresh to try again.");
        setSubmissions([]);
        return;
      }

      setAdminNotes(
        Object.fromEntries(notesResult.data.map((entry) => [entry.submission_id, entry.notes]))
      );
      setTracking(Object.fromEntries((trackingResult.data ?? []).map((entry) => [entry.submission_id, entry])));
      setEvents(groupEvents(eventsResult.data ?? []));
      setSubmissions(data);
      loadStorage();

      const paths = data.flatMap((submission) => [
        submission.poster_path,
        submission.audio_path,
      ]);

      if (paths.length === 0) {
        return;
      }

      const { data: urls } = await supabase.storage
        .from(SUBMISSIONS_BUCKET)
        .createSignedUrls(paths, SIGNED_URL_SECONDS);

      if (!cancelled && urls) {
        setSignedUrls(
          Object.fromEntries(
            urls
              .filter((entry) => entry.signedUrl)
              .map((entry) => [entry.path, entry.signedUrl])
          )
        );
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const updateSubmission = async (id, changes) => {
    const { data, error } = await supabase
      .from("submissions")
      .update(changes)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(error);
      return error;
    }

    setSubmissions((current) =>
      current.map((submission) => (submission.id === id ? data : submission))
    );

    if (changes.status === "sent_to_distributor" && !tracking[id]?.sent_on) {
      await saveTracking(id, { ...(tracking[id] ?? {}), sent_on: todayString() });
    }
    refreshEvents(id);

    // The card may leave the current filter, so confirm at the top of the list.
    if (changes.status) {
      setNotice(
        `“${data.track_title}” moved to ${STATUS_LABELS[data.status]}.${
          EMAILED_STATUSES.includes(data.status) ? ` Emailing ${data.contact_email}.` : ""
        }`
      );
    }
    return null;
  };

  // Called after the cleanup panel deleted a release's files.
  const markFilesRemoved = async (submissionId, bytes) =>
    updateSubmission(submissionId, {
      files_removed_at: new Date().toISOString(),
      files_removed_bytes: bytes ? Math.round(bytes) : null,
    });

  const removeSubmissionFiles = async (submission, bytes) => {
    const { data: removed, error: removeError } = await supabase.storage
      .from(SUBMISSIONS_BUCKET)
      .remove([submission.audio_path, submission.poster_path]);

    // Storage reports no error when access rules refuse a delete; it just
    // removes nothing, so check that the files actually went.
    if (removeError || !removed?.length) {
      console.error(removeError ?? "No files were deleted");
      return removeError ?? new Error("No files were deleted");
    }

    const error = await updateSubmission(submission.id, {
      files_removed_at: new Date().toISOString(),
      files_removed_bytes: bytes ? Math.round(bytes) : null,
    });

    loadStorage();
    return error;
  };

  const refreshEvents = async (submissionId) => {
    const { data } = await supabase
      .from("submission_events")
      .select("*")
      .eq("submission_id", submissionId)
      .order("created_at");
    if (data) setEvents((current) => ({ ...current, [submissionId]: data }));
  };

  const saveTracking = async (submissionId, values) => {
    const { submission_id: _ignored, updated_at: _updated, ...fields } = values;
    const { data, error } = await supabase
      .from("submission_tracking")
      .upsert({ submission_id: submissionId, ...fields }, { onConflict: "submission_id" })
      .select()
      .single();
    if (error) {
      console.error(error);
      return error;
    }
    setTracking((current) => ({ ...current, [submissionId]: data }));
    refreshEvents(submissionId);
    return null;
  };

  // Private notes live in their own admin-only table; an empty note removes it.
  const saveAdminNote = async (submissionId, notes) => {
    const { error } = notes
      ? await supabase
          .from("submission_admin_notes")
          .upsert({ submission_id: submissionId, notes }, { onConflict: "submission_id" })
      : await supabase.from("submission_admin_notes").delete().eq("submission_id", submissionId);

    if (error) {
      console.error(error);
      return error;
    }

    setAdminNotes((current) => {
      const next = { ...current };
      if (notes) {
        next[submissionId] = notes;
      } else {
        delete next[submissionId];
      }
      return next;
    });
    return null;
  };

  const title = "Review submissions";

  if (!authReady || (session && isAdmin === null)) {
    return (
      <PageShell eyebrow="Admin" title={title}>
        <LoadingText />
      </PageShell>
    );
  }

  if (!session) {
    return (
      <PageShell eyebrow="Admin" title={title}>
        <SignInPrompt
          message="Sign in with an admin Google account to review submissions."
          onOpenAuth={onOpenAuth}
        />
      </PageShell>
    );
  }

  if (!isAdmin) {
    return (
      <PageShell eyebrow="Admin" title={title}>
        <Panel className="max-w-xl">
          <p className="leading-7 text-stone-300">
            {session.user.email} doesn&apos;t have access to this page.
          </p>
        </Panel>
      </PageShell>
    );
  }

  const counts = (submissions ?? []).reduce(
    (totals, submission) => ({
      ...totals,
      [submission.status]: (totals[submission.status] ?? 0) + 1,
      follow_up: totals.follow_up + (followUpDue(submission, tracking[submission.id]) ? 1 : 0),
      all: totals.all + 1,
    }),
    { all: 0, follow_up: 0 }
  );

  const waitingSince = (submission) => submission.submitted_at ?? submission.created_at;
  const visible = (submissions ?? [])
    .filter((submission) =>
      filter === "all"
        ? true
        : filter === "follow_up"
          ? followUpDue(submission, tracking[submission.id])
          : submission.status === filter
    )
    .sort((a, b) => {
      if (sort === "newest") return waitingSince(b).localeCompare(waitingSince(a));
      if (sort === "release") return (a.release_date ?? "9999").localeCompare(b.release_date ?? "9999");
      return waitingSince(a).localeCompare(waitingSince(b));
    });

  const submissionsTab = (
    <>
      {storageUsage ? <StorageMeter usage={storageUsage} /> : null}
      <CleanupPanel onChanged={{ refreshStorage: loadStorage, markRemoved: markFilesRemoved }} />
      {notice ? (
        <p
          className="mb-6 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-5 py-3 text-sm text-emerald-100"
          aria-live="polite"
        >
          {notice}
        </p>
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] transition ${
              filter === value
                ? "border-orange-400 bg-orange-500 text-white"
                : "border-white/15 text-stone-300 hover:border-orange-300 hover:text-orange-200"
            }`}
          >
            {FILTER_LABELS[value] ?? STATUS_LABELS[value]} ({counts[value] ?? 0})
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-stone-400">
        Sort
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          className="rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-stone-200 focus:border-orange-300 focus:outline-none"
        >
          {SORTS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      </div>

      <div className="mt-8 space-y-6">
        {loadError ? <p className="text-red-300">{loadError}</p> : null}
        {submissions === null ? (
          <LoadingText />
        ) : visible.length === 0 ? (
          <p className="text-stone-400">No submissions here.</p>
        ) : (
          visible.map((submission) => (
            <SubmissionCard
              key={submission.id}
              submission={submission}
              signedUrls={signedUrls}
              adminNote={adminNotes[submission.id]}
              fileBytes={fileSizes[submission.id]}
              onRemoveFiles={removeSubmissionFiles}
              onUpdate={updateSubmission}
              onSaveNote={saveAdminNote}
              tracking={tracking[submission.id]}
              events={events[submission.id]}
              onSaveTracking={saveTracking}
            />
          ))
        )}
      </div>
    </>
  );

  const tabs = [
    { value: "submissions", label: "Submissions" },
    { value: "plans", label: "Artist plans" },
    { value: "growth", label: "Artist growth" },
  ];

  return (
    <PageShell
      eyebrow="Admin"
      title={title}
      intro={
        tab === "plans"
          ? "See how each artist is planning their releases and budgets. Plans are read-only here; only the artist can change them."
          : tab === "growth"
            ? "See how each artist's audience and earnings are growing. Read-only; only the artist can log numbers."
            : "Listen, check the details, then download the audio and poster for your distributor. Artists see the status you set here."
      }
    >
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === "plans" ? (
        <ArtistPlansTab />
      ) : tab === "growth" ? (
        <ArtistGrowthTab />
      ) : (
        submissionsTab
      )}
    </PageShell>
  );
};

export default AdminPage;
