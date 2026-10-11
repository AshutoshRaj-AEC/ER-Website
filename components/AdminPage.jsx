import { useEffect, useState } from "react";
import { LoadingText, PageShell, Panel, SignInPrompt } from "./PageShell";
import StatusBadge from "./StatusBadge";
import { STATUS_LABELS, SUBMISSIONS_BUCKET, supabase } from "../lib/supabase";

const FILTERS = ["pending", "approved", "sent_to_distributor", "rejected", "all"];

const STATUS_ACTIONS = [
  { status: "approved", label: "Approve" },
  { status: "sent_to_distributor", label: "Mark sent to distributor" },
  { status: "rejected", label: "Reject" },
  { status: "pending", label: "Move back to pending" },
];

const SIGNED_URL_SECONDS = 60 * 60;

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

const SubmissionCard = ({ submission, signedUrls, onUpdate }) => {
  const [notes, setNotes] = useState(submission.admin_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const posterUrl = signedUrls[submission.poster_path];
  const audioUrl = signedUrls[submission.audio_path];
  const notesChanged = notes !== (submission.admin_notes ?? "");

  const save = async (changes) => {
    setSaving(true);
    setMessage("");
    const error = await onUpdate(submission.id, {
      ...changes,
      admin_notes: notes.trim() ? notes.trim() : null,
    });
    setSaving(false);
    setMessage(error ? "Couldn't save. Please try again." : "Saved.");
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
          {posterUrl ? (
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

          {audioUrl ? (
            <audio
              controls
              preload="none"
              src={audioUrl}
              className="mt-6 w-full"
            />
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
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
            <button type="button" onClick={copyDetails} className={smallButtonClass}>
              Copy details
            </button>
          </div>

          <label className="mt-6 block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-500">
              Notes (only admins see these)
            </span>
            <textarea
              rows={2}
              maxLength={5000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-stone-100 focus:border-orange-300 focus:outline-none"
            />
          </label>

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
            {notesChanged ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => save({})}
                className={smallButtonClass}
              >
                Save notes
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

const AdminPage = ({ session, authReady, isAdmin, onOpenAuth }) => {
  const [submissions, setSubmissions] = useState(null);
  const [signedUrls, setSignedUrls] = useState({});
  const [filter, setFilter] = useState("pending");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    document.title = "Review Submissions | EklautA Records";
  }, []);

  useEffect(() => {
    if (isAdmin !== true) {
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (cancelled) {
        return;
      }

      if (error) {
        setLoadError("Couldn't load submissions. Refresh to try again.");
        setSubmissions([]);
        return;
      }

      setSubmissions(data);

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

  return (
    <PageShell
      eyebrow="Admin"
      title={title}
      intro="Listen, check the details, then download the audio and poster for your distributor. Artists see the status you set here."
    >
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
              onUpdate={updateSubmission}
            />
          ))
        )}
      </div>
    </PageShell>
  );
};

export default AdminPage;
