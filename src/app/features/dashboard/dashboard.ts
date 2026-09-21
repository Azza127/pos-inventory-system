import { Component, OnInit, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ProductService } from '../../core/services/product.service';
import { OrderService } from '../../core/services/order.service';
import { StoreSettingsService } from '../../core/services/store-settings.service';
import { ReturnService } from '../../core/services/return.service';
import { Product } from '../../core/models/product.model';
import { Order } from '../../core/models/order.model';
import { ReturnTransaction } from '../../core/models/return.model';
import { StatsUtil } from '../../core/utils/stats.util';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [ CommonModule, RouterLink ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})

export class Dashboard implements OnInit {

  /* SERVICES */
  private productService = inject(ProductService);
  private orderService = inject(OrderService);
  private returnService = inject(ReturnService);
  private storeSettingsService = inject(StoreSettingsService);

  /* DATA */
  products = signal<Product[]>([]);
  orders = signal<Order[]>([]);
  returns = signal<ReturnTransaction[]>([]);
  loading = signal<boolean>(true);
  currencySymbol = signal('EGP');
  period = signal< 'daily' | 'weekly' | 'monthly' | 'yearly' >('daily');
  showPeriodDropdown = false;

  /* PERIOD HELPERS */
  private getPeriodStart(): Date {
    const start = new Date();
    start.setHours( 0, 0,  0,  0 );

    switch (this.period()) {
      case 'weekly': {
        const day = start.getDay();
        /* Weekly period: Saturday 00:00 -> Friday 23:59:59
          JavaScript: Sunday= 0, Monday= 1, Tuesday= 2, Wednesday= 3, Thursday= 4, Friday= 5 , Saturday= 6*/
        const diff = (day + 1) % 7;
        start.setDate( start.getDate() - diff );
        break;
      }

      case 'monthly':
        start.setDate(1);
        break;

      case 'yearly':
        start.setMonth(
          0,
          1
        );
        break;

      case 'daily':
      default:
        break;
    }
    return start;
  }


  private getPeriodEnd(): Date {
    const end = new Date();

    switch (this.period()) {
      case 'weekly': {
        const day = end.getDay();
    
        /* Weekly period ends on Friday. */
        const daysUntilFriday = day <= 5 ? 5 - day : 6 + 5 - day;
        end.setDate( end.getDate() + daysUntilFriday );
        end.setHours(23, 59, 59, 999);
        break;
      }

      case 'monthly':
        end.setMonth( end.getMonth() + 1, 0 );
        end.setHours( 23,  59, 59, 999);
        break;

      case 'yearly':
        end.setMonth( 11, 31 );
        end.setHours( 23, 59, 59, 999);
        break;

      case 'daily':
      default:

        end.setHours( 23, 59, 59, 999 );
        break;
    }
    return end;
  }

