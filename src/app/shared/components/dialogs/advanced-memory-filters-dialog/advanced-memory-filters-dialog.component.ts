import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { ColorOption } from '../../../models';
import { MemoryListFilters } from '../../../../core/api/memories/memories-api.service';

export interface AdvancedMemoryFiltersData {
  colors: ColorOption[];
  filters: MemoryListFilters;
}

@Component({
  selector: 'app-advanced-memory-filters-dialog',
  imports: [
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  templateUrl: './advanced-memory-filters-dialog.component.html',
  styleUrl: './advanced-memory-filters-dialog.component.scss',
})
export class AdvancedMemoryFiltersDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<AdvancedMemoryFiltersDialogComponent, Partial<MemoryListFilters> | null>);
  readonly data = inject<AdvancedMemoryFiltersData>(MAT_DIALOG_DATA);

  readonly form = this.fb.group({
    color: [this.data.filters.color ?? ''],
    updatedFrom: [this.parseDate(this.data.filters.updatedFrom)],
    updatedTo: [this.parseDate(this.data.filters.updatedTo)],
    dueFrom: [this.parseDate(this.data.filters.dueFrom)],
    dueTo: [this.parseDate(this.data.filters.dueTo)],
    categoryPresence: [this.data.filters.categoryPresence ?? 'all'],
    sortBy: [this.data.filters.sortBy ?? 'created_at'],
    sortDirection: [this.data.filters.sortDirection ?? 'desc'],
  });

  apply(): void {
    const value = this.form.getRawValue();

    this.dialogRef.close({
      color: value.color || undefined,
      updatedFrom: this.formatDateForApi(value.updatedFrom),
      updatedTo: this.formatDateForApi(value.updatedTo),
      dueFrom: this.formatDateForApi(value.dueFrom),
      dueTo: this.formatDateForApi(value.dueTo),
      categoryPresence: value.categoryPresence === 'without' ? 'without' : undefined,
      sortBy: value.sortBy as MemoryListFilters['sortBy'],
      sortDirection: value.sortDirection as MemoryListFilters['sortDirection'],
    });
  }

  clear(): void {
    this.dialogRef.close({
      color: undefined,
      updatedFrom: undefined,
      updatedTo: undefined,
      dueFrom: undefined,
      dueTo: undefined,
      categoryPresence: undefined,
      sortBy: 'created_at',
      sortDirection: 'desc',
    });
  }

  private parseDate(value: string | undefined): Date | null {
    if (!value) {
      return null;
    }

    const [year, month, day] = value.split('-').map(Number);

    if (!year || !month || !day) {
      return null;
    }

    return new Date(year, month - 1, day);
  }

  private formatDateForApi(value: Date | null | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
