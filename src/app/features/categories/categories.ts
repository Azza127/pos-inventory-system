import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CategoryService } from '../../core/services/category.service';
import { Category } from '../../core/models/category.model';
import { PopupService } from '../../core/services/popup.service';

@Component({
  selector: 'app-categories',
  imports: [FormsModule],
  templateUrl: './categories.html',
  styleUrl: './categories.css',
})

export class Categories implements OnInit {
  private readonly categoryService = inject(CategoryService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly popupService = inject(PopupService);
  userRole = 'Employee';
  get isEmployee(): boolean {
    return this.userRole.trim().toLowerCase() === 'employee';
  }

  categories: Category[] = [];
  newCategoryName = '';
  editingCategoryId: string | null = null;
  showCategoryModal = false;

  ngOnInit(): void {
    const user = localStorage.getItem('currentUser');
    if (user) {
      try {
        const currentUser = JSON.parse(user);
        this.userRole = currentUser.role || 'Employee';
      } catch (e) {
        this.popupService.showAlert('Error parsing current user', 'error');
      }
    }
    this.loadCategories();
  }

  loadCategories(): void {
    this.categoryService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Failed to load categories:', error);
      }
    });
  }

  openAddCategory(): void {
    if (this.isEmployee) return;
    this.newCategoryName = '';
    this.editingCategoryId = null;
    this.showCategoryModal = true;
  }

  openEditCategory(category: Category): void {
    if (this.isEmployee) return;
    this.newCategoryName = category.name;
    this.editingCategoryId = category.id;
    this.showCategoryModal = true;
  }

  closeCategoryModal(): void {
    this.newCategoryName = '';
    this.editingCategoryId = null;
    this.showCategoryModal = false;
  }

  saveCategory(): void {
    const name = this.newCategoryName.trim();
    if (name === '') {
      return;
    }

    if (this.editingCategoryId !== null) {
      this.categoryService
        .updateCategory(this.editingCategoryId, { name })
        .subscribe({ next: (updatedCategory) => {
            this.categories = this.categories.map((category) =>
              category.id === updatedCategory.id ? updatedCategory : category
            );
            this.closeCategoryModal();
            this.cdr.markForCheck();
          },
          error: (error) => {
            console.error('Failed to update category:', error);
          }
        });
      return;
    }

    this.categoryService
      .addCategory({ name })
      .subscribe({ next: (createdCategory) => {
          this.categories = [ ...this.categories, createdCategory ];
          this.closeCategoryModal();
          this.cdr.markForCheck();
        },
        error: (error) => {console.error('Failed to add category:', error);}
      });
  }

  openDeleteCategory(category: Category): void {
    if (this.isEmployee) return;
  
    this.popupService
      .showConfirm(
        `Are you sure you want to delete "${category.name}"? This action cannot be undone.`,
        'Delete Category?'
      )
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
  
        this.categoryService.deleteCategory(category.id).subscribe({
          next: () => {
            this.categories = this.categories.filter(
              (item) => item.id !== category.id
            );
  
            this.cdr.markForCheck();
          },
          error: (error) => {
            console.error('Failed to delete category:', error);
  
            this.popupService.showAlert(
              'Failed to delete category.',
              'error'
            );
          }
        });
      });
  }
}