  private isWithinSelectedPeriod( createdAt: string ): boolean {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())){
      return false;
    }
    return (
      date >= this.getPeriodStart() &&
      date <= this.getPeriodEnd()
    );
  }

  /* KPI */
  totalSales = computed(() => {
    const completedOrders = this.orders().filter(order => order.status === 'Completed' && this.isWithinSelectedPeriod( order.createdAt ));
    return completedOrders.reduce(
      ( sum, order ) => sum + this.getNetOrderGrossTotal( order ), 0 );
  });

  totalOrders = computed(() => {
    return this.orders().filter(order => order.status === 'Completed' && this.isWithinSelectedPeriod( order.createdAt )) .length;
  });

  totalReturns = computed(() => {
    return this.returns().filter( returnTransaction => returnTransaction.type === 'sale' && returnTransaction.status === 'completed' && this.isWithinSelectedPeriod(returnTransaction.createdAt)).length;
  });

  returnValueRate = computed(() => {

    /* ORDERS SOLD DURING SELECTED PERIOD */
    const periodOrders = this.orders().filter( order => order.status === 'Completed' && this.isWithinSelectedPeriod( order.createdAt ));
  
    /* ORIGINAL SALES VALUE order.total is already INCLUDING TAX. */
    const originalSales = periodOrders.reduce(( sum, order ) => sum + Number( order.total ?? 0 ), 0 );
  
    /* RETURNED VALUE */
    const returnedSales = periodOrders.reduce(( sum, order) => {
          const orderReturns = this.returns().filter( returnTransaction => returnTransaction.type === 'sale' && returnTransaction.status === 'completed' && String( returnTransaction.referenceId ) === String( order.id ));
          const returnedValue = orderReturns.reduce(( returnSum, returnTransaction ) => returnSum +Number( returnTransaction.total ?? 0 ), 0 );
          return ( sum + returnedValue );
        }, 0);
  
    /* PREVENT DIVISION BY ZERO */
    if ( originalSales <= 0 ) {
      return 0;
    }
  
    /* FINAL RETURN RATE */
    return Number(
      ( returnedSales / originalSales * 100).toFixed(2) ); });

  totalProducts = computed(() => this.products().length );
  lowStockProducts = computed(() => StatsUtil.lowStockProducts(this.products() ) );
  lowStockCount = computed(() => this.lowStockProducts().length
  );

  /* RECENT ORDERS */
  recentOrders = computed(() => {
    const periodOrders = this.orders().filter(order => this.isWithinSelectedPeriod(order.createdAt));
    return StatsUtil.recentOrders( periodOrders,5 );
  });

  /* ORDER DISPLAY HELPERS */
  getTicketNumber(order: Order): string {
    const ticketNumber = (order as any).ticketNumber;
    if (ticketNumber) {
      return `#${ticketNumber}`;
    }
    return `#ORD-${order.id ?? ''}`;
  }

  getOrderItemCount(order: Order): number {
    return ( order.items || []).reduce(( total, item ) => total + ( Number( item.quantity ) || 0 ),0 );
  }

  getPaymentMethod( order: Order): string {
    return ((order as any).paymentMethod ||'Cash');
  }

  /* SALES TREND */
  chartData = computed(() => {
    const start = this.getPeriodStart();
    const end = this.getPeriodEnd();
    const orders = this.orders().filter( order => order.status === 'Completed' &&  this.isWithinSelectedPeriod( order.createdAt ));
    const points: Date[] = [];

    /* DAILY */
    if ( this.period() === 'daily' ) {
      for ( let i = 6; i >= 0; i-- ) {
        const date = new Date(start);
        date.setDate( date.getDate() - i );
        points.push(date);
      }
    }

    /* WEEKLY */
    else if ( this.period() === 'weekly' ) {
      for ( let i = 0; i < 7; i++ ) {
        const date = new Date(start);
        date.setDate( start.getDate() + i);
        points.push(date);
      }
    }

    /* MONTHLY */
    else if (
      this.period() === 'monthly'
    ) {
      const daysInMonth = end.getDate();
      for ( let i = 1; i <= daysInMonth; i++ ) {
        const date = new Date(start);
        date.setDate(i);
        points.push(date);
      }
    }

    /* YEARLY */
    else {
      for ( let i = 0; i < 12; i++ ) {
        const date = new Date(start);
        date.setMonth(i);
        points.push(date);
      }
    }

    /*  BUILD CHART DATA */
    return points.map(
      date => {
        let label: string;
        if ( this.period() === 'yearly' ) { label = date.toLocaleDateString( 'en-US', { month: 'short' } ); }
        else { label =  date.toLocaleDateString( 'en-US', { month: 'short', day: 'numeric' } ); }

        const matchingOrders = orders.filter( order => {
              const orderDate = new Date( order.createdAt );
              if ( this.period() === 'yearly' ) {
                return (
                  orderDate.getFullYear() ===  date.getFullYear() &&
                  orderDate.getMonth() === date.getMonth()
                );
              }

              return (
                orderDate.getFullYear() === date.getFullYear() &&
                orderDate.getMonth() === date.getMonth() &&
                orderDate.getDate() === date.getDate()
              );
            }
          );

        /* Sales are AFTER TAX and AFTER completed sale returns.*/
        const sales = matchingOrders.reduce(
            ( sum, order ) => sum + this.getNetOrderGrossTotal( order ), 0 );
        return { date, label, sales, orders: matchingOrders.length };
      }
    );
  });

  /* CHART SALES LABELS */
  chartSalesLabels = computed(() => {
    const data = this.chartData();
    if (!data.length) {
      return [ 0,  0, 0,  0 ];
    }

    const maxSales = Math.max( ...data.map( item => item.sales ));
    if (!maxSales) {
      return [ 0, 0, 0, 0 ];
    }

    return [ 0, maxSales * 0.33, maxSales * 0.66, maxSales ];
  });


  /* CHART MAX VALUES */
  private chartMaxSales = computed(() => {
      const data = this.chartData();
      return data.length ? Math.max( ...data.map( item => item.sales )) : 0;
    });

  private chartMaxOrders = computed(() => {
      const data = this.chartData();
      return data.length ? Math.max( ...data.map( item => item.orders )) : 0;
    });

  /* CHART POINTS */
  chartPoints = computed(() => {
    const data = this.chartData();
    const width = 760;
    const height = 220;
    const paddingX = 8;
    const paddingY = 12;
    const maxSales = this.chartMaxSales() || 1;
    const maxOrders = this.chartMaxOrders() || 1;

    if (!data.length) {
      return [];
    }

    const step = data.length > 1 ? ( width - paddingX * 2 ) / (data.length - 1) : 0;
    return data.map(( item, index ) => {
        const x = paddingX +( index * step);
        const salesY = height - paddingY - (( item.sales / maxSales ) * ( height - paddingY * 2 ) );
        const ordersY = height - paddingY - (( item.orders / maxOrders ) * ( height - paddingY * 2 ));
        return { ...item, x, salesY, ordersY };
      }
    );
  });

  /* CREATE SMOOTH SVG CURVE */
  private createSmoothPath( points: Array<{ x: number; y: number; }> ): string {
    if (!points.length) {
      return '';
    }

    if ( points.length === 1) {
      return ` M ${points[0].x} ${points[0].y} `;
    }

    let path = `M ${points[0].x} ${points[0].y}`;
    for ( let i = 0; i < points.length - 1; i++ ) {
      const current = points[i];
      const next = points[i + 1];
      const midX = ( current.x + next.x ) / 2;
      path += ` C ${midX} ${current.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
    }

    return path;
  }

  /* SALES PATH */
  salesPath = computed(() => {
    const points = this.chartPoints().map( point => ({ x: point.x, y: point.salesY }));
    return this.createSmoothPath( points );
  });

  /* ORDERS PATH */
  ordersPath = computed(() => {
    const points = this.chartPoints().map( point => ({ x: point.x, y: point.ordersY }));
    return this.createSmoothPath( points );
  });

  /* SALES AREA PATH */
  salesAreaPath = computed(() => {
    const points = this.chartPoints();
    if (!points.length) {
      return '';
    }

    const line = this.createSmoothPath( points.map( point => ({ x: point.x, y: point.salesY })));
    const last = points[ points.length - 1 ];
    const first = points[0];
    return ` ${line} L ${last.x} 220 L ${first.x} 220 Z `;
  });

  /* STORE SETTINGS */
  private loadStoreSettings(): void {
    this.storeSettingsService .getOrLoadSettings().subscribe({
        next: (settings) => {
          if (!settings) {
            return;
          }
          this.currencySymbol.set( this.storeSettingsService .getCurrencySymbol( settings.currency )
          );
        },

        error: (error) => {
          console.error( 'Error loading store settings:', error );
        }
      });
  }

  /* NET ORDER ITEMS */
  private getNetOrderItems( order: Order ): Order['items'] {
    const returnedByProduct = new Map<string, number>();

    this.returns()
      .filter( returnTransaction => returnTransaction.type === 'sale' && returnTransaction.status === 'completed' && String( returnTransaction.referenceId ) === String(order.id))
      .forEach( returnTransaction => { returnTransaction.items.forEach( item => { const productId =  String(item.productId);
            returnedByProduct.set( productId,( returnedByProduct.get( productId ) || 0 ) + Number( item.quantity || 0 ) );
            }
          );
        }
      );

    return (order.items || []).map(item => {
        const originalQuantity = Number( item.quantity || 0 );
        const returnedQuantity = Math.min( originalQuantity, returnedByProduct.get(String(item.productId) ) || 0 );
        const remainingQuantity = Math.max( 0, originalQuantity - returnedQuantity );
        if ( remainingQuantity <= 0 ) {
          return null;
        }

        const unitPrice = originalQuantity > 0 ? Number(item.total || 0) / originalQuantity : Number(item.price || 0);
        return {...item, quantity: remainingQuantity,
          total: Number(( unitPrice * remainingQuantity).toFixed(2))
        };
      })
      .filter(( item ): item is Order['items'][number] => item !== null );
  }

  /* NET ORDER SALES AFTER TAX */
    private getNetOrderGrossTotal( order: Order): number {
      const netItems = this.getNetOrderItems( order );
      if ( !netItems.length ) {
        return 0;
      }
    
      const netSubtotal = netItems.reduce(( sum, item ) => sum + Number( item.total || 0 ), 0 );
      const originalSubtotal = Number( order.subtotal ?? 0 );
      const originalTax = Number( order.tax ?? 0 );
      const originalTotal = Number( order.total ?? 0 );

      if ( originalSubtotal > 0 && Math.abs( netSubtotal - originalSubtotal) < 0.01 ) {
        return Number( originalTotal.toFixed(2));
      }
  
      if ( originalSubtotal > 0 ) {
        const taxRate = originalTax / originalSubtotal;
        return Number(( netSubtotal * (1 + taxRate) ).toFixed(2));
      }
    
      const originalItemsSubtotal = (order.items || [])
          .reduce(( sum, item ) => sum + Number( item.total || 0 ), 0 );
      if ( originalItemsSubtotal > 0 && originalTotal > 0) {
        return Number(( netSubtotal * ( originalTotal / originalItemsSubtotal )).toFixed(2));
      }
    
      return Number(
        netSubtotal.toFixed(2)
      );
    }

  /* ORDER DISPLAY TOTAL */
  getOrderDisplayTotal( order: Order ): number {
    if ( order.status !== 'Completed') {
      return Number(
        order.total ?? 0
      );
    }

    return this.getNetOrderGrossTotal(
      order
    );
  }

  /* PERIOD SELECTION */
    selectPeriod( period: 'daily' | 'weekly' | 'monthly' | 'yearly' ): void {
      this.period.set(period);
      this.showPeriodDropdown = false;
    }

    togglePeriodDropdown(): void {
      this.showPeriodDropdown = !this.showPeriodDropdown;
    }

    @HostListener(
      'document:click', ['$event']
    )
    onDocumentClick( event: MouseEvent  ): void {
      const target = event.target as HTMLElement;
      const dropdown = target.closest( '.period-dropdown' );
      if (!dropdown) { this.showPeriodDropdown = false; }
    }

  getPeriodLabel(): string {
    switch (this.period()) {
      case 'weekly':
        return 'Weekly';

      case 'monthly':
        return 'Monthly';

      case 'yearly':
        return 'Yearly';

      case 'daily':
      default:
        return 'Daily';
    }
  }

  /* INIT */
  ngOnInit(): void {
    this.loadStoreSettings();

    forkJoin({ 
      products: this.productService .getProducts(),
      orders: this.orderService .getOrders(),
      returns: this.returnService .getReturns()
    })

    .subscribe({
      next: ({ products, orders, returns }) => {
        this.products.set( products || [] );
        this.orders.set( orders || [] );
        this.returns.set( returns || [] );
        this.loading.set( false );
      },
      error: (error) => { console.error( 'Failed to load dashboard data:', error );
        this.loading.set(false);
      }
    });
  }
}