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
  @Input() defaultColor: NoteColor | null = null;
  @Input() saving = false;

  @Output() closeDialog = new EventEmitter<void>();
  @Output() saveMemory = new EventEmitter<MemoryPayload>();

  advancedOpen = false;
  categoriesOpen = false;
  contentCopied = false;

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    content: ['', [Validators.required]],
    color: this.fb.control<NoteColor | null>(null),
    due_date: this.fb.control<string | null>(null),
    category_ids: this.fb.control<string[]>([]),
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['memory'] || changes['defaultCategoryId'] || changes['defaultColor']) {
      this.advancedOpen = false;
      this.categoriesOpen = false;
      this.contentCopied = false;

      this.form.reset({
        title: this.memory?.title ?? '',
        content: this.memory?.content ?? '',
        color: this.memory ? this.memory.color : this.defaultColor,
        due_date: this.toInputDate(this.memory?.due_date ?? null),
        category_ids: this.memory
          ? this.memory.categories.map((category) => category.id)
          : this.defaultCategoryId ? [this.defaultCategoryId] : [],
      });
    }
  }

  toggleAdvanced(): void {
    this.advancedOpen = !this.advancedOpen;

    if (!this.advancedOpen) {
      this.categoriesOpen = false;
    }
  }

  toggleCategories(): void {
    this.categoriesOpen = !this.categoriesOpen;
  }

  toggleCategory(categoryId: string): void {
    const selectedIds = this.form.controls.category_ids.value ?? [];
    const nextSelectedIds = selectedIds.includes(categoryId)
      ? selectedIds.filter((selectedId) => selectedId !== categoryId)
      : [...selectedIds, categoryId];

    this.form.controls.category_ids.setValue(nextSelectedIds);
    this.form.controls.category_ids.markAsDirty();
    this.form.controls.category_ids.markAsTouched();
  }

  isCategorySelected(categoryId: string): boolean {
    return (this.form.controls.category_ids.value ?? []).includes(categoryId);
  }

  selectedCategories(): Category[] {
    const selectedIds = this.form.controls.category_ids.value ?? [];

    return this.categories.filter((category) => selectedIds.includes(category.id));
  }

  categorySummary(): string {
    const total = this.selectedCategories().length;

    if (total === 0) {
      return 'Nenhuma pasta selecionada';
    }

    return total === 1 ? '1 pasta selecionada' : `${total} pastas selecionadas`;
  }

  categoryDisplay(category: Category): string {
    return category.parent_id ? `${this.parentName(category.parent_id)} / ${category.label}` : category.label;
  }

  copyContent(): void {
    const content = this.form.controls.content.value ?? '';

    if (!content.trim()) {
      return;
    }

    void this.copyToClipboard(content).then(() => {
      this.contentCopied = true;

      window.setTimeout(() => {
        this.contentCopied = false;
      }, 1200);
    });
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

  private async copyToClipboard(text: string): Promise<void> {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
}
