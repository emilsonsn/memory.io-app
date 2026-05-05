import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faArrowRightFromBracket,
  faBell,
  faClock,
  faCopy,
  faFolderOpen,
  faLayerGroup,
  faNoteSticky,
  faSliders,
  faPlus,
  faUser,
  faSearch,
  faGear,
  faThumbtack,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { AuthApiService } from '../../core/api/auth/auth-api.service';
import { CategoriesApiService, CategoryListFilters } from '../../core/api/categories/categories-api.service';
import { ColorsApiService } from '../../core/api/colors/colors-api.service';
import { MemoriesApiService, MemoryListFilters } from '../../core/api/memories/memories-api.service';
import { AuthStore } from '../../core/auth/auth.store';
import { CategoryDialogComponent } from '../../shared/components/dialogs/category-dialog/category-dialog.component';
import { AdvancedMemoryFiltersDialogComponent } from '../../shared/components/dialogs/advanced-memory-filters-dialog/advanced-memory-filters-dialog.component';
import { ConfirmDialogComponent } from '../../shared/components/dialogs/confirm-dialog/confirm-dialog.component';
import { MemoryDialogComponent } from '../../shared/components/dialogs/memory-dialog/memory-dialog.component';
import { NoteGroupDialogComponent, NoteGroupPayload } from '../../shared/components/dialogs/note-group-dialog/note-group-dialog.component';
import {
  Category,
  CategoryPayload,
  ColorOption,
  Memory,
  MemoryPayload,
  NoteColor,
} from '../../shared/models';

type DialogType = 'category' | 'memory' | null;
type DeleteTarget =
  | { type: 'category'; item: Category }
  | { type: 'memory'; item: Memory };
type ConfirmTarget =
  | { type: 'move-to-category'; memory: Memory; category: Category }
  | { type: 'group-memories'; source: Memory; target: Memory };
type MemoryFilterKey =
  | 'text'
  | 'color'
  | 'createdFrom'
  | 'createdTo';

