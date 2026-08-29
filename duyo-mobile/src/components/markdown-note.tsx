import { Fragment } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/text';
import { lift } from '@/lib/glass';

const PRIMARY = '#2F6FE4';
const INK = '#22406F';
const MUTED = '#8CA3CB';
const GREEN = '#22B573';
const PLACEHOLDER = '#7693C2';

/**
 * A #tag's gold.
 *
 * The tag used to be `text-neon-yellow` (#FDC700), which was picked for a note
 * card that was always dark navy. On the light glass card that yellow is a
 * highlighter stripe with no letters in it, so it steps down to the palette's
 * darker gold — the same hue family, still unmistakably not a [[link]], and
 * readable on white.
 */
const TAG = '#D08700';

interface Props {
  body: string;
  /** Tapping a [[link]] — the title is passed through unresolved. */
  onLinkPress?: (title: string) => void;
  /**
   * Press-and-hold a [[link]]. Obsidian previews a note when you hover it with
   * Ctrl held; a phone has no hover, and a long press is the gesture that
   * means "show me more without going there".
   *
   * DEVICE ONLY. react-native-web's Text handles onPress but not onLongPress,
   * so on web the hold falls through to a plain tap and simply opens the note
   * — a degraded path, not a broken one. Web is the dev harness here; the
   * product ships to iOS and Android.
   */
  onLinkHold?: (title: string) => void;
  onTagPress?: (tag: string) => void;
  /**
   * Titles that actually exist, lowercased. A [[link]] to something unwritten
   * is drawn differently — Obsidian shows it muted, and the difference is what
   * tells a child "this one is still waiting for you".
   */
  existing?: Set<string>;
  /** Lowercased title → body, for ![[embeds]]. Missing ones show as a stub. */
  embeds?: Record<string, string>;
  /** Toggle the checkbox on line `index`. Omit to render them read-only. */
  onToggleCheck?: (index: number) => void;
  /** Guards ![[embed]] recursion — an embed renders its own body but no deeper. */
  depth?: number;
}

