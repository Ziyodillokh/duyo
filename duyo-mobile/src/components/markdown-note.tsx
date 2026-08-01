import { Fragment } from 'react';
import { Text, View } from 'react-native';

interface Props {
  body: string;
  /** Tapping a [[link]] — the title is passed through unresolved. */
  onLinkPress?: (title: string) => void;
  onTagPress?: (tag: string) => void;
}

// Inline spans, in the order they're tried. [[links]] and #tags come first so
// a link containing an asterisk isn't split by the emphasis rules.
const INLINE = /(\[\[[^\[\]]{1,120}\]\])|(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|((?:^|\s)#[^\s#.,;:!?()\[\]{}'"]{1,40})/;

/**
 * The small slice of Markdown a child actually writes.
 *
 * Hand-rolled rather than pulled from a library: the app renders to React
 * Native, where the usual Markdown packages either target the DOM or drag in a
 * WebView. Supported: # headings, - bullets, **bold**, *italic*, `code`,
 * [[links]] and #tags. Anything else renders as the plain text it is, which is
 * the right failure for a child's notebook — nothing disappears.
 */
export function MarkdownNote({ body, onLinkPress, onTagPress }: Props) {
  const lines = (body || '').split('\n');

  return (
    <View>
      {lines.map((line, i) => (
        <Line key={i} text={line} onLinkPress={onLinkPress} onTagPress={onTagPress} />
      ))}
    </View>
  );
}

function Line({
  text,
  onLinkPress,
  onTagPress,
}: {
  text: string;
  onLinkPress?: (title: string) => void;
  onTagPress?: (tag: string) => void;
}) {
  if (text.trim() === '') return <View style={{ height: 10 }} />;

  const heading = /^(#{1,3})\s+(.*)$/.exec(text);
  if (heading) {
    const level = heading[1].length;
    return (
      <Text
        className="text-foreground dark:text-dark-text"
        style={{
          fontSize: level === 1 ? 22 : level === 2 ? 19 : 17,
          fontWeight: '700',
          marginTop: 12,
          marginBottom: 4,
        }}
      >
        {heading[2]}
      </Text>
    );
  }

  const bullet = /^\s*[-*]\s+(.*)$/.exec(text);
  if (bullet) {
    return (
      <View className="flex-row" style={{ marginVertical: 2 }}>
        <Text className="text-muted-foreground dark:text-dark-muted" style={{ width: 16 }}>
          •
        </Text>
        <Text className="text-base text-foreground dark:text-dark-text flex-1 leading-6">
          <Inline text={bullet[1]} onLinkPress={onLinkPress} onTagPress={onTagPress} />
        </Text>
      </View>
    );
  }

  return (
    <Text className="text-base text-foreground dark:text-dark-text leading-6" style={{ marginVertical: 2 }}>
      <Inline text={text} onLinkPress={onLinkPress} onTagPress={onTagPress} />
    </Text>
  );
}

function Inline({
  text,
  onLinkPress,
  onTagPress,
}: {
  text: string;
  onLinkPress?: (title: string) => void;
  onTagPress?: (tag: string) => void;
}): React.ReactElement {
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
      parts.push(
        <Text
          key={key++}
          className="text-neon-blue"
          onPress={onLinkPress ? () => onLinkPress(title) : undefined}
        >
          {title}
        </Text>,
      );
    } else if (token.startsWith('`')) {
      parts.push(
        <Text key={key++} style={{ fontFamily: 'monospace', color: '#9BE8A8' }}>
          {token.slice(1, -1)}
        </Text>,
      );
    } else if (token.startsWith('**')) {
      parts.push(
        <Text key={key++} style={{ fontWeight: '700' }}>
          {token.slice(2, -2)}
        </Text>,
      );
    } else if (token.startsWith('*')) {
      parts.push(
        <Text key={key++} style={{ fontStyle: 'italic' }}>
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
          className="text-neon-yellow"
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
