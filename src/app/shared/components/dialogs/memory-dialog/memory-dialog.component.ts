import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faChevronDown, faCopy, faExpand, faTimes, faXmark } from '@fortawesome/free-solid-svg-icons';
import { QuillModule } from 'ngx-quill';
import { ToastrService } from 'ngx-toastr';
import { Category, ColorOption, Memory, MemoryPayload, NoteColor } from '../../../models';

@Component({
  selector: 'app-memory-dialog',
  imports: [FontAwesomeModule, QuillModule, ReactiveFormsModule],
  templateUrl: './memory-dialog.component.html',
  styleUrl: './memory-dialog.component.scss',
})
export class MemoryDialogComponent implements OnChanges, OnDestroy, OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly toastr = inject(ToastrService);

  @Input({ required: true }) categories: Category[] = [];
  @Input({ required: true }) colors: ColorOption[] = [];
  @Input() memory: Memory | null = null;
  @Input() defaultCategoryId: string | null = null;
  @Input() defaultColor: NoteColor | null = null;
  @Input() saving = false;

  @Output() closeDialog = new EventEmitter<void>();
  @Output() saveMemory = new EventEmitter<MemoryPayload>();
  @Output() expandMemory = new EventEmitter<MemoryPayload>();

  advancedOpen = false;
  categoriesOpen = false;
  contentCopied = false;
  private autosaveDebounce: number | null = null;
  private formSubscription: Subscription | null = null;
  private lastAutosaveSnapshot = '';
  readonly icons = {
    chevronDown: faChevronDown,
    copy: faCopy,
    expand: faExpand,
    remove: faTimes,
    close: faXmark,
  };
  readonly compactEditorModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link'],
    ],
  };

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    content: ['', [Validators.required]],
    color: this.fb.control<NoteColor | null>(null),
    due_date: this.fb.control<string | null>(null),
    category_ids: this.fb.control<string[]>([]),
  });

  ngOnInit(): void {
    this.formSubscription = this.form.valueChanges.subscribe(() => {
      this.queueAutosave();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    const memoryChanged = changes['memory'];
    const previousMemory = memoryChanged?.previousValue as Memory | null | undefined;
    const currentMemory = memoryChanged?.currentValue as Memory | null | undefined;
    const shouldResetForm = Boolean(
      changes['defaultCategoryId']
      || changes['defaultColor']
      || (memoryChanged && previousMemory?.id !== currentMemory?.id && !this.form.dirty)
    );

    if (shouldResetForm) {
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
      }, {
        emitEvent: false,
      });
      this.lastAutosaveSnapshot = this.formSnapshot();
    }
  }

  ngOnDestroy(): void {
    this.clearAutosaveDebounce();
    this.formSubscription?.unsubscribe();
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

  selectColor(color: NoteColor | null): void {
    this.form.controls.color.setValue(color);
    this.form.controls.color.markAsDirty();
    this.form.controls.color.markAsTouched();
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
      return 'Nenhuma categoria selecionada';
    }

    return total === 1 ? '1 categoria selecionada' : `${total} categorias selecionadas`;
  }

  categoryDisplay(category: Category): string {
    return category.parent_id ? `${this.parentName(category.parent_id)} / ${category.label}` : category.label;
  }

  copyContent(): void {
    const content = this.htmlToText(this.form.controls.content.value ?? '');

    if (!content.trim()) {
      return;
    }

    void this.copyToClipboard(content).then(() => {
      this.contentCopied = true;
      this.toastr.success('Conteudo copiado.');

      window.setTimeout(() => {
        this.contentCopied = false;
      }, 1200);
    }).catch(() => this.toastr.error('Nao foi possivel copiar o conteudo.'));
  }

  expandNote(): void {
    if (this.form.invalid) {
      this.toastr.warning('Preencha os campos obrigatórios para expandir a memória.');
      return;
    }

    this.flushAutosave();
    this.expandMemory.emit(this.memoryPayload());
  }

  requestClose(): void {
    this.flushAutosave();
    this.closeDialog.emit();
  }

  submit(): void {
    this.flushAutosave();
  }

  private memoryPayload(): MemoryPayload {
    const value = this.form.getRawValue();

    return {
      title: value.title ?? '',
      content: value.content ?? '',
      color: value.color,
      due_date: value.due_date || null,
      category_ids: value.category_ids ?? [],
    };
  }

  hasRichContent(): boolean {
    return /<\/?[a-z][\s\S]*>/i.test(this.form.controls.content.value ?? '');
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

  private htmlToText(value: string): string {
    const container = document.createElement('div');
    container.innerHTML = value;
    return container.textContent ?? container.innerText ?? value;
  }

  private queueAutosave(): void {
    this.clearAutosaveDebounce();
    this.autosaveDebounce = window.setTimeout(() => {
      this.autosaveDebounce = null;
      this.flushAutosave();
    }, 700);
  }

  private flushAutosave(): void {
    this.clearAutosaveDebounce();

    if (this.form.invalid) {
      return;
    }

    const snapshot = this.formSnapshot();

    if (snapshot === this.lastAutosaveSnapshot) {
      return;
    }

    this.lastAutosaveSnapshot = snapshot;
    this.saveMemory.emit(this.memoryPayload());
  }

  private formSnapshot(): string {
    return JSON.stringify(this.form.getRawValue());
  }

  private clearAutosaveDebounce(): void {
    if (this.autosaveDebounce === null) {
      return;
    }

    window.clearTimeout(this.autosaveDebounce);
    this.autosaveDebounce = null;
  }
}