// Inline spans, in the order they're tried. [[links]] and #tags come first so
// a link containing an asterisk isn't split by the emphasis rules.
const INLINE = /(\[\[[^\[\]]{1,120}\]\])|(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|((?:^|\s)#[^\s#.,;:!?()\[\]{}'"]{1,40})/;

const CHECK = /^(\s*)[-*]\s+\[([ xX])\]\s+(.*)$/;
const EMBED = /^!\[\[([^\[\]]{1,120})\]\]$/;
const CALLOUT = /^>\s*\[!(\w+)\]\s*(.*)$/;
const QUOTED = /^>\s?(.*)$/;

// Obsidian ships a long list of callout types; these are the ones a child has
// any use for, each with the tone it should read in.
const CALLOUTS: Record<string, { icon: string; colour: string; label: string }> = {
  note: { icon: '📝', colour: '#60A5FA', label: 'Eslatma' },
  tip: { icon: '💡', colour: '#FDC700', label: 'Maslahat' },
  info: { icon: 'ℹ️', colour: '#60A5FA', label: "Ma'lumot" },
  question: { icon: '❓', colour: '#C084FC', label: 'Savol' },
  warning: { icon: '⚠️', colour: '#FB923C', label: 'Diqqat' },
  success: { icon: '✅', colour: '#4ADE80', label: 'Yaxshi' },
};

type Block =
  | { kind: 'line'; text: string; index: number }
  | { kind: 'embed'; title: string; index: number }
  | { kind: 'callout'; type: string; title: string; lines: string[]; index: number };

/** Group raw lines into blocks, so a callout's continuation lines join it. */
function toBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  for (let i = 0; i < lines.length; i++) {
    const embed = EMBED.exec(lines[i].trim());
    if (embed) {
      blocks.push({ kind: 'embed', title: embed[1].trim(), index: i });
      continue;
    }
    const callout = CALLOUT.exec(lines[i]);
    if (callout) {
      const body: string[] = [];
      while (i + 1 < lines.length && QUOTED.test(lines[i + 1]) && !CALLOUT.test(lines[i + 1])) {
        body.push(QUOTED.exec(lines[++i])![1]);
      }
      blocks.push({
        kind: 'callout',
        type: callout[1].toLowerCase(),
        title: callout[2].trim(),
        lines: body,
        index: i,
      });
      continue;
    }
    blocks.push({ kind: 'line', text: lines[i], index: i });
  }
  return blocks;
}

/**
 * The small slice of Markdown a child actually writes.
 *
 * Hand-rolled rather than pulled from a library: the app renders to React
 * Native, where the usual Markdown packages either target the DOM or drag in a
 * WebView. Supported: # headings, - bullets, - [ ] checkboxes, **bold**,
 * *italic*, `code`, [[links]], ![[embeds]], > [!callouts] and #tags. Anything
 * else renders as the plain text it is, which is the right failure for a
 * child's notebook — nothing disappears.
 */
export function MarkdownNote({
  body,
  onLinkPress,
  onLinkHold,
  onTagPress,
  existing,
  embeds,
  onToggleCheck,
  depth = 0,
}: Props) {
  const blocks = toBlocks((body || '').split('\n'));
  const inline = { onLinkPress, onLinkHold, onTagPress, existing };

  return (
    <View>
      {blocks.map((b) => {
        if (b.kind === 'embed') {
          return (
            <EmbedCard
              key={b.index}
              title={b.title}
              body={embeds?.[b.title.toLowerCase()]}
              depth={depth}
              onLinkPress={onLinkPress}
              onLinkHold={onLinkHold}
              onTagPress={onTagPress}
              existing={existing}
            />
          );
        }
        if (b.kind === 'callout') {
          return <Callout key={b.index} block={b} {...inline} />;
        }
        return (
          <Line
            key={b.index}
            text={b.text}
            index={b.index}
            onToggleCheck={onToggleCheck}
            {...inline}
          />
        );
      })}
    </View>
  );
}

function EmbedCard({
  title,
  body,
  depth,
  onLinkPress,
  onLinkHold,
  onTagPress,
  existing,
}: {
  title: string;
  body?: string;
  depth: number;
} & Pick<Props, 'onLinkPress' | 'onLinkHold' | 'onTagPress' | 'existing'>) {
  return (
    <View style={styles.embed}>
      <Text
        style={styles.embedTitle}
        onPress={onLinkPress ? () => onLinkPress(title) : undefined}
      >
        📄 {title}
      </Text>
      {body !== undefined && depth < 1 ? (
        <MarkdownNote
          body={body}
          onLinkPress={onLinkPress}
          onLinkHold={onLinkHold}
          onTagPress={onTagPress}
          existing={existing}
          depth={depth + 1}
        />
      ) : (
        <Text style={styles.stub}>
          {body === undefined ? 'Bu qayd hali yozilmagan.' : '…'}
        </Text>
      )}
    </View>
  );
}

function Callout({
  block,
  onLinkPress,
  onLinkHold,
  onTagPress,
  existing,
}: {
  block: Extract<Block, { kind: 'callout' }>;
} & Pick<Props, 'onLinkPress' | 'onLinkHold' | 'onTagPress' | 'existing'>) {
  const style = CALLOUTS[block.type] ?? CALLOUTS.note;
  return (
    <View
      style={[
        styles.callout,
        { borderLeftColor: style.colour, backgroundColor: `${style.colour}14` },
      ]}
    >
      <Text style={[styles.calloutTitle, { color: style.colour }]}>
        {style.icon} {block.title || style.label}
      </Text>
      {block.lines.map((l, i) => (
        <Text key={i} style={styles.body}>
          <Inline
            text={l}
            onLinkPress={onLinkPress}
            onLinkHold={onLinkHold}
            onTagPress={onTagPress}
            existing={existing}
          />
        </Text>
      ))}
    </View>
  );
}

function Line({
  text,
  index,
  onLinkPress,
  onLinkHold,
  onTagPress,
  existing,
  onToggleCheck,
}: {
  text: string;
  index: number;
} & Pick<Props, 'onLinkPress' | 'onLinkHold' | 'onTagPress' | 'existing' | 'onToggleCheck'>) {
  if (text.trim() === '') return <View style={styles.blank} />;

  const heading = /^(#{1,3})\s+(.*)$/.exec(text);
  if (heading) {
    const level = heading[1].length;
    return (
      <Text
        style={[
          styles.heading,
          level === 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3,
        ]}
      >
        {heading[2]}
      </Text>
    );
  }

  // Checkbox before bullet: "- [ ] x" is also a valid bullet, and the box wins.
  const check = CHECK.exec(text);
  if (check) {
    const done = check[2] !== ' ';
    return (
      <View style={styles.checkRow}>
        {/* The touch target is 30x30 and the drawn box stays 20x20 inside it:
            hitSlop enlarges nothing on web, and a 20pt box is below every
            minimum-target guideline there is. The negative margins keep the
            box exactly where it sat before it gained the padding. */}
        <Pressable
          onPress={onToggleCheck ? () => onToggleCheck(index) : undefined}
          disabled={!onToggleCheck}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={check[3]}
          hitSlop={8}
          style={[styles.checkTarget, styles.focusable]}
        >
          <View style={[styles.checkBox, done ? styles.checkOn : styles.checkOff]}>
            {done ? <Text style={styles.tick}>✓</Text> : null}
          </View>
        </Pressable>
        <Text style={[styles.checkText, done ? styles.struck : null]}>
          <Text style={done ? undefined : styles.ink}>
            <Inline
              text={check[3]}
              onLinkPress={onLinkPress}
              onLinkHold={onLinkHold}
              onTagPress={onTagPress}
              existing={existing}
            />
          </Text>
        </Text>
      </View>
    );
  }

  const bullet = /^\s*[-*]\s+(.*)$/.exec(text);
  if (bullet) {
    return (
      <View style={styles.bulletRow}>
        <Text style={styles.bulletGlyph}>•</Text>
        <Text style={[styles.body, styles.bulletText]}>
          <Inline
            text={bullet[1]}
            onLinkPress={onLinkPress}
            onLinkHold={onLinkHold}
            onTagPress={onTagPress}
            existing={existing}
          />
        </Text>
      </View>
    );
  }

  return (
    <Text style={[styles.body, styles.paragraph]}>
      <Inline
        text={text}
        onLinkPress={onLinkPress}
        onLinkHold={onLinkHold}
        onTagPress={onTagPress}
        existing={existing}
      />
    </Text>
  );
}

function Inline({
  text,
  onLinkPress,
  onLinkHold,
  onTagPress,
  existing,
}: {
  text: string;
} & Pick<Props, 'onLinkPress' | 'onLinkHold' | 'onTagPress' | 'existing'>): React.ReactElement {
  const parts: React.ReactNode[] = [];
  let rest = text;
  let key = 0;

  while (rest) {
    const m = INLINE.exec(rest);
    if (!m || m.index === undefined) {
      parts.push(<Fragment key={key++}>{rest}</Fragment>);
      break;
    }
    if (m.index > 0) parts.push(<Fragment key={key++}>{rest.slice(0, m.index)}</Fragment>);

    const token = m[0];
    if (token.startsWith('[[')) {
      const title = token.slice(2, -2).trim();
      // No `existing` set means we can't tell — treat every link as written
      // rather than marking them all broken.
      const written = !existing || existing.has(title.toLowerCase());
      parts.push(
        <Text
          key={key++}
          style={written ? styles.link : styles.linkBroken}
          onPress={onLinkPress ? () => onLinkPress(title) : undefined}
          onLongPress={onLinkHold ? () => onLinkHold(title) : undefined}
        >
          {title}
        </Text>,
      );
    } else if (token.startsWith('`')) {
      parts.push(
        <Text key={key++} style={styles.code}>
          {token.slice(1, -1)}
        </Text>,
      );
    } else if (token.startsWith('**')) {
      parts.push(
        <Text key={key++} style={styles.bold}>
          {token.slice(2, -2)}
        </Text>,
      );
    } else if (token.startsWith('*')) {
      parts.push(
        <Text key={key++} style={styles.italic}>
          {token.slice(1, -1)}
        </Text>,
      );
    } else {
      // #tag — the match may carry the leading space that anchored it.
      const lead = token.startsWith('#') ? '' : token[0];
      const tag = token.trim().slice(1);
      if (lead) parts.push(<Fragment key={key++}>{lead}</Fragment>);
      parts.push(
        <Text
          key={key++}
          style={styles.tag}
          onPress={onTagPress ? () => onTagPress(tag.toLowerCase()) : undefined}
        >
          #{tag}
        </Text>,
      );
    }
    rest = rest.slice(m.index + token.length);
  }

  return <>{parts}</>;
}

/** Titles inside ![[embeds]], so the screen knows which bodies to fetch. */
export function extractEmbeds(body: string): string[] {
  const out = new Set<string>();
  for (const line of (body || '').split('\n')) {
    const m = EMBED.exec(line.trim());
    if (m) out.add(m[1].trim());
  }
  return [...out];
}

/** Flip the checkbox on `index`, returning the new body. */
export function toggleCheckbox(body: string, index: number): string {
  const lines = (body || '').split('\n');
  const m = CHECK.exec(lines[index] ?? '');
  if (!m) return body;
  lines[index] = `${m[1]}- [${m[2] === ' ' ? 'x' : ' '}] ${m[3]}`;
  return lines.join('\n');
}

const styles = StyleSheet.create({
  focusable: { outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle,

  // ── Blocks ────────────────────────────────────────────────────────────────
  // An embed and a callout are drawn ON the note's own card, so they take the
  // glass edges and no shadow at all — 'flush'. A pane that casts a shadow
  // onto the pane it is part of is the tell that a design stacks styles
  // instead of modelling depth.
  embed: {
    marginVertical: 8,
    borderRadius: 14,
    paddingLeft: 12,
    paddingVertical: 8,
    borderLeftWidth: 2,
    borderLeftColor: PRIMARY,
    backgroundColor: 'rgba(47,111,228,0.06)',
    boxShadow: lift('flush'),
  },
  embedTitle: { fontSize: 12, marginBottom: 4, color: PRIMARY },
  stub: { fontSize: 12, color: MUTED },

  callout: {
    marginVertical: 8,
    borderRadius: 14,
    padding: 12,
    borderLeftWidth: 3,
    boxShadow: lift('flush'),
  },
  calloutTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },

  // ── Lines ─────────────────────────────────────────────────────────────────
  blank: { height: 10 },

  heading: { fontWeight: '700', marginTop: 12, marginBottom: 4, color: INK },
  h1: { fontSize: 22 },
  h2: { fontSize: 19 },
  h3: { fontSize: 17 },

  body: { fontSize: 16, lineHeight: 24, color: INK },
  paragraph: { marginVertical: 2 },

  checkRow: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 3 },
  checkTarget: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -3,
    marginRight: 3,
  },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOff: { borderColor: PLACEHOLDER, backgroundColor: 'transparent' },
  checkOn: { borderColor: GREEN, backgroundColor: GREEN },
  tick: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  checkText: { fontSize: 16, lineHeight: 24, flexGrow: 1, flexShrink: 1 },
  struck: { textDecorationLine: 'line-through', color: MUTED },
  ink: { color: INK },

  bulletRow: { flexDirection: 'row', marginVertical: 2 },
  bulletGlyph: { width: 16, color: MUTED },
  bulletText: { flex: 1 },

  // ── Spans ─────────────────────────────────────────────────────────────────
  link: { color: PRIMARY },
  linkBroken: {
    color: MUTED,
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },
  // The mint the code span used to wear (#9BE8A8) was mixed for a navy card
  // and disappears on glass; the palette's green says the same thing.
  code: { fontFamily: 'monospace', color: GREEN },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  tag: { color: TAG },
});
