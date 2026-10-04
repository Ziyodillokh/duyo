/**
 * The copy's typography, applied at render so content.ts stays plain text.
 */

/**
 * Typographic glue, applied at render so content.ts stays plain text: an em
 * dash never starts a line, it stays with the word before it.
 */
export const typeset = (text: string): string => text.replace(/ — /g, '\u00a0— ');

/**
 * Text never breaks inside a hyphenated compound ("qadamma-qadam",
 * "bosqichma-bosqich", "bir-biriga"): split there, it reads as two words. Used for
 * headings, body and proof labels alike. The hero's phone size is set so its
 * longest compound fits a 320px screen whole.
 */
export function Words({ text }: { text: string }) {
  const words = text.split(' ');
  return (
    <>
      {words.map((w, i) => {
        const sep = i < words.length - 1 ? ' ' : '';
        if (!w.includes('-')) return w + sep;
        return (
          <span key={i}>
            <span className="whitespace-nowrap">{w}</span>
            {sep}
          </span>
        );
      })}
    </>
  );
}

/**
 * A heading set in lines. A line break in content.ts ("\n") makes a line of
 * its own, and with `accent` the last line carries the light — the robot
 * page's headings, as on its concept deck. Otherwise the hero sets each
 * sentence on a line of its own at every width — "Salom!" is DUYO's beat
 * before it says who it is, short enough that even a 320px phone holds
 * "Men — DUYO." whole — and other headings simply flow.
 */
export function HeadingText({ text, bySentence, accent = false }: { text: string; bySentence: boolean; accent?: boolean }) {
  const t = typeset(text);
  const lines = t.includes('\n') ? t.split('\n') : bySentence ? t.split(/(?<=[.!?]) /) : null;
  if (!lines) return <Words text={t} />;
  return (
    <>
      {lines.map((line, i) => (
        <span key={line} className={`block${accent && i === lines.length - 1 ? ' accent' : ''}`}>
          {i > 0 ? ' ' : ''}
          <Words text={line} />
        </span>
      ))}
    </>
  );
}
