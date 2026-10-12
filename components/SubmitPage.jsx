import { useEffect, useState } from "react";
import { LoadingText, PageShell, Panel, SignInPrompt } from "./PageShell";
import StatusBadge from "./StatusBadge";
import { SUBMISSIONS_BUCKET, supabase } from "../lib/supabase";

const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const MAX_POSTER_BYTES = 10 * 1024 * 1024;
const MIN_POSTER_PIXELS = 1400;

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
  explicit: false,
  lyrics: "",
  isrc: "",
  upc: "",
});

const getExtension = (file) => file.name.split(".").pop().toLowerCase();

const formatSize = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const todayString = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
};

const validateAudio = (file) => {
  if (!AUDIO_TYPES[getExtension(file)]) {
    return "Audio must be a WAV or FLAC file.";
  }

  if (file.size > MAX_AUDIO_BYTES) {
    return `Audio must be 50 MB or smaller (this file is ${formatSize(file.size)}). FLAC is lossless and about half the size of WAV.`;
  }

  return "";
};

const validatePoster = async (file) => {
  if (!POSTER_TYPES[getExtension(file)]) {
    return "Poster must be a JPG or PNG image.";
  }

  if (file.size > MAX_POSTER_BYTES) {
    return `Poster must be 10 MB or smaller (this file is ${formatSize(file.size)}).`;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    bitmap.close();

    if (width !== height) {
      return `Poster must be square (this one is ${width}×${height}).`;
    }

    if (width < MIN_POSTER_PIXELS) {
      return `Poster must be at least ${MIN_POSTER_PIXELS}×${MIN_POSTER_PIXELS} pixels (this one is ${width}×${height}).`;
    }
  } catch {
    return "Couldn't read this image. Try exporting it again as JPG or PNG.";
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
  explicit: form.explicit,
  lyrics: toNullableText(form.lyrics),
  isrc: toNullableText(form.isrc.toUpperCase().replace(/[^A-Z0-9]/g, "")),
  upc: toNullableText(form.upc.replace(/\D/g, "")),
});

const inputClass =
  "mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-stone-100 placeholder:text-stone-500 focus:border-orange-300 focus:outline-none";

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

const MySubmissions = ({ submissions }) => {
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
              className="rounded-2xl border border-white/10 bg-black/30 p-4"
            >
              <p className="font-semibold text-white">{submission.track_title}</p>
              <p className="mt-1 text-sm text-stone-400">
                {submission.artist_name} ·{" "}
                {new Date(submission.created_at).toLocaleDateString()}
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
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
};

