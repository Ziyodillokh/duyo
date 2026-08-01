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
}

export interface GraphNode {
  /** null for a [[link]] whose note hasn't been written yet. */
  id: string | null;
  title: string;
  links: number;
  exists: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface NoteGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export async function listNotes(childId: string): Promise<NoteListItem[]> {
  const { data } = await apiClient.get<NoteListItem[]>('/notes', {
    params: { child_id: childId },
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
