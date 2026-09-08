/**
 * Is this worth asking the board solver about?
 *
 * A cheap local filter in front of an expensive one. `POST /chat/board` is a
 * second model call on top of the reply the child is already waiting for, and
 * the server answers `is_problem: false` for most of what a child says — so
 * the point here is to not spend that call on "salom".
 *
 * Deliberately generous: it only rejects what is obviously not a question.
 * Deciding what actually deserves a board is the model's job, and a filter
 * that guesses too hard is a board that never appears.
 *
 * Lived in voice.tsx while voice was the only surface with a board. The text
 * chat has one now too, and two copies of a rule like this is one copy that
 * quietly stops matching.
 */

// Speech-to-text emits several apostrophe glyphs for o'/g', so match any.
const APOS = "['‘’ʻʼ]?";

const PURE_SMALL_TALK = new RegExp(
  `^(salom|assalomu?\\s*alaykum|qalaysan|rahmat|xayr|ha|yo${APOS}q|xo${APOS}p|` +
    `yaxshi|zo${APOS}r|charchadim|zerikdim|uxlayman)[\\s.!?]*$`,
  'i',
);

export function worthAsking(text: string): boolean {
  const t = text.trim();
  // Too short to carry a problem statement.
  if (t.length < 8) return false;
  // The whole utterance is a greeting or an acknowledgement.
  return !PURE_SMALL_TALK.test(t);
}
