import { addRelation, type MemoryRecord } from '@/lib/memory-db';
import { overlapScore, tokenize } from '@/lib/memory-text';

/**
 * The knowledge-graph half of local memory (spec §8) — memories are not
 * just a flat list; two memories that share a real concept ("AI agentlar"
 * showing up in both a `research` fact and an `interests` fact) are linked
 * so "Mening Xotiram" can show that structure, the way Obsidian links notes.
 *
 * Auto-linking only, on a shared significant keyword — there is no on-device
 * LLM to ask "are these related?", and asking the child to hand-link facts
 * DUYO itself extracted would defeat the point of automatic capture. This
 * mirrors duyo-backend's ChildNote graph (services/notes.py) in spirit —
 * nodes + typed edges — without copying its [[wiki-link]] mechanic, which
 * only makes sense for text the child deliberately writes and cross-references.
 */

// Two memories need at least this many shared significant tokens to be
// worth a visible edge — 1 shared common-ish word is usually coincidence.
const MIN_SHARED_TOKENS = 2;

// A new memory is only compared against this many most-recent existing
// memories — a family's memory set stays small, but this keeps linking
// O(n) against a bound rather than O(n) against an ever-growing table.
const MAX_CANDIDATES_SCANNED = 200;

/**
 * Link `newMemory` to whichever of `existing` it shares enough vocabulary
 * with. Call once, right after `addMemory` — see store/memory.ts.
 */
export async function autoLinkMemory(
  newMemory: MemoryRecord,
  existing: readonly MemoryRecord[],
): Promise<void> {
  const newTokens = tokenize(newMemory.content);
  if (newTokens.length === 0) return;

  const candidates = existing.slice(0, MAX_CANDIDATES_SCANNED);
  for (const other of candidates) {
    if (other.id === newMemory.id) continue;
    const score = overlapScore(newTokens, tokenize(other.content));
    if (score >= MIN_SHARED_TOKENS) {
      await addRelation(newMemory.childId, newMemory.id, other.id, 'keyword');
    }
  }
}

export interface GraphNode {
  id: string;
  label: string; // first few words of the memory — enough to recognise it in a graph view
  category: MemoryRecord['category'];
}

export interface GraphEdge {
  source: string;
  target: string;
}

const NODE_LABEL_MAX = 40;

/** Pure view-model builder for the graph screen — no I/O, just shapes what memory-db already loaded. */
export function buildMemoryGraph(
  memories: readonly MemoryRecord[],
  relations: readonly { fromId: string; toId: string }[],
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes = memories.map((m) => ({
    id: m.id,
    label: m.content.length > NODE_LABEL_MAX
      ? `${m.content.slice(0, NODE_LABEL_MAX)}…`
      : m.content,
    category: m.category,
  }));
  const known = new Set(memories.map((m) => m.id));
  const edges = relations
    .filter((r) => known.has(r.fromId) && known.has(r.toId))
    .map((r) => ({ source: r.fromId, target: r.toId }));
  return { nodes, edges };
}
