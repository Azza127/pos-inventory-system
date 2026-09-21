import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreSettingsService } from '../../core/services/store-settings.service';
import { StoreSettings } from '../../core/models/store-settings.model';
import { ProductService } from '../../core/services/product.service';
import { OrderService } from '../../core/services/order.service';
import { CategoryService } from '../../core/services/category.service';
import { PopupService } from '../../core/services/popup.service';
import { Product } from '../../core/models/product.model';
import { Category } from '../../core/models/category.model';
import { OrderItem } from '../../core/models/order-item.model';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [ CommonModule, FormsModule ],
  templateUrl: './pos.component.html',
  styleUrl: './pos.component.css'
})

export class PosComponent implements OnInit {

  // SERVICES
  private readonly productService = inject(ProductService);
  private readonly orderService = inject(OrderService);
  private readonly categoryService = inject(CategoryService);
  private readonly storeSettingsService = inject(StoreSettingsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly popupService = inject(PopupService);

  // CART PERSISTENCE
  private readonly CART_STORAGE_KEY = 'pos_cart';
  private readonly TICKET_STORAGE_KEY = 'pos_ticket';
  private readonly PAYMENT_STORAGE_KEY = 'pos_payment';

  // SAVE CART
  saveCart(): void {
    localStorage.setItem( this.CART_STORAGE_KEY, JSON.stringify(this.cart));
  }

  // LOAD CART
  loadCart(): void {
    const savedCart = localStorage.getItem( this.CART_STORAGE_KEY );
    if (!savedCart) {
      this.cart = [];
      return;
    }

    try {
      const parsed = JSON.parse(savedCart);
      if (Array.isArray(parsed)) {
        this.cart = parsed;
      } else {
        this.cart = [];
      }
    } 
    
    catch (error) {
      console.error( 'Error loading saved cart:', error );
      this.cart = [];
      localStorage.removeItem(
        this.CART_STORAGE_KEY
      );
    }
  }

  // SAVE TICKET NUMBER
  saveTicketNumber(): void {
    localStorage.setItem( this.TICKET_STORAGE_KEY, this.currentTicketNumber);
  }

  // LOAD TICKET NUMBER
  loadTicketNumber(): void {
    const savedTicket = localStorage.getItem( this.TICKET_STORAGE_KEY );
    if (savedTicket) { this.currentTicketNumber = savedTicket;
    } else {
      this.generateTicketNumber();
    }
  }

  // SAVE PAYMENT METHOD
  savePaymentMethod(): void {
    localStorage.setItem( this.PAYMENT_STORAGE_KEY, this.paymentMethod );
  }

  // LOAD PAYMENT METHOD
  loadPaymentMethod(): void {
    const savedPayment =  localStorage.getItem( this.PAYMENT_STORAGE_KEY );
    if (savedPayment === 'Cash' || savedPayment === 'Card' ) {
      this.paymentMethod =  savedPayment;
    }
  }

  // CLEAR SAVED CART
  clearSavedCart(): void {
    localStorage.removeItem( this.CART_STORAGE_KEY );
    localStorage.removeItem( this.TICKET_STORAGE_KEY );
  }

  // DATA
  products: Product[] = [];
  filteredProducts: Product[] = [];
  categories: Category[] = [];

  // CART
  cart: OrderItem[] = [];
  receiptCart: OrderItem[] = [];

  // FILTERS
  selectedCategoryId: string = 'ALL';
  searchQuery: string = '';

  // PAYMENT
  paymentMethod: 'Cash' | 'Card' = 'Cash';
  taxRate: number = 0.14;
  currency: string = 'EGP';
  currencySymbol: string = 'EGP';

  // DATE / TICKET
  currentDate: Date = new Date();
  currentTicketNumber: string = '';

  // SUCCESS MODAL
  showSuccessModal: boolean = false;
  lastOrderTotal: number = 0;
  lastPaymentMethod: string = '';
  lastTicketNumber: string = '';

  // INIT
  ngOnInit(): void {
    this.loadTicketNumber();
    this.loadPaymentMethod();
    this.loadCart();
    this.loadStoreSettings();
    this.loadData();
  }

  // LOAD STORE SETTINGS
  loadStoreSettings(): void {
    this.storeSettingsService .getOrLoadSettings().subscribe({ next: (  settings: StoreSettings | null ) => {
          if (!settings) {
            return;
          }

          // TAX
          this.taxRate = Number(settings.taxRate) / 100;

          // CURRENCY
          this.currency = settings.currency;
          this.currencySymbol = this.storeSettingsService .getCurrencySymbol( settings.currency );
          console.log( 'POS Settings:', { taxRate: this.taxRate, currency: this.currency, currencySymbol: this.currencySymbol });
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          console.error( 'Failed to load store settings:', error );
        }
      });
  }

  // GENERATE TICKET
  generateTicketNumber(): void {
    const randomNum = Math.floor( 1000 + Math.random() * 9000 );
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const randomChar = letters.charAt( Math.floor( Math.random() * letters.length ));
    this.currentTicketNumber = `#${randomNum}-${randomChar}`;
  }

  // LOAD DATA
  loadData(): void {
    
    // PRODUCTS
    this.productService .getProducts().subscribe({
        next: (data) => {
          this.products = data.map((p) => ({ ...p, id: String(p.id) }));
          this.restoreCartStock();
          this.filterProducts();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error( 'Error fetching products:', err );
        }
      });

    // CATEGORIES
    this.categoryService .getCategories().subscribe({
        next: (data) => {
          this.categories = data;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error( 'Error fetching categories:', err );
        }
      });
  }

  // RESTORE RESERVED STOCK
  restoreCartStock(): void {
    this.cart.forEach((item) => {
        const product = this.products.find((p) => String(p.id) === String(item.productId));
        if (product) {
          product.stock = Math.max( 0, product.stock - item.quantity );
        }
      }
    );
  }

  // FILTER PRODUCTS
  filterProducts(): void {
    const query = (this.searchQuery || '').trim().toLowerCase();
    this.filteredProducts = this.products.filter((product) => {
          const matchesSearch = !query ||  product.name .toLowerCase() .includes(query) || ( product.sku && product.sku .toLowerCase() .includes(query));
          const matchesCategory = this.selectedCategoryId === 'ALL' || String(product.categoryId) === String(this.selectedCategoryId);
          return (  matchesSearch && matchesCategory
          );
        }
      );
  }

  // SELECT CATEGORY
  selectCategory( categoryId: string ): void {
    this.selectedCategoryId = categoryId;
    this.filterProducts();
  }

  // PRODUCT IMAGE
  getProductImage(item: OrderItem ): string {
    const product = this.products.find((p) => String(p.id) === String(item.productId));
    return ( product?.image || 'https://via.placeholder.com/120x120?text=Product' );
  }

  // ADD TO CART
  addToCart( product: Product ): void {

    // OUT OF STOCK
    if (product.stock <= 0) {
      this.popupService.showAlert( 'Product is out of stock!', 'warning', 'Out of Stock' );
      return;
    }

    // RESERVE ONE UNIT
    product.stock -= 1;

    // CHECK IF PRODUCT ALREADY EXISTS
    const existingItem = this.cart.find((item) => String(item.productId) === String(product.id));
    if (existingItem) { existingItem.quantity += 1; 
      existingItem.total = existingItem.quantity * existingItem.price;
    } else {
      this.cart.push({
        productId: product.id as any,
        productName: product.name,
        price: Number(product.price),
        costPrice:  Number(product.costPrice ?? 0),
        quantity: 1,
        total: Number(product.price)
      } as OrderItem);
    }
    this.saveCart();
  }

  // UPDATE QUANTITY
  updateQuantity(
    item: OrderItem,
    change: number
  ): void {
    const product = this.products.find((p) => String(p.id) === String(item.productId));

    // INCREASE
    if (change > 0) {
      if ( product && product.stock > 0 ) {
        product.stock -= 1;
        item.quantity += 1;
        item.total = item.quantity * item.price;
      } else {
        this.popupService.showAlert(
          'No more stock available!', 'warning', 'Out of Stock'
        );
        return;
      }
    }

    // DECREASE
    else if (change < 0) {
      if (product) {
        product.stock += 1;
      }

      item.quantity -= 1;
      if (item.quantity <= 0) {
        this.cart = this.cart.filter((i) => String(i.productId) !==  String(item.productId));
      } else {
        item.total = item.quantity *  item.price;
      }
    }
    this.saveCart();
  }

  // REMOVE FROM CART
  removeFromCart(
    item: OrderItem
  ): void {
    const product = this.products.find((p) => String(p.id) === String(item.productId));
    if (product) {
      product.stock += item.quantity;
    }
    this.cart = this.cart.filter((i) => String(i.productId) !== String(item.productId));
    this.saveCart();
  }

  // CLEAR CART
  clearCart(): void {
    this.cart.forEach(
      (item) => { const product = this.products.find((p) => String(p.id) === String(item.productId));
        if (product) { product.stock += item.quantity;
        }
      }
    );

    this.cart = [];
    localStorage.removeItem(this.CART_STORAGE_KEY);
  }


  // TOTALS
  get subtotal(): number {
    return this.cart.reduce((sum, item) => sum + item.total, 0);
  }

  get tax(): number {
    return ( this.subtotal * this.taxRate );
  }

  get total(): number {
    return ( this.subtotal + this.tax );
  }

  // CHECKOUT
  checkout(): void {
    if (this.cart.length === 0) {
      return;
    }

    // CURRENT DATE / TIME
    this.currentDate =  new Date();
    this.lastOrderTotal = this.total;
    this.lastPaymentMethod = this.paymentMethod;
    this.lastTicketNumber = this.currentTicketNumber;
    this.receiptCart = [...this.cart];

    const newOrder = {
      ticketNumber: this.currentTicketNumber,
      items: this.cart,
      subtotal: Number( this.subtotal.toFixed(2)),
      tax: Number( this.tax.toFixed(2) ),
      total: Number( this.total.toFixed(2)),
      paymentMethod: this.paymentMethod,
      status: 'Completed' as const,
      createdAt: this.currentDate.toISOString()
    };

    // CREATE ORDER
    this.orderService .createOrder(newOrder as any) .subscribe({
        next: () => {
          /* UPDATE PRODUCT STOCK*/
          const updateRequests = this.cart .map((item) => {const product = this.products.find((p) => String(p.id) === String(item.productId));
                  if (product) {
                    const updatedProduct = { ...product, stock: product.stock};
                    return this.productService .updateProduct( product.id, updatedProduct as any );
                  }
                  return null;
                }
              ).filter((req) => req !== null);
          forkJoin( updateRequests ).subscribe({
            next: () => {
              this.cart = [];
              this.clearSavedCart();
              this.showSuccessModal = true;
              this.cdr.detectChanges();
            },
            error: (err) => { console.error( 'Error updating stocks:', err );
            }
          });
        },
        error: (err) => {
          console.error( 'Error creating order:', err );
          this.popupService.showAlert( 'Failed to process checkout!', 'error', 'Checkout Failed' );
        }
      });
  }

  // PRINT
  printReceipt(): void {
    window.print();
  }

  // CLOSE SUCCESS MODAL
  closeModal(): void {
    this.showSuccessModal = false;
    this.generateTicketNumber();
    this.saveTicketNumber();
  }
}