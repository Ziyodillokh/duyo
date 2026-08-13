import type { GraphEdge, GraphNode } from '@/api/endpoints/notes';

/**
 * The one sentence the insights card gets to say about the child's graph,
 * picked by what would help most right now: nothing written yet → start; two
 * clusters that never touch → suggest the bridge; a [[link]] with no note
 * behind it → offer to write it; a genuinely central note → name it. Every
 * branch is a fact read off the graph — no score is invented and nothing is
 * random, so the same graph always yields the same sentence.
 */

export type BrainInsight =
  | { kind: 'start' }
  | { kind: 'bridge'; a: string; b: string }
  | { kind: 'unwritten'; title: string }
  | { kind: 'hub'; title: string; links: number }
  | { kind: 'growing' };

export interface InsightSummary {
  clusters: number;
  notes: number;
  links: number;
  insight: BrainInsight;
}

/** Below this, "map centre" would be an overclaim for an ordinary note. */
const HUB_MIN_LINKS = 3;

/** Tag nodes carry their '#' in edge endpoints; the tags list never does. */
function norm(title: string): string {
  return title.replace(/^#/, '').toLowerCase();
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/** Tag → its member note titles (normalised), read from the tag edges. */
function clusterMembers(
  edges: GraphEdge[],
  tags: string[],
): Map<string, Set<string>> {
  const tagByNorm = new Map(tags.map((t) => [norm(t), t]));
  const members = new Map<string, Set<string>>(
    tags.map((t) => [t, new Set<string>()]),
  );
  for (const edge of edges) {
    if (edge.kind !== 'tag') continue;
    const sourceTag = tagByNorm.get(norm(edge.source));
    const targetTag = tagByNorm.get(norm(edge.target));
    if (sourceTag !== undefined && targetTag === undefined) {
      members.get(sourceTag)?.add(norm(edge.target));
    } else if (targetTag !== undefined && sourceTag === undefined) {
      members.get(targetTag)?.add(norm(edge.source));
    }
  }
  return members;
}

/**
 * The first pair of clusters (in tag order, so the pick is stable) that are
 * both substantial — two or more notes each — yet share not a single link or
 * mention between their members. Identical member sets are skipped: two tags
 * on the same notes are one cluster wearing two names, not a gap to bridge.
 */
function findBridge(edges: GraphEdge[], tags: string[]): BrainInsight | null {
  const members = clusterMembers(edges, tags);
  const crossEdges = edges.filter((e) => e.kind !== 'tag');
  for (let i = 0; i < tags.length; i++) {
    for (let j = i + 1; j < tags.length; j++) {
      const a = members.get(tags[i]);
      const b = members.get(tags[j]);
      if (!a || !b || a.size < 2 || b.size < 2 || sameSet(a, b)) continue;
      const connected = crossEdges.some((e) => {
        const s = norm(e.source);
        const t = norm(e.target);
        return (a.has(s) && b.has(t)) || (a.has(t) && b.has(s));
      });
      if (!connected) return { kind: 'bridge', a: tags[i], b: tags[j] };
    }
  }
  return null;
}

export function summarizeGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  tags: string[],
): InsightSummary {
  const written = nodes.filter((n) => n.kind === 'note' && n.exists);
  const counts = {
    clusters: tags.length,
    notes: written.length,
    links: edges.filter((e) => e.kind !== 'tag').length,
  };

  if (written.length === 0) return { ...counts, insight: { kind: 'start' } };

  const bridge = findBridge(edges, tags);
  if (bridge) return { ...counts, insight: bridge };

  const unwritten = nodes.find((n) => !n.exists && n.kind !== 'tag');
  if (unwritten) {
    return { ...counts, insight: { kind: 'unwritten', title: unwritten.title } };
  }

  let hub: GraphNode | null = null;
  for (const n of written) {
    if (n.links >= HUB_MIN_LINKS && (hub === null || n.links > hub.links)) {
      hub = n;
    }
  }
  if (hub) {
    return {
      ...counts,
      insight: { kind: 'hub', title: hub.title, links: hub.links },
    };
  }

  return { ...counts, insight: { kind: 'growing' } };
}
