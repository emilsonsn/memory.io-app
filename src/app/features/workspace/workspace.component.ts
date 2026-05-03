import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
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
} from '../../shared/models';

type DialogType = 'category' | 'memory' | null;

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
        this.closeAfterSave();
        this.loadMemories();
      },
      error: (error: HttpErrorResponse) => this.error.set(this.extractError(error)),
      complete: () => this.saving.set(false),
    });
  }

  removeCategory(category: Category, event: Event): void {
    event.stopPropagation();

    if (!confirm(`Excluir a pasta "${category.label}"?`)) {
      return;
    }

    this.categoriesApi.delete(category.id).subscribe({
      next: () => {
        this.categories.update((categories) => categories.filter((item) => item.id !== category.id));

        if (this.currentCategoryId() === category.id) {
          this.currentCategoryId.set(category.parent_id);
        }

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
      next: () => this.memories.update((memories) => memories.filter((item) => item.id !== memory.id)),
      error: (error: HttpErrorResponse) => this.error.set(this.extractError(error)),
    });
  }

  logout(): void {
    this.authApi.logout().subscribe({ error: () => undefined });
    this.authStore.clear();
    void this.router.navigate(['/login']);
  }

  parentName(parentId: string): string {
    return this.findCategory(parentId)?.label ?? 'Pasta';
  }

  private closeAfterSave(): void {
    this.activeDialog.set(null);
    this.editingCategory.set(null);
    this.editingMemory.set(null);
  }

  private loadMemories(): void {
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

    return categoryId
      ? { categoryIds: [categoryId] }
      : { withoutCategories: true };
  }

  private findCategory(categoryId: string): Category | null {
    return this.categories().find((category) => category.id === categoryId) ?? null;
  }

  private extractError(error: HttpErrorResponse): string {
    const firstError = Object.values((error.error as { errors?: Record<string, string[]> })?.errors ?? {})[0]?.[0];
    return firstError ?? 'Nao foi possivel salvar agora.';
  }
}
