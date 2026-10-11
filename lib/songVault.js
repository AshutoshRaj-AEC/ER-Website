export const SONG_VAULT_BUCKET = "song-vault";

export const SONG_STATUSES = [
  { value: "idea", label: "Idea" },
  { value: "writing", label: "Writing" },
  { value: "recording", label: "Recording" },
  { value: "mixing", label: "Mixing" },
  { value: "mastered", label: "Mastered" },
];

export const getStatusLabel = (value) =>
  SONG_STATUSES.find((status) => status.value === value)?.label ?? value;

export const getStatusStep = (value) =>
  SONG_STATUSES.findIndex((status) => status.value === value);

const NOTES = ["C", "C♯/D♭", "D", "D♯/E♭", "E", "F", "F♯/G♭", "G", "G♯/A♭", "A", "A♯/B♭", "B"];

export const MUSICAL_KEYS = NOTES.flatMap((note) => [`${note} major`, `${note} minor`]);

export const IDEA_KINDS = [
  { value: "hook", label: "Hook" },
  { value: "verse", label: "Verse" },
  { value: "concept", label: "Concept" },
  { value: "note", label: "Note" },
];

export const getIdeaLabel = (value) =>
  IDEA_KINDS.find((kind) => kind.value === value)?.label ?? value;

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

// Upload content types are chosen from the extension because browsers often
// report WAV/FLAC/M4A with empty or non-standard types.
export const DEMO_TYPES = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  ogg: "audio/ogg",
  webm: "audio/webm",
};

// MediaRecorder reports types like "audio/webm;codecs=opus".
export const RECORDING_EXTENSIONS = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
};

export const baseMimeType = (type) => type.split(";")[0].trim().toLowerCase();

export const formatSize = (bytes) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export const formatDuration = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export const formatShortDate = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
