import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { Category, CategoryPayload, ColorOption, NoteColor } from '../../../models';

@Component({
  selector: 'app-category-dialog',
  imports: [FontAwesomeModule, ReactiveFormsModule],
  templateUrl: './category-dialog.component.html',
  styleUrl: './category-dialog.component.scss',
})
export class CategoryDialogComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input({ required: true }) categories: Category[] = [];
  @Input({ required: true }) colors: ColorOption[] = [];
  @Input() category: Category | null = null;
  @Input() defaultParentId: string | null = null;
  @Input() saving = false;

  @Output() closeDialog = new EventEmitter<void>();
  @Output() saveCategory = new EventEmitter<CategoryPayload>();

  advancedOpen = false;
  readonly icons = {
    close: faXmark,
  };

  readonly form = this.fb.group({
    label: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', [Validators.required, Validators.maxLength(255)]],
    color: this.fb.control<NoteColor | null>(null),
    parent_id: this.fb.control<string | null>(null),
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['category'] || changes['defaultParentId']) {
      this.advancedOpen = false;

      this.form.reset({
        label: this.category?.label ?? '',
        description: this.category?.description ?? '',
        color: this.category?.color ?? null,
        parent_id: this.category?.parent_id ?? this.defaultParentId,
      });
    }
  }

  toggleAdvanced(): void {
    this.advancedOpen = !this.advancedOpen;
  }

  parentOptions(): Category[] {
    const blockedIds = this.blockedParentIds();

    return this.categories.filter((category) => !blockedIds.has(category.id));
  }

  categoryDisplay(category: Category): string {
    return category.parent_id ? `${this.parentName(category.parent_id)} / ${category.label}` : category.label;
  }

  submit(): void {
    if (this.form.invalid || this.saving) {
      return;
    }

    const value = this.form.getRawValue();

    this.saveCategory.emit({
      label: value.label ?? '',
      description: value.description ?? '',
      color: value.color,
      parent_id: value.parent_id,
    });
  }

  private parentName(parentId: string): string {
    return this.categories.find((category) => category.id === parentId)?.label ?? 'Categoria';
  }

  private blockedParentIds(): Set<string> {
    const blockedIds = new Set<string>();

    if (!this.category) {
      return blockedIds;
    }

    blockedIds.add(this.category.id);
    this.collectChildren(this.category.id, blockedIds);

    return blockedIds;
  }

  private collectChildren(parentId: string, blockedIds: Set<string>): void {
    for (const category of this.categories.filter((item) => item.parent_id === parentId)) {
      blockedIds.add(category.id);
      this.collectChildren(category.id, blockedIds);
    }
  }
}
