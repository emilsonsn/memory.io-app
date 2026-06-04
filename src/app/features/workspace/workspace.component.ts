import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, forkJoin, of } from 'rxjs';
import { QuillModule } from 'ngx-quill';
import { ToastrService } from 'ngx-toastr';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faArrowRightFromBracket,
  faBell,
  faBoxArchive,
  faChevronDown,
  faChevronRight,
  faCopy,
  faEllipsisVertical,
  faFolderOpen,
  faMoon,
  faNoteSticky,
  faSliders,
  faPlus,
  faSpinner,
  faStar,
  faSun,
  faUser,
  faSearch,
  faGear,
  faThumbtack,
  faTrashCan,
  faXmark,
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
import { FavoritesApiService } from '../../core/api/favorites';
import { MemoriesApiService, MemoryListFilters } from '../../core/api/memories/memories-api.service';
import { AuthStore } from '../../core/auth/auth.store';
import { AppLoadingService } from '../../core/loading/app-loading.service';
import { ThemeService } from '../../core/theme/theme.service';
import { CategoryDialogComponent } from '../../shared/components/dialogs/category-dialog/category-dialog.component';
import { AdvancedMemoryFiltersDialogComponent } from '../../shared/components/dialogs/advanced-memory-filters-dialog/advanced-memory-filters-dialog.component';
import { ConfirmDialogComponent } from '../../shared/components/dialogs/confirm-dialog/confirm-dialog.component';
import { MemoryDialogComponent } from '../../shared/components/dialogs/memory-dialog/memory-dialog.component';
import { NoteGroupDialogComponent, NoteGroupPayload } from '../../shared/components/dialogs/note-group-dialog/note-group-dialog.component';
import {
  Category,
  CategoryPayload,
  ColorOption,
  Favorite,
  FavoritePayload,
  FavoriteType,
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
type QuickSettingsTarget =
  | { type: 'category'; id: string }
  | { type: 'memory'; id: string };
type MemoryFilterKey =
  | 'text'
  | 'color'
  | 'createdFrom'
  | 'createdTo';
type SidebarCategoryNode = {
  category: Category;
  children: SidebarCategoryNode[];
};
type SidebarCategoryEntry =
  | { kind: 'category'; category: Category; depth: number; hasChildren: boolean; expanded: boolean }
  | { kind: 'toggle'; category: Category; depth: number; hiddenChildren: number; expanded: boolean };
type FavoriteItem =
  | { type: 'category'; item: Category; favorite: Favorite }
  | { type: 'memory'; item: Memory; favorite: Favorite };

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
    QuillModule,
    ReactiveFormsModule,
  ],
  templateUrl: './workspace.component.html',
  styleUrl: './workspace.component.scss',
})
export class WorkspaceComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authApi = inject(AuthApiService);
  private readonly categoriesApi = inject(CategoriesApiService);
  private readonly colorsApi = inject(ColorsApiService);
  private readonly favoritesApi = inject(FavoritesApiService);
  private readonly memoriesApi = inject(MemoriesApiService);
  readonly authStore = inject(AuthStore);
  private readonly appLoading = inject(AppLoadingService);
  private readonly router = inject(Router);
  private readonly toastr = inject(ToastrService);
  private readonly dialog = inject(MatDialog);
  readonly themeService = inject(ThemeService);

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
  readonly favorites = signal<Favorite[]>([]);
  readonly favoriteRequestKeys = signal<string[]>([]);
  readonly editingCategory = signal<Category | null>(null);
  readonly editingMemory = signal<Memory | null>(null);
  readonly expandedMemory = signal<Memory | null>(null);
  readonly copiedMemoryId = signal<string | null>(null);
  readonly deleteTarget = signal<DeleteTarget | null>(null);
  readonly confirmTarget = signal<ConfirmTarget | null>(null);
  readonly quickSettingsTarget = signal<QuickSettingsTarget | null>(null);
  readonly groupingPair = signal<{ source: Memory; target: Memory } | null>(null);
  readonly draggedMemory = signal<Memory | null>(null);
  readonly dropCategoryId = signal<string | null>(null);
  readonly dropMemoryId = signal<string | null>(null);
  readonly expandedSidebarCategoryIds = signal<string[]>([]);
  readonly collapsedSidebarCategoryIds = signal<string[]>([]);
  readonly sidebarPinned = signal(true);
  private readonly expandMemoryAfterSave = signal(false);
  readonly icons = {
    box: faBoxArchive,
    chevronDown: faChevronDown,
    chevronRight: faChevronRight,
    copy: faCopy,
    ellipsis: faEllipsisVertical,
    folderOpen: faFolderOpen,
    gear: faGear,
    logout: faArrowRightFromBracket,
    moon: faMoon,
    notification: faBell,
    note: faNoteSticky,
    plus: faPlus,
    profile: faUser,
    search: faSearch,
    sliders: faSliders,
    spinner: faSpinner,
    star: faStar,
    sun: faSun,
    thumbtack: faThumbtack,
    trash: faTrashCan,
    close: faXmark,
  };
  readonly expandedNoteForm = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    content: ['', [Validators.required]],
  });
  readonly memoryFilters = signal<MemoryListFilters>({
    sortBy: 'created_at',
    sortDirection: 'desc',
  });

  private searchDebounce: number | null = null;
  private expandedLastSavedSnapshot = '';

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
      return this.filteredCategories();
    }

    const parentId = this.currentCategoryId();

    return this.categories().filter((category) => category.parent_id === parentId);
  });

  readonly visibleMemories = computed(() => {
    return this.memories();
  });

  readonly hasRootSections = computed(() => {
    return !this.currentCategoryId() && !this.hasMemoryFilters();
  });

  readonly favoriteItems = computed<FavoriteItem[]>(() => {
    return this.favorites().flatMap((favorite): FavoriteItem[] => {
      if (favorite.type === 'category') {
        const category = favorite.category ?? this.categories().find((item) => item.id === favorite.category_id);
        return category ? [{ type: 'category', item: category, favorite }] : [];
      }

      const memory = favorite.memory ?? this.allMemories().find((item) => item.id === favorite.memory_id);
      return memory ? [{ type: 'memory', item: memory, favorite }] : [];
    });
  });

  readonly pageTitle = computed(() => {
    if (this.currentCategory()) {
      return this.currentCategory()?.label;
    }

    return 'Seu Second Brain';
  });

  readonly generalItemsTotal = computed(() => {
    return this.visibleCategories().length + this.visibleMemories().length;
  });

  readonly sidebarCategoryEntries = computed<SidebarCategoryEntry[]>(() => {
    return this.buildSidebarEntries(this.sidebarCategoryTree());
  });

  readonly currentDefaultMemoryColor = computed<NoteColor | null>(() => {
    return this.currentCategory()?.color ?? null;
  });

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.saveExpandedMemoryIfNeeded();
  }

  toggleSidebarPinned(): void {
    this.sidebarPinned.update((pinned) => !pinned);
  }

  selectSidebarCategory(category: Category, hasChildren: boolean, event: Event): void {
    event.stopPropagation();

    if (hasChildren) {
      this.toggleSidebarCategoryState(category);
    }

    this.goToCategory(category);
  }

  toggleSidebarCategory(category: Category, event: Event): void {
    event.stopPropagation();
    this.toggleSidebarCategoryState(category);
  }

  private toggleSidebarCategoryState(category: Category): void {
    if (this.sidebarCategoryExpanded(category)) {
      this.expandedSidebarCategoryIds.update((ids) => ids.filter((id) => id !== category.id));
      this.collapsedSidebarCategoryIds.update((ids) => ids.includes(category.id) ? ids : [...ids, category.id]);
      return;
    }

    this.collapsedSidebarCategoryIds.update((ids) => ids.filter((id) => id !== category.id));
    this.expandedSidebarCategoryIds.update((ids) => ids.includes(category.id) ? ids : [...ids, category.id]);
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set(null);
    this.appLoading.start();

    forkJoin({
      colors: this.colorsApi.list(),
      categories: this.categoriesApi.list(),
      memories: this.memoriesApi.list(this.currentMemoryFilters()),
      allMemories: this.memoriesApi.list(),
      favorites: this.favoritesApi.list().pipe(catchError(() => of([]))),
    }).pipe(
      finalize(() => {
        this.loading.set(false);
        this.appLoading.stop();
      }),
    ).subscribe({
      next: ({ colors, categories, memories, allMemories, favorites }) => {
        this.colors.set(colors);
        this.categories.set(categories);
        this.memories.set(memories);
        this.allMemories.set(allMemories);
        this.favorites.set(favorites);
      },
      error: () => {
        this.error.set('Nao foi possivel carregar os cadastros. Verifique se a API esta ativa.');
      },
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

  expandMemoryFromDialog(payload: MemoryPayload): void {
    const editing = this.editingMemory();

    if (editing) {
      const expandedMemory = this.memoryFromPayload(editing, payload);
      this.openExpandedMemory(expandedMemory);
      this.closeAfterSave();
      return;
    }

    if (this.saving()) {
      this.expandMemoryAfterSave.set(true);
      return;
    }

    const finalPayload = this.memoryPayloadWithCurrentCategory(payload);

    this.saving.set(true);
    this.memoriesApi.create(finalPayload).subscribe({
      next: (memory) => {
        this.toastr.success('Memoria criada com sucesso.');
        this.closeAfterSave();
        this.openExpandedMemory(memory);
        this.loadMemories();
        this.loadDashboardMemories();
      },
      error: (error: HttpErrorResponse) => {
        this.expandMemoryAfterSave.set(false);
        this.error.set(this.extractError(error));
      },
      complete: () => this.saving.set(false),
    });
  }

  openExpandedMemory(memory: Memory): void {
    this.expandedMemory.set(memory);
    this.expandedNoteForm.reset({
      title: memory.title,
      content: memory.content,
    });
    this.expandedLastSavedSnapshot = this.expandedSnapshot();
  }

  closeExpandedMemory(): void {
    this.saveExpandedMemoryIfNeeded();
    this.expandedMemory.set(null);
  }

  toggleQuickSettings(type: QuickSettingsTarget['type'], id: string, event: Event): void {
    event.stopPropagation();
    const current = this.quickSettingsTarget();

    if (current?.type === type && current.id === id) {
      this.quickSettingsTarget.set(null);
      return;
    }

    this.quickSettingsTarget.set({ type, id });
  }

  quickSettingsOpen(type: QuickSettingsTarget['type'], id: string): boolean {
    const current = this.quickSettingsTarget();

    return current?.type === type && current.id === id;
  }

  editCategoryFromQuickSettings(category: Category, event: Event): void {
    event.stopPropagation();
    this.quickSettingsTarget.set(null);
    this.editingCategory.set(category);
    this.activeDialog.set('category');
  }

  editMemoryFromQuickSettings(memory: Memory, event: Event): void {
    event.stopPropagation();
    this.quickSettingsTarget.set(null);
    this.openEditMemory(memory);
  }

  updateCategoryColor(category: Category, color: NoteColor | null, event: Event): void {
    event.stopPropagation();

    if (this.saving()) {
      return;
    }

    this.saving.set(true);
    this.categoriesApi.update(category.id, {
      label: category.label,
      description: category.description,
      color,
      parent_id: category.parent_id,
    }).subscribe({
      next: (updatedCategory) => {
        this.categories.update((categories) => categories.map((item) => item.id === updatedCategory.id ? updatedCategory : item));
        this.toastr.success('Cor atualizada com sucesso.');
      },
      error: (error: HttpErrorResponse) => {
        this.expandMemoryAfterSave.set(false);
        this.error.set(this.extractError(error));
      },
      complete: () => this.saving.set(false),
    });
  }

  saveCurrentCategoryTitle(event: Event): void {
    const input = event.target as HTMLInputElement;
    const category = this.currentCategory();
    const label = input.value.trim();

    if (!category) {
      return;
    }

    if (!label) {
      input.value = category.label;
      return;
    }

    if (label === category.label) {
      return;
    }

    this.updateCurrentCategory(category, { label }, () => {
      input.value = category.label;
    });
  }

  saveCurrentCategoryDescription(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    const category = this.currentCategory();
    const description = textarea.value.trim();

    if (!category || description === category.description) {
      return;
    }

    this.updateCurrentCategory(category, { description }, () => {
      textarea.value = category.description;
    });
  }

  private updateCurrentCategory(category: Category, changes: Partial<CategoryPayload>, rollback: () => void): void {
    if (this.saving()) {
      rollback();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.categoriesApi.update(category.id, {
      label: changes.label ?? category.label,
      description: changes.description ?? category.description,
      color: changes.color ?? category.color,
      parent_id: changes.parent_id ?? category.parent_id,
    }).subscribe({
      next: (updatedCategory) => {
        this.categories.update((categories) => categories.map((item) => item.id === updatedCategory.id ? updatedCategory : item));
      },
      error: (error: HttpErrorResponse) => {
        rollback();
        this.error.set(this.extractError(error));
      },
      complete: () => this.saving.set(false),
    });
  }

  updateMemoryColor(memory: Memory, color: NoteColor | null, event: Event): void {
    event.stopPropagation();

    if (this.saving()) {
      return;
    }

    this.saving.set(true);
    this.memoriesApi.update(memory.id, {
      title: memory.title,
      content: memory.content,
      color,
      due_date: memory.due_date,
      category_ids: memory.categories.map((category) => category.id),
    }).subscribe({
      next: (updatedMemory) => {
        this.memories.update((memories) => memories.map((item) => item.id === updatedMemory.id ? updatedMemory : item));
        this.allMemories.update((memories) => memories.map((item) => item.id === updatedMemory.id ? updatedMemory : item));
        this.toastr.success('Cor atualizada com sucesso.');
      },
      error: (error: HttpErrorResponse) => this.error.set(this.extractError(error)),
      complete: () => this.saving.set(false),
    });
  }

  closeDialog(): void {
    if (this.saving()) {
      return;
    }

    this.expandMemoryAfterSave.set(false);
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
      || filters.sortDirection !== 'desc'
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

    const finalPayload = this.memoryPayloadWithCurrentCategory(payload);

    this.saving.set(true);
    this.error.set(null);
    const editing = this.editingMemory();
    const request = editing
      ? this.memoriesApi.update(editing.id, finalPayload)
      : this.memoriesApi.create(finalPayload);

    request.subscribe({
      next: (memory) => {
        this.editingMemory.set(memory);        
        this.loadMemories();
        this.loadDashboardMemories();

        if (this.expandMemoryAfterSave()) {
          this.expandMemoryAfterSave.set(false);
          this.closeAfterSave();
          this.openExpandedMemory(memory);
        }
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

  endItemDrag(): void {
    this.draggedMemory.set(null);
    this.dropCategoryId.set(null);
    this.dropMemoryId.set(null);
  }

  allowCategoryDrop(category: Category, event: DragEvent): void {
    const draggedMemory = this.draggedMemory();

    if (!draggedMemory) {
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
    this.endItemDrag();

    if (!memory || memory.categories.some((item) => item.id === category.id)) {
      return;
    }

    this.confirmTarget.set({ type: 'move-to-category', memory, category });
  }

  dropMemoryOnMemory(target: Memory, event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const source = this.draggedMemory();
    this.endItemDrag();

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

  isFavorite(type: FavoriteType, id: string): boolean {
    return this.favorites().some((favorite) => this.favoriteKeyFromFavorite(favorite) === this.favoriteKey(type, id));
  }

  isFavoriteLoading(type: FavoriteType, id: string): boolean {
    return this.favoriteRequestKeys().includes(this.favoriteKey(type, id));
  }

  toggleFavorite(type: FavoriteType, id: string, event: Event): void {
    event.stopPropagation();
    const key = this.favoriteKey(type, id);

    if (this.favoriteRequestKeys().includes(key)) {
      return;
    }

    this.favoriteRequestKeys.update((keys) => [...keys, key]);

    const favorite = this.favorites().find((item) => this.favoriteKeyFromFavorite(item) === key);
    const request: Observable<Favorite | null> = favorite
      ? this.favoritesApi.remove(this.favoritePayload(type, id))
      : this.favoritesApi.add(this.favoritePayload(type, id));

    request.pipe(
      finalize(() => this.favoriteRequestKeys.update((keys) => keys.filter((item) => item !== key))),
    ).subscribe({
      next: (response) => {
        if (favorite) {
          this.favorites.update((items) => items.filter((item) => this.favoriteKeyFromFavorite(item) !== key));
          return;
        }

        this.favorites.update((items) => [...items.filter((item) => this.favoriteKeyFromFavorite(item) !== key), response as Favorite]);
      },
      error: () => {
        this.toastr.error('Nao foi possivel atualizar o favorito.');
      },
    });
  }

  openFavoriteItem(favorite: FavoriteItem): void {
    if (favorite.type === 'category') {
      this.goToCategory(favorite.item);
      return;
    }

    this.openEditMemory(favorite.item);
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

  colorPreview(color: NoteColor | null): string {
    const previews: Record<NoteColor | 'default', string> = {
      default: '#92909a',
      gray: '#92909a',
      red: '#df5b68',
      orange: '#df8b42',
      yellow: '#d8b22d',
      green: '#37a66b',
      blue: '#4c7fd8',
      purple: '#6d3bdc',
      pink: '#dc66ad',
    };

    return previews[color ?? 'default'];
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

  saveExpandedMemoryIfNeeded(): void {
    const memory = this.expandedMemory();

    if (!memory || this.expandedNoteForm.invalid || this.saving()) {
      return;
    }

    const snapshot = this.expandedSnapshot();

    if (snapshot === this.expandedLastSavedSnapshot) {
      return;
    }

    const value = this.expandedNoteForm.getRawValue();
    const payload: MemoryPayload = {
      title: value.title ?? '',
      content: value.content ?? '',
      color: memory.color,
      due_date: memory.due_date,
      category_ids: memory.categories.map((category) => category.id),
    };

    this.saving.set(true);
    this.memoriesApi.update(memory.id, payload).subscribe({
      next: (updatedMemory) => {
        this.expandedMemory.set(updatedMemory);
        this.memories.update((memories) => memories.map((item) => item.id === updatedMemory.id ? updatedMemory : item));
        this.allMemories.update((memories) => memories.map((item) => item.id === updatedMemory.id ? updatedMemory : item));
        this.expandedLastSavedSnapshot = snapshot;
      },
      error: (error: HttpErrorResponse) => this.error.set(this.extractError(error)),
      complete: () => this.saving.set(false),
    });
  }

  private expandedSnapshot(): string {
    return JSON.stringify(this.expandedNoteForm.getRawValue());
  }

  private memoryPayloadWithCurrentCategory(payload: MemoryPayload): MemoryPayload {
    const currentCategoryId = this.currentCategoryId();

    return this.editingMemory() || !currentCategoryId
      ? payload
      : { ...payload, category_ids: Array.from(new Set([...payload.category_ids, currentCategoryId])) };
  }

  private memoryFromPayload(memory: Memory, payload: MemoryPayload): Memory {
    return {
      ...memory,
      title: payload.title,
      content: payload.content,
      color: payload.color,
      due_date: payload.due_date,
      categories: this.categories().filter((category) => payload.category_ids.includes(category.id)),
    };
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

  private favoriteKey(type: FavoriteType, id: string): string {
    return `${type}:${id}`;
  }

  private favoriteKeyFromFavorite(favorite: Favorite): string {
    const id = favorite.type === 'category' ? favorite.category_id : favorite.memory_id;
    return id ? this.favoriteKey(favorite.type, id) : favorite.id;
  }

  private favoritePayload(type: FavoriteType, id: string): FavoritePayload {
    return type === 'category'
      ? { category_id: id }
      : { memory_id: id };
  }

  private sidebarCategoryTree(): SidebarCategoryNode[] {
    const nodes = new Map<string, SidebarCategoryNode>();

    for (const category of this.categories()) {
      nodes.set(category.id, { category, children: [] });
    }

    const roots: SidebarCategoryNode[] = [];

    for (const node of nodes.values()) {
      const parent = node.category.parent_id ? nodes.get(node.category.parent_id) : null;

      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  private buildSidebarEntries(nodes: SidebarCategoryNode[], depth = 0): SidebarCategoryEntry[] {
    return nodes.flatMap((node) => {
      const expanded = this.sidebarCategoryExpanded(node.category, depth);
      const entries: SidebarCategoryEntry[] = [{
        kind: 'category',
        category: node.category,
        depth,
        hasChildren: node.children.length > 0,
        expanded,
      }];

      if (expanded) {
        entries.push(...this.buildSidebarEntries(node.children, depth + 1));
      } else if (node.children.length > 0 && depth > 0) {
        entries.push({
          kind: 'toggle',
          category: node.category,
          depth: depth + 1,
          hiddenChildren: node.children.length,
          expanded,
        });
      }

      return entries;
    });
  }

  private sidebarCategoryExpanded(category: Category, depth = 0): boolean {
    if (this.collapsedSidebarCategoryIds().includes(category.id)) {
      return false;
    }

    if (this.expandedSidebarCategoryIds().includes(category.id)) {
      return true;
    }

    return this.breadcrumb().some((item) => item.parent_id === category.id);
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
