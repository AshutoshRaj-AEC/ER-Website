// Release readiness checks for the submission form. These catch common
// reasons a release gets sent back, before anything is uploaded. They never
// change what the artist entered, and passing them doesn't guarantee a
// distributor will accept the release.

import { formatDuration } from "./audioInfo.js";

export const LEVELS = {
  required: "Required",
  conditional: "Required in some cases",
  recommended: "Recommended",
};

const MIN_SAMPLE_RATE = 44100;
const MIN_BIT_DEPTH = 16;
const MIN_DURATION_SECONDS = 30;
const RECOMMENDED_LEAD_DAYS = 21;
const MIN_POSTER = 1400;
const RECOMMENDED_POSTER = 3000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ISRC_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;
// Words stores commonly reject in a track title.
const DESCRIPTIVE_TITLE = /\b(official\s+(audio|video|music\s+video|lyric(s)?\s+video)|lyric(s)?\s+video|full\s+song|audio\s+song|new\s+song|hd|4k)\b/i;
const FEAT_IN_TITLE = /\b(feat\.?|ft\.?|featuring)\s/i;
// Emoji and pictographs.
const EMOJI = /\p{Extended_Pictographic}/u;

export const normalizeIsrc = (value) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

// GTIN check digit (UPC-A has 12 digits, EAN-13 has 13).
export const isValidUpc = (value) => {
  const digits = value.replace(/\D/g, "");
  if (!/^\d{12,13}$/.test(digits)) return false;
  const body = digits.slice(0, -1).split("").reverse().map(Number);
  const sum = body.reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1));
};

const daysBetween = (from, to) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

const isAllCaps = (text) => {
  const letters = text.replace(/[^\p{L}]/gu, "");
  return letters.length > 3 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
};

