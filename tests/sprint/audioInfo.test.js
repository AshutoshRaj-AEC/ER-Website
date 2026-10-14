import { describe, expect, it } from "vitest";
import { formatDuration, parseAudioHeader } from "../../lib/audioInfo.js";

// Build a minimal WAV header: RIFF, an optional LIST chunk, fmt and data.
const wav = ({ sampleRate = 44100, bits = 16, channels = 2, seconds = 180, format = 1, listChunk = false } = {}) => {
  const byteRate = (sampleRate * channels * bits) / 8;
  const dataSize = Math.round(byteRate * seconds);
  const extra = listChunk ? 8 + 10 : 0;
  const buffer = new ArrayBuffer(44 + extra);
  const view = new DataView(buffer);
  const text = (offset, value) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + extra + dataSize, true);
  text(8, "WAVE");
  let offset = 12;
  if (listChunk) {
    text(offset, "LIST");
    view.setUint32(offset + 4, 10, true);
    offset += 18;
  }
  text(offset, "fmt ");
  view.setUint32(offset + 4, 16, true);
  view.setUint16(offset + 8, format, true);
  view.setUint16(offset + 10, channels, true);
  view.setUint32(offset + 12, sampleRate, true);
  view.setUint32(offset + 16, byteRate, true);
  view.setUint16(offset + 20, (channels * bits) / 8, true);
  view.setUint16(offset + 22, bits, true);
  text(offset + 24, "data");
  view.setUint32(offset + 28, dataSize, true);
  return buffer;
};

// Build a minimal FLAC header: "fLaC" + STREAMINFO block.
const flac = ({ sampleRate = 48000, bits = 24, channels = 2, seconds = 200 } = {}) => {
  const buffer = new ArrayBuffer(4 + 4 + 34);
  const view = new DataView(buffer);
  [..."fLaC"].forEach((char, i) => view.setUint8(i, char.charCodeAt(0)));
  view.setUint8(4, 0x80); // last block, type 0 (STREAMINFO)
  view.setUint8(7, 34);
  const total = BigInt(Math.round(sampleRate * seconds));
  // 20 bits rate | 3 bits channels-1 | 5 bits bps-1 | 36 bits samples
  const packed = (BigInt(sampleRate) << 44n) | (BigInt(channels - 1) << 41n) | (BigInt(bits - 1) << 36n) | total;
  for (let i = 0; i < 8; i += 1) {
    view.setUint8(8 + 10 + i, Number((packed >> BigInt(8 * (7 - i))) & 0xffn));
  }
  return buffer;
};

describe("parseAudioHeader", () => {
  it("reads a standard WAV", () => {
    expect(parseAudioHeader(wav())).toMatchObject({ container: "wav", sampleRate: 44100, bitsPerSample: 16, channels: 2, compressed: false });
    expect(Math.round(parseAudioHeader(wav()).durationSeconds)).toBe(180);
  });

  it("skips other chunks before fmt", () => {
    expect(parseAudioHeader(wav({ listChunk: true, sampleRate: 48000, bits: 24 }))).toMatchObject({ sampleRate: 48000, bitsPerSample: 24 });
  });

  it("flags compressed audio inside a WAV", () => {
    expect(parseAudioHeader(wav({ format: 0x55 })).compressed).toBe(true);
  });

  it("reads FLAC stream info", () => {
    const info = parseAudioHeader(flac());
    expect(info).toMatchObject({ container: "flac", sampleRate: 48000, bitsPerSample: 24, channels: 2 });
    expect(Math.round(info.durationSeconds)).toBe(200);
  });

  it("reports files that aren't WAV or FLAC", () => {
    expect(parseAudioHeader(new TextEncoder().encode("ID3 not really audio").buffer).error).toBeTruthy();
  });

  it("formats durations", () => {
    expect(formatDuration(185.4)).toBe("3:05");
    expect(formatDuration(null)).toBe("unknown length");
  });
});
