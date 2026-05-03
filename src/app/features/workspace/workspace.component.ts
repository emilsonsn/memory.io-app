import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { AuthApiService } from '../../core/api/auth/auth-api.service';
import { CategoriesApiService } from '../../core/api/categories/categories-api.service';
import { ColorsApiService } from '../../core/api/colors/colors-api.service';
import { MemoriesApiService, MemoryListFilters } from '../../core/api/memories/memories-api.service';
import { AuthStore } from '../../core/auth/auth.store';
import { CategoryDialogComponent } from '../../shared/components/dialogs/category-dialog/category-dialog.component';
import { MemoryDialogComponent } from '../../shared/components/dialogs/memory-dialog/memory-dialog.component';
import {
  Category,
  CategoryPayload,
  ColorOption,
  Memory,
  MemoryPayload,
  NoteColor,
} from '../../shared/models';

type DialogType = 'category' | 'memory' | null;
type MemoryFilterKey =
  | 'text'
  | 'color'
  | 'createdFrom'
  | 'createdTo'
  | 'updatedFrom'
  | 'updatedTo'
  | 'dueFrom'
  | 'dueTo'
  | 'sortBy'
  | 'sortDirection';

@Component({
  selector: 'app-workspace',
  imports: [CategoryDialogComponent, DatePipe, MemoryDialogComponent],
  templateUrl: './workspace.component.html',
  styleUrl: './workspace.component.scss',
})
export class WorkspaceComponent implements OnInit {
  private readonly authApi = inject(AuthApiService);
  private readonly categoriesApi = inject(CategoriesApiService);
  private readonly colorsApi = inject(ColorsApiService);
  private readonly memoriesApi = inject(MemoriesApiService);
  readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly toastr = inject(ToastrService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly activeDialog = signal<DialogType>(null);
  readonly currentCategoryId = signal<string | null>(null);
  readonly colors = signal<ColorOption[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly memories = signal<Memory[]>([]);
  readonly editingCategory = signal<Category | null>(null);
  readonly editingMemory = signal<Memory | null>(null);
  readonly copiedMemoryId = signal<string | null>(null);
  readonly memoryFilters = signal<MemoryListFilters>({
    sortBy: 'created_at',
    sortDirection: 'desc',
  });

  private searchDebounce: number | null = null;

  readonly currentCategory = computed(() => {
    const categoryId = this.currentCategoryId();

    return categoryId ? this.findCategory(categoryId) : null;
  });

  readonly breadcrumb = computed(() => {
    const trail: Category[] = [];
    let cursor = this.currentCategory();

    while (cursor) {
      trail.unshift(cursor);
      cursor = cursor.parent_id ? this.findCategory(cursor.parent_id) : null;
    }

    return trail;
  });

  readonly visibleCategories = computed(() => {
    const parentId = this.currentCategoryId();

    return this.categories()
      .filter((category) => category.parent_id === parentId)
      .sort((left, right) => left.label.localeCompare(right.label));
  });

  readonly visibleMemories = computed(() => {
    return this.memories();
  });

  readonly sidebarCategories = computed(() => {
    return [...this.categories()].sort((left, right) => this.categoryDisplay(left).localeCompare(this.categoryDisplay(right)));
  });

  readonly currentDefaultMemoryColor = computed<NoteColor | null>(() => {
    return this.currentCategory()?.color ?? null;
  });

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      colors: this.colorsApi.list(),
      categories: this.categoriesApi.list(),
      memories: this.memoriesApi.list(this.currentMemoryFilters()),
    }).subscribe({
      next: ({ colors, categories, memories }) => {
        this.colors.set(colors);
        this.categories.set(categories);
        this.memories.set(memories);
      },
      error: () => {
        this.error.set('Nao foi possivel carregar os cadastros. Verifique se a API esta ativa.');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  openCreateCategory(): void {
    this.editingCategory.set(null);
    this.activeDialog.set('category');
  }

  openEditCategory(category: Category, event: Event): void {
    event.stopPropagation();
    this.editingCategory.set(category);
    this.activeDialog.set('category');
  }

  openCreateMemory(): void {
    this.editingMemory.set(null);
    this.activeDialog.set('memory');
  }

  openEditMemory(memory: Memory): void {
    this.editingMemory.set(memory);
    this.activeDialog.set('memory');
  }

  closeDialog(): void {
    if (this.saving()) {
      return;
    }

    this.activeDialog.set(null);
    this.editingCategory.set(null);
    this.editingMemory.set(null);
  }

  enterCategory(category: Category): void {
    this.currentCategoryId.set(category.id);
    this.loadMemories();
  }

  goToRoot(): void {
    this.currentCategoryId.set(null);
    this.loadMemories();
  }

  goToCategory(category: Category): void {
    this.currentCategoryId.set(category.id);
    this.loadMemories();
  }

  goUp(): void {
    const current = this.currentCategory();
    this.currentCategoryId.set(current?.parent_id ?? null);
    this.loadMemories();
  }

  updateMemoryFilter(key: MemoryFilterKey, value: string): void {
    this.memoryFilters.update((filters) => ({
      ...filters,
      [key]: value || undefined,
    }));

    if (key === 'text') {
      this.scheduleLoadMemories();
      return;
    }

    this.loadMemories();
  }

  clearMemoryFilters(): void {
    this.memoryFilters.set({
      sortBy: 'created_at',
      sortDirection: 'desc',
    });
    this.loadMemories();
  }

  hasMemoryFilters(): boolean {
    const filters = this.memoryFilters();

    return Boolean(
      filters.text
      || filters.color
      || filters.createdFrom
      || filters.createdTo
      || filters.updatedFrom
      || filters.updatedTo
      || filters.dueFrom
      || filters.dueTo
      || filters.sortBy !== 'created_at'
      || filters.sortDirection !== 'desc',
    );
  }

  saveCategory(payload: CategoryPayload): void {
    if (this.saving()) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    const editing = this.editingCategory();
    const request = editing
      ? this.categoriesApi.update(editing.id, payload)
      : this.categoriesApi.create(payload);

    request.subscribe({
      next: (category) => {
        this.categories.update((categories) => editing
          ? categories.map((item) => item.id === category.id ? category : item)
          : [category, ...categories]);
        this.toastr.success(editing ? 'Categoria atualizada com sucesso.' : 'Categoria criada com sucesso.');
        this.closeAfterSave();
      },
      error: (error: HttpErrorResponse) => this.error.set(this.extractError(error)),
      complete: () => this.saving.set(false),
    });
  }

  saveMemory(payload: MemoryPayload): void {
    if (this.saving()) {
      return;
    }

    const currentCategoryId = this.currentCategoryId();
    const finalPayload = this.editingMemory() || !currentCategoryId
      ? payload
      : { ...payload, category_ids: Array.from(new Set([...payload.category_ids, currentCategoryId])) };

    this.saving.set(true);
    this.error.set(null);
    const editing = this.editingMemory();
    const request = editing
      ? this.memoriesApi.update(editing.id, finalPayload)
      : this.memoriesApi.create(finalPayload);

    request.subscribe({
      next: () => {
        this.toastr.success(editing ? 'Memoria atualizada com sucesso.' : 'Memoria criada com sucesso.');
        this.closeAfterSave();
        this.loadMemories();
      },
      error: (error: HttpErrorResponse) => this.error.set(this.extractError(error)),
      complete: () => this.saving.set(false),
    });
  }

  removeCategory(category: Category, event: Event): void {
    event.stopPropagation();

    if (!confirm(`Excluir a categoria "${category.label}"?`)) {
      return;
    }

    this.categoriesApi.delete(category.id).subscribe({
      next: () => {
        this.categories.update((categories) => categories.filter((item) => item.id !== category.id));

        if (this.currentCategoryId() === category.id) {
          this.currentCategoryId.set(category.parent_id);
        }

        this.toastr.success('Categoria excluida com sucesso.');
        this.loadMemories();
      },
      error: (error: HttpErrorResponse) => this.error.set(this.extractError(error)),
    });
  }

  removeMemory(memory: Memory, event: Event): void {
    event.stopPropagation();

    if (!confirm(`Excluir a memoria "${memory.title}"?`)) {
      return;
    }

    this.memoriesApi.delete(memory.id).subscribe({
      next: () => {
        this.memories.update((memories) => memories.filter((item) => item.id !== memory.id));
        this.toastr.success('Memoria excluida com sucesso.');
      },
      error: (error: HttpErrorResponse) => this.error.set(this.extractError(error)),
    });
  }

  copyMemoryContent(memory: Memory, event: Event): void {
    event.stopPropagation();

    void this.copyToClipboard(memory.content).then(() => {
      this.copiedMemoryId.set(memory.id);
      this.toastr.success('Conteudo copiado.');

      window.setTimeout(() => {
        if (this.copiedMemoryId() === memory.id) {
          this.copiedMemoryId.set(null);
        }
      }, 1200);
    }).catch(() => this.toastr.error('Nao foi possivel copiar o conteudo.'));
  }

  logout(): void {
    this.authApi.logout().subscribe({ error: () => undefined });
    this.authStore.clear();
    this.toastr.success('Sessao encerrada com sucesso.');
    void this.router.navigate(['/login']);
  }

  parentName(parentId: string): string {
    return this.findCategory(parentId)?.label ?? 'Categoria';
  }

  categoryDisplay(category: Category): string {
    return category.parent_id ? `${this.parentName(category.parent_id)} / ${category.label}` : category.label;
  }

  userInitial(): string {
    return this.authStore.user()?.name?.trim().charAt(0).toUpperCase() || 'U';
  }

  private closeAfterSave(): void {
    this.activeDialog.set(null);
    this.editingCategory.set(null);
    this.editingMemory.set(null);
  }

  private loadMemories(): void {
    if (this.searchDebounce) {
      window.clearTimeout(this.searchDebounce);
      this.searchDebounce = null;
    }

    this.loading.set(true);
    this.error.set(null);

    this.memoriesApi.list(this.currentMemoryFilters()).subscribe({
      next: (memories) => this.memories.set(memories),
      error: () => {
        this.error.set('Nao foi possivel carregar as memorias. Verifique se a API esta ativa.');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  private currentMemoryFilters(): MemoryListFilters {
    const categoryId = this.currentCategoryId();
    const filters = this.memoryFilters();

    const scopeFilters = categoryId
      ? { categoryIds: [categoryId] }
      : { withoutCategories: true };

    return {
      ...filters,
      ...scopeFilters,
    };
  }

  private scheduleLoadMemories(): void {
    if (this.searchDebounce) {
      window.clearTimeout(this.searchDebounce);
    }

    this.searchDebounce = window.setTimeout(() => this.loadMemories(), 350);
  }

  private findCategory(categoryId: string): Category | null {
    return this.categories().find((category) => category.id === categoryId) ?? null;
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

  private extractError(error: HttpErrorResponse): string {
    const firstError = Object.values((error.error as { errors?: Record<string, string[]> })?.errors ?? {})[0]?.[0];
    return firstError ?? 'Nao foi possivel salvar agora.';
  }
}
