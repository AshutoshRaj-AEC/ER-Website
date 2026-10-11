import { useEffect, useState } from "react";
import { fieldClass } from "./AutoSaveField";
import { LoadingText } from "./PageShell";
import SongDetail from "./SongDetail";
import { supabase } from "../lib/supabase";
import {
  SONG_STATUSES,
  formatShortDate,
  getStatusLabel,
  getStatusStep,
} from "../lib/songVault";

const SONG_LIST_SELECT =
  "id, title, status, bpm, musical_key, genre, updated_at, song_lyric_versions(count), song_ideas(count), song_audio(count)";

const getSongIdFromUrl = () => new URLSearchParams(window.location.search).get("song");

const countOf = (relation) => relation?.[0]?.count ?? 0;

const StatusDots = ({ status }) => {
  const step = getStatusStep(status);

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1" aria-hidden="true">
        {SONG_STATUSES.map((option, index) => (
          <span
            key={option.value}
            className={`h-1.5 w-5 rounded-full ${index <= step ? "bg-orange-400" : "bg-white/10"}`}
          />
        ))}
      </div>
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-200">
        {getStatusLabel(status)}
      </span>
    </div>
  );
};

const SongCard = ({ song, onOpen }) => {
  const details = [
    song.bpm ? `${song.bpm} BPM` : null,
    song.musical_key,
    song.genre,
  ].filter(Boolean);
  const counts = [
    [countOf(song.song_lyric_versions), "lyric version"],
    [countOf(song.song_ideas), "idea"],
    [countOf(song.song_audio), "recording"],
  ]
    .filter(([count]) => count > 0)
    .map(([count, noun]) => `${count} ${noun}${count === 1 ? "" : "s"}`);

  return (
    <button
      type="button"
      onClick={() => onOpen(song.id)}
      className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-left transition hover:border-orange-300/60"
    >
      <p className="truncate font-['Space_Grotesk'] text-xl font-bold uppercase tracking-[0.06em] text-white">
        {song.title}
      </p>
      <div className="mt-3">
        <StatusDots status={song.status} />
      </div>
      {details.length ? (
        <p className="mt-4 text-sm text-stone-300">{details.join(" · ")}</p>
      ) : null}
      <p className="mt-4 text-xs text-stone-500">
        {counts.length ? `${counts.join(" · ")} · ` : ""}Updated {formatShortDate(song.updated_at)}
      </p>
    </button>
  );
};

const SongVault = ({ userId }) => {
  const [selectedSongId, setSelectedSongId] = useState(getSongIdFromUrl);
  const [songs, setSongs] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const handlePopState = () => setSelectedSongId(getSongIdFromUrl());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (selectedSongId) {
      return undefined;
    }

    let cancelled = false;

    supabase
      .from("songs")
      .select(SONG_LIST_SELECT)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .then(({ data, error: loadError }) => {
        if (cancelled) {
          return;
        }
        if (loadError) {
          setError("Couldn't load your songs. Refresh to try again.");
          setSongs([]);
          return;
        }
        setSongs(data);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, selectedSongId, reloadKey]);

  const openSong = (songId) => {
    window.history.pushState({}, "", `/dashboard?tab=vault&song=${songId}`);
    setSelectedSongId(songId);
    window.scrollTo({ top: 0 });
  };

  const closeSong = () => {
    window.history.pushState({}, "", "/dashboard?tab=vault");
    setSelectedSongId(null);
    setReloadKey((current) => current + 1);
    window.scrollTo({ top: 0 });
  };

  const createSong = async (event) => {
    event.preventDefault();
    setCreating(true);
    setError("");
    const { data, error: createError } = await supabase
      .from("songs")
      .insert({ title: newTitle.trim() })
      .select("id")
      .single();
    setCreating(false);

    if (createError) {
      console.error(createError);
      setError("Couldn't create the song. Please try again.");
      return;
    }

    setNewTitle("");
    openSong(data.id);
  };

  if (selectedSongId) {
    return (
      <SongDetail
        songId={selectedSongId}
        userId={userId}
        onBack={closeSong}
        onDeleted={closeSong}
      />
    );
  }

  const counts = (songs ?? []).reduce(
    (totals, song) => ({ ...totals, [song.status]: (totals[song.status] ?? 0) + 1 }),
    {}
  );
  const query = search.trim().toLowerCase();
  const visible = (songs ?? []).filter(
    (song) =>
      (filter === "all" || song.status === filter) &&
      (!query || song.title.toLowerCase().includes(query))
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="max-w-2xl text-sm leading-6 text-stone-400">
          Your private songwriting space. Only you can see it, not even the
          label. Every lyric draft, hook and demo is kept, so you never lose
          an old idea.
        </p>
      </div>

      <form onSubmit={createSong} className="flex flex-col gap-3 sm:flex-row">
        <label className="flex-1">
          <span className="sr-only">New song title</span>
          <input
            required
            maxLength={200}
            placeholder="Working title for a new song"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            className={fieldClass}
          />
        </label>
        <button
          type="submit"
          disabled={creating || !newTitle.trim()}
          className="rounded-full bg-orange-500 px-8 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-orange-400 disabled:opacity-50"
        >
          {creating ? "Creating…" : "+ New song"}
        </button>
      </form>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {songs === null ? (
        <LoadingText />
      ) : songs.length === 0 ? (
        <p className="text-stone-400">
          No songs yet. Start one with just a working title. You can add
          lyrics, hooks and voice notes as they come.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
              {[{ value: "all", label: "All" }, ...SONG_STATUSES].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={filter === option.value}
                  onClick={() => setFilter(option.value)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                    filter === option.value
                      ? "border-orange-400 bg-orange-500 text-white"
                      : "border-white/15 text-stone-300 hover:border-orange-300 hover:text-orange-200"
                  }`}
                >
                  {option.label} ({option.value === "all" ? songs.length : counts[option.value] ?? 0})
                </button>
              ))}
            </div>
            <label className="lg:w-72">
              <span className="sr-only">Search songs</span>
              <input
                type="search"
                placeholder="Search by title"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={fieldClass}
              />
            </label>
          </div>

          {visible.length === 0 ? (
            <p className="text-stone-400">No songs match.</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {visible.map((song) => (
                <SongCard key={song.id} song={song} onOpen={openSong} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SongVault;
