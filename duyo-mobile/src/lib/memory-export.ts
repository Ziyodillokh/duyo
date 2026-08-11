import { type MemoryRecord } from '@/lib/memory-db';

/**
 * Manual, user-initiated export (spec §9/§10) — the closest thing to a
 * backup this architecture offers, deliberately. There is no automatic
 * cloud sync: the device is the only copy, so a reinstall or a lost phone
 * loses the memory unless the child/parent exported it themselves first.
 * Accepted trade-off for now (see the delivery report) — this function is
 * what makes that trade-off survivable rather than a silent data loss trap.
 *
 * Returns a plain JSON string; the caller decides how to hand it to the
 * user (system share sheet, save-to-file, etc.) — kept out of this module
 * so it stays testable without touching React Native APIs.
 */
export interface MemoryExport {
  exported_at: string;
  version: 1;
  memories: {
    category: MemoryRecord['category'];
    content: string;
    source: MemoryRecord['source'];
    created_at: string;
  }[];
}

export function buildMemoryExport(memories: readonly MemoryRecord[]): MemoryExport {
  return {
    exported_at: new Date().toISOString(),
    version: 1,
    memories: memories.map((m) => ({
      category: m.category,
      content: m.content,
      source: m.source,
      created_at: new Date(m.createdAt).toISOString(),
    })),
  };
}

export function memoryExportToJson(memories: readonly MemoryRecord[]): string {
  return JSON.stringify(buildMemoryExport(memories), null, 2);
}
