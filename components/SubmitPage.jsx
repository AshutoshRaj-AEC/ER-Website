import { useEffect, useMemo, useState } from "react";
import { LoadingText, PageShell, Panel, SignInPrompt } from "./PageShell";
import StatusBadge from "./StatusBadge";
import { SUBMISSIONS_BUCKET, supabase } from "../lib/supabase";
import { bytesLeft, formatMegabytes, getUploadUsage, isStorageRefusal } from "../lib/uploadLimits";
import { readAudioInfo } from "../lib/audioInfo";
import { LEVELS, checkReadiness } from "../lib/readiness";

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const MAX_POSTER_BYTES = 10 * 1024 * 1024;

// Browsers often report an empty or non-standard type for WAV/FLAC, so the
// content type is chosen from the extension instead of file.type.
const AUDIO_TYPES = { wav: "audio/wav", flac: "audio/flac" };
const POSTER_TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

const GENRES = [
  "Hip-Hop/Rap",
  "Devotional",
  "Pop",
  "Indie",
  "Electronic",
  "Rock",
  "Folk",
  "R&B/Soul",
  "Lo-Fi",
  "Instrumental",
];

const LANGUAGES = [
  "Hindi",
  "English",
  "Punjabi",
  "Bhojpuri",
  "Haryanvi",
  "Sanskrit",
  "Instrumental (no lyrics)",
];

const createEmptyForm = (email = "") => ({
  artist_name: "",
  track_title: "",
  genre: "",
  release_date: "",
  contact_email: email,
  songwriters: "",
  producers: "",
  featured_artists: "",
  language: "",
  explicit: "",
  lyrics: "",
  isrc: "",
  upc: "",
});

// A saved submission, as form values (for editing after changes are requested).
const formFromSubmission = (submission) => ({
  artist_name: submission.artist_name ?? "",
  track_title: submission.track_title ?? "",
  genre: submission.genre ?? "",
  release_date: submission.release_date ?? "",
  contact_email: submission.contact_email ?? "",
  songwriters: submission.songwriters ?? "",
  producers: submission.producers ?? "",
  featured_artists: submission.featured_artists ?? "",
  language: submission.language ?? "",
  explicit: submission.explicit ? "yes" : "no",
  lyrics: submission.lyrics ?? "",
  isrc: submission.isrc ?? "",
  upc: submission.upc ?? "",
});

const getEditIdFromUrl = () => new URLSearchParams(window.location.search).get("edit");

const getExtension = (file) => file.name.split(".").pop().toLowerCase();

const formatSize = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const todayString = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
};

// Hard limits only; quality checks (specs, square, size) are readiness checks.
const fileTypeError = (file, kind) => {
  if (kind === "audio") {
    if (!AUDIO_TYPES[getExtension(file)]) return "Audio must be a WAV or FLAC file.";
    if (file.size > MAX_AUDIO_BYTES) {
      return `Audio must be 50 MB or smaller (this file is ${formatSize(file.size)}). FLAC is lossless and about half the size of WAV.`;
    }
  } else {
    if (!POSTER_TYPES[getExtension(file)]) return "The cover must be a JPG or PNG image.";
    if (file.size > MAX_POSTER_BYTES) return `The cover must be 10 MB or smaller (this file is ${formatSize(file.size)}).`;
  }
  return "";
};

const toNullableText = (value) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const buildSubmissionRow = (form) => ({
  artist_name: form.artist_name.trim(),
  track_title: form.track_title.trim(),
  genre: form.genre.trim(),
  release_date: form.release_date || null,
  contact_email: form.contact_email.trim(),
  songwriters: toNullableText(form.songwriters),
  producers: toNullableText(form.producers),
  featured_artists: toNullableText(form.featured_artists),
  language: toNullableText(form.language),
  explicit: form.explicit === "yes",
  lyrics: toNullableText(form.lyrics),
  isrc: toNullableText(form.isrc.toUpperCase().replace(/[^A-Z0-9]/g, "")),
  upc: toNullableText(form.upc.replace(/\D/g, "")),
});

const inputClass =
  "mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-stone-100 placeholder:text-stone-500 focus:border-orange-300 focus:outline-none";

const fileInputClass = `${inputClass} file:mr-4 file:rounded-full file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-[0.15em] file:text-white`;

