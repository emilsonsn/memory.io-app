import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { RegisterPayload, User } from '../../../shared/models';
import { ApiClientService } from '../api-client.service';

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  constructor(private readonly api: ApiClientService) {}

  register(payload: RegisterPayload): Observable<User> {
    return this.api.post<User>('/users', payload);
  }
}
