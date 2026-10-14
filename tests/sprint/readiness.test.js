import { describe, expect, it } from "vitest";
import { checkReadiness, isValidUpc, normalizeIsrc } from "../../lib/readiness.js";

const TODAY = "2026-10-15";

const form = (overrides = {}) => ({
  artist_name: "Naam Namah",
  track_title: "Night Drive",
  genre: "Hip-Hop/Rap",
  release_date: "2026-11-20",
  contact_email: "artist@example.com",
  songwriters: "A. Writer",
  producers: "B. Producer",
  featured_artists: "",
  language: "Hindi",
  explicit: "no",
  lyrics: "",
  isrc: "",
  upc: "",
  ...overrides,
});

const goodAudio = { name: "song.wav", info: { container: "wav", sampleRate: 44100, bitsPerSample: 24, channels: 2, durationSeconds: 190, compressed: false } };
const goodPoster = { width: 3000, height: 3000 };

const run = (overrides = {}, extra = {}) =>
  checkReadiness({ form: form(overrides), audio: goodAudio, poster: goodPoster, rightsConfirmed: true, today: TODAY, ...extra });

const status = (result, id) => result.checks.find((check) => check.id === id)?.status;

describe("checkReadiness", () => {
  it("passes a complete, correct release", () => {
    const result = run();
    expect(result.ready).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("requires the core fields, credits, explicit declaration, files and rights", () => {
    const result = checkReadiness({
      form: form({ artist_name: " ", track_title: "", genre: "", contact_email: "nope", songwriters: "", explicit: "" }),
      audio: null,
      poster: null,
      rightsConfirmed: false,
      today: TODAY,
    });
    expect(result.ready).toBe(false);
    expect(result.failures.map((check) => check.id).sort()).toEqual(
      ["artist_name", "audio", "contact_email", "explicit", "genre", "poster", "rights", "songwriters", "track_title"].sort()
    );
  });

  it("checks the master's technical specs", () => {
    const low = run({}, { audio: { name: "a.wav", info: { sampleRate: 22050, bitsPerSample: 8, channels: 1, durationSeconds: 20, compressed: false } } });
    expect(status(low, "audio")).toBe("fail");
    expect(low.checks.find((check) => check.id === "audio").message).toMatch(/22.05 kHz.*8-bit/);
    expect(status(low, "audio_channels")).toBe("warn");
    expect(status(low, "audio_length")).toBe("warn");
  });

  it("warns, rather than fails, when the audio header can't be read", () => {
    expect(status(run({}, { audio: { name: "a.wav", info: { error: "Unreadable." } } }), "audio")).toBe("warn");
  });

  it("isn't ready while the audio file is still being read", () => {
    const result = run({}, { audio: { name: "a.wav", info: null } });
    expect(status(result, "audio")).toBe("fail");
    expect(result.ready).toBe(false);
  });

  it("accepts kept files when resubmitting", () => {
    const result = run({}, { audio: { kept: true }, poster: { kept: true } });
    expect(status(result, "audio")).toBe("pass");
    expect(status(result, "poster")).toBe("pass");
  });

  it("checks the cover size", () => {
    expect(status(run({}, { poster: { width: 1600, height: 900 } }), "poster")).toBe("fail");
    expect(status(run({}, { poster: { width: 1500, height: 1500 } }), "poster_size")).toBe("warn");
  });

  it("handles release dates in the past, too soon, and fine", () => {
    expect(status(run({ release_date: "2026-10-01" }), "release_date")).toBe("fail");
    expect(status(run({ release_date: "2026-10-25" }), "release_date")).toBe("warn");
    expect(status(run({ release_date: "2026-12-01" }), "release_date")).toBe("pass");
    expect(status(run({ release_date: "" }), "release_date")).toBe("info");
  });

  it("validates ISRC and UPC only when given, without changing them", () => {
    expect(status(run({ isrc: "in-abc-26-00001" }), "isrc")).toBe("pass");
    expect(status(run({ isrc: "12345" }), "isrc")).toBe("fail");
    expect(status(run({ upc: "036000291452" }), "upc")).toBe("pass");
    expect(status(run({ upc: "036000291453" }), "upc")).toBe("fail");
    expect(run({ upc: "" }).checks.some((check) => check.id === "upc")).toBe(false);
  });

  it("flags title formatting that stores commonly reject", () => {
    const result = run({ track_title: "Night Drive (Official Audio) feat. Someone 🔥" });
    const message = result.checks.find((check) => check.id === "title_style").message;
    expect(message).toMatch(/Official Audio/);
    expect(message).toMatch(/featured artists/);
    expect(message).toMatch(/emoji/);
    expect(run({ track_title: "NIGHT DRIVE" }).checks.find((check) => check.id === "title_style").message).toMatch(/ALL CAPS/);
    expect(run({ track_title: "MC" }).checks.some((check) => check.id === "title_style")).toBe(false);
    expect(status(result, "featured")).toBe("warn");
    // Warnings never block submission.
    expect(result.ready).toBe(true);
  });

  it("asks for lyrics language when lyrics are given", () => {
    expect(status(run({ lyrics: "la la", language: "" }), "language")).toBe("warn");
  });
});

describe("identifier helpers", () => {
  it("validates UPC-A and EAN-13 check digits", () => {
    expect(isValidUpc("036000291452")).toBe(true);
    expect(isValidUpc("4006381333931")).toBe(true);
    expect(isValidUpc("4006381333932")).toBe(false);
    expect(isValidUpc("12345")).toBe(false);
  });

  it("normalises ISRC formatting for checking", () => {
    expect(normalizeIsrc("in-abc-26-00001")).toBe("INABC2600001");
  });
});
