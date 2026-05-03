import { Plan } from './plan.model';

export interface User {
  id: string;
  name: string;
  email: string;
  plan_id: string | null;
  plan?: Plan | null;
}
