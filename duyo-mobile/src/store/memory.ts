import { create } from 'zustand';

import * as memoryDb from '@/lib/memory-db';
import {
  type MemoryCategory,
  type MemoryRecord,
  type MemorySource,
} from '@/lib/memory-db';
import {
  forgetCachedKey,
  MemoryKeyLostError,
} from '@/lib/memory-crypto';
import { autoLinkMemory } from '@/lib/memory-graph';
import { describeGuardReasons, screenMemoryContent } from '@/lib/memory-guard';

/**
 * Reactive cache over the on-device memory database (memory-db.ts) for
 * "Mening Xotiram" and the chat screen's consent flow.
 *
 * Deliberately NOT a zustand `persist` store — SQLite (via memory-db.ts) is
 * already the persistence layer, encrypted at rest. Mirroring the whole
 * table into AsyncStorage/SecureStore on top of that would be exactly the
 * "SharedPreferences as a memory database" the architecture explicitly
 * rules out, and would leave a second, unencrypted copy of the child's
 * memory sitting in plain AsyncStorage. This store only holds an in-memory,
 * already-decrypted view for the current screen; closing the app drops it,
 * and the next `load()` re-reads (and re-decrypts) from SQLite.
 *
 * This store is also the ENFORCEMENT POINT for the Memory Guard. Every write
 * path — the chat consent prompt, the manual add form, and editing an
 * existing memory — goes through `addMemory`/`updateMemory` here, so
 * screening in one place means no screen can accidentally ship an
 * unscreened write. An earlier revision screened at each call site instead,
 * and the edit path was missed: a child could save an innocuous memory and
 * then rewrite it to hold a phone number, which would later be eligible to
 * ride along to the LLM as `memory_context`. Callers still screen ahead of
 * time when they want to explain the block to the user before writing (see
 * memory.tsx's AddMemoryForm); this layer is the backstop that cannot be
 * forgotten.
 */

/** Thrown by `addMemory`/`updateMemory` when the Memory Guard rejects the content. */
export class MemoryGuardError extends Error {
  readonly reasons: string[];
  constructor(reasons: string[]) {
    super(`memory blocked by guard: ${describeGuardReasons(reasons)}`);
    this.name = 'MemoryGuardError';
    this.reasons = reasons;
  }
}

interface MemoryState {
  childId: string | null;
  items: MemoryRecord[];
  counts: Record<MemoryCategory, number>;
  /** Rows present on disk that could not be decrypted — surfaced, never hidden. */
  undecryptable: number;
  /**
   * Set when the master key is gone but encrypted rows remain: the number
   * of rows that can no longer be opened. Null in every healthy state.
   *
   * Surfaced rather than swallowed. The data is unrecoverable either way —
   * AES-256 with a lost key is final — so the only question left is whether
   * the child is told, and an app that quietly looks empty is the wrong
   * answer for a notebook they filled themselves.
   */
  keyLost: number | null;
  loading: boolean;
  loaded: boolean;
  load: (childId: string) => Promise<void>;
  refresh: () => Promise<void>;
  addMemory: (
    category: MemoryCategory,
    content: string,
    source: MemorySource,
  ) => Promise<MemoryRecord>;
  updateMemory: (id: string, content: string) => Promise<void>;
  removeMemory: (id: string) => Promise<void>;
  removeAll: () => Promise<void>;
  /** Clear the orphaned rows and start a fresh key. Destructive, and only
   *  ever called from an explicit confirmation. */
  resetAfterKeyLoss: () => Promise<void>;
}

const EMPTY_COUNTS = Object.fromEntries(
  memoryDb.MEMORY_CATEGORIES.map((c) => [c, 0]),
) as Record<MemoryCategory, number>;

// Monotonic token identifying the most recently STARTED load. A load whose
// token is no longer current has been superseded and must not write its
// result — without this, a slow read for child A can resolve after a newer
// read for child B and paint sibling A's decrypted memories onto B's screen,
// which is exactly the leak `load`'s cache-clearing below exists to prevent.
let loadToken = 0;

export const useMemoryStore = create<MemoryState>()((set, get) => ({
  childId: null,
  items: [],
  counts: EMPTY_COUNTS,
  undecryptable: 0,
  keyLost: null,
  loading: false,
  loaded: false,

  load: async (childId) => {
    // A device may be handed between siblings (see child.ts's "active
    // child" note) — switching child must never show the previous child's
    // decrypted memory, even for a frame, so the cache is cleared first.
    if (get().childId !== childId) {
      set({
        childId,
        items: [],
        counts: EMPTY_COUNTS,
        undecryptable: 0,
        loaded: false,
      });
    }
    const token = ++loadToken;
    set({ loading: true });
    try {
      const [result, counts] = await Promise.all([
        memoryDb.listMemoriesDetailed(childId),
        memoryDb.countByCategory(childId),
      ]);
      if (token !== loadToken) return; // superseded — drop this result
      set({
        items: result.memories,
        undecryptable: result.undecryptable,
        counts,
        keyLost: null,
        loaded: true,
      });
    } catch (err) {
      // The one error worth a screen of its own. Everything else keeps the
      // old behaviour of propagating to the caller.
      if (err instanceof MemoryKeyLostError) {
        if (token === loadToken) {
          set({ keyLost: err.rows, items: [], counts: EMPTY_COUNTS, loaded: true });
        }
        return;
      }
      throw err;
    } finally {
      if (token === loadToken) set({ loading: false });
    }
  },

  refresh: async () => {
    const { childId } = get();
    if (!childId) return;
    await get().load(childId);
  },

  resetAfterKeyLoss: async () => {
    await memoryDb.purgeAllEncryptedRows();
    forgetCachedKey();
    set({ keyLost: null, items: [], counts: EMPTY_COUNTS, undecryptable: 0 });
    const { childId } = get();
    if (childId) await get().load(childId);
  },

  addMemory: async (category, content, source) => {
    const { childId, items } = get();
    if (!childId) throw new Error('memory store: no active child');
    const guard = screenMemoryContent(content);
    if (guard.verdict !== 'safe') throw new MemoryGuardError(guard.reasons);
    const record = await memoryDb.addMemory(childId, category, content, source);
    // Best-effort — a linking failure must never lose the memory itself.
    try {
      await autoLinkMemory(record, items);
    } catch {
      // ignore
    }
    await get().refresh();
    return record;
  },

  updateMemory: async (id, content) => {
    const { childId } = get();
    if (!childId) return;
    const guard = screenMemoryContent(content);
    if (guard.verdict !== 'safe') throw new MemoryGuardError(guard.reasons);
    await memoryDb.updateMemoryContent(childId, id, content);
    await get().refresh();
  },

  removeMemory: async (id) => {
    const { childId } = get();
    if (!childId) return;
    await memoryDb.deleteMemory(childId, id);
    await get().refresh();
  },

  removeAll: async () => {
    const { childId } = get();
    if (!childId) return;
    await memoryDb.deleteAllMemories(childId);
    // Clears `undecryptable` too — "delete all" deletes the unreadable rows
    // as well, so leaving the count behind would report phantom memories.
    set({ items: [], counts: EMPTY_COUNTS, undecryptable: 0 });
  },
}));
