// A port of duyo-backend/src/duyo/services/notes.py::build_graph, so the mock
// returns the graph the real server would build from the same notes rather
// than a hand-drawn one.

const LINK = /\[\[([^[\]|]{1,120})\]\]/g;
const TAG = /(?:^|(?<=\s))#([^\s#.,;:!?()[\]{}'"]{1,40})/gu;
const MIN_MENTION_TITLE = 4;

export function extractLinks(body) {
  const seen = [];
  for (const m of (body ?? '').matchAll(LINK)) {
    const t = m[1].trim();
    if (t && !seen.includes(t)) seen.push(t);
  }
  return seen;
}

export function extractTags(body) {
  const seen = [];
  for (const m of (body ?? '').matchAll(TAG)) {
    const t = m[1].trim().toLowerCase();
    if (t && !/^\d+$/.test(t) && !seen.includes(t)) seen.push(t);
  }
  return seen;
}

function proseOnly(body) {
  return body.replace(LINK, (s) => ' '.repeat(s.length)).replace(TAG, (s) => ' '.repeat(s.length));
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Unicode-aware whole-word match, like Python's \b on str patterns. */
function mentions(text, title) {
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(title)}(?![\\p{L}\\p{N}_])`, 'iu');
  return re.test(text);
}

export function buildGraph(notes) {
  const byKey = new Map();
  for (const n of notes) byKey.set(n.title.toLowerCase(), [n.id, n.title, 'note', n.colour]);

  const edges = [];
  const incoming = new Map();
  const seenPairs = new Set();
  const connect = (sourceTitle, key, kind = 'link') => {
    const targetTitle = byKey.get(key)[1];
    const pair = [sourceTitle.toLowerCase(), key].sort().join('\u0000');
    if (seenPairs.has(pair)) return;
    seenPairs.add(pair);
    edges.push({ source: sourceTitle, target: targetTitle, kind });
    incoming.set(key, (incoming.get(key) ?? 0) + 1);
  };

  for (const n of notes) {
    for (const link of extractLinks(n.body)) {
      const key = link.toLowerCase();
      if (key === n.title.toLowerCase()) continue;
      if (!byKey.has(key)) byKey.set(key, [null, link, 'unwritten', null]);
      connect(n.title, key);
    }
    for (const tag of extractTags(n.body)) {
      const key = `#${tag}`;
      if (!byKey.has(key)) byKey.set(key, [null, `#${tag}`, 'tag', null]);
      connect(n.title, key, 'tag');
    }
  }
  for (const n of notes) {
    const text = proseOnly(n.body);
    for (const other of notes) {
      if (other.title.toLowerCase() === n.title.toLowerCase()) continue;
      if (other.title.length < MIN_MENTION_TITLE) continue;
      if (mentions(text, other.title)) connect(n.title, other.title.toLowerCase(), 'mention');
    }
  }

  const nodes = [...byKey.entries()].map(([key, [id, title, kind, colour]]) => ({
    id, title, links: incoming.get(key) ?? 0, exists: kind === 'note', kind, colour,
  }));
  nodes.sort((a, b) => b.links - a.links || a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
  return { nodes, edges };
}

export function tagsByUse(notes) {
  const counts = new Map();
  for (const n of notes) for (const t of extractTags(n.body)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}
