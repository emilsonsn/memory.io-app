import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuthData, LoginPayload, User } from '../../../shared/models';
import { ApiClientService } from '../api-client.service';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  constructor(private readonly api: ApiClientService) {}

  login(payload: LoginPayload): Observable<AuthData> {
    return this.api.post<AuthData>('/auth/login', payload);
  }

  me(): Observable<User> {
    return this.api.get<User>('/auth/me');
  }

  logout(): Observable<null> {
    return this.api.post<null>('/auth/logout', {});
  }
}
