import { ChangeDetectorRef, Component, HostListener, OnInit, inject} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { forkJoin, Observable, of, switchMap} from 'rxjs';
import { ProductService } from '../../core/services/product.service';
import { Product } from '../../core/models/product.model';
import { CategoryService } from '../../core/services/category.service';
import { Category } from '../../core/models/category.model';
import { StoreSettingsService } from '../../core/services/store-settings.service';
import { PurchaseInvoiceService } from '../../core/services/purchase-invoice.service';
import { PurchaseInvoice, PurchaseInvoiceItem} from '../../core/models/purchase-invoice.model';
import { PopupService } from '../../core/services/popup.service';
import { ReturnService } from '../../core/services/return.service';
import { ReturnTransaction } from '../../core/models/return.model';

@Component({
  selector: 'app-purchase-invoices',
  standalone: true,
  imports: [ FormsModule, DecimalPipe ],
  templateUrl: './purchase-invoices.html',
  styleUrl: './purchase-invoices.css'
})

export class PurchaseInvoices implements OnInit {

  //  SERVICES //
  private readonly productService = inject(ProductService);
  private readonly categoryService = inject(CategoryService);
  private readonly purchaseInvoiceService = inject(PurchaseInvoiceService);
  private readonly popupService = inject(PopupService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly storeSettingsService = inject(StoreSettingsService);
  private readonly returnService = inject(ReturnService);

// DATA
invoices: PurchaseInvoice[] = [];
products: Product[] = [];

// PURCHASE RETURNS
purchaseReturns: ReturnTransaction[] = [];

// STORE SETTINGS / CURRENCY
currency = 'EGP';
currencySymbol = 'EGP';

// SEARCH / FILTERS
searchTerm = '';
invoiceSearchTerm = '';
invoiceDateFilter = '';

// MODAL
  showInvoiceForm = false;
  editingInvoiceId: string | null = null;

  // PRODUCT SEARCH
  productSearchTerm = '';
  productSearchResults: Product[] = [];
  showProductResults = false;

// QUICK ADD PRODUCT
  showQuickAddProduct = false;
  categories: Category[] = [];
  quickProduct: Product =  this.createEmptyQuickProduct();

  // FORM
  newInvoice: PurchaseInvoice = this.createEmptyInvoice();

  // INIT
  ngOnInit(): void {
    this.loadInvoices();
    this.loadProducts();
    this.loadCategories();
    this.loadStoreSettings();
    this.loadPurchaseReturns();
  }

private loadStoreSettings(): void {
  this.storeSettingsService
    .getOrLoadSettings()
    .subscribe({ next: (settings) => {
        if (!settings) {
          return;
        }
        this.currency = settings.currency;
        this.currencySymbol = this.storeSettingsService.getCurrencySymbol( settings.currency );
        this.cdr.markForCheck();
      },
      error: (error: unknown) => { console.error( 'Failed to load store settings:', error ); }
    });
}

  // LOAD INVOICES
  loadInvoices(): void {
    this.purchaseInvoiceService.getPurchaseInvoices().subscribe({
      next: (invoices) => {
        this.invoices = [...(invoices || [])].sort(
          (a, b) =>
            new Date(b.invoiceDate).getTime() -
            new Date(a.invoiceDate).getTime()
        );
  
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error loading purchase invoices:', error);
      }
    });
  }

  // LOAD PRODUCTS
  loadProducts(): void {
    this.productService
      .getProducts()
      .subscribe({ next: (products) => {
          this.products = products;
          this.cdr.markForCheck();
        },
        error: (error: unknown) => { console.error( 'Failed to load products:', error );
          this.popupService.showAlert( 'Failed to load products.', 'error', 'Loading Error' );
        }
      });
  }

// LOAD CATEGORIES
loadCategories(): void {
  this.categoryService
    .getCategories()
    .subscribe({ next: (categories) => {
        this.categories = categories.map( category => ({ ...category, id: String(category.id) }) );
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        console.error( 'Failed to load categories:', error );
        this.popupService.showAlert( 'Failed to load product categories.', 'error', 'Loading Error' );
      }
    });
}


  // LOAD PURCHASE RETURNS
  loadPurchaseReturns(): void {
    this.returnService
      .getReturnsByType('purchase')
      .subscribe({
        next: (returns) => {
          this.purchaseReturns = returns || [];
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          console.error( 'Failed to load purchase returns:', error
          );
        }
      });
  }

  // CHECK IF THE WHOLE PURCHASE INVOICE WAS RETURNED
  isInvoiceFullyReturned(
    invoice: PurchaseInvoice
  ): boolean {

    if (!invoice.items || invoice.items.length === 0) {
      return false;
    }

    const completedReturns =
      this.purchaseReturns.filter( returnTransaction => returnTransaction.type === 'purchase' && returnTransaction.status === 'completed' && String(returnTransaction.referenceId) === String(invoice.id));
    if (completedReturns.length === 0) {
      return false;
    }

    return invoice.items.every((invoiceItem) => {
      const returnedQuantity = completedReturns.reduce((total, returnTransaction) => total + (returnTransaction.items || [])
              .filter( returnItem => String(returnItem.productId) === String(invoiceItem.productId))
              .reduce((itemTotal, returnItem) => itemTotal + Number(returnItem.quantity || 0), 0 ), 0 );
      return returnedQuantity >= Number(invoiceItem.quantity || 0);
    });
  }

  // OPEN NEW INVOICE
  showNewInvoiceForm(): void {
    this.editingInvoiceId = null;
    this.newInvoice = this.createEmptyInvoice();
    this.productSearchTerm = '';
    this.productSearchResults = [];
    this.showProductResults = false;
    this.showInvoiceForm = true;
  }

  // CANCEL INVOICE
  cancelInvoiceForm(): void {
    this.showInvoiceForm = false;
    this.editingInvoiceId = null;
    this.productSearchTerm = '';
    this.productSearchResults = [];
    this.showProductResults = false;
    this.newInvoice = this.createEmptyInvoice();
  }

  // CREATE EMPTY INVOICE
  private createEmptyInvoice(): PurchaseInvoice {
    return {
      id: '', supplierName: '', invoiceNumber: '',invoiceDate: this.getTodayDate(), warehouseId: '', notes: '', subtotal: 0, taxTotal: 0, total: 0, items: []
    };
  }

  // TODAY DATE
  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  // PRODUCT SEARCH
  searchProducts(term: string): void {
    this.productSearchTerm = term;
    const normalizedTerm = term.trim().toLowerCase();
    if (normalizedTerm === '') {
      this.productSearchResults = [];
      this.showProductResults = false;
      return;
    }

    this.productSearchResults = this.products .filter((product) => {
          const name = product.name.toLowerCase();
          const sku = product.sku.toLowerCase();
          return (
            name.includes(normalizedTerm) || sku.includes(normalizedTerm)
          );
        }) .slice(0, 8);

    this.showProductResults = this.productSearchResults.length > 0;
  }

  // SCAN / ENTER PRODUCT CODE
  scanProductByCode(code: string): void {
    const normalizedCode = code.trim().toLowerCase();
    if (normalizedCode === '') {
      return;
    }

    const product = this.products.find( item => item.sku.trim().toLowerCase() === normalizedCode );

    if (product) {
      this.selectProduct(product);
      return;
    }

    this.popupService.showAlert(
      `No product was found with code "${code}".`, 'warning', 'Product Not Found'
    );
  }
  
  // SELECT PRODUCT
  selectProduct(product: Product): void {
    const existingItem = this.newInvoice.items.find( item => item.productId === product.id );

    // Product already exists
    if (existingItem) {
      existingItem.quantity += 1;
      this.recalculateInvoice();
      this.clearProductSearch();
      return;
    }

    // Add product
    const item: PurchaseInvoiceItem = {
      id: this.generateId(),
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: 1,
      expiryDate: '',
      purchasePrice: product.costPrice ?? 0,
      sellingPrice: product.price,
      taxRate: 0,
      taxAmount: 0,
      subtotal: 0,
      total: 0
    };

    this.newInvoice.items = [ ...this.newInvoice.items, item ];
    this.recalculateInvoice();
    this.clearProductSearch();
  }

  // CLEAR PRODUCT SEARCH
  clearProductSearch(): void {
    this.productSearchTerm = '';
    this.productSearchResults = [];
    this.showProductResults = false;
  }

// QUICK ADD PRODUCT
openQuickAddProduct(): void {
  this.quickProduct = this.createEmptyQuickProduct();
  const searchValue = this.productSearchTerm.trim();

  if (searchValue !== '') {
    const looksLikeSku =  /^[A-Za-z0-9_-]+$/.test(searchValue);
    if (looksLikeSku) {
      this.quickProduct.sku = searchValue;
    } else {
      this.quickProduct.name = searchValue;
    }
  }

  this.showProductResults = false;
  this.showQuickAddProduct = true;
  this.cdr.markForCheck();
}


// CLOSE QUICK ADD PRODUCT
closeQuickAddProduct(): void {
  this.showQuickAddProduct = false;
  this.quickProduct = this.createEmptyQuickProduct();
  this.cdr.markForCheck();
}

// CREATE EMPTY QUICK PRODUCT
private createEmptyQuickProduct(): Product {
  return {
    id: '', name: '', description: '', sku: '', categoryId: '', price: 0, stock: 0, maxStock: 0, minStock: 0, image: ''
  };
}

// VALIDATE QUICK PRODUCT
isQuickProductValid(): boolean {
  const name = this.quickProduct.name.trim();
  const sku = this.quickProduct.sku.trim();
  const categoryId = String( this.quickProduct.categoryId || '' ).trim();
  const price = Number(this.quickProduct.price);
  const minStock = Number(this.quickProduct.minStock);
  const maxStock = Number(this.quickProduct.maxStock);
  if (name === '') {
    return false;
  }

  if (sku === '') {
    return false;
  }

  if (categoryId === '') {
    return false;
  }

  if (!Number.isFinite(price) || price <= 0) {
    return false;
  }

  if (!Number.isFinite(minStock) || minStock < 0) {
    return false;
  }

  if (!Number.isFinite(maxStock) || maxStock <= 0) {
    return false;
  }

  if (minStock > maxStock) {
    return false;
  }

  return true;
}


// SAVE QUICK PRODUCT
saveQuickProduct(): void {
  if (!this.isQuickProductValid()) {
    this.popupService.showAlert(
      'Please complete the required product information.', 'warning', 'Incomplete Product'
    );
    return;
  }

  const productToSave: Product = { ...this.quickProduct,
    name: this.quickProduct.name.trim(),
    sku: this.quickProduct.sku.trim(),
    categoryId: String( this.quickProduct.categoryId ),
    stock: 0,
    minStock: Number(this.quickProduct.minStock || 0),
    maxStock: Number(this.quickProduct.maxStock || 0),
    price: Number(this.quickProduct.price || 0),
    image: this.quickProduct.image?.trim() ?? '',
    description: this.quickProduct.description?.trim() ?? ''
  };

  this.productService
    .createProduct(productToSave)
    .subscribe({ next: (createdProduct: Product) => {
        const normalizedProduct: Product = { ...createdProduct,
          id: String(createdProduct.id),
          categoryId: String(createdProduct.categoryId),
          stock: Number(createdProduct.stock || 0)
        };

        // Add the new product to local product list
        this.products = [ ...this.products, normalizedProduct ];
        this.selectProduct( normalizedProduct );

        // Close ONLY the quick product modal
        this.showQuickAddProduct = false;
        this.quickProduct = this.createEmptyQuickProduct();

        // Make sure search is cleared
        this.clearProductSearch();
        this.popupService.showAlert(
          'Product added successfully and added to the current purchase invoice.', 'success', 'Product Added'
        );

        this.cdr.markForCheck();
      },

      error: (error: unknown) => {
        console.error( 'Failed to create product:', error );
        this.popupService.showAlert( 'Failed to add the product.', 'error', 'Add Product Failed' );
      }
    });
}

  // REMOVE ITEM
  removeInvoiceItem(itemId: string): void {
    this.newInvoice.items = this.newInvoice.items.filter( item => item.id !== itemId );
    this.recalculateInvoice();
  }

  // UPDATE ITEM
  updateItem( item: PurchaseInvoiceItem ): void {
    if (item.quantity < 1) {
      item.quantity = 1;
    }

    if (item.purchasePrice < 0) {
      item.purchasePrice = 0;
    }

    if (item.sellingPrice < 0) {
      item.sellingPrice = 0;
    }

    if (item.taxRate < 0) {
      item.taxRate = 0;
    }

    this.recalculateInvoice();
  }

  // RECALCULATE INVOICE
  recalculateInvoice(): void {
    let subtotal = 0;
    let taxTotal = 0;

    this.newInvoice.items.forEach((item) => {
        item.subtotal = item.quantity * item.purchasePrice;
        item.taxAmount = item.subtotal * (item.taxRate / 100);
        item.total = item.subtotal + item.taxAmount;
        subtotal += item.subtotal;
        taxTotal += item.taxAmount;
      }
    );

    this.newInvoice.subtotal = subtotal;
    this.newInvoice.taxTotal = taxTotal;
    this.newInvoice.total = subtotal + taxTotal;
    this.cdr.markForCheck();
  }

  // UPDATE ONE PRODUCT STOCK
  private updateProductStock( product: Product, quantityDelta: number ): Observable<Product> {
    const currentStock =Number(product.stock ?? 0);
    const newStock = Math.max(0, currentStock + quantityDelta);
    const updatedProduct: Product = { ...product, stock: newStock };
    return this.productService.updateProduct( product.id, updatedProduct );
  }

  // ADD PURCHASE QUANTITIES TO STOCK
  private addInvoiceStock( invoice: PurchaseInvoice ): Observable<Product[]> {
    if (invoice.items.length === 0) {
      return of([]);
    }

    return this.productService
      .getProducts()
      .pipe( switchMap(
          (latestProducts) => { const updates: Observable<Product>[] = [];
            invoice.items.forEach( (item) => {
                const product = latestProducts.find(  product =>  String(product.id) ===  String(item.productId) );
                if (!product) {
                  throw new Error( `Product ${item.productId} was not found while updating stock.` );
                }
                updates.push( this.updateProductStock( product, Number(item.quantity || 0))
                );
              }
            );

            if (updates.length === 0) {
              return of([]);
            }

            return forkJoin(updates);
          }
        )
      );
  }

  // UPDATE STOCK AFTER EDITING INVOICE
  private updateStockAfterInvoiceEdit(
    oldInvoice: PurchaseInvoice, newInvoice: PurchaseInvoice ): Observable<Product[]> {
    const quantityChanges = new Map<string, number>();

    // Remove old invoice quantities
    oldInvoice.items.forEach((item) => {
        const productId = String(item.productId);
        const oldQuantity = Number(item.quantity || 0);
        const current = quantityChanges.get(productId) ?? 0;
        quantityChanges.set( productId,current - oldQuantity );
      }
    );

    // Add new invoice quantities
    newInvoice.items.forEach( (item) => {
        const productId = String(item.productId);
        const newQuantity = Number(item.quantity || 0);
        const current = quantityChanges.get(productId) ?? 0;
        quantityChanges.set( productId, current + newQuantity
        );
      }
    );

    // Keep only actual changes
    const changedProducts = Array.from( quantityChanges.entries())
      .filter( ([, quantityDelta]) => quantityDelta !== 0);

    if (changedProducts.length === 0) {
      return of([]);
    }

    // Get latest products from API
    return this.productService
      .getProducts().pipe( switchMap(
          (latestProducts) => { const updates: Observable<Product>[] = [];
            changedProducts.forEach(([productId, quantityDelta]) => {
                const product = latestProducts.find( item => String(item.id) === String(productId));
                if (!product) {
                  throw new Error( `Product ${productId} was not found while updating stock.` );
                }
                updates.push(this.updateProductStock( product, Number(quantityDelta)));
              }
            );

            if (updates.length === 0) {
              return of([]);
            }
            return forkJoin(updates);
          }
        )
      );
  }

  // SAVE INVOICE
  saveInvoice(): void {
    if (!this.isInvoiceValid()) {
      this.popupService.showAlert(
        'Please complete all required invoice information and add at least one product.', 'warning', 'Incomplete Invoice'
      );
      return;
    }

    this.recalculateInvoice();
    const invoiceToSave: PurchaseInvoice = { ...this.newInvoice,
      supplierName: this.newInvoice.supplierName.trim(),
      invoiceNumber: this.newInvoice.invoiceNumber.trim(),
      notes: this.newInvoice.notes?.trim() ?? '',
      items: this.newInvoice.items.map( item => ({ ...item }) )
    };

    // UPDATE EXISTING INVOICE
    if (this.editingInvoiceId) {
      const oldInvoice = this.invoices.find( invoice => invoice.id === this.editingInvoiceId);

      if (!oldInvoice) {
        this.popupService.showAlert(
          'The original invoice could not be found.', 'error', 'Update Failed'
        );
        return;
      }

      this.purchaseInvoiceService
        .updatePurchaseInvoice( this.editingInvoiceId, invoiceToSave )
        .subscribe({next: (updatedInvoice) => {
            this.updateStockAfterInvoiceEdit( oldInvoice, updatedInvoice)
            .subscribe({ next: () => {

                // Update invoice list
                this.invoices = this.invoices.map( invoice => invoice.id === updatedInvoice.id ? updatedInvoice : invoice );

                // Reload products
                this.loadProducts();

                // Close modal
                this.cancelInvoiceForm();

                // Success popup
                this.popupService.showAlert(
                  'Purchase invoice and inventory were updated successfully.', 'success','Invoice Updated'
                );

                this.cdr.markForCheck();
              }, error: (error: unknown) => { console.error( 'Failed to update product stock:', error );

                this.popupService.showAlert(
                  'The invoice was updated, but the inventory stock could not be updated.', 'error', 'Inventory Update Failed'
                );
              }
            });
          }, 
          error: (error: unknown) => {
            console.error( 'Failed to update purchase invoice:', error );

            this.popupService.showAlert(
              'Failed to update purchase invoice.', 'error', 'Update Failed'
            );
          }
        });
      return;
    }

    // CREATE NEW INVOICE
    this.purchaseInvoiceService
      .createPurchaseInvoice(invoiceToSave)
      .subscribe({ next: (createdInvoice) => {
          // ---------------------------------------------------
          // IMPORTANT:
          // After creating the invoice, add its quantities
          // to the Inventory stock.
          // ---------------------------------------------------
          this.addInvoiceStock( createdInvoice )
          .subscribe({next: (updatedProducts) => {

              // Update local products immediately
              if (updatedProducts.length > 0) {
                const updatedMap = new Map( updatedProducts.map( product => [String(product.id), product]));
                this.products =this.products.map(product =>updatedMap.get(String(product.id)) ?? product);
              }

              // Add invoice to list
              this.invoices = [createdInvoice, ...this.invoices];

              // Close modal
              this.cancelInvoiceForm();

              // Success popup
              this.popupService.showAlert(
                'Purchase invoice created and inventory stock updated successfully.', 'success','Invoice Created'
              );
              this.cdr.markForCheck();
            },
            error: (error: unknown) => {
              console.error('Failed to update inventory stock after creating invoice:', error);

              // Invoice itself was created successfully,
              // but inventory update failed.
              this.invoices = [ ...this.invoices,createdInvoice ];
              this.cancelInvoiceForm();
              this.popupService.showAlert(
                'The purchase invoice was created, but the inventory stock could not be updated.', 'error','Inventory Update Failed'
              );
              this.cdr.markForCheck();
            }
          });
        },
        error: (error: unknown) => {
          console.error('Failed to create purchase invoice:', error);
          this.popupService.showAlert(
            'Failed to create purchase invoice.', 'error', 'Save Failed'
          );
        }
      });
  }

  // VALIDATION
  isInvoiceValid(): boolean {
    if (
      this.newInvoice.supplierName.trim() === ''
    ) {
      return false;
    }

    if (
      this.newInvoice.invoiceNumber.trim() === ''
    ) {
      return false;
    }

    if (
      this.newInvoice.invoiceDate === ''
    ) {
      return false;
    }

    if (
      this.newInvoice.items.length === 0
    ) {
      return false;
    }

    return this.newInvoice.items.every(
      item => item.productId !== '' && item.quantity > 0 && item.purchasePrice >= 0 && item.sellingPrice >= 0 && item.taxRate >= 0
    );
  }

  // EDIT INVOICE
  editInvoice(
    invoice: PurchaseInvoice
  ): void {
    this.editingInvoiceId = invoice.id;
    this.newInvoice = { ...invoice,items: invoice.items.map( item => ({ ...item }))
    };
    this.showInvoiceForm = true;
  }

  // DELETE INVOICE
  deleteInvoice(
    invoice: PurchaseInvoice
  ): void {
    this.popupService
      .showConfirm(
        `Are you sure you want to delete invoice "${invoice.invoiceNumber}"? This action cannot be undone.`,
        'Delete Purchase Invoice'
      )
      .subscribe(
        (confirmed) => {
          if (!confirmed) {
            return;
          }
          this.performDeleteInvoice( invoice
          );
        }
      );
  }

  // PERFORM DELETE
  private performDeleteInvoice( invoice: PurchaseInvoice): void {

    // First remove the purchased quantities from Inventory.
    // Then delete the invoice.
    const reverseStockChanges =invoice.items.map(item => ({
          productId: String(item.productId), quantity: Number(item.quantity || 0)
        })
      );

    this.productService
      .getProducts()
      .pipe( switchMap(
          (latestProducts) => {
            const updates: Observable<Product>[] = [];
            reverseStockChanges.forEach((change) => {
                const product = latestProducts.find(
                    item => String(item.id) === change.productId
                  );

                if (!product) {
                  throw new Error(
                    `Product ${change.productId} was not found while reversing invoice stock.`
                  );
                }

                updates.push(
                  this.updateProductStock( product, -change.quantity ));
              }
            );

            if (updates.length === 0) {
              return of([]);
            }

            return forkJoin(updates);
          }
        )
      )
      .subscribe({ next: () => {
          // Inventory successfully reversed.
          // Now delete invoice.
          this.purchaseInvoiceService.deletePurchaseInvoice( invoice.id )
            .subscribe({ next: () => {
                this.invoices = this.invoices.filter( item => item.id !== invoice.id );
                this.loadProducts();
                this.popupService.showAlert(
                  `Invoice "${invoice.invoiceNumber}" was deleted and inventory stock was updated successfully.`,'success','Invoice Deleted'
                );
                this.cdr.markForCheck();
              },

              error: (error: unknown) => {
                console.error('Failed to delete purchase invoice:', error);
                this.popupService.showAlert(
                  'Inventory was updated, but the purchase invoice could not be deleted.', 'error', 'Delete Failed'
                );
              }
            });
        },

        error: (error: unknown) => {
          console.error('Failed to reverse inventory stock:', error);
          this.popupService.showAlert(
            'The purchase invoice was not deleted because the inventory stock could not be updated.', 'error', 'Inventory Update Failed'
          );
        }
      });
  }

// FILTER INVOICES
get filteredInvoices(): PurchaseInvoice[] {
  const searchTerm = this.invoiceSearchTerm.trim().toLowerCase();
  const selectedDate = this.invoiceDateFilter;
  return this.invoices.filter((invoice) => {

    // SEARCH FILTER
    const matchesSearch = searchTerm === '' ||
      invoice.invoiceNumber.toLowerCase().includes(searchTerm) ||
      invoice.supplierName.toLowerCase().includes(searchTerm) ||
      invoice.items.some((item) => item.productName.toLowerCase().includes(searchTerm) || item.sku.toLowerCase() .includes(searchTerm)
      );

    // DATE FILTER
    const matchesDate = selectedDate === '' || this.normalizeInvoiceDate(invoice.invoiceDate) === selectedDate;

    // BOTH FILTERS
    return matchesSearch && matchesDate;
  });

}

// NORMALIZE INVOICE DATE
private normalizeInvoiceDate(date: string): string {
  if (!date) {
    return '';
  }

  return new Date(date)
    .toISOString()
    .split('T')[0];
}

// CLEAR INVOICE FILTERS
clearInvoiceFilters(): void {
  this.invoiceSearchTerm = '';
  this.invoiceDateFilter = '';
  this.cdr.markForCheck();
}

// EXPORT INVOICES
exportInvoices(): void {
  const invoicesToExport = this.filteredInvoices;
  if (invoicesToExport.length === 0) {
    this.popupService.showAlert(
      'There are no invoices to export.', 'warning', 'Nothing to Export'
    );
    return;
  }

  const headers = [ 'Invoice', 'Supplier', 'Date', 'Items','Subtotal', 'Tax', 'Total' ];
  const rows = invoicesToExport.map((invoice) => [ invoice.invoiceNumber, invoice.supplierName, invoice.invoiceDate, invoice.items.length, invoice.subtotal, invoice.taxTotal, invoice.total ]);
  const csvContent = [ headers,...rows ].map(row => row .map(value => `"${String(value).replace(/"/g, '""')}"` ) .join(',')).join('\n');
  const blob = new Blob( [csvContent], {type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `purchase-invoices-${this.getTodayDate()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

  // PROFIT
  getItemProfit( item: PurchaseInvoiceItem ): number {
    return ( item.sellingPrice - item.purchasePrice ) * item.quantity;
  }

  getInvoiceProfit(): number {
    return this.newInvoice.items
      .reduce(
        (total, item) => total + this.getItemProfit(item), 0
      );
  }

  // ID
  private generateId(): string {
    return (
      Date.now().toString() + Math.random() .toString(36) .substring(2, 8) );
  }

  // CLOSE PRODUCT RESULTS
  @HostListener('document:click',['$event'])
  onDocumentClick( event: MouseEvent
  ): void {
    const target = event.target as HTMLElement;
    if (
      !target.closest( '.product-search'
      )
    ){
      this.showProductResults = false;
    }
  }
}