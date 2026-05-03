import { Category } from '../categories';
import { NoteColor } from '../colors';

export interface Memory {
  id: string;
  title: string;
  content: string;
  color: NoteColor | null;
  due_date: string | null;
  categories: Category[];
  created_at: string;
  updated_at: string;
}
