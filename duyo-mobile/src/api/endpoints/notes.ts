import { apiClient } from '@/api/client';

// Mirrors backend duyo.schemas.note. Notes are the child's own writing —
// [[links]] between them become the edges of the brain graph.

export interface NoteListItem {
  id: string;
  title: string;
  updated_at: string;
}

export interface Note extends NoteListItem {
  body: string;
  created_at: string;
  /** Parsed from the body server-side, never stored. */
  tags: string[];
}

export interface NoteSearchHit extends NoteListItem {
  excerpt: string;
}

export interface Backlink {
  id: string;
  title: string;
}

export type GraphNodeKind = 'note' | 'unwritten' | 'tag';

export interface GraphNode {
  /** null for an unwritten [[link]] and for every #tag node. */
  id: string | null;
  title: string;
  links: number;
  exists: boolean;
  kind: GraphNodeKind;
}

/** "link" is a deliberate [[wiki-link]]; "tag" joins notes through a #tag;
 *  "mention" is one note naming another in plain prose. */
export type GraphEdgeKind = 'link' | 'tag' | 'mention';

export interface GraphEdge {
  source: string;
  target: string;
  kind: GraphEdgeKind;
}

export interface NoteGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export async function listNotes(
  childId: string,
  tag?: string,
): Promise<NoteListItem[]> {
  const { data } = await apiClient.get<NoteListItem[]>('/notes', {
    params: { child_id: childId, tag },
  });
  return data;
}

export async function getNoteGraph(childId: string): Promise<NoteGraph> {
  const { data } = await apiClient.get<NoteGraph>('/notes/graph', {
    params: { child_id: childId },
  });
  return data;
}

export async function getNote(noteId: string): Promise<Note> {
  const { data } = await apiClient.get<Note>(`/notes/${noteId}`);
  return data;
}

export async function createNote(
  childId: string,
  title: string,
  body = '',
): Promise<Note> {
  const { data } = await apiClient.post<Note>('/notes', {
    child_id: childId,
    title,
    body,
  });
  return data;
}

export async function updateNote(
  noteId: string,
  patch: { title?: string; body?: string },
): Promise<Note> {
  const { data } = await apiClient.put<Note>(`/notes/${noteId}`, patch);
  return data;
}

export async function deleteNote(noteId: string): Promise<void> {
  await apiClient.delete(`/notes/${noteId}`);
}

export async function searchNotes(
  childId: string,
  q: string,
  tag?: string,
): Promise<NoteSearchHit[]> {
  const { data } = await apiClient.get<NoteSearchHit[]>('/notes/search', {
    params: { child_id: childId, q, tag },
  });
  return data;
}

export async function listTags(childId: string): Promise<string[]> {
  const { data } = await apiClient.get<string[]>('/notes/tags', {
    params: { child_id: childId },
  });
  return data;
}

/** Notes that link to this one — "who mentions this?". */
export async function getBacklinks(noteId: string): Promise<Backlink[]> {
  const { data } = await apiClient.get<Backlink[]>(`/notes/${noteId}/backlinks`);
  return data;
}
