import { Component, OnInit, inject, ChangeDetectorRef, HostListener} from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { Chart, registerables } from 'chart.js';
import { FormsModule } from '@angular/forms';
Chart.register(...registerables);
import { ProductService } from '../../core/services/product.service';
import { CategoryService } from '../../core/services/category.service';
import { OrderService } from '../../core/services/order.service';
import { StoreSettingsService } from '../../core/services/store-settings.service';
import { Product } from '../../core/models/product.model';
import { Category } from '../../core/models/category.model';
import { Order } from '../../core/models/order.model';
import { ReturnService } from '../../core/services/return.service';
import { ReturnTransaction } from '../../core/models/return.model';

export interface CategoryReport {
  categoryId: string;
  categoryName: string;
  totalSales: number;
  percentage: number;
}

export interface TopProductReport {
  productId: string;
  productName: string;
  unitsSold: number;
  revenue: number;
  trend: number;
  isPositive: boolean;
  image?: string;
}

export interface InventoryValuation {
  totalCost: number;
  potentialRevenue: number;
  totalItemsInStock: number;
  profitMargin: number;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [ CommonModule, FormsModule ],
  templateUrl: './reports.html',
  styleUrl: './reports.css'
})

export class Reports
  implements OnInit {

  /* SERVICES */
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  private orderService = inject(OrderService);
  private returnService = inject(ReturnService);
  private cdr = inject(ChangeDetectorRef);
  private storeSettingsService = inject(StoreSettingsService);

  /* DATA */
  products: Product[] = [];
  categories: Category[] = [];
  orders: Order[] = [];
  returns: ReturnTransaction[] = [];

  /* FILTER */
  selectedPeriod: 'daily'|'weekly'|'monthly'|'yearly' = 'daily';
  isPeriodDropdownOpen: boolean = false;

  /* STATE */
  isLoading: boolean = true;
  errorMessage: string = '';
  currencySymbol: string = 'EGP';

  /* SUMMARY */
  totalSales: number = 0;
  totalOrdersCount: number = 0;
  avgOrderValue: number = 0;

  /* REPORTS */
  categoryReports: CategoryReport[] = [];
  topProducts: TopProductReport[] = [];

  /* INVENTORY VALUATION */
  inventoryValuation: InventoryValuation = { totalCost: 0, potentialRevenue: 0, totalItemsInStock: 0, profitMargin: 0};

  /* CHART INSTANCES */
  lineChart: Chart | null = null;
  doughnutChart: Chart | null = null;

  /* CATEGORY COLORS */
  categoryColors: string[] = [
    '#12A39F',

    '#4F7CAC',

    '#8E7DBE',

    '#E3A857',

    '#D96C75',

    '#6FA58A',

    '#D48A5A',

    '#7C8C9A'

  ];

  /* INIT */
  ngOnInit(): void {
    this.loadStoreSettings();
    this.loadReportData();
  }


  /* CATEGORY COLOR */
  getCategoryColor(
    index: number
  ): string {

    return this.categoryColors[
      index %
      this.categoryColors.length
    ];
  }

  /* PERIOD DROPDOWN */
  togglePeriodDropdown(): void {
    this.isPeriodDropdownOpen =!this.isPeriodDropdownOpen;
  }

  selectPeriod( period: 'daily' | 'weekly' | 'monthly' | 'yearly'
  ): void {
    this.selectedPeriod = period;
    this.isPeriodDropdownOpen = false;
    this.onPeriodChange();
  }

  getSelectedPeriodLabel(): string {
    switch (this.selectedPeriod) {
      case 'daily':
        return 'Daily';
  
      case 'weekly':
        return 'Weekly';
  
      case 'monthly':
        return 'Monthly';
  
      case 'yearly':
        return 'Yearly';
  
      default:
        return 'Daily';
    }
  }

  /* CLOSE DROPDOWN */
  @HostListener(
    'document:click',
    ['$event']
  )

  onDocumentClick(
    event: MouseEvent
  ): void {
    const target = event.target as HTMLElement;
    if (
      !target.closest( '.custom-period-dropdown' )
    ) {
      this.isPeriodDropdownOpen = false;
    }
  }

  /* PERIOD CHANGE */
  onPeriodChange(): void {
    this.calculateReports();
    setTimeout(() => {
      this.renderLineChart();
      this.renderDoughnutChart();
    }, 50);
  }

  /* STORE SETTINGS */
  private loadStoreSettings(): void {
    this.storeSettingsService
      .getOrLoadSettings()
      .subscribe({
        next: (settings) => {
          if (!settings) {
            return;
          }


          this.currencySymbol = this.storeSettingsService.getCurrencySymbol( settings.currency );
          if (!this.isLoading) {
            setTimeout(() => {
              this.renderLineChart();
              this.renderDoughnutChart();
            }, 50);
          }
        },
        error: (error) => {
          console.error( 'Error loading store settings:', error);
        }
      });

  }

  /* LOAD DATA */
  loadReportData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    forkJoin({
      products:this.productService.getProducts().pipe(catchError(() => of([]))),
      categories:this.categoryService.getCategories().pipe(catchError(() => of([]))),
      orders:this.orderService.getOrders().pipe(catchError(() => of([]))),
      returns:this.returnService.getReturns().pipe(catchError(() => of([])))
    })

    .pipe(finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    )

    .subscribe({next: (res) => {
        this.products = res.products || [];
        this.categories = res.categories || [];
        this.orders = res.orders || [];
        this.returns = res.returns || [];
        this.calculateReports();
        this.cdr.detectChanges();
        setTimeout(() => {
          this.renderLineChart();
          this.renderDoughnutChart();
        }, 100);
      },
      error: () => {
        this.errorMessage = 'Unable to load reports data.';
      }
    });
  }

  /* CALCULATE ALL REPORTS */
  private calculateReports(): void {
    const allCompleted = this.orders.filter( order => order.status === 'Completed');
    const completedOrders = this.filterOrdersByPeriod( allCompleted );
    this.totalOrdersCount = completedOrders.length;
    this.totalSales = completedOrders.reduce(( sum, order ) => sum + this.getNetOrderGrossTotal( order ), 0);
    this.avgOrderValue = this.totalOrdersCount > 0 ? Number(( this.totalSales /this.totalOrdersCount ).toFixed(2) )  : 0;
    this.calculateCategorySales( completedOrders );
    this.calculateTopProducts( completedOrders );
    this.calculateInventoryValuation( completedOrders );
  }

  /* FILTER ORDERS BY PERIOD */
     private filterOrdersByPeriod( completedOrders: Order[]): Order[] { const now = new Date();
      if (
        this.selectedPeriod === 'daily'
      ) {
        const start = new Date( now.getFullYear(), now.getMonth(), now.getDate() );
        const end = new Date( now.getFullYear(), now.getMonth(), now.getDate() + 1);
        return completedOrders.filter(
          order => { const orderDate = new Date( order.createdAt );
            if (
              isNaN(
                orderDate.getTime()
              )
            ) {
              return false;
            }

            return (
              orderDate >= start && orderDate < end
            );
          }
        );
      }
    
if (
  this.selectedPeriod === 'weekly'
) {

  const start = new Date( now );
  start.setHours( 0, 0, 0, 0 );

  const daysSinceSaturday = (start.getDay() + 1) % 7;
  start.setDate( start.getDate() - daysSinceSaturday );

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return completedOrders.filter(
    order => {
      const orderDate = new Date( order.createdAt );

      if (
        isNaN(
          orderDate.getTime()
        )
      ) {
        return false;
      }
      return (
        orderDate >= start && orderDate < end
      );
    }
  );

}
    
      if (
        this.selectedPeriod === 'monthly'
      ) {

        const start = new Date(  now.getFullYear(), now.getMonth(), 1 );
        const end = new Date( now.getFullYear(), now.getMonth() + 1, 1 );
  
        return completedOrders.filter(
          order => {
            const orderDate = new Date( order.createdAt );
            if (
              isNaN(
                orderDate.getTime()
              )
            ) {
              return false;
            }
            return (
              orderDate >= start && orderDate < end
            );
          }
        );
      }
    
      if (
        this.selectedPeriod === 'yearly'
      ) {

        const start = new Date( now.getFullYear(), 0, 1 );
        const end = new Date(  now.getFullYear() + 1, 0, 1 );
        return completedOrders.filter(
          order => {
            const orderDate = new Date( order.createdAt );
            if (
              isNaN(
                orderDate.getTime()
              )
            ) {
              return false;
            }
            return (
              orderDate >= start && orderDate < end
            );
          }
        );
      }
      return completedOrders;
    }


  /* CATEGORY SALES */
  private calculateCategorySales(
    completedOrders: Order[]
  ): void {

    const categorySalesMap = new Map<string, number>();
    const productCategoryMap = new Map<string, string>();
    this.products.forEach(
      product => {
        productCategoryMap.set(String(product.id), String(product.categoryId) );
      }
    );

    completedOrders.forEach(
      order => {
        this.getNetOrderItems(order)
          .forEach(item => { const categoryId = productCategoryMap.get(  String(item.productId));
            if (!categoryId) {
              return;
            }

            const currentTotal = categorySalesMap.get( categoryId ) || 0;
            categorySalesMap.set( categoryId, currentTotal +  this.getNetItemGrossTotal( order, item )
            );
          });
      }
    );

    this.categoryReports = this.categories
        .map(category => {
          const sales = categorySalesMap.get( String(category.id) ) || 0;
          const percentage = this.totalSales > 0 ? ( sales / this.totalSales ) * 100  : 0;
          return {
            categoryId: String(category.id),
            categoryName: category.name,
            totalSales: Number(sales.toFixed(2) ),
            percentage: Number( percentage.toFixed(1))
          };
        })
        .filter(
          category => category.totalSales > 0
        );
  }

  /* TOP PRODUCTS */
  private calculateTopProducts(
    completedOrders: Order[]
  ): void {

    const productStatsMap = new Map< string,
        { name: string; units: number; revenue: number; }
      >();

    completedOrders.forEach(
      order => {
        this.getNetOrderItems(order).forEach(item => {
            const productId = String(item.productId);
            const existing = productStatsMap.get( productId  ) || { name: item.productName || '', units: 0, revenue: 0 };
            productStatsMap.set(
              productId,
              {name: item.productName || existing.name,
                units: existing.units + Number( item.quantity || 0),
                revenue: existing.revenue + this.getNetItemGrossTotal( order, item )
              }
            );
          });
      }
    );

    this.topProducts =Array.from( productStatsMap.entries() )
      .map(
        ([id, stat]) => {
          const sharePercentage = this.totalSales > 0 ? ( stat.revenue / this.totalSales ) * 100 : 0;
          const trendVal = Number( sharePercentage.toFixed(1));
          return {
            productId: id,
            productName: stat.name,
            unitsSold: stat.units,
            revenue: Number( stat.revenue.toFixed(2) ),
            trend: trendVal,
            isPositive: trendVal >= 0,
            image: this.products.find( product => String(product.id) === String(id) )?.image || ''
          };
        }
      )
      .sort( (a, b) => b.unitsSold - a.unitsSold )
      .slice(0, 5);
  }


  /* INVENTORY VALUATION + AVERAGE PROFIT MARGIN */
  private calculateInventoryValuation(
    completedOrders: Order[]
  ): void {
    let totalCost = 0;
    let potentialRevenue = 0;
    let totalItemsInStock = 0;

    /* CURRENT INVENTORY
    Total Asset Value (Cost) = stock × costPrice
    Potential Revenue (Retail)= stock × sellingPrice
    These values are based on
    CURRENT inventory only. */

    this.products.forEach(
      product => {
        const stock = Number( product.stock ?? 0 );
        const sellingPrice = Number( product.price ?? 0 );
        const costPrice = Number( product.costPrice ?? 0);

        totalCost += costPrice * stock;
        potentialRevenue += sellingPrice * stock;
        totalItemsInStock +=  stock;
      }
    );

    let salesRevenue = 0;
    let salesCost = 0;

    const productMap = new Map<string, Product>();

    this.products.forEach(
      product => {
        productMap.set( String(product.id), product);
      }
    );

    completedOrders.forEach(
      order => {
        this.getNetOrderItems(order)
          .forEach(item => {
            const quantity = Number( item.quantity || 0);
            if ( quantity <= 0 ) {
              return;
            }

            /* PRE-TAX REVENUE */
            const itemRevenue = Number(item.total || 0 );
            salesRevenue += itemRevenue;

            const savedCostPrice = Number( item.costPrice ?? 0 );

            if (
              Number.isFinite( savedCostPrice) && savedCostPrice > 0 ) { salesCost += savedCostPrice * quantity;
              return;
            }

            /* FALLBACK FOR OLD ORDERS */
            const product = productMap.get( String(item.productId) );
            if (!product) {
              return;
            }

            const currentCostPrice = Number( product.costPrice ?? 0 );
            if (
              Number.isFinite( currentCostPrice ) && currentCostPrice > 0 ) {
              salesCost += currentCostPrice * quantity;
            }
          });
      }
    );

    /* AVG PROFIT MARGIN */
    let profitMargin = 0;
    if (
      salesRevenue > 0
    ) {
      const profit = salesRevenue - salesCost;
      profitMargin = ( profit / salesRevenue ) * 100;
    }
    profitMargin = Math.max( 0, Math.min( 100, profitMargin ));

    /*  SAVE VALUES */
    this.inventoryValuation = {
      totalCost:  Number( totalCost.toFixed(2) ),
      potentialRevenue: Number( potentialRevenue.toFixed(2) ),
      totalItemsInStock: totalItemsInStock,
      profitMargin: Number( profitMargin.toFixed(1) )
    };
  }

  /* NET ORDER ITEMS */
  private getNetOrderItems(
    order: Order
  ): Order['items'] {
    const returnedByProduct = new Map<string, number>();

    this.returns
      .filter( returnTransaction =>
          returnTransaction.type === 'sale' &&
          returnTransaction.status === 'completed' &&
          String(  returnTransaction.referenceId) === String(order.id)
      )

      .forEach(
        returnTransaction => {
          returnTransaction.items
            .forEach(
              item => {
                const productId = String( item.productId);
                returnedByProduct.set(
                  productId,
                  ( returnedByProduct.get( productId ) || 0) +
                  Number( item.quantity || 0 )
                );
              }
            );
        }
      );

    return (order.items || [])
      .map( item => {
          const originalQuantity = Number( item.quantity || 0 );
          const returnedQuantity = Math.min( originalQuantity, returnedByProduct.get( String(item.productId) ) || 0 );
          const remainingQuantity = Math.max( 0, originalQuantity - returnedQuantity );
          if (
            remainingQuantity <= 0
          ) {
            return null;
          }

          const unitPrice = originalQuantity > 0 ? Number( item.total || 0 ) / originalQuantity : Number( item.price || 0 );
          return { ...item,
            quantity: remainingQuantity,
            total: Number(( unitPrice * remainingQuantity).toFixed(2))
          };
        }
      )
      .filter(
        ( item ): item is Order['items'][number] => item !== null
      );
  }


  /* NET ORDER GROSS TOTAL */
  private getNetOrderGrossTotal(order: Order ): number {
    const netItems = this.getNetOrderItems( order );
    if (
      !netItems.length
    ) {
      return 0;
    }

    const netSubtotal =  netItems.reduce(( sum, item ) => sum + Number( item.total || 0 ), 0);
    const originalSubtotal = Number((order as any).subtotal ?? 0 );
    const originalTax = Number( (order as any).tax ?? 0 );
    const originalTotal = Number( order.total ?? 0 );
    if (
      originalSubtotal > 0 && Math.abs( netSubtotal - originalSubtotal ) < 0.01
    ) {
      return Number(
        originalTotal.toFixed(2)
      );
    }
    if (
      originalSubtotal > 0
    ) {

      const taxRate = originalTax / originalSubtotal;
      return Number(
        ( netSubtotal * (1 + taxRate)).toFixed(2)
      );
    }

    const originalItemsSubtotal = (order.items || []) .reduce(( sum, item ) => sum + Number( item.total || 0 ), 0 );

    if (
      originalItemsSubtotal > 0 && originalTotal > 0
    ) {
      return Number(
        (netSubtotal * ( originalTotal / originalItemsSubtotal )).toFixed(2)
      );
    }

    return Number(
      netSubtotal.toFixed(2)
    );
  }


  /* NET GROSS ITEM TOTAL*/
  private getNetItemGrossTotal(
    order: Order,
    item: Order['items'][number]
  ): number {

    const originalSubtotal = Number((order as any).subtotal ?? 0);
    const originalTax = Number( (order as any).tax ?? 0);
    const itemSubtotal = Number( item.total || 0);
    if (
      itemSubtotal <= 0
    ) {
      return 0;
    }

    if (
      originalSubtotal > 0
    ) {
      const taxRate = originalTax / originalSubtotal;
      return Number(
        ( itemSubtotal * (1 + taxRate) ).toFixed(2)
      );
    }

    const originalItemsSubtotal = (order.items || []).reduce(( sum, orderItem ) =>  sum + Number( orderItem.total || 0 ), 0 );
    const originalTotal = Number( order.total ?? 0);

    if (
      originalItemsSubtotal > 0 && originalTotal > 0
    ) {
      return Number(
        ( itemSubtotal * ( originalTotal / originalItemsSubtotal)).toFixed(2)
      );
    }

    return Number(
      itemSubtotal.toFixed(2)
    );
  }


  /* EXPORT CSV */
  exportCSV(): void {
    let csvContent ='data:text/csv;charset=utf-8,';
    csvContent +=`Category Name,Total Sales (${this.currencySymbol}),Percentage (%)\n`;
    this.categoryReports.forEach(category => {
        csvContent += `"${category.categoryName}",` + `${category.totalSales},` + `${category.percentage}%\n`;
      }
    );

    csvContent += `\nProduct Name,Units Sold,Revenue (${this.currencySymbol})\n`;
    this.topProducts.forEach( product => {
        csvContent +=  `"${product.productName}",` + `${product.unitsSold},` + `${product.revenue}\n`;
      }
    );
    const encodedUri = encodeURI( csvContent );
    const link = document.createElement( 'a' );
    link.setAttribute( 'href', encodedUri );
    link.setAttribute( 'download',`Sales_Report_${this.selectedPeriod}.csv` );
    document.body.appendChild( link );
    link.click();
    document.body.removeChild( link );
  }


  /* EXPORT PDF */
  exportPDF(): void {
    window.print();
  }

  /* LINE CHART */
  private renderLineChart(): void {
    const canvas = document.getElementById( 'salesLineChart' ) as HTMLCanvasElement;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext( '2d' );
    if (!ctx) {
      return;
    }

    if (this.lineChart) {
      this.lineChart.destroy();
      this.lineChart = null;
    }

    const allCompleted = this.orders.filter( order =>  order.status === 'Completed' );
    const completedOrders = this.filterOrdersByPeriod( allCompleted );
    const salesByDateMap = new Map<string, number>();
    completedOrders.forEach( order => {
        const dateLabel = new Date( order.createdAt).toLocaleDateString( 'en-US', { month: 'short', day: 'numeric' } );
        const currentSales = salesByDateMap.get( dateLabel) || 0;
        salesByDateMap.set(
          dateLabel, currentSales + this.getNetOrderGrossTotal( order ) );
      }
    );

    let labels = Array.from( salesByDateMap.keys() );
    let dataPoints = Array.from(salesByDateMap.values() );

    if ( labels.length === 1 ) {
      labels = ['Start', labels[0] ];
      dataPoints = [ dataPoints[0] ];
    }
    else if (
      labels.length === 0
    ) {
      labels = [ 'No Sales Yet' ];
      dataPoints = [ 0 ];
    }

    const chartAreaColor = '#E3F3F1';
    this.lineChart = new Chart(
        canvas, {
          type: 'line', data: { labels, datasets: [{
                label: 'Revenue',
                data: dataPoints,
                borderColor: '#12A39F',
                borderWidth: 2,
                backgroundColor:  chartAreaColor,
                fill: true,
                tension: 0.38,
                pointRadius: 4,
                pointHoverRadius: 5,
                pointBackgroundColor:
                  '#12A39F',
                pointBorderColor:
                  '#FFFFFF',
                pointBorderWidth: 2
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
              intersect: false,
              mode: 'index'
            },
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                enabled: true,
                backgroundColor: '#26302B',
                titleColor:  '#FCFCF8',
                bodyColor: '#FCFCF8',
                borderWidth: 0,
                padding: 10,
                displayColors: false,
                callbacks: {
                  label:  (context) => {
                      const value = context.parsed.y ?? 0;
                      return ( `Sales: ${value.toFixed(2)} ${this.currencySymbol}` );
                    }
                }
              }
            },
            scales: {
              x: { grid: { display: false },
                border: {
                  display: false
                },
                ticks: {
                  color: '#8A8178',
                  font: {  size: 11 },
                  padding: 8 }
              },
              y: {
                beginAtZero: true,
                grid: {
                  color: '#E4DED4',
                  lineWidth: 1
                },
                border: {
                  display: false
                },
                ticks: {
                  color: '#8A8178',
                  font: { size: 11 },
                  padding: 8,
                  callback: (value) => {
                      return (
                        `${value} ${this.currencySymbol}`
                      );
                    }
                }
              }
            }
          }
        }
      );
  }

  /* DOUGHNUT CHART */
  private renderDoughnutChart(): void {
    const canvas = document.getElementById( 'categoryDoughnutChart' ) as HTMLCanvasElement;
    if (!canvas) {
      return;
    }

    if (this.doughnutChart) {
      this.doughnutChart.destroy();
      this.doughnutChart = null;
    }
    const hasCategoryData =  this.categoryReports.length > 0;
    const labels = hasCategoryData ? this.categoryReports.map( category => category.categoryName ) : ['No Category Sales'];
    const data = hasCategoryData ? this.categoryReports.map( category => category.totalSales ) : [1];
    const centerTextPlugin = { id: 'centerText', beforeDraw:  (chart: any) => { 
        const {  width, height, ctx } = chart;  ctx.save();
        const formattedSales = this.totalSales >= 1000 ? `${( this.totalSales / 1000 )
          .toFixed(0)}k ${this.currencySymbol}` : `${this.totalSales.toFixed(0)} ${this.currencySymbol}`;
          ctx.font = '700 24px Inter, sans-serif';
          ctx.fillStyle = '#252A27';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText( formattedSales, width / 2, height / 2 - 8);
          ctx.font = '500 12px Inter, sans-serif';
          ctx.fillStyle = '#8A8178';
          ctx.fillText( 'Total Sales', width / 2, height / 2 + 15 );
          ctx.restore();
        }
    };

    this.doughnutChart = new Chart(

        canvas, {
          type: 'doughnut',
          data: { labels, datasets: [{ data, backgroundColor: hasCategoryData ? this.categoryReports .map((_, index) => 
            this.getCategoryColor( index )) : ['#D5D8D0'], borderWidth: 3, borderColor: '#FCFCF8', hoverOffset: 4 } ] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', rotation: -90, plugins: {
            legend: { display: false }, 
            tooltip: { enabled: true, backgroundColor: '#26302B', titleColor: '#FCFCF8', bodyColor: '#FCFCF8', padding: 10 } } },
            plugins: [ centerTextPlugin ]
        }
      );
  }
}