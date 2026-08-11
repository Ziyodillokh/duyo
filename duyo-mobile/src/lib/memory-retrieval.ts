import { type MemoryRecord } from '@/lib/memory-db';
import { overlapScore, tokenize } from '@/lib/memory-text';

/**
 * "Relevant memory retrieval" (spec §6) — picks the few memories worth
 * sending to the LLM for ONE message, out of however many the child has.
 * Never the whole store: with 100+ memories, sending all of them would blow
 * the prompt budget, leak unrelated personal facts into an unrelated
 * question, and cost tokens/latency for nothing the model needed.
 *
 * Keyword-overlap scoring rather than embeddings — there is no on-device
 * embedding model to run, and a child's memory set is small enough (tens to
 * low hundreds of rows) that a linear scan is effectively instant.
 */

const DEFAULT_TOP_K = 4; // ChatRequest.MAX_MEMORY_CONTEXT_ITEMS backend cap is 6; leave headroom.
const MIN_SCORE = 1; // at least one shared significant token

export function selectRelevantMemories(
  query: string,
  memories: readonly MemoryRecord[],
  topK: number = DEFAULT_TOP_K,
): MemoryRecord[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0 || memories.length === 0) return [];

  const scored = memories
    .map((memory) => ({
      memory,
      score: overlapScore(queryTokens, tokenize(memory.content)),
    }))
    .filter((entry) => entry.score >= MIN_SCORE)
    // Higher overlap first; ties broken by recency (more recently
    // added/edited memories are more likely to reflect the current state).
    .sort((a, b) => b.score - a.score || b.memory.updatedAt - a.memory.updatedAt);

  return scored.slice(0, topK).map((entry) => entry.memory);
}

/** The plain strings ChatRequest.memory_context expects — content only, nothing else leaves the device. */
export function toMemoryContextLines(memories: readonly MemoryRecord[]): string[] {
  return memories.map((m) => m.content);
}
