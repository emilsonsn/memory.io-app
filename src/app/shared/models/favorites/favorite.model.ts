import { Category } from '../categories';
import { Memory } from '../memories';

export type FavoriteType = 'memory' | 'category';

export interface Favorite {
  id: string;
  type: FavoriteType;
  memory_id: string | null;
  category_id: string | null;
  memory?: Memory | null;
  category?: Category | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface FavoritePayload {
  memory_id?: string | null;
  category_id?: string | null;
}