// form:   the submission form values
// audio:  { name, info } where info comes from readAudioInfo, or { kept: true } when
//         resubmitting with the existing file; null if no file chosen
// poster: { width, height } or { kept: true }; null if none
// Each check: { id, level, status: "pass" | "fail" | "warn" | "info", label, message }
export const checkReadiness = ({ form, audio, poster, rightsConfirmed, today }) => {
  const checks = [];
  const add = (id, level, status, label, message) => checks.push({ id, level, status, label, message });

  // Required -----------------------------------------------------------------
  add("artist_name", "required", form.artist_name.trim() ? "pass" : "fail", "Artist name",
    form.artist_name.trim() ? "Added." : "Add the artist name exactly as it should appear on streaming services.");

  const title = form.track_title.trim();
  add("track_title", "required", title ? "pass" : "fail", "Track title",
    title ? "Added." : "Add the track title.");

  add("genre", "required", form.genre.trim() ? "pass" : "fail", "Genre",
    form.genre.trim() ? "Added." : "Choose a genre so the label can place your release.");

  const email = form.contact_email.trim();
  add("contact_email", "required", EMAIL_PATTERN.test(email) ? "pass" : "fail", "Contact email",
    EMAIL_PATTERN.test(email) ? "Added." : "Add a valid email address so the label can reach you.");

  add("songwriters", "required", form.songwriters.trim() ? "pass" : "fail", "Songwriter credits",
    form.songwriters.trim()
      ? "Added."
      : "Add the songwriters' real names. Distributors usually need them for publishing and royalties.");

  add("explicit", "required", form.explicit === "yes" || form.explicit === "no" ? "pass" : "fail", "Explicit content",
    form.explicit === "yes" || form.explicit === "no"
      ? form.explicit === "yes" ? "Marked as explicit." : "Marked as clean."
      : "Say whether the lyrics contain explicit content. Marking it wrongly can get a release taken down.");

  if (!audio) {
    add("audio", "required", "fail", "Master audio", "Add your master audio file (WAV or FLAC).");
  } else if (audio.kept) {
    add("audio", "required", "pass", "Master audio", "Keeping the audio file you already uploaded.");
  } else if (!audio.info) {
    add("audio", "required", "fail", "Master audio", "Checking your audio file…");
  } else if (audio.info.error) {
    add("audio", "required", "warn", "Master audio",
      `${audio.info.error} Make sure it's an uncompressed WAV or FLAC at 44.1 kHz and 16-bit or higher.`);
  } else if (audio.info) {
    const { sampleRate, bitsPerSample, channels, durationSeconds, compressed } = audio.info;
    const problems = [];
    if (compressed) problems.push("it uses a compressed format inside the WAV");
    if (sampleRate < MIN_SAMPLE_RATE) problems.push(`its sample rate is ${sampleRate / 1000} kHz (needs at least 44.1 kHz)`);
    if (bitsPerSample < MIN_BIT_DEPTH) problems.push(`it's ${bitsPerSample}-bit (needs 16-bit or higher)`);
    add("audio", "required", problems.length ? "fail" : "pass", "Master audio",
      problems.length
        ? `This file won't meet store requirements: ${problems.join("; ")}. Export the master again from your session.`
        : `${sampleRate / 1000} kHz, ${bitsPerSample}-bit, ${channels === 1 ? "mono" : channels === 2 ? "stereo" : `${channels} channels`}, ${formatDuration(durationSeconds)}.`);

    if (channels === 1) {
      add("audio_channels", "recommended", "warn", "Stereo master",
        "This master is mono. Most releases are delivered in stereo; check with the label if mono is intended.");
    }
    if (durationSeconds !== null && durationSeconds < MIN_DURATION_SECONDS) {
      add("audio_length", "recommended", "warn", "Track length",
        `The track is ${formatDuration(durationSeconds)}. Plays under 30 seconds don't count as streams on Spotify.`);
    }
  }

  if (!poster) {
    add("poster", "required", "fail", "Cover artwork", "Add a square cover image (JPG or PNG).");
  } else if (poster.kept) {
    add("poster", "required", "pass", "Cover artwork", "Keeping the cover you already uploaded.");
  } else {
    const square = poster.width === poster.height;
    const bigEnough = poster.width >= MIN_POSTER;
    add("poster", "required", square && bigEnough ? "pass" : "fail", "Cover artwork",
      square && bigEnough
        ? `${poster.width}×${poster.height}.`
        : `The cover must be square and at least ${MIN_POSTER}×${MIN_POSTER} (this one is ${poster.width}×${poster.height}).`);
    if (square && bigEnough && poster.width < RECOMMENDED_POSTER) {
      add("poster_size", "recommended", "warn", "Cover resolution",
        `${RECOMMENDED_POSTER}×${RECOMMENDED_POSTER} is recommended; some stores ask for it.`);
    }
  }

  add("rights", "required", rightsConfirmed ? "pass" : "fail", "Rights confirmation",
    rightsConfirmed ? "Confirmed." : "Confirm you own or control the rights to the recording, lyrics and artwork.");

  // Required in some cases ---------------------------------------------------
  if (form.release_date) {
    const lead = daysBetween(today, form.release_date);
    if (lead < 0) {
      add("release_date", "conditional", "fail", "Release date", "The release date is in the past. Choose a future date or leave it empty.");
    } else if (lead < RECOMMENDED_LEAD_DAYS) {
      add("release_date", "conditional", "warn", "Release date",
        `Only ${lead} day${lead === 1 ? "" : "s"} away. Review, distribution and Spotify pitching need about 3 weeks, so this date may move.`);
    } else {
      add("release_date", "conditional", "pass", "Release date", `${lead} days away, enough time for review and pitching.`);
    }
  } else {
    add("release_date", "conditional", "info", "Release date", "No date chosen. The label will suggest the earliest realistic date.");
  }

  if (form.isrc.trim()) {
    const isrc = normalizeIsrc(form.isrc);
    add("isrc", "conditional", ISRC_PATTERN.test(isrc) ? "pass" : "fail", "ISRC",
      ISRC_PATTERN.test(isrc)
        ? `${isrc}.`
        : "This isn't a valid ISRC. It should be 12 characters, like INABC2600001. Leave it empty if the recording doesn't have one yet.");
  } else {
    add("isrc", "conditional", "info", "ISRC", "Not needed for a new recording. Only fill it in if this recording already has one.");
  }

  if (form.upc.trim()) {
    add("upc", "conditional", isValidUpc(form.upc) ? "pass" : "fail", "UPC",
      isValidUpc(form.upc)
        ? "Valid barcode number."
        : "This UPC isn't valid: it must be 12 or 13 digits with a correct check digit. Copy it again or leave it empty.");
  }

  const hasFeatInTitle = FEAT_IN_TITLE.test(title);
  if (hasFeatInTitle && !form.featured_artists.trim()) {
    add("featured", "conditional", "warn", "Featured artists",
      "The title mentions a featured artist. Add them under Featured artists so stores credit them properly.");
  }

  if (form.explicit === "yes" && !form.lyrics.trim()) {
    add("lyrics_explicit", "conditional", "warn", "Lyrics",
      "Explicit tracks are easier to review with lyrics. Add them if you can.");
  }

  if (form.lyrics.trim() && !form.language.trim()) {
    add("language", "conditional", "warn", "Lyrics language", "Add the language of the lyrics.");
  }

  // Recommended --------------------------------------------------------------
  if (title) {
    const issues = [];
    if (DESCRIPTIVE_TITLE.test(title)) issues.push("remove words like \"Official Audio\" or \"Lyric Video\"; stores reject them in titles");
    if (hasFeatInTitle) issues.push("featured artists usually go in their own field, not the title");
    if (isAllCaps(title)) issues.push("stores often ask for normal capitalisation instead of ALL CAPS");
    if (EMOJI.test(title)) issues.push("emoji in titles are usually rejected");
    if (issues.length) {
      add("title_style", "recommended", "warn", "Title formatting", `Check the title: ${issues.join("; ")}.`);
    }
  }

  if (!form.producers.trim()) {
    add("producers", "recommended", "info", "Producer credits", "Optional, but credits help the right people get recognised.");
  }

  const failures = checks.filter((check) => check.status === "fail");
  const warnings = checks.filter((check) => check.status === "warn");

  return {
    checks,
    failures,
    warnings,
    ready: failures.length === 0,
  };
};
