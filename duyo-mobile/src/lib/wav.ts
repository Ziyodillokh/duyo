// Build a minimal PCM WAV file in memory from raw PCM bytes.
// Used to feed expo-audio's AudioPlayer which requires a file URI / known
// format header — the backend emits raw 24kHz PCM with no envelope.

const WAV_HEADER_BYTES = 44;
const RIFF_PREAMBLE_BYTES = 36;
const PCM_FORMAT_CODE = 1;
const PCM_FMT_CHUNK_SIZE = 16;

export interface WavOptions {
  sampleRate: number;
  channels?: number;
  bitsPerSample?: number;
}

export function buildWavBuffer(pcm: ArrayBuffer, options: WavOptions): ArrayBuffer {
  const channels = options.channels ?? 1;
  const bitsPerSample = options.bitsPerSample ?? 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = pcm.byteLength;

  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, RIFF_PREAMBLE_BYTES + dataSize, true);
  writeAscii(view, 8, 'WAVE');

  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, PCM_FMT_CHUNK_SIZE, true);
  view.setUint16(20, PCM_FORMAT_CODE, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, options.sampleRate, true);
  view.setUint32(28, options.sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, bitsPerSample, true);

  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  new Uint8Array(buffer, WAV_HEADER_BYTES).set(new Uint8Array(pcm));

  return buffer;
}

function writeAscii(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
