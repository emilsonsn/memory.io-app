import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Favorite, FavoritePayload } from '../../../shared/models';
import { ApiClientService } from '../api-client.service';

@Injectable({ providedIn: 'root' })
export class FavoritesApiService {
  constructor(private readonly api: ApiClientService) {}

  list(): Observable<Favorite[]> {
    return this.api.get<Favorite[]>('/favorites', { per_page: 100 });
  }

  add(payload: FavoritePayload): Observable<Favorite> {
    return this.api.post<Favorite>('/favorites', payload);
  }

  remove(payload: FavoritePayload): Observable<null> {
    const params: Record<string, string> = {};

    if (payload.memory_id) {
      params['memory_id'] = payload.memory_id;
    }

    if (payload.category_id) {
      params['category_id'] = payload.category_id;
    }

    return this.api.delete<null>('/favorites', params);
  }
}
