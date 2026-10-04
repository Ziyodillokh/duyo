/**
 * "Listen to DUYO": plays the owner's recording of DUYO introducing itself,
 * while the 3D DUYO beside the copy waves, nods and moves its mouth with it.
 *
 * Rendered only once the recording is known to exist (duyoVoice probes for
 * it), so the page never offers a button that does nothing. The captions
 * show only if the transcript has been filled in, and are announced politely
 * so a screen reader hears the words the audio says.
 */

import { useSyncExternalStore } from 'react';
import { DUYO_VOICE } from '../content';
import { duyoVoice } from './duyoVoice';
import type { VoiceStatus } from './duyoVoice';

const useVoiceStatus = (): VoiceStatus =>
  useSyncExternalStore(duyoVoice.subscribe, duyoVoice.status, () => 'checking');

/** Three bars: still when idle, bouncing while DUYO talks (CSS, off under reduced motion). */
function Bars() {
  return (
    <span className="voice-bars" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

/**
 * Below 640px the button is a round one beside the download, its label read
 * out but not shown: as a pill it would wrap onto a row of its own and push
 * the hero's caption up over DUYO. DUYO itself answers a tap there too.
 */
export function VoiceButton() {
  const status = useVoiceStatus();
  if (status !== 'ready' && status !== 'playing') return null;
  const playing = status === 'playing';
  const label = playing ? DUYO_VOICE.stop : DUYO_VOICE.listen;
  return (
    <button
      type="button"
      // The label itself says what a press does now ("listen" / "stop"), so
      // it is not also marked as a pressed toggle, which would read twice.
      onClick={duyoVoice.toggle}
      title={label}
      className={`btn-voice inline-flex h-12 w-12 shrink-0 items-center justify-center whitespace-nowrap rounded-full text-[15px] font-medium sm:w-auto sm:gap-2.5 sm:px-5 ${playing ? 'is-playing' : ''}`}
    >
      <Bars />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </button>
  );
}

export function VoiceCaption() {
  const status = useVoiceStatus();
  const text = DUYO_VOICE.transcript.trim();
  if (!text) return null;
  return (
    <p className="voice-caption mt-5 max-w-[30rem] text-[15px] leading-relaxed" aria-live="polite">
      {status === 'playing' ? `«${text}»` : ''}
    </p>
  );
}
