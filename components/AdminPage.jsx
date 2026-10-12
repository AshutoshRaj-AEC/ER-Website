import { useEffect, useState } from "react";
import GrowthTracker from "./GrowthTracker";
import { LoadingText, PageShell, Panel, SignInPrompt, Tabs } from "./PageShell";
import StatusBadge from "./StatusBadge";
import PlanDetail from "./PlanDetail";
import PlanList from "./PlanList";
import { STATUS_LABELS, SUBMISSIONS_BUCKET, supabase } from "../lib/supabase";
import { PLAN_LIST_SELECT } from "../lib/releasePlans";
import { formatShortDate, formatSize } from "../lib/songVault";
import {
  GROWTH_METRICS,
  formatMetricValue,
  formatMonth,
  seriesFor,
} from "../lib/growth";

const FILTERS = ["pending", "approved", "sent_to_distributor", "rejected", "all"];

const STATUS_ACTIONS = [
  { status: "approved", label: "Approve" },
  { status: "sent_to_distributor", label: "Mark sent to distributor" },
  { status: "rejected", label: "Reject" },
  { status: "pending", label: "Move back to pending" },
];

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
          the files of releases you've already sent to the distributor to free up space.
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

const EMAILED_STATUSES = ["approved", "sent_to_distributor", "rejected"];

const SubmissionCard = ({
  submission,
  adminNote,
  fileBytes,
  signedUrls,
  onUpdate,
  onSaveNote,
  onRemoveFiles,
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
                {submission.artist_name} · submitted{" "}
                {new Date(submission.created_at).toLocaleString()}
              </p>
            </div>
            <StatusBadge status={submission.status} />
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
          ) : submission.status === "sent_to_distributor" ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-stone-300">
                This release is with the distributor. Once you've kept your own copy, you can
                delete the audio and poster here to free up storage.
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
              <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-500">
                Message to artist
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
            Approving, rejecting or marking it sent emails the artist at{" "}
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
      const [{ data, error }, notesResult] = await Promise.all([
        supabase.from("submissions").select("*").order("created_at", { ascending: false }),
        supabase.from("submission_admin_notes").select("submission_id, notes"),
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
      all: totals.all + 1,
    }),
    { all: 0 }
  );

  const visible = (submissions ?? []).filter(
    (submission) => filter === "all" || submission.status === filter
  );

  const submissionsTab = (
    <>
      {storageUsage ? <StorageMeter usage={storageUsage} /> : null}
      {notice ? (
        <p
          className="mb-6 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-5 py-3 text-sm text-emerald-100"
          aria-live="polite"
        >
          {notice}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
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
            {value === "all" ? "All" : STATUS_LABELS[value]} ({counts[value] ?? 0})
          </button>
        ))}
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
