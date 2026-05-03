import { NoteColor } from '../colors';

export interface Category {
  id: string;
  label: string;
  description: string;
  color: NoteColor | null;
  parent_id: string | null;
  parent?: Category | null;
  children?: Category[];
  created_at: string;
  updated_at: string;
}
