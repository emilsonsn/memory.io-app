import { NoteColor } from '../colors';

export interface MemoryPayload {
  title: string;
  content: string;
  color: NoteColor | null;
  due_date: string | null;
  category_id: string | null;
}
