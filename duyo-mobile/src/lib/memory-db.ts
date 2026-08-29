import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

import { decryptText, encryptText } from '@/lib/memory-crypto';

/**
 * The on-device personal-memory database — the source of truth for
 * "Local-First Personal AI Memory". This is a NEW subsystem, additive to
 * the app: it does not replace or read from ChildGoal, ChildNote or Report
 * (those stay exactly as they are server-side — see api/endpoints/goals.ts
 * and notes.ts — because they serve purposes this store deliberately does
 * not: parent-set goals, social goal-matching, and crisis-scanned notes).
 *
 * One SQLite file for the whole app, all rows scoped by `childId` — mirrors
 * how the backend scopes every table by child_id rather than opening one
 * database per child. `content` is the only column that ever touches
 * plaintext personal information; it is encrypted at rest via
 * memory-crypto.ts and only ever decrypted into memory, never written back
 * to disk in the clear. `category` stays plaintext by design — it is a
 * coarse taxonomy tag ("interests", "learning", ...), not content, and the
 * management UI needs it to filter/group without decrypting the whole table
 * on every render.
 */

export type MemoryCategory =
  | 'profile'
  | 'preferences'
  | 'interests'
  | 'learning'
  | 'research'
  | 'notes';

export const MEMORY_CATEGORIES: readonly MemoryCategory[] = [
  'profile',
  'preferences',
  'interests',
  'learning',
  'research',
  'notes',
];

export type MemorySource = 'chat_confirmed' | 'manual';

export interface MemoryRecord {
  id: string;
  childId: string;
  category: MemoryCategory;
  content: string; // decrypted plaintext — never persisted in this form
  source: MemorySource;
  createdAt: number;
  updatedAt: number;
}

export type RelationKind = 'keyword';

export interface MemoryRelation {
  id: string;
  childId: string;
  fromId: string;
  toId: string;
  kind: RelationKind;
  createdAt: number;
}

interface MemoryRow {
  id: string;
  child_id: string;
  category: string;
  content_enc: string;
  source: string;
  created_at: number;
  updated_at: number;
}

interface RelationRow {
  id: string;
  child_id: string;
  from_id: string;
  to_id: string;
  kind: string;
  created_at: number;
}

const DB_NAME = 'duyo-memory.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      // WAL — a settings-screen "delete all" and an in-flight chat write
      // should never deadlock each other.
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY NOT NULL,
          child_id TEXT NOT NULL,
          category TEXT NOT NULL,
          content_enc TEXT NOT NULL,
          source TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_memories_child ON memories(child_id);

        CREATE TABLE IF NOT EXISTS memory_relations (
          id TEXT PRIMARY KEY NOT NULL,
          child_id TEXT NOT NULL,
          from_id TEXT NOT NULL,
          to_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_relations_child ON memory_relations(child_id);
      `);
      return db;
    });
  }
  return dbPromise;
}

async function rowToRecord(row: MemoryRow): Promise<MemoryRecord> {
  return {
    id: row.id,
    childId: row.child_id,
    category: row.category as MemoryCategory,
    content: await decryptText(row.content_enc),
    source: row.source as MemorySource,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function relationFromRow(row: RelationRow): MemoryRelation {
  return {
    id: row.id,
    childId: row.child_id,
    fromId: row.from_id,
    toId: row.to_id,
    kind: row.kind as RelationKind,
    createdAt: row.created_at,
  };
}

export async function addMemory(
  childId: string,
  category: MemoryCategory,
  content: string,
  source: MemorySource,
): Promise<MemoryRecord> {
  const db = await getDb();
  const now = Date.now();
  const id = Crypto.randomUUID();
  const contentEnc = await encryptText(content);
  await db.runAsync(
    `INSERT INTO memories (id, child_id, category, content_enc, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, childId, category, contentEnc, source, now, now],
  );
  return { id, childId, category, content, source, createdAt: now, updatedAt: now };
}

/**
 * All memories for one child, newest first. Decrypts every row — see module
 * note on scale.
 *
 * A row that fails to decrypt is SKIPPED, not thrown: `Promise.all` would
 * fail the whole call on one bad ciphertext, so a single corrupted row would
 * blank the entire "Mening Xotiram" screen and silently strip local context
 * from every chat turn. One unreadable memory should cost one memory.
 * `undecryptable` reports how many were dropped so a caller can tell the
 * difference between "no memories" and "memories that cannot be read".
 */
export interface MemoryListResult {
  memories: MemoryRecord[];
  undecryptable: number;
}

export async function listMemoriesDetailed(
  childId: string,
): Promise<MemoryListResult> {
  const db = await getDb();
  const rows = await db.getAllAsync<MemoryRow>(
    `SELECT * FROM memories WHERE child_id = ? ORDER BY created_at DESC`,
    [childId],
  );
  const memories: MemoryRecord[] = [];
  let undecryptable = 0;
  for (const row of rows) {
    try {
      memories.push(await rowToRecord(row));
    } catch {
      undecryptable += 1;
    }
  }
  return { memories, undecryptable };
}

export async function updateMemoryContent(
  childId: string,
  id: string,
  content: string,
): Promise<void> {
  const db = await getDb();
  const contentEnc = await encryptText(content);
  await db.runAsync(
    `UPDATE memories SET content_enc = ?, updated_at = ? WHERE id = ? AND child_id = ?`,
    [contentEnc, Date.now(), id, childId],
  );
}

export async function deleteMemory(childId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM memories WHERE id = ? AND child_id = ?`, [id, childId]);
    await db.runAsync(
      `DELETE FROM memory_relations WHERE child_id = ? AND (from_id = ? OR to_id = ?)`,
      [childId, id, id],
    );
  });
}

/** "Delete all my memories" (TEST 6 / spec §9) — every row for this child, both tables. */
export async function deleteAllMemories(childId: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM memories WHERE child_id = ?`, [childId]);
    await db.runAsync(`DELETE FROM memory_relations WHERE child_id = ?`, [childId]);
  });
}

export async function countByCategory(
  childId: string,
): Promise<Record<MemoryCategory, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ category: string; n: number }>(
    `SELECT category, COUNT(*) as n FROM memories WHERE child_id = ? GROUP BY category`,
    [childId],
  );
  const counts = Object.fromEntries(MEMORY_CATEGORIES.map((c) => [c, 0])) as Record<
    MemoryCategory,
    number
  >;
  for (const row of rows) {
    if (row.category in counts) counts[row.category as MemoryCategory] = row.n;
  }
  return counts;
}

// --- Relations (knowledge graph edges) --------------------------------

export async function addRelation(
  childId: string,
  fromId: string,
  toId: string,
  kind: RelationKind,
): Promise<void> {
  if (fromId === toId) return;
  const db = await getDb();
  // Undirected in practice — never store the same pair twice regardless of order.
  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM memory_relations
     WHERE child_id = ? AND ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?))`,
    [childId, fromId, toId, toId, fromId],
  );
  if (existing) return;
  await db.runAsync(
    `INSERT INTO memory_relations (id, child_id, from_id, to_id, kind, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [Crypto.randomUUID(), childId, fromId, toId, kind, Date.now()],
  );
}

export async function listRelations(childId: string): Promise<MemoryRelation[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<RelationRow>(
    `SELECT * FROM memory_relations WHERE child_id = ?`,
    [childId],
  );
  return rows.map(relationFromRow);
}
