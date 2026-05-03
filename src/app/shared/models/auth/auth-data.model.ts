import { User } from '../users';

export interface AuthData {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: User;
}
