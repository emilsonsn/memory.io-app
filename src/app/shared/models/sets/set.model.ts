export interface MemorySetCard {
  id?: string;
  front?: string;
  back?: string;
}

export interface MemorySet {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  cards?: MemorySetCard[];
  updated_at?: string;
  created_at?: string;
}