const Field = ({ label, hint, required, children }) => {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-300">
        {label}
        {required ? <span className="text-orange-300"> *</span> : null}
      </span>
      {children}
      {hint ? (
        <span className="mt-2 block text-xs leading-5 text-stone-500">
          {hint}
        </span>
      ) : null}
    </label>
  );
};

const SectionHeading = ({ children }) => {
  return (
    <h2 className="mb-6 font-['Space_Grotesk'] text-xl font-bold uppercase tracking-[0.08em] text-white">
      {children}
    </h2>
  );
};

const STATUS_ICON = { fail: "✕", warn: "!", pass: "✓", info: "i" };
const STATUS_COLOR = {
  fail: "text-red-300",
  warn: "text-amber-200",
  pass: "text-emerald-300",
  info: "text-sky-200",
};

const ReadinessPanel = ({ readiness }) => {
  const groups = [
    { title: "Needs fixing before you can submit", items: readiness.failures },
    { title: "Worth checking", items: readiness.warnings },
    { title: "Good to know", items: readiness.checks.filter((check) => check.status === "info") },
  ];
  const passed = readiness.checks.filter((check) => check.status === "pass");

  return (
    <Panel className={readiness.ready ? "border-emerald-300/30" : ""}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-['Space_Grotesk'] text-xl font-bold uppercase tracking-[0.08em] text-white">
          Release readiness
        </h2>
        <p className={`text-sm font-semibold ${readiness.ready ? "text-emerald-300" : "text-red-300"}`} aria-live="polite">
          {readiness.ready
            ? readiness.warnings.length
              ? `Ready to submit · ${readiness.warnings.length} thing${readiness.warnings.length === 1 ? "" : "s"} worth checking`
              : "Ready to submit"
            : `${readiness.failures.length} thing${readiness.failures.length === 1 ? "" : "s"} to fix`}
        </p>
      </div>

      <div className="space-y-5">
        {groups.map((group) =>
          group.items.length ? (
            <div key={group.title}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-400">{group.title}</p>
              <ul className="mt-2 space-y-2">
                {group.items.map((check) => (
                  <li key={check.id} className="flex gap-3 text-sm leading-6">
                    <span aria-hidden="true" className={`w-4 shrink-0 text-center font-bold ${STATUS_COLOR[check.status]}`}>
                      {STATUS_ICON[check.status]}
                    </span>
                    <span>
                      <span className="font-semibold text-stone-100">{check.label}</span>
                      <span className="text-stone-500"> · {LEVELS[check.level]}</span>
                      <span className="block text-stone-300">{check.message}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null
        )}

        {passed.length ? (
          <details>
            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-300">
              {passed.length} check{passed.length === 1 ? "" : "s"} passed
            </summary>
            <ul className="mt-2 space-y-1 text-sm text-stone-400">
              {passed.map((check) => (
                <li key={check.id}>
                  <span aria-hidden="true" className="mr-2 text-emerald-300">✓</span>
                  {check.label}: {check.message}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      <p className="mt-5 text-xs leading-5 text-stone-500">
        These checks catch common problems early. Passing them doesn't guarantee a distributor or store will accept
        the release, and the label reviews every submission.
      </p>
    </Panel>
  );
};

const MySubmissions = ({ submissions, editingId }) => {
  return (
    <Panel>
      <SectionHeading>Your submissions</SectionHeading>
      {submissions === null ? (
        <LoadingText />
      ) : submissions.length === 0 ? (
        <p className="text-sm leading-6 text-stone-400">
          Nothing submitted yet. Your tracks and their review status will show
          up here.
        </p>
      ) : (
        <ul className="space-y-4">
          {submissions.map((submission) => (
            <li
              key={submission.id}
              className={`rounded-2xl border bg-black/30 p-4 ${submission.id === editingId ? "border-orange-400/60" : "border-white/10"}`}
            >
              <p className="font-semibold text-white">{submission.track_title}</p>
              <p className="mt-1 text-sm text-stone-400">
                {submission.artist_name} ·{" "}
                {new Date(submission.submitted_at ?? submission.created_at).toLocaleDateString()}
              </p>
              <div className="mt-3">
                <StatusBadge status={submission.status} />
              </div>
              {submission.artist_message ? (
                <div className="mt-3 border-l-2 border-orange-400 pl-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-200">
                    From the label
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-stone-300">
                    {submission.artist_message}
                  </p>
                </div>
              ) : null}
              {submission.status === "changes_requested" && submission.id !== editingId ? (
                <a
                  href={`/submit?edit=${submission.id}`}
                  className="mt-3 inline-flex rounded-full bg-orange-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white transition hover:bg-orange-400"
                >
                  Fix and resubmit
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
};

const SubmitPage = ({ session, authReady, onOpenAuth }) => {
  const user = session?.user;
  const [editId] = useState(getEditIdFromUrl);
  const [editing, setEditing] = useState(null);
  const [editError, setEditError] = useState("");
  const [form, setForm] = useState(() => createEmptyForm(user?.email));
  const [audio, setAudio] = useState(null);
  const [poster, setPoster] = useState(null);
  const [posterPreview, setPosterPreview] = useState("");
  const [fileErrors, setFileErrors] = useState({ audio: "", poster: "" });
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [lastSubmitted, setLastSubmitted] = useState(null);
  const [fileInputsKey, setFileInputsKey] = useState(0);
  const [submissions, setSubmissions] = useState(null);
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    document.title = editId ? "Fix and Resubmit | EklautA Records" : "Submit Music | EklautA Records";
  }, [editId]);

  // Fill the contact email once the user signs in on this page.
  useEffect(() => {
    if (user?.email && !editId) {
      setForm((current) =>
        current.contact_email
          ? current
          : { ...current, contact_email: user.email }
      );
    }
  }, [user?.email, editId]);

  useEffect(() => {
    if (!user?.id) {
      setSubmissions(null);
      return undefined;
    }

    let cancelled = false;

    supabase
      .from("submissions")
      .select("id, artist_name, track_title, status, created_at, submitted_at, artist_message")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error: loadError }) => {
        if (!cancelled) {
          setSubmissions(loadError ? [] : data);
        }
      });

    getUploadUsage().then((result) => {
      if (!cancelled) {
        setUsage(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id, lastSubmitted]);

  // Load the submission being corrected.
  useEffect(() => {
    if (!user?.id || !editId) {
      return undefined;
    }
    let cancelled = false;

    supabase
      .from("submissions")
      .select("*")
      .eq("id", editId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError || !data) {
          setEditError("This submission couldn't be found.");
        } else if (data.status !== "changes_requested") {
          setEditError("This submission can't be edited right now. Only submissions the label has sent back for changes can be resubmitted.");
        } else {
          setEditing(data);
          setForm(formFromSubmission(data));
          setAudio({ kept: true });
          setPoster({ kept: true });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, editId]);

  useEffect(() => {
    if (!poster?.file) {
      setPosterPreview("");
      return undefined;
    }

    const url = URL.createObjectURL(poster.file);
    setPosterPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [poster]);

  const readiness = useMemo(
    () => checkReadiness({ form, audio, poster, rightsConfirmed, today: todayString() }),
    [form, audio, poster, rightsConfirmed]
  );

  if (!authReady) {
    return (
      <PageShell eyebrow="Submit music" title="Send us your release">
        <LoadingText />
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell
        eyebrow="Submit music"
        title="Send us your release"
        intro="Artists can submit finished tracks to EklautA Records for review. Every submission is checked by the label before it goes to distribution."
      >
        <SignInPrompt
          message="Sign in with your Google account to submit a track and follow its review."
          onOpenAuth={onOpenAuth}
        />
      </PageShell>
    );
  }

  if (editId && !editing) {
    return (
      <PageShell eyebrow="Fix and resubmit" title="Update your release">
        {editError ? (
          <Panel className="max-w-xl">
            <p className="leading-7 text-stone-300">{editError}</p>
            <a href="/submit" className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.2em] text-orange-300 hover:text-orange-200">
              Submit a new track instead →
            </a>
          </Panel>
        ) : (
          <LoadingText />
        )}
      </PageShell>
    );
  }

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleAudioChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setAudio(editing ? { kept: true } : null);
      return;
    }
    const typeError = fileTypeError(file, "audio");
    setFileErrors((current) => ({ ...current, audio: typeError }));
    if (typeError) {
      setAudio(editing ? { kept: true } : null);
      return;
    }
    setAudio({ file, name: file.name, info: null });
    const info = await readAudioInfo(file);
    setAudio({ file, name: file.name, info });
  };

  const handlePosterChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setPoster(editing ? { kept: true } : null);
      return;
    }
    const typeError = fileTypeError(file, "poster");
    setFileErrors((current) => ({ ...current, poster: typeError }));
    if (typeError) {
      setPoster(editing ? { kept: true } : null);
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      setPoster({ file, width: bitmap.width, height: bitmap.height });
      bitmap.close();
    } catch {
      setFileErrors((current) => ({ ...current, poster: "Couldn't read this image. Try exporting it again as JPG or PNG." }));
      setPoster(editing ? { kept: true } : null);
    }
  };

  const uploadFile = async (bucket, path, file, types) => {
    const { error: uploadError } = await bucket.upload(path, file, { contentType: types[getExtension(file)] });
    if (uploadError) {
      throw uploadError;
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!readiness.ready) {
      setError("Fix the items under Release readiness first.");
      return;
    }
    setError("");

    const newBytes = (audio?.file?.size ?? 0) + (poster?.file?.size ?? 0);

    // Check the artist's limits before uploading anything.
    const latestUsage = await getUploadUsage();
    if (latestUsage) {
      setUsage(latestUsage);
      const { limits } = latestUsage;
      if (!editing && latestUsage.pending_submissions >= limits.max_pending_submissions) {
        setError(
          `You already have ${limits.max_pending_submissions} submissions waiting for review. Please wait for the label to review them before sending more.`
        );
        return;
      }
      if (!editing && latestUsage.submissions_today >= limits.max_submissions_per_day) {
        setError(`You can submit up to ${limits.max_submissions_per_day} tracks a day. Please try again tomorrow.`);
        return;
      }
      if (newBytes > bytesLeft(latestUsage, "submissions")) {
        setError(
          `This upload would go over your ${formatMegabytes(limits.bytes.submissions)} storage allowance for submissions. Contact the label at eklautarecords@gmail.com to free up space.`
        );
        return;
      }
    }

    const submissionId = editing?.id ?? crypto.randomUUID();
    const folder = `${user.id}/${submissionId}`;
    const stamp = editing ? `-${Date.now()}` : "";
    const bucket = supabase.storage.from(SUBMISSIONS_BUCKET);
    const audioPath = audio?.file ? `${folder}/audio${stamp}.${getExtension(audio.file)}` : editing?.audio_path;
    const posterPath = poster?.file ? `${folder}/poster${stamp}.${getExtension(poster.file)}` : editing?.poster_path;

    try {
      if (poster?.file) {
        setProgress("Uploading cover…");
        await uploadFile(bucket, posterPath, poster.file, POSTER_TYPES);
      }
      if (audio?.file) {
        setProgress(`Uploading audio (${formatSize(audio.file.size)}). This can take a few minutes…`);
        await uploadFile(bucket, audioPath, audio.file, AUDIO_TYPES);
      }

      setProgress(editing ? "Resubmitting…" : "Saving your submission…");
      if (editing) {
        const { error: updateError } = await supabase
          .from("submissions")
          .update({ ...buildSubmissionRow(form), audio_path: audioPath, poster_path: posterPath, status: "pending" })
          .eq("id", editing.id);
        if (updateError) throw updateError;

        // The old files are no longer used; remove them so they don't take up space.
        const replaced = [
          audio?.file ? editing.audio_path : null,
          poster?.file ? editing.poster_path : null,
        ].filter(Boolean);
        if (replaced.length) {
          await bucket.remove(replaced);
        }
      } else {
        const { error: insertError } = await supabase.from("submissions").insert({
          id: submissionId,
          ...buildSubmissionRow(form),
          audio_path: audioPath,
          poster_path: posterPath,
        });
        if (insertError) throw insertError;
      }

      setLastSubmitted({ id: submissionId, track_title: form.track_title.trim(), resubmitted: Boolean(editing) });
      if (editing) {
        setEditing(null);
        window.history.replaceState({}, "", "/submit");
      }
      setForm(createEmptyForm(user.email));
      setAudio(null);
      setPoster(null);
      setRightsConfirmed(false);
      setFileInputsKey((current) => current + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      console.error(submitError);
      setError(
        submitError.hint === "submission_limit"
          ? submitError.message
          : /maximum allowed size/i.test(submitError.message ?? "")
            ? "That file is too large to upload. Audio must be 50 MB or smaller."
            : isStorageRefusal(submitError)
              ? "You've reached your storage allowance for submissions. Contact the label at eklautarecords@gmail.com to free up space."
              : "Something went wrong while submitting. Please check your connection and try again."
      );
    } finally {
      setProgress("");
    }
  };

  const submitting = Boolean(progress);
  const audioInfo = audio?.info && !audio.info.error ? audio.info : null;

  return (
    <PageShell
      eyebrow={editing ? "Fix and resubmit" : "Submit music"}
      title={editing ? `Update “${editing.track_title}”` : "Send us your release"}
      intro={
        editing
          ? "Make the changes the label asked for, check the readiness panel, and resubmit. You only need to upload new files if they changed."
          : "Fill in the release details and upload your master audio and cover poster. The label reviews every submission before sending it to distribution."
      }
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {lastSubmitted ? (
            <Panel className="border-emerald-300/30 bg-emerald-300/10">
              <p className="font-semibold text-emerald-100">
                “{lastSubmitted.track_title}” is {lastSubmitted.resubmitted ? "back with the label" : "in for review"}.
              </p>
              <p className="mt-2 text-sm leading-6 text-emerald-100/80">
                The label has been notified. You can follow its status under
                Your submissions.
              </p>
              <a
                href="/dashboard?tab=plans"
                className="mt-4 inline-flex rounded-full border border-emerald-200/40 px-5 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-emerald-100 transition hover:border-emerald-100"
              >
                Plan this release
              </a>
            </Panel>
          ) : null}

          {editing?.artist_message ? (
            <Panel className="border-fuchsia-300/30 bg-fuchsia-300/10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-fuchsia-200">The label asked for changes</p>
              <p className="mt-2 whitespace-pre-wrap leading-7 text-stone-100">{editing.artist_message}</p>
            </Panel>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <fieldset disabled={submitting} className="space-y-6">
              <Panel>
                <SectionHeading>Release info</SectionHeading>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="Artist name" required>
                    <input
                      maxLength={200}
                      value={form.artist_name}
                      onChange={updateField("artist_name")}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Track title" required hint="Just the song name. Featured artists go under Credits.">
                    <input
                      maxLength={200}
                      value={form.track_title}
                      onChange={updateField("track_title")}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Genre" required>
                    <input
                      maxLength={100}
                      list="genre-options"
                      value={form.genre}
                      onChange={updateField("genre")}
                      className={inputClass}
                    />
                    <datalist id="genre-options">
                      {GENRES.map((genre) => (
                        <option key={genre} value={genre} />
                      ))}
                    </datalist>
                  </Field>
                  <Field
                    label="Preferred release date"
                    hint="Leave at least 3 weeks for review and distribution."
                  >
                    <input
                      type="date"
                      min={todayString()}
                      value={form.release_date}
                      onChange={updateField("release_date")}
                      className={`${inputClass} [color-scheme:dark]`}
                    />
                  </Field>
                  <Field
                    label="Contact email"
                    required
                    hint="The label will reply here about this release."
                  >
                    <input
                      type="email"
                      maxLength={320}
                      value={form.contact_email}
                      onChange={updateField("contact_email")}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </Panel>

              <Panel>
                <SectionHeading>Credits</SectionHeading>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="Songwriters" required hint="Real names, separated by commas.">
                    <input
                      maxLength={1000}
                      value={form.songwriters}
                      onChange={updateField("songwriters")}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Producers" hint="Separate names with commas.">
                    <input
                      maxLength={1000}
                      value={form.producers}
                      onChange={updateField("producers")}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Featured artists" hint="Separate names with commas.">
                    <input
                      maxLength={1000}
                      value={form.featured_artists}
                      onChange={updateField("featured_artists")}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </Panel>

              <Panel>
                <SectionHeading>Lyrics & language</SectionHeading>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="Language">
                    <input
                      maxLength={100}
                      list="language-options"
                      value={form.language}
                      onChange={updateField("language")}
                      className={inputClass}
                    />
                    <datalist id="language-options">
                      {LANGUAGES.map((language) => (
                        <option key={language} value={language} />
                      ))}
                    </datalist>
                  </Field>
                  <fieldset>
                    <legend className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-300">
                      Explicit content<span className="text-orange-300"> *</span>
                    </legend>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {[
                        { value: "no", label: "No, it's clean" },
                        { value: "yes", label: "Yes, explicit" },
                      ].map((option) => (
                        <label
                          key={option.value}
                          className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-4 py-3 text-sm transition ${
                            form.explicit === option.value ? "border-orange-400 bg-orange-500/10 text-white" : "border-white/10 bg-black/30 text-stone-300"
                          }`}
                        >
                          <input
                            type="radio"
                            name="explicit"
                            value={option.value}
                            checked={form.explicit === option.value}
                            onChange={updateField("explicit")}
                            className="accent-orange-500"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
                <div className="mt-6">
                  <Field label="Lyrics">
                    <textarea
                      rows={8}
                      maxLength={20000}
                      value={form.lyrics}
                      onChange={updateField("lyrics")}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </Panel>

              <Panel>
                <SectionHeading>Existing IDs (optional)</SectionHeading>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field
                    label="ISRC"
                    hint="Only if this recording already has one, e.g. INABC2600001."
                  >
                    <input
                      maxLength={15}
                      value={form.isrc}
                      onChange={updateField("isrc")}
                      className={`${inputClass} uppercase`}
                    />
                  </Field>
                  <Field label="UPC" hint="Only if this release already has one.">
                    <input
                      inputMode="numeric"
                      maxLength={13}
                      value={form.upc}
                      onChange={updateField("upc")}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </Panel>

              <Panel>
                <SectionHeading>Files</SectionHeading>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field
                    label={editing ? "Master audio (optional: replace)" : "Master audio"}
                    required={!editing}
                    hint="WAV or FLAC, up to 50 MB. 16-bit / 44.1 kHz or higher."
                  >
                    <input
                      key={`audio-${fileInputsKey}`}
                      type="file"
                      accept=".wav,.flac,audio/wav,audio/flac"
                      onChange={handleAudioChange}
                      className={fileInputClass}
                    />
                    {fileErrors.audio ? (
                      <span className="mt-2 block text-sm text-red-300">{fileErrors.audio}</span>
                    ) : null}
                    {audio?.file ? (
                      <span className="mt-2 block text-sm text-stone-400">
                        {audio.file.name} · {formatSize(audio.file.size)}
                        {audio.info === null ? " · reading…" : audioInfo ? ` · ${audioInfo.sampleRate / 1000} kHz / ${audioInfo.bitsPerSample}-bit` : ""}
                      </span>
                    ) : editing ? (
                      <span className="mt-2 block text-sm text-stone-500">Keeping your current audio.</span>
                    ) : null}
                  </Field>
                  <Field
                    label={editing ? "Cover (optional: replace)" : "Cover poster"}
                    required={!editing}
                    hint="Square JPG or PNG, at least 1400×1400 (3000×3000 recommended), up to 10 MB."
                  >
                    <input
                      key={`poster-${fileInputsKey}`}
                      type="file"
                      accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                      onChange={handlePosterChange}
                      className={fileInputClass}
                    />
                    {fileErrors.poster ? (
                      <span className="mt-2 block text-sm text-red-300">{fileErrors.poster}</span>
                    ) : null}
                    {posterPreview ? (
                      <img
                        src={posterPreview}
                        alt="Cover preview"
                        className="mt-4 h-32 w-32 rounded-2xl object-cover"
                      />
                    ) : editing ? (
                      <span className="mt-2 block text-sm text-stone-500">Keeping your current cover.</span>
                    ) : null}
                  </Field>
                </div>
              </Panel>

              <label className="flex items-start gap-3 text-sm leading-6 text-stone-300">
                <input
                  type="checkbox"
                  checked={rightsConfirmed}
                  onChange={(event) => setRightsConfirmed(event.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 accent-orange-500"
                />
                I own or control the rights to this recording, its lyrics and
                the cover artwork, and everyone credited has agreed to this
                release.
              </label>
            </fieldset>

            <ReadinessPanel readiness={readiness} />

            {error ? <p className="text-sm text-red-300">{error}</p> : null}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={submitting || !readiness.ready}
                className="rounded-full bg-orange-500 px-8 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Submitting…" : editing ? "Resubmit for review" : "Submit for review"}
              </button>
              {progress ? (
                <p className="text-sm text-stone-400" aria-live="polite">
                  {progress}
                </p>
              ) : !readiness.ready ? (
                <p className="text-sm text-stone-400">Fix the items under Release readiness to submit.</p>
              ) : null}
            </div>
            {usage && !editing ? (
              <p className="text-xs text-stone-500">
                You have {usage.pending_submissions} of {usage.limits.max_pending_submissions} submissions waiting
                for review, and can send up to {usage.limits.max_submissions_per_day} a day.
              </p>
            ) : null}
          </form>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <MySubmissions submissions={submissions} editingId={editing?.id} />
        </aside>
      </div>
    </PageShell>
  );
};

export default SubmitPage;