const SubmitPage = ({ session, authReady, onOpenAuth }) => {
  const user = session?.user;
  const [form, setForm] = useState(() => createEmptyForm(user?.email));
  const [audioFile, setAudioFile] = useState(null);
  const [posterFile, setPosterFile] = useState(null);
  const [posterPreview, setPosterPreview] = useState("");
  const [fileErrors, setFileErrors] = useState({ audio: "", poster: "" });
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [lastSubmitted, setLastSubmitted] = useState(null);
  const [fileInputsKey, setFileInputsKey] = useState(0);
  const [submissions, setSubmissions] = useState(null);

  useEffect(() => {
    document.title = "Submit Music | EklautA Records";
  }, []);

  // Fill the contact email once the user signs in on this page.
  useEffect(() => {
    if (user?.email) {
      setForm((current) =>
        current.contact_email
          ? current
          : { ...current, contact_email: user.email }
      );
    }
  }, [user?.email]);

  useEffect(() => {
    if (!user?.id) {
      setSubmissions(null);
      return undefined;
    }

    let cancelled = false;

    supabase
      .from("submissions")
      .select("id, artist_name, track_title, status, created_at, artist_message")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error: loadError }) => {
        if (!cancelled) {
          setSubmissions(loadError ? [] : data);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, lastSubmitted]);

  useEffect(() => {
    if (!posterFile) {
      setPosterPreview("");
      return undefined;
    }

    const url = URL.createObjectURL(posterFile);
    setPosterPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [posterFile]);

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

  const updateField = (field) => (event) => {
    const value =
      event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleAudioChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setAudioFile(null);
      return;
    }

    const audioError = validateAudio(file);
    setFileErrors((current) => ({ ...current, audio: audioError }));
    setAudioFile(audioError ? null : file);
  };

  const handlePosterChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setPosterFile(null);
      return;
    }

    const posterError = await validatePoster(file);
    setFileErrors((current) => ({ ...current, poster: posterError }));
    setPosterFile(posterError ? null : file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!audioFile || !posterFile) {
      setError("Add a valid audio file and poster before submitting.");
      return;
    }

    setError("");

    const submissionId = crypto.randomUUID();
    const folder = `${user.id}/${submissionId}`;
    const audioExtension = getExtension(audioFile);
    const posterExtension = getExtension(posterFile);
    const audioPath = `${folder}/audio.${audioExtension}`;
    const posterPath = `${folder}/poster.${posterExtension}`;
    const bucket = supabase.storage.from(SUBMISSIONS_BUCKET);

    try {
      setProgress("Uploading poster…");
      const posterUpload = await bucket.upload(posterPath, posterFile, {
        contentType: POSTER_TYPES[posterExtension],
      });
      if (posterUpload.error) {
        throw posterUpload.error;
      }

      setProgress(
        `Uploading audio (${formatSize(audioFile.size)}). This can take a few minutes…`
      );
      const audioUpload = await bucket.upload(audioPath, audioFile, {
        contentType: AUDIO_TYPES[audioExtension],
      });
      if (audioUpload.error) {
        throw audioUpload.error;
      }

      setProgress("Saving your submission…");
      const { error: insertError } = await supabase.from("submissions").insert({
        id: submissionId,
        ...buildSubmissionRow(form),
        audio_path: audioPath,
        poster_path: posterPath,
      });
      if (insertError) {
        throw insertError;
      }

      setLastSubmitted({ id: submissionId, track_title: form.track_title.trim() });
      setForm(createEmptyForm(user.email));
      setAudioFile(null);
      setPosterFile(null);
      setRightsConfirmed(false);
      setFileInputsKey((current) => current + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      console.error(submitError);
      setError(
        /maximum allowed size/i.test(submitError.message ?? "")
          ? "That file is too large to upload. Audio must be 50 MB or smaller."
          : "Something went wrong while submitting. Please check your connection and try again."
      );
    } finally {
      setProgress("");
    }
  };

  const submitting = Boolean(progress);

  return (
    <PageShell
      eyebrow="Submit music"
      title="Send us your release"
      intro="Fill in the release details and upload your master audio and cover poster. The label reviews every submission before sending it to distribution."
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {lastSubmitted ? (
            <Panel className="border-emerald-300/30 bg-emerald-300/10">
              <p className="font-semibold text-emerald-100">
                “{lastSubmitted.track_title}” is in for review.
              </p>
              <p className="mt-2 text-sm leading-6 text-emerald-100/80">
                The label has been notified. You can follow its status under
                Your submissions.
              </p>
              <a
                href="/dashboard"
                className="mt-4 inline-flex rounded-full border border-emerald-200/40 px-5 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-emerald-100 transition hover:border-emerald-100"
              >
                Plan this release's budget
              </a>
            </Panel>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-6">
            <fieldset disabled={submitting} className="space-y-6">
              <Panel>
                <SectionHeading>Release info</SectionHeading>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="Artist name" required>
                    <input
                      required
                      maxLength={200}
                      value={form.artist_name}
                      onChange={updateField("artist_name")}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Track title" required>
                    <input
                      required
                      maxLength={200}
                      value={form.track_title}
                      onChange={updateField("track_title")}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Genre" required>
                    <input
                      required
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
                      required
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
                  <Field label="Songwriters" hint="Separate names with commas.">
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
                  <label className="flex items-center gap-3 self-end rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-stone-200">
                    <input
                      type="checkbox"
                      checked={form.explicit}
                      onChange={updateField("explicit")}
                      className="h-4 w-4 accent-orange-500"
                    />
                    Contains explicit content
                  </label>
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
                      pattern="[A-Za-z]{2}-?[A-Za-z0-9]{3}-?[0-9]{2}-?[0-9]{5}"
                      title="12 characters: 2 letters, 3 letters or digits, then 7 digits."
                      value={form.isrc}
                      onChange={updateField("isrc")}
                      className={`${inputClass} uppercase`}
                    />
                  </Field>
                  <Field label="UPC" hint="Only if this release already has one.">
                    <input
                      inputMode="numeric"
                      maxLength={13}
                      pattern="[0-9]{12,13}"
                      title="12 or 13 digits."
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
                    label="Master audio"
                    required
                    hint="WAV or FLAC, up to 50 MB. 16-bit / 44.1 kHz or higher."
                  >
                    <input
                      key={`audio-${fileInputsKey}`}
                      required
                      type="file"
                      accept=".wav,.flac,audio/wav,audio/flac"
                      onChange={handleAudioChange}
                      className={`${inputClass} file:mr-4 file:rounded-full file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-[0.15em] file:text-white`}
                    />
                    {fileErrors.audio ? (
                      <span className="mt-2 block text-sm text-red-300">
                        {fileErrors.audio}
                      </span>
                    ) : null}
                    {audioFile ? (
                      <span className="mt-2 block text-sm text-stone-400">
                        {audioFile.name} · {formatSize(audioFile.size)}
                      </span>
                    ) : null}
                  </Field>
                  <Field
                    label="Cover poster"
                    required
                    hint="Square JPG or PNG, at least 1400×1400 (3000×3000 recommended), up to 10 MB."
                  >
                    <input
                      key={`poster-${fileInputsKey}`}
                      required
                      type="file"
                      accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                      onChange={handlePosterChange}
                      className={`${inputClass} file:mr-4 file:rounded-full file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-[0.15em] file:text-white`}
                    />
                    {fileErrors.poster ? (
                      <span className="mt-2 block text-sm text-red-300">
                        {fileErrors.poster}
                      </span>
                    ) : null}
                    {posterPreview ? (
                      <img
                        src={posterPreview}
                        alt="Poster preview"
                        className="mt-4 h-32 w-32 rounded-2xl object-cover"
                      />
                    ) : null}
                  </Field>
                </div>
              </Panel>

              <label className="flex items-start gap-3 text-sm leading-6 text-stone-300">
                <input
                  required
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

            {error ? <p className="text-sm text-red-300">{error}</p> : null}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-orange-500 px-8 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-orange-400 disabled:cursor-wait disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit for review"}
              </button>
              {progress ? (
                <p className="text-sm text-stone-400" aria-live="polite">
                  {progress}
                </p>
              ) : null}
            </div>
          </form>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <MySubmissions submissions={submissions} />
        </aside>
      </div>
    </PageShell>
  );
};

export default SubmitPage;
