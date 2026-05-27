// Allow side-effect imports of stylesheets and CSS Module imports.
declare module '*.css';
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

// @fugood/react-native-audio-pcm-stream ships its types under the wrong
// module name ('react-native-live-audio-stream'). Re-declare them here so
// TypeScript resolves the actual package path.
declare module '@fugood/react-native-audio-pcm-stream' {
  export interface PcmStreamOptions {
    sampleRate: number;
    channels: 1 | 2;
    bitsPerSample: 8 | 16;
    audioSource?: number;
    bufferSize?: number;
    wavFile: string;
  }

  export interface PcmStreamRecorder {
    init: (options: PcmStreamOptions) => void;
    start: () => void;
    stop: () => Promise<string>;
    on: (event: 'data', callback: (data: string) => void) => void;
  }

  const AudioRecord: PcmStreamRecorder;
  export default AudioRecord;
}
