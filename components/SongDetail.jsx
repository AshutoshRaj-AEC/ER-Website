import { useEffect, useState } from "react";
import { AutoSaveInput, AutoSaveTextarea, fieldClass } from "./AutoSaveField";
import { LoadingText, Panel } from "./PageShell";
import VoiceRecorder from "./VoiceRecorder";
import { supabase } from "../lib/supabase";
import {
  DEMO_TYPES,
  IDEA_KINDS,
  MAX_AUDIO_BYTES,
  MUSICAL_KEYS,
  RECORDING_EXTENSIONS,
  SONG_STATUSES,
  SONG_VAULT_BUCKET,
  baseMimeType,
  formatDateTime,
  formatSize,
  getIdeaLabel,
  getStatusLabel,
  getStatusStep,
} from "../lib/songVault";

const labelClass =
  "text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-400";

const primaryButtonClass =
  "rounded-full bg-orange-500 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-orange-400 disabled:opacity-50";

const smallButtonClass =
  "text-xs font-semibold uppercase tracking-[0.15em] transition";

const SIGNED_URL_SECONDS = 60 * 60;
const HISTORY_PREVIEW = 12;

const SectionHeading = ({ children, aside }) => {
  return (
    <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="font-['Space_Grotesk'] text-xl font-bold uppercase tracking-[0.08em] text-white">
        {children}
      </h2>
      {aside}
    </div>
  );
};

