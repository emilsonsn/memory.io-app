import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Category, ColorOption, Memory, MemoryPayload, NoteColor } from '../../../models';

@Component({
  selector: 'app-memory-dialog',
  imports: [ReactiveFormsModule],
  templateUrl: './memory-dialog.component.html',
  styleUrl: './memory-dialog.component.scss',
})
export class MemoryDialogComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input({ required: true }) categories: Category[] = [];
  @Input({ required: true }) colors: ColorOption[] = [];
  @Input() memory: Memory | null = null;
  @Input() defaultCategoryId: string | null = null;
  @Input() saving = false;

  @Output() closeDialog = new EventEmitter<void>();
  @Output() saveMemory = new EventEmitter<MemoryPayload>();

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    content: ['', [Validators.required]],
    color: this.fb.control<NoteColor | null>(null),
    due_date: this.fb.control<string | null>(null),
    category_ids: this.fb.control<string[]>([]),
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['memory'] || changes['defaultCategoryId']) {
      this.form.reset({
        title: this.memory?.title ?? '',
        content: this.memory?.content ?? '',
        color: this.memory?.color ?? null,
        due_date: this.toInputDate(this.memory?.due_date ?? null),
        category_ids: this.memory
          ? this.memory.categories.map((category) => category.id)
          : this.defaultCategoryId ? [this.defaultCategoryId] : [],
      });
    }
  }

  categoryDisplay(category: Category): string {
    return category.parent_id ? `${this.parentName(category.parent_id)} / ${category.label}` : category.label;
  }

  submit(): void {
    if (this.form.invalid || this.saving) {
      return;
    }

    const value = this.form.getRawValue();

    this.saveMemory.emit({
      title: value.title ?? '',
      content: value.content ?? '',
      color: value.color,
      due_date: value.due_date || null,
      category_ids: value.category_ids ?? [],
    });
  }

  private parentName(parentId: string): string {
    return this.categories.find((category) => category.id === parentId)?.label ?? 'Categoria';
  }

  private toInputDate(value: string | null): string | null {
    if (!value) {
      return null;
    }

    return value.slice(0, 16);
  }
}
