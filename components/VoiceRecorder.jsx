import { useEffect, useRef, useState } from "react";
import { fieldClass } from "./AutoSaveField";
import { MAX_AUDIO_BYTES, RECORDING_EXTENSIONS, formatDuration } from "../lib/songVault";

const MAX_SECONDS = 10 * 60;

// Opus in WebM (Chrome, Firefox) or AAC in MP4 (Safari): both small enough
// that a 10-minute voice note stays well under the upload limit.
const PREFERRED_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

const canRecord = () =>
  typeof window !== "undefined" &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  typeof window.MediaRecorder !== "undefined";

const VoiceRecorder = ({ onSave }) => {
  const [state, setState] = useState("idle");
  const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState(null);
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const recorderRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!recording) {
      return undefined;
    }
    return () => URL.revokeObjectURL(recording.url);
  }, [recording]);

  if (!canRecord()) {
    return (
      <p className="text-sm text-stone-500">
        This browser can't record audio. Upload a voice memo as a demo instead.
      </p>
    );
  }

  const stop = () => {
    clearInterval(timerRef.current);
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  };

  const start = async () => {
    setError("");
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(
        "Microphone access was blocked. Allow it in your browser's site settings and try again."
      );
      return;
    }

    const mimeType = PREFERRED_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType });
      setRecording({ blob, url: URL.createObjectURL(blob) });
      setState("recorded");
    };

    recorderRef.current = recorder;
    recorder.start(1000);
    setSeconds(0);
    setState("recording");
    timerRef.current = setInterval(() => {
      setSeconds((current) => {
        if (current + 1 >= MAX_SECONDS) {
          stop();
        }
        return current + 1;
      });
    }, 1000);
  };

  const discard = () => {
    setRecording(null);
    setLabel("");
    setState("idle");
  };

  const save = async () => {
    if (recording.blob.size > MAX_AUDIO_BYTES) {
      setError("This recording is too large to save. Keep voice notes under 10 minutes.");
      return;
    }
    if (!RECORDING_EXTENSIONS[recording.blob.type.split(";")[0]]) {
      setError("This browser recorded in a format the vault can't store. Try Chrome or Safari.");
      return;
    }

    setState("saving");
    const saved = await onSave(recording.blob, label.trim());
    if (saved) {
      discard();
    } else {
      setState("recorded");
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-stone-300">
        Voice note
      </p>

      {state === "idle" ? (
        <button
          type="button"
          onClick={start}
          className="mt-4 inline-flex items-center gap-3 rounded-full bg-orange-500 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-orange-400"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-white" aria-hidden="true" />
          Record
        </button>
      ) : null}

      {state === "recording" ? (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-2 text-sm font-semibold text-red-300" aria-live="polite">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-400" aria-hidden="true" />
            Recording {formatDuration(seconds)}
          </span>
          <button
            type="button"
            onClick={stop}
            className="rounded-full border border-white/20 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:border-orange-300"
          >
            Stop
          </button>
        </div>
      ) : null}

      {(state === "recorded" || state === "saving") && recording ? (
        <div className="mt-4 space-y-4">
          <audio controls src={recording.url} className="w-full" />
          <input
            maxLength={120}
            placeholder="Name this take (optional), e.g. chorus melody"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className={fieldClass}
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={state === "saving"}
              onClick={save}
              className="rounded-full bg-orange-500 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-orange-400 disabled:opacity-60"
            >
              {state === "saving" ? "Saving…" : "Save to song"}
            </button>
            <button
              type="button"
              disabled={state === "saving"}
              onClick={discard}
              className="rounded-full border border-white/15 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-stone-300 transition hover:border-red-300 hover:text-red-200"
            >
              Discard
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
    </div>
  );
};

export default VoiceRecorder;