@Component({
  selector: 'app-workspace',
  imports: [
    CategoryDialogComponent,
    ConfirmDialogComponent,
    DatePipe,
    FontAwesomeModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    MemoryDialogComponent,
    NoteGroupDialogComponent,
  ],
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
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly activeDialog = signal<DialogType>(null);
  readonly currentCategoryId = signal<string | null>(null);
  readonly colors = signal<ColorOption[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly filteredCategories = signal<Category[]>([]);
  readonly memories = signal<Memory[]>([]);
  readonly allMemories = signal<Memory[]>([]);
  readonly editingCategory = signal<Category | null>(null);
  readonly editingMemory = signal<Memory | null>(null);
  readonly copiedMemoryId = signal<string | null>(null);
  readonly deleteTarget = signal<DeleteTarget | null>(null);
  readonly confirmTarget = signal<ConfirmTarget | null>(null);
  readonly groupingPair = signal<{ source: Memory; target: Memory } | null>(null);
  readonly draggedMemory = signal<Memory | null>(null);
  readonly dropCategoryId = signal<string | null>(null);
  readonly dropMemoryId = signal<string | null>(null);
  readonly sidebarPinned = signal(true);
  readonly icons = {
    copy: faCopy,
    folderOpen: faFolderOpen,
    gear: faGear,
    logout: faArrowRightFromBracket,
    notification: faBell,
    plus: faPlus,
    profile: faUser,
    search: faSearch,
    sliders: faSliders,
    thumbtack: faThumbtack,
    trash: faTrashCan,
  };
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
    if (this.hasMemoryFilters()) {
      return [...this.filteredCategories()].sort((left, right) => left.label.localeCompare(right.label));
    }

    const parentId = this.currentCategoryId();

    return this.categories()
      .filter((category) => category.parent_id === parentId)
      .sort((left, right) => left.label.localeCompare(right.label));
  });

  readonly visibleMemories = computed(() => {
    return this.memories();
  });

  readonly showRootDashboard = computed(() => !this.currentCategoryId() && !this.hasMemoryFilters());

  readonly pageTitle = computed(() => {
    if (this.currentCategory()) {
      return this.currentCategory()?.label;
    }

    return 'Seu Second Brain';
  });

  readonly dashboardStats = computed(() => {
    const categories = this.categories();
    const memories = this.allMemories();

    return [
      {
        label: 'Total de Notas',
        value: memories.length,
        icon: faNoteSticky,
      },
      {
        label: 'Pastas',
        value: categories.filter((category) => !category.parent_id).length,
        icon: faFolderOpen,
      },
      {
        label: 'Categorias',
        value: categories.filter((category) => category.parent_id).length,
        icon: faLayerGroup,
      },
      {
        label: 'A Vencer',
        value: memories.filter((memory) => this.isUpcoming(memory)).length,
        icon: faClock,
      },
    ];
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

  toggleSidebarPinned(): void {
    this.sidebarPinned.update((pinned) => !pinned);
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      colors: this.colorsApi.list(),
      categories: this.categoriesApi.list(),
      memories: this.memoriesApi.list(this.currentMemoryFilters()),
      allMemories: this.memoriesApi.list(),
    }).subscribe({
      next: ({ colors, categories, memories, allMemories }) => {
        this.colors.set(colors);
        this.categories.set(categories);
        this.memories.set(memories);
        this.allMemories.set(allMemories);
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

  updateDateFilter(key: 'createdFrom' | 'createdTo', value: Date | null): void {
    this.updateMemoryFilter(key, this.formatDateForApi(value));
  }

  updateCategoryFilter(categoryIds: string[]): void {
    this.memoryFilters.update((filters) => ({
      ...filters,
      categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
    }));
    this.loadMemories();
  }

  openAdvancedFilters(): void {
    this.dialog.open(AdvancedMemoryFiltersDialogComponent, {
      data: {
        colors: this.colors(),
        filters: this.memoryFilters(),
      },
      autoFocus: false,
      panelClass: 'advanced-memory-filters-panel',
      width: '620px',
      maxWidth: 'calc(100vw - 32px)',
    }).afterClosed().subscribe((filters: Partial<MemoryListFilters> | null | undefined) => {
      if (!filters) {
        return;
      }

      this.memoryFilters.update((currentFilters) => ({
        ...currentFilters,
        ...filters,
      }));
      this.loadMemories();
    });
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
      || filters.categoryIds?.length
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
        this.loadDashboardMemories();
      },
      error: (error: HttpErrorResponse) => this.error.set(this.extractError(error)),
      complete: () => this.saving.set(false),
    });
  }

  removeCategory(category: Category, event: Event): void {
    event.stopPropagation();
    this.deleteTarget.set({ type: 'category', item: category });
  }

  removeMemory(memory: Memory, event: Event): void {
    event.stopPropagation();
    this.deleteTarget.set({ type: 'memory', item: memory });
  }

  startMemoryDrag(memory: Memory, event: DragEvent): void {
    this.draggedMemory.set(memory);
    event.dataTransfer?.setData('text/plain', memory.id);
    event.dataTransfer?.setDragImage(event.currentTarget as Element, 20, 20);
  }

  endMemoryDrag(): void {
    this.draggedMemory.set(null);
    this.dropCategoryId.set(null);
    this.dropMemoryId.set(null);
  }

  allowCategoryDrop(category: Category, event: DragEvent): void {
    if (!this.draggedMemory()) {
      return;
    }

    event.preventDefault();
    this.dropCategoryId.set(category.id);
  }

  allowMemoryDrop(memory: Memory, event: DragEvent): void {
    const dragged = this.draggedMemory();

    if (!dragged || dragged.id === memory.id) {
      return;
    }

    event.preventDefault();
    this.dropMemoryId.set(memory.id);
  }

  leaveDropTarget(event: DragEvent): void {
    const current = event.currentTarget as HTMLElement;
    const next = event.relatedTarget as Node | null;

    if (next && current.contains(next)) {
      return;
    }

    this.dropCategoryId.set(null);
    this.dropMemoryId.set(null);
  }

  dropMemoryOnCategory(category: Category, event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const memory = this.draggedMemory();
    this.endMemoryDrag();

    if (!memory || memory.categories.some((item) => item.id === category.id)) {
      return;
    }

    this.confirmTarget.set({ type: 'move-to-category', memory, category });
  }

  dropMemoryOnMemory(target: Memory, event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const source = this.draggedMemory();
    this.endMemoryDrag();

    if (!source || source.id === target.id) {
      return;
    }

    this.confirmTarget.set({ type: 'group-memories', source, target });
  }

  closeConfirmDialog(): void {
    this.confirmTarget.set(null);
  }

  confirmDragAction(): void {
    const target = this.confirmTarget();

    if (!target) {
      return;
    }

    if (target.type === 'move-to-category') {
      this.associateMemoryToCategory(target.memory, target.category);
      return;
    }

    this.groupingPair.set({ source: target.source, target: target.target });
    this.confirmTarget.set(null);
  }

  closeGroupDialog(): void {
    this.groupingPair.set(null);
  }

  createGroupForMemories(payload: NoteGroupPayload): void {
    const pair = this.groupingPair();

    if (!pair || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.categoriesApi.create({
      label: payload.label,
      description: payload.description,
      color: null,
      parent_id: this.currentCategoryId(),
    }).subscribe({
      next: (category) => {
        this.categories.update((categories) => [category, ...categories]);
        this.associateMemoriesToCategory([pair.source, pair.target], category, () => {
          this.toastr.success('Notas associadas com sucesso.');
          this.closeGroupDialog();
        });
      },
      error: (error: HttpErrorResponse) => this.error.set(this.extractError(error)),
      complete: () => this.saving.set(false),
    });
  }

  closeDeleteDialog(): void {
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const target = this.deleteTarget();

    if (!target) {
      return;
    }

    if (target.type === 'category') {
      this.deleteCategory(target.item);
      return;
    }

    this.deleteMemory(target.item);
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

  filterDateValue(value: string | undefined): Date | null {
    if (!value) {
      return null;
    }

    const [year, month, day] = value.split('-').map(Number);

    if (!year || !month || !day) {
      return null;
    }

    return new Date(year, month - 1, day);
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

    const memoryFilters = this.currentMemoryFilters();
    const requests = this.hasMemoryFilters()
      ? forkJoin({
        memories: this.memoriesApi.list(memoryFilters),
        categories: this.categoriesApi.list(this.currentCategoryFilters()),
      })
      : forkJoin({
        memories: this.memoriesApi.list(memoryFilters),
        categories: this.categoriesApi.list(),
      });

    requests.subscribe({
      next: ({ memories, categories }) => {
        this.memories.set(memories);

        if (this.hasMemoryFilters()) {
          this.filteredCategories.set(categories);
          return;
        }

        this.categories.set(categories);
        this.filteredCategories.set([]);
      },
      error: () => {
        this.error.set('Nao foi possivel carregar os resultados. Verifique se a API esta ativa.');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  private loadDashboardMemories(): void {
    this.memoriesApi.list().subscribe({
      next: (memories) => this.allMemories.set(memories),
      error: () => undefined,
    });
  }

  private deleteCategory(category: Category): void {
    this.categoriesApi.delete(category.id).subscribe({
      next: () => {
        this.categories.update((categories) => categories.filter((item) => item.id !== category.id));

        if (this.currentCategoryId() === category.id) {
          this.currentCategoryId.set(category.parent_id);
        }

        this.toastr.success('Categoria excluida com sucesso.');
        this.closeDeleteDialog();
        this.loadMemories();
      },
      error: (error: HttpErrorResponse) => this.error.set(this.extractError(error)),
    });
  }

  private deleteMemory(memory: Memory): void {
    this.memoriesApi.delete(memory.id).subscribe({
      next: () => {
        this.memories.update((memories) => memories.filter((item) => item.id !== memory.id));
        this.toastr.success('Memoria excluida com sucesso.');
        this.closeDeleteDialog();
        this.loadDashboardMemories();
      },
      error: (error: HttpErrorResponse) => this.error.set(this.extractError(error)),
    });
  }

  private associateMemoryToCategory(memory: Memory, category: Category): void {
    this.updateMemoryCategories(memory, category.id).subscribe({
      next: () => {
        this.toastr.success('Nota associada a pasta com sucesso.');
        this.closeConfirmDialog();
        this.loadMemories();
        this.loadDashboardMemories();
      },
      error: (error: HttpErrorResponse) => this.error.set(this.extractError(error)),
    });
  }

  private associateMemoriesToCategory(memories: Memory[], category: Category, afterSave: () => void): void {
    forkJoin(memories.map((memory) => this.updateMemoryCategories(memory, category.id))).subscribe({
      next: () => {
        afterSave();
        this.loadMemories();
        this.loadDashboardMemories();
      },
      error: (error: HttpErrorResponse) => this.error.set(this.extractError(error)),
    });
  }

  private updateMemoryCategories(memory: Memory, categoryId: string) {
    const categoryIds = Array.from(new Set([...memory.categories.map((category) => category.id), categoryId]));

    return this.memoriesApi.update(memory.id, {
      title: memory.title,
      content: memory.content,
      color: memory.color,
      due_date: memory.due_date,
      category_ids: categoryIds,
    });
  }

  private currentMemoryFilters(): MemoryListFilters {
    const categoryId = this.currentCategoryId();
    const filters = this.memoryFilters();

    if (this.hasMemoryFilters()) {
      return filters;
    }

    const scopeFilters = categoryId
      ? { categoryIds: [categoryId] }
      : { withoutCategories: true };

    return {
      ...filters,
      ...scopeFilters,
    };
  }

  private currentCategoryFilters(): CategoryListFilters {
    const filters = this.memoryFilters();
    const sortBy = filters.sortBy === 'title'
      ? 'label'
      : filters.sortBy === 'color' || filters.sortBy === 'created_at' || filters.sortBy === 'updated_at'
        ? filters.sortBy
        : undefined;

    return {
      text: filters.text,
      color: filters.color,
      sortBy,
      sortDirection: filters.sortDirection,
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

  private isUpcoming(memory: Memory): boolean {
    if (!memory.due_date) {
      return false;
    }

    const dueDate = new Date(memory.due_date).getTime();

    return Number.isFinite(dueDate) && dueDate >= Date.now();
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

  private formatDateForApi(value: Date | null): string {
    if (!value) {
      return '';
    }

    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private extractError(error: HttpErrorResponse): string {
    const firstError = Object.values((error.error as { errors?: Record<string, string[]> })?.errors ?? {})[0]?.[0];
    return firstError ?? 'Nao foi possivel salvar agora.';
  }
}
