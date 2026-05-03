import { NoteColor } from '../colors';

export interface CategoryPayload {
  label: string;
  description: string;
  color: NoteColor | null;
  parent_id: string | null;
}