const StatusStepper = ({ status, onChange }) => {
  const currentStep = getStatusStep(status);

  return (
    <ol className="flex flex-wrap gap-2 sm:grid sm:grid-cols-5" aria-label="Song status">
      {SONG_STATUSES.map((option, index) => {
        const reached = index <= currentStep;
        const current = index === currentStep;

        return (
          <li key={option.value}>
            <button
              type="button"
              aria-current={current ? "step" : undefined}
              onClick={() => onChange(option.value)}
              className={`rounded-full border px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] transition sm:w-full sm:rounded-2xl sm:px-2 sm:py-3 sm:text-xs ${
                current
                  ? "border-orange-400 bg-orange-500 text-white"
                  : reached
                    ? "border-orange-400/40 bg-orange-500/10 text-orange-100"
                    : "border-white/10 text-stone-400 hover:border-orange-300/60 hover:text-orange-200"
              }`}
            >
              {option.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
};

const LyricsEditor = ({ versions, onSaveVersion, onDirtyChange }) => {
  const latest = versions[0];
  const [draft, setDraft] = useState(latest?.content ?? "");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [openVersionId, setOpenVersionId] = useState(null);

  useEffect(() => {
    setDraft(latest?.content ?? "");
  }, [latest?.id]);

  const dirty = draft !== (latest?.content ?? "");

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const save = async () => {
    setSaving(true);
    const saved = await onSaveVersion(draft, label.trim() || null);
    setSaving(false);
    if (saved) {
      setLabel("");
    }
  };

  const restore = async (version, number) => {
    setSaving(true);
    await onSaveVersion(version.content, `Restored from v${number}`);
    setSaving(false);
    setOpenVersionId(null);
  };

  return (
    <Panel>
      <SectionHeading
        aside={
          <p className="text-sm text-stone-400">
            {versions.length === 0
              ? "Every save keeps a new version."
              : `${versions.length} version${versions.length === 1 ? "" : "s"} saved`}
          </p>
        }
      >
        Lyrics
      </SectionHeading>

      <textarea
        aria-label="Lyrics"
        rows={14}
        maxLength={50000}
        placeholder="Write your lyrics here…"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        className={`${fieldClass} font-mono text-sm leading-7`}
      />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          maxLength={120}
          placeholder="Version note (optional), e.g. new second verse"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          className={`${fieldClass} sm:max-w-sm`}
        />
        <button
          type="button"
          disabled={!dirty || saving || !draft.trim()}
          onClick={save}
          className={primaryButtonClass}
        >
          {saving ? "Saving…" : "Save as new version"}
        </button>
        {dirty ? <span className="text-xs text-amber-200">Unsaved changes</span> : null}
      </div>

      {versions.length > 0 ? (
        <ol className="mt-8 space-y-2">
          {versions.map((version, index) => {
            const number = versions.length - index;
            const open = openVersionId === version.id;

            return (
              <li key={version.id} className="rounded-2xl border border-white/10 bg-black/20">
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <p className="text-sm text-stone-200">
                    <span className="font-semibold text-white">v{number}</span>
                    {index === 0 ? <span className="text-orange-300"> · current</span> : null}
                    {version.label ? <span className="text-stone-400"> · {version.label}</span> : null}
                    <span className="block text-xs text-stone-500 sm:inline">
                      <span className="hidden sm:inline"> · </span>
                      {formatDateTime(version.created_at)}
                    </span>
                  </p>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenVersionId(open ? null : version.id)}
                      className={`${smallButtonClass} text-orange-300 hover:text-orange-200`}
                    >
                      {open ? "Hide" : "View"}
                    </button>
                    {index === 0 ? null : (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => restore(version, number)}
                        className={`${smallButtonClass} text-stone-400 hover:text-orange-200`}
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </div>
                {open ? (
                  <pre className="whitespace-pre-wrap border-t border-white/10 px-4 py-4 font-mono text-sm leading-7 text-stone-300">
                    {version.content}
                  </pre>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </Panel>
  );
};

const Ideas = ({ ideas, onAdd, onDelete }) => {
  const [kind, setKind] = useState("hook");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const saved = await onAdd(kind, content.trim());
    setSaving(false);
    if (saved) {
      setContent("");
    }
  };

  return (
    <Panel>
      <SectionHeading>Hooks, verses & ideas</SectionHeading>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Type of idea">
          {IDEA_KINDS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={kind === option.value}
              onClick={() => setKind(option.value)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                kind === option.value
                  ? "border-orange-400 bg-orange-500 text-white"
                  : "border-white/15 text-stone-300 hover:border-orange-300 hover:text-orange-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <textarea
          required
          rows={3}
          maxLength={10000}
          placeholder="Write it down before it's gone…"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          className={`${fieldClass} text-sm leading-7`}
        />
        <button type="submit" disabled={saving || !content.trim()} className={primaryButtonClass}>
          {saving ? "Saving…" : `Save ${getIdeaLabel(kind).toLowerCase()}`}
        </button>
      </form>

      {ideas.length > 0 ? (
        <ul className="mt-8 space-y-3">
          {ideas.map((idea) => (
            <li key={idea.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-start justify-between gap-4">
                <span className="rounded-full border border-orange-300/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-200">
                  {getIdeaLabel(idea.kind)}
                </span>
                <button
                  type="button"
                  onClick={() => onDelete(idea)}
                  className={`${smallButtonClass} text-stone-500 hover:text-red-300`}
                >
                  Delete
                </button>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-stone-200">{idea.content}</p>
              <p className="mt-2 text-xs text-stone-500">{formatDateTime(idea.created_at)}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
};

const DemoUpload = ({ onUpload }) => {
  const [file, setFile] = useState(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  const handleFileChange = (event) => {
    const nextFile = event.target.files?.[0] ?? null;
    setError("");
    if (!nextFile) {
      setFile(null);
      return;
    }
    const extension = nextFile.name.split(".").pop().toLowerCase();
    if (!DEMO_TYPES[extension]) {
      setError("Demos can be MP3, WAV, M4A, AAC, FLAC, OGG or WebM.");
      setFile(null);
      return;
    }
    if (nextFile.size > MAX_AUDIO_BYTES) {
      setError(`Demos must be 25 MB or smaller (this one is ${formatSize(nextFile.size)}). Try exporting an MP3.`);
      setFile(null);
      return;
    }
    setFile(nextFile);
  };

  const upload = async () => {
    setSaving(true);
    const saved = await onUpload(file, label.trim());
    setSaving(false);
    if (saved) {
      setFile(null);
      setLabel("");
      setInputKey((current) => current + 1);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-300">Demo</p>
      <input
        key={inputKey}
        type="file"
        accept=".mp3,.wav,.m4a,.aac,.flac,.ogg,.webm,audio/*"
        onChange={handleFileChange}
        className={`${fieldClass} mt-4 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-orange-500 file:px-4 file:py-2 file:text-xs file:font-semibold file:uppercase file:tracking-[0.15em] file:text-white`}
      />
      <p className="mt-2 text-xs text-stone-500">MP3, WAV, M4A, FLAC and more, up to 25 MB.</p>
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
      {file ? (
        <div className="mt-4 space-y-3">
          <input
            maxLength={120}
            placeholder="Name this demo (optional), e.g. rough mix 2"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className={fieldClass}
          />
          <button type="button" disabled={saving} onClick={upload} className={primaryButtonClass}>
            {saving ? "Uploading…" : `Upload ${formatSize(file.size)}`}
          </button>
        </div>
      ) : null}
    </div>
  );
};

const AudioSection = ({ audio, signedUrls, onSaveRecording, onUploadDemo, onDelete }) => {
  return (
    <Panel>
      <SectionHeading>Voice notes & demos</SectionHeading>
      <div className="grid gap-4 lg:grid-cols-2">
        <VoiceRecorder onSave={onSaveRecording} />
        <DemoUpload onUpload={onUploadDemo} />
      </div>

      {audio.length > 0 ? (
        <ul className="mt-8 space-y-3">
          {audio.map((item) => (
            <li key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-sm text-stone-200">
                  <span className="mr-2 rounded-full border border-orange-300/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-200">
                    {item.kind === "voice_note" ? "Voice note" : "Demo"}
                  </span>
                  {item.label ? <span className="font-semibold text-white">{item.label}</span> : null}
                </p>
                <button
                  type="button"
                  onClick={() => onDelete(item)}
                  className={`${smallButtonClass} text-stone-500 hover:text-red-300`}
                >
                  Delete
                </button>
              </div>
              {signedUrls[item.storage_path] ? (
                <audio
                  controls
                  preload="none"
                  src={signedUrls[item.storage_path]}
                  className="mt-3 w-full"
                />
              ) : (
                <p className="mt-3 text-xs text-stone-500">Loading audio…</p>
              )}
              <p className="mt-2 text-xs text-stone-500">
                {formatDateTime(item.created_at)}
                {item.size_bytes ? ` · ${formatSize(item.size_bytes)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
};

const buildHistory = ({ statusHistory, versions, ideas, audio }) => {
  const versionCount = versions.length;

  return [
    ...statusHistory.map((entry, index) => ({
      id: `status-${entry.id}`,
      at: entry.changed_at,
      text:
        index === 0
          ? `Song started as ${getStatusLabel(entry.status)}`
          : `Moved to ${getStatusLabel(entry.status)}`,
    })),
    ...versions.map((version, index) => ({
      id: `lyrics-${version.id}`,
      at: version.created_at,
      text: `Saved lyrics v${versionCount - index}${version.label ? `: ${version.label}` : ""}`,
    })),
    ...ideas.map((idea) => ({
      id: `idea-${idea.id}`,
      at: idea.created_at,
      text: `Added a ${getIdeaLabel(idea.kind).toLowerCase()}: “${idea.content.slice(0, 60)}${idea.content.length > 60 ? "…" : ""}”`,
    })),
    ...audio.map((item) => ({
      id: `audio-${item.id}`,
      at: item.created_at,
      text: `${item.kind === "voice_note" ? "Recorded a voice note" : "Added a demo"}${item.label ? `: ${item.label}` : ""}`,
    })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
};

const CreativeHistory = ({ events }) => {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? events : events.slice(0, HISTORY_PREVIEW);

  return (
    <Panel>
      <SectionHeading>Creative history</SectionHeading>
      <ol className="relative space-y-5 border-l border-white/10 pl-6">
        {visible.map((event) => (
          <li key={event.id} className="relative">
            <span
              className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-stone-950 bg-orange-400"
              aria-hidden="true"
            />
            <p className="text-sm text-stone-200">{event.text}</p>
            <p className="mt-1 text-xs text-stone-500">{formatDateTime(event.at)}</p>
          </li>
        ))}
      </ol>
      {events.length > HISTORY_PREVIEW ? (
        <button
          type="button"
          onClick={() => setShowAll((current) => !current)}
          className={`${smallButtonClass} mt-6 text-orange-300 hover:text-orange-200`}
        >
          {showAll ? "Show less" : `Show all ${events.length} moments`}
        </button>
      ) : null}
    </Panel>
  );
};

const SongDetail = ({ songId, userId, onBack, onDeleted }) => {
  const [song, setSong] = useState(null);
  const [versions, setVersions] = useState([]);
  const [ideas, setIdeas] = useState([]);
  const [audio, setAudio] = useState([]);
  const [statusHistory, setStatusHistory] = useState([]);
  const [signedUrls, setSignedUrls] = useState({});
  const [lyricsDirty, setLyricsDirty] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState({ text: "", error: false });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [songResult, versionsResult, ideasResult, audioResult, historyResult] =
        await Promise.all([
          supabase.from("songs").select("*").eq("id", songId).maybeSingle(),
          supabase
            .from("song_lyric_versions")
            .select("*")
            .eq("song_id", songId)
            .order("created_at", { ascending: false }),
          supabase
            .from("song_ideas")
            .select("*")
            .eq("song_id", songId)
            .order("created_at", { ascending: false }),
          supabase
            .from("song_audio")
            .select("*")
            .eq("song_id", songId)
            .order("created_at", { ascending: false }),
          supabase
            .from("song_status_history")
            .select("*")
            .eq("song_id", songId)
            .order("changed_at"),
        ]);

      if (cancelled) {
        return;
      }

      const failed = [songResult, versionsResult, ideasResult, audioResult, historyResult].some(
        (result) => result.error
      );
      if (failed) {
        setLoadError("Couldn't load this song. Refresh to try again.");
        return;
      }
      if (!songResult.data) {
        setLoadError("This song doesn't exist or isn't yours.");
        return;
      }

      setSong(songResult.data);
      setVersions(versionsResult.data);
      setIdeas(ideasResult.data);
      setAudio(audioResult.data);
      setStatusHistory(historyResult.data);

      const paths = audioResult.data.map((item) => item.storage_path);
      if (paths.length > 0) {
        const { data: urls } = await supabase.storage
          .from(SONG_VAULT_BUCKET)
          .createSignedUrls(paths, SIGNED_URL_SECONDS);
        if (!cancelled && urls) {
          setSignedUrls(
            Object.fromEntries(
              urls.filter((entry) => entry.signedUrl).map((entry) => [entry.path, entry.signedUrl])
            )
          );
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [songId]);

  // Warn before closing the tab with unsaved lyrics.
  useEffect(() => {
    if (!lyricsDirty) {
      return undefined;
    }
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [lyricsDirty]);

  const report = (error, successText) => {
    if (error) {
      console.error(error);
    }
    setMessage(
      error
        ? { text: "Couldn't save that. Please try again.", error: true }
        : { text: successText, error: false }
    );
  };

  const updateSong = async (changes) => {
    const { data, error } = await supabase
      .from("songs")
      .update(changes)
      .eq("id", songId)
      .select()
      .single();
    report(error, "Saved");
    if (error) {
      return;
    }
    setSong(data);

    if (changes.status) {
      const { data: history } = await supabase
        .from("song_status_history")
        .select("*")
        .eq("song_id", songId)
        .order("changed_at");
      if (history) {
        setStatusHistory(history);
      }
    }
  };

  const saveLyricsVersion = async (content, label) => {
    const { data, error } = await supabase
      .from("song_lyric_versions")
      .insert({ song_id: songId, content, label })
      .select()
      .single();
    report(error, "Lyrics saved as a new version");
    if (error) {
      return false;
    }
    setVersions((current) => [data, ...current]);
    return true;
  };

  const addIdea = async (kind, content) => {
    const { data, error } = await supabase
      .from("song_ideas")
      .insert({ song_id: songId, kind, content })
      .select()
      .single();
    report(error, `${getIdeaLabel(kind)} saved`);
    if (error) {
      return false;
    }
    setIdeas((current) => [data, ...current]);
    return true;
  };

  const deleteIdea = async (idea) => {
    if (!window.confirm(`Delete this ${getIdeaLabel(idea.kind).toLowerCase()}? It will be gone for good.`)) {
      return;
    }
    const { error } = await supabase.from("song_ideas").delete().eq("id", idea.id);
    report(error, "Deleted");
    if (!error) {
      setIdeas((current) => current.filter((item) => item.id !== idea.id));
    }
  };

  const storeAudio = async ({ blob, contentType, extension, kind, label }) => {
    const path = `${userId}/${songId}/${crypto.randomUUID()}.${extension}`;
    const bucket = supabase.storage.from(SONG_VAULT_BUCKET);

    const { error: uploadError } = await bucket.upload(path, blob, { contentType });
    if (uploadError) {
      report(uploadError);
      return false;
    }

    const { data, error } = await supabase
      .from("song_audio")
      .insert({
        song_id: songId,
        kind,
        label: label || null,
        storage_path: path,
        size_bytes: blob.size,
      })
      .select()
      .single();

    if (error) {
      await bucket.remove([path]);
      report(error);
      return false;
    }

    const { data: signed } = await bucket.createSignedUrl(path, SIGNED_URL_SECONDS);
    if (signed) {
      setSignedUrls((current) => ({ ...current, [path]: signed.signedUrl }));
    }
    setAudio((current) => [data, ...current]);
    report(null, kind === "voice_note" ? "Voice note saved" : "Demo uploaded");
    return true;
  };

  const saveRecording = (blob, label) => {
    const contentType = baseMimeType(blob.type);
    return storeAudio({
      blob,
      contentType,
      extension: RECORDING_EXTENSIONS[contentType],
      kind: "voice_note",
      label,
    });
  };

  const uploadDemo = (file, label) => {
    const extension = file.name.split(".").pop().toLowerCase();
    return storeAudio({
      blob: file,
      contentType: DEMO_TYPES[extension],
      extension,
      kind: "demo",
      label,
    });
  };

  const deleteAudio = async (item) => {
    const name = item.kind === "voice_note" ? "voice note" : "demo";
    if (!window.confirm(`Delete this ${name}? It will be gone for good.`)) {
      return;
    }
    const { error } = await supabase.from("song_audio").delete().eq("id", item.id);
    report(error, "Deleted");
    if (error) {
      return;
    }
    await supabase.storage.from(SONG_VAULT_BUCKET).remove([item.storage_path]);
    setAudio((current) => current.filter((entry) => entry.id !== item.id));
  };

  const deleteSong = async () => {
    if (
      !window.confirm(
        `Delete "${song.title}" with all its lyrics, ideas, voice notes and demos? This can't be undone.`
      )
    ) {
      return;
    }

    const folder = `${userId}/${songId}`;
    const bucket = supabase.storage.from(SONG_VAULT_BUCKET);
    const { data: files } = await bucket.list(folder, { limit: 1000 });
    if (files?.length) {
      await bucket.remove(files.map((file) => `${folder}/${file.name}`));
    }

    const { error } = await supabase.from("songs").delete().eq("id", songId);
    if (error) {
      report(error);
      return;
    }
    onDeleted();
  };

  const handleBack = () => {
    if (lyricsDirty && !window.confirm("You have unsaved lyrics. Leave without saving them?")) {
      return;
    }
    onBack();
  };

  const backButton = (
    <button
      type="button"
      onClick={handleBack}
      className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-300 transition hover:text-orange-200"
    >
      ← All songs
    </button>
  );

  if (loadError) {
    return (
      <div className="space-y-6">
        {backButton}
        <p className="text-red-300">{loadError}</p>
      </div>
    );
  }

  if (!song) {
    return <LoadingText />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {backButton}
        {message.text ? (
          <p
            className={`text-sm ${message.error ? "text-red-300" : "text-stone-500"}`}
            aria-live="polite"
          >
            {message.text}
          </p>
        ) : null}
      </div>

      <AutoSaveInput
        aria-label="Song title"
        required
        maxLength={200}
        value={song.title}
        onSave={(title) => updateSong({ title: title.trim() })}
        bare
        className="w-full rounded-2xl border border-transparent bg-transparent py-2 font-['Space_Grotesk'] text-3xl font-bold uppercase tracking-[0.06em] text-white transition hover:border-white/10 focus:border-orange-300 focus:bg-black/40 focus:px-4 focus:outline-none"
      />

      <StatusStepper status={song.status} onChange={(status) => updateSong({ status })} />

      <Panel>
        <SectionHeading>Details</SectionHeading>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className={labelClass}>BPM</span>
            <AutoSaveInput
              type="number"
              min="20"
              max="400"
              inputMode="numeric"
              value={song.bpm ?? ""}
              onSave={(bpm) => updateSong({ bpm: bpm === "" ? null : Math.round(Number(bpm)) })}
              className="mt-2"
            />
          </label>
          <label className="block">
            <span className={labelClass}>Key</span>
            <select
              value={song.musical_key ?? ""}
              onChange={(event) => updateSong({ musical_key: event.target.value || null })}
              className={`${fieldClass} mt-2`}
            >
              <option value="">Not set</option>
              {MUSICAL_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Genre</span>
            <AutoSaveInput
              maxLength={100}
              value={song.genre ?? ""}
              onSave={(genre) => updateSong({ genre: genre.trim() || null })}
              className="mt-2"
            />
          </label>
          <label className="block sm:col-span-2 lg:col-span-3">
            <span className={labelClass}>Collaborators</span>
            <AutoSaveInput
              maxLength={1000}
              placeholder="Who's working on this with you?"
              value={song.collaborators ?? ""}
              onSave={(collaborators) => updateSong({ collaborators: collaborators.trim() || null })}
              className="mt-2"
            />
          </label>
          <label className="block sm:col-span-2 lg:col-span-3">
            <span className={labelClass}>Reference tracks</span>
            <AutoSaveTextarea
              rows={3}
              maxLength={2000}
              placeholder="Songs this should feel like, one per line. Links are fine."
              value={song.reference_tracks ?? ""}
              onSave={(references) => updateSong({ reference_tracks: references.trim() || null })}
              className="mt-2 text-sm leading-7"
            />
          </label>
        </div>
      </Panel>

      <LyricsEditor
        versions={versions}
        onSaveVersion={saveLyricsVersion}
        onDirtyChange={setLyricsDirty}
      />

      <Ideas ideas={ideas} onAdd={addIdea} onDelete={deleteIdea} />

      <AudioSection
        audio={audio}
        signedUrls={signedUrls}
        onSaveRecording={saveRecording}
        onUploadDemo={uploadDemo}
        onDelete={deleteAudio}
      />

      <CreativeHistory events={buildHistory({ statusHistory, versions, ideas, audio })} />

      <button
        type="button"
        onClick={deleteSong}
        className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-500 transition hover:text-red-300"
      >
        Delete this song
      </button>
    </div>
  );
};

export default SongDetail;
