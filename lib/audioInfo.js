// Read basic technical details from the start of a WAV or FLAC file, in the
// browser, without uploading it. Only the header bytes are inspected.

// How much of the file to read: enough for any normal header and metadata.
export const HEADER_BYTES = 256 * 1024;

const ascii = (view, offset, length) =>
  offset + length > view.byteLength
    ? ""
    : String.fromCharCode(...Array.from({ length }, (_, i) => view.getUint8(offset + i)));

const parseWav = (view) => {
  if (ascii(view, 0, 4) !== "RIFF" || ascii(view, 8, 4) !== "WAVE") {
    return null;
  }

  let format = null;
  let dataBytes = null;
  let offset = 12;

  while (offset + 8 <= view.byteLength) {
    const id = ascii(view, offset, 4);
    const size = view.getUint32(offset + 4, true);
    if (id === "fmt " && offset + 24 <= view.byteLength) {
      format = {
        audioFormat: view.getUint16(offset + 8, true),
        channels: view.getUint16(offset + 10, true),
        sampleRate: view.getUint32(offset + 12, true),
        byteRate: view.getUint32(offset + 16, true),
        bitsPerSample: view.getUint16(offset + 22, true),
      };
    } else if (id === "data") {
      dataBytes = size;
      break;
    }
    // Chunks are padded to an even length.
    offset += 8 + size + (size % 2);
  }

  if (!format) {
    return { container: "wav", error: "The WAV file has no format information." };
  }

  return {
    container: "wav",
    channels: format.channels,
    sampleRate: format.sampleRate,
    bitsPerSample: format.bitsPerSample,
    durationSeconds: dataBytes !== null && format.byteRate > 0 ? dataBytes / format.byteRate : null,
    compressed: ![1, 3, 0xfffe].includes(format.audioFormat),
  };
};

// Skip an ID3v2 tag that some tools put in front of FLAC files.
const skipId3 = (view) => {
  if (ascii(view, 0, 3) !== "ID3" || view.byteLength < 10) {
    return 0;
  }
  const size =
    ((view.getUint8(6) & 0x7f) << 21) |
    ((view.getUint8(7) & 0x7f) << 14) |
    ((view.getUint8(8) & 0x7f) << 7) |
    (view.getUint8(9) & 0x7f);
  return 10 + size;
};

const parseFlac = (view) => {
  const start = skipId3(view);
  if (ascii(view, start, 4) !== "fLaC") {
    return null;
  }

  // The first metadata block must be STREAMINFO (type 0, 34 bytes).
  const blockType = view.getUint8(start + 4) & 0x7f;
  const info = start + 8;
  if (blockType !== 0 || info + 18 > view.byteLength) {
    return { container: "flac", error: "The FLAC file has no stream information." };
  }

  // Bytes 10-17 of STREAMINFO: 20 bits sample rate, 3 bits channels-1,
  // 5 bits bits-per-sample-1, 36 bits total samples.
  const b = (i) => view.getUint8(info + 10 + i);
  const sampleRate = (b(0) << 12) | (b(1) << 4) | (b(2) >> 4);
  const channels = ((b(2) >> 1) & 0x07) + 1;
  const bitsPerSample = (((b(2) & 0x01) << 4) | (b(3) >> 4)) + 1;
  const totalSamples = (b(3) & 0x0f) * 2 ** 32 + ((b(4) << 24) >>> 0) + (b(5) << 16) + (b(6) << 8) + b(7);

  return {
    container: "flac",
    channels,
    sampleRate,
    bitsPerSample,
    durationSeconds: sampleRate > 0 && totalSamples > 0 ? totalSamples / sampleRate : null,
    compressed: false,
  };
};

// Returns technical details, or { error } if the header can't be read.
export const parseAudioHeader = (buffer) => {
  const view = new DataView(buffer);
  return (
    parseWav(view) ??
    parseFlac(view) ?? { error: "This doesn't look like a WAV or FLAC file, even though its name says so." }
  );
};

export const readAudioInfo = async (file) => {
  try {
    return parseAudioHeader(await file.slice(0, HEADER_BYTES).arrayBuffer());
  } catch {
    return { error: "The audio file couldn't be read." };
  }
};

export const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined) return "unknown length";
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};
