import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ColorOption } from '../../../shared/models';
import { ApiClientService } from '../api-client.service';

@Injectable({ providedIn: 'root' })
export class ColorsApiService {
  constructor(private readonly api: ApiClientService) {}

  list(): Observable<ColorOption[]> {
    return this.api.get<ColorOption[]>('/colors');
  }
}
