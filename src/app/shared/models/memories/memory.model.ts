import { Category } from '../categories';
import { NoteColor } from '../colors';

export interface Memory {
  id: string;
  title: string;
  content: string;
  color: NoteColor | null;
  due_date: string | null;
  category_id: string | null;
  category: Category | null;
  created_at: string;
  updated_at: string;
}
