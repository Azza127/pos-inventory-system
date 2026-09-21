  import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
  import { CommonModule } from '@angular/common';
  import { forkJoin } from 'rxjs';
  import { OrderService } from '../../core/services/order.service';
  import { ProductService } from '../../core/services/product.service';
  import { StoreSettingsService } from '../../core/services/store-settings.service';
  import { Order } from '../../core/models/order.model';
  import { Product } from '../../core/models/product.model';
  import { OrderStatusTabs, OrderStatusFilter } from './order-status-tabs/order-status-tabs';
  import { OrderFilters } from './order-filters/order-filters';
  import { OrderTable } from './order-table/order-table';
  import { OrderDetailsDrawer } from './order-details-drawer/order-details-drawer';
  
  @Component({
    selector: 'app-orders',
    standalone: true,
    imports: [CommonModule, OrderStatusTabs, OrderFilters, OrderTable, OrderDetailsDrawer],
    templateUrl: './orders.html',
    styleUrl: './orders.css',
  })
  export class Orders implements OnInit {
    private readonly orderService = inject(OrderService);
    private readonly productService = inject(ProductService);
    private readonly storeSettingsService = inject(StoreSettingsService);
    private readonly cdr = inject(ChangeDetectorRef);
    
    // DATA
    orders: Order[] = [];
    products: Product[] = [];
    filteredOrders: Order[] = [];
    loading = true;
    loadError = false;
    activeStatus: OrderStatusFilter = 'all';
    searchTerm = '';
    dateFilter = '';
    selectedOrder: Order | null = null;
    currencySymbol = 'EGP';
  
    // INIT 
    ngOnInit(): void {
      this.loadStoreSettings();
      this.loadData();
    }
  
    // LOAD STORE SETTINGS
    private loadStoreSettings(): void {
      this.storeSettingsService.getOrLoadSettings().subscribe({ next: (settings) => {
            if (!settings) {
              return;
            }
  
            this.currencySymbol = this.storeSettingsService.getCurrencySymbol(settings.currency);
            this.cdr.markForCheck();
          }, error: (error) => {
            console.error('Error loading store settings:', error);
          }
        });
    }
  
    // LOAD DATA
    loadData(): void {
      this.loading = true;
      this.loadError = false;
  
      forkJoin({
        orders: this.orderService.getOrders(),
        products: this.productService.getProducts(),
      })
      
      .subscribe({ next: ({ orders, products }) => {
        //   console.log('ORDERS FROM API:', orders);
        //   console.log('ORDERS COUNT:', orders.length);
          this.orders = orders;
          this.products = products;
          this.applyFilters();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          console.error( 'Failed to load orders:', err );
          this.loadError = true;
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
    }
  
    // STATUS FILTER
    onStatusChange(
      status: OrderStatusFilter
    ): void {
      this.activeStatus = status;
      this.applyFilters();
    }
  
  
    // SEARCH
    onSearchChange(
      term: string
    ): void {
      this.searchTerm = term;
      this.applyFilters();
    }
  
    // DATE FILTER
    onDateChange(
      date: string
    ): void {
      this.dateFilter = date;
      this.applyFilters();
    }
  
    // LOCAL DATE KEY
    private toLocalDateKey(
      iso: string
    ): string {
      if (!iso) {
        return '';
      }
      const d = new Date(iso);
      if (isNaN(d.getTime())) {
        return '';
      }
  
      const y = d.getFullYear();
      const m = String( d.getMonth() + 1 ).padStart(2, '0');
      const day = String( d.getDate() ).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  
   // APPLY FILTERS
  private applyFilters(): void {
  const term = this.searchTerm.trim().toLowerCase();
  this.filteredOrders = this.orders
    .filter((order) => {

      // STATUS FILTER
      const matchesStatus = this.activeStatus === 'all' || order.status === this.activeStatus;
      if (!matchesStatus) {
        return false;
      }

      // DATE FILTER
      if (this.dateFilter) {
        const orderDate = this.toLocalDateKey(order.createdAt);
        if (orderDate !== this.dateFilter) {
          return false;
        }
      }

      // SEARCH
      if (term === '') {
        return true;
      }

      const ticket = String((order as any).ticketNumber || `#${order.id}` || '').toLowerCase();
      const idMatch = String(order.id ?? '').toLowerCase().includes(term);
      const ticketMatch = ticket.includes(term);
      const itemMatch = (order.items || []).some((item) => (item.productName || '').toLowerCase().includes(term));
      return ( ticketMatch || idMatch || itemMatch);
    })

    // NEWEST ORDERS FIRST
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    this.cdr.markForCheck();
}
  
    // SELECT ORDER
    selectOrder(
      order: Order
    ): void {
      this.selectedOrder = order;
    }
  
    // CLOSE DRAWER
    closeDrawer(): void {
      this.selectedOrder = null;
    }
  
    // ORDER UPDATED 
    onOrderUpdated(
      updated: Order
    ): void {
      this.orders = this.orders.map((o) => o.id === updated.id ? updated : o );
      this.applyFilters();
      this.selectedOrder = updated;
    }
  
    // EXPORT CSV
    exportCsv(): void {
      if (!this.filteredOrders.length) {
        return;
      }
  
      const rows:
        (string | number)[][] = [
          [ 'Ticket', 'Date', 'Items', `Total (${this.currencySymbol})`, 'Payment Method', 'Status' ],
            ...this.filteredOrders.map((o) => [(o as any).ticketNumber || `#${o.id}`,
                    o.createdAt, (o.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0 ),
                    o.total ?? '',(o as any).paymentMethod || '', o.status,
            ]
          ),
        ];
  
      const csvContent = rows.map((row) =>row.map((cell) =>`"${String(cell).replace( /"/g,'""')}"` ).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;'});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `orders-export-${new Date() .toISOString() .slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
  }