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
  import * as ExcelJS from 'exceljs';

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

    // DELETE PENDING ORDER
onOrderDeleted(orderId: string | number): void {
  const deletedId = String(orderId);

  // Remove the deleted invoice from the main orders list.
  this.orders = this.orders.filter(
    order => String(order.id) !== deletedId
  );

  // Close the details drawer if it shows the deleted invoice.
  if (
    this.selectedOrder &&
    String(this.selectedOrder.id) === deletedId
  ) {
    this.selectedOrder = null;
  }

  // Refresh the visible list using the current filters.
  this.applyFilters();

  this.cdr.markForCheck();
}
  

// EXPORT ORDERS TO A FORMATTED EXCEL WORKBOOK
async exportExcel(): Promise<void> {
  const ordersToExport = this.filteredOrders;

  if (!ordersToExport || ordersToExport.length === 0) {
    console.warn('There are no orders to export.');
    return;
  }

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Moasher POS & Inventory';
    workbook.title = 'Sales Orders';
    workbook.subject = 'Sales Orders Report';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Sales Orders');
    const currency = this.currencySymbol || 'EGP';
    const moneyFormat = '#,##0.00';

    // Black-and-white print-friendly design.
    const colors = {
      title: 'FFE0E0E0',
      header: 'FFD0D0D0',
      label: 'FFE5E5E5',
      alternate: 'FFF3F3F3',
      total: 'FFDADADA',
      white: 'FFFFFFFF',
      text: 'FF000000',
      border: 'FF707070'
    };

    const border = {
      top: {
        style: 'thin' as const,
        color: { argb: colors.border }
      },
      left: {
        style: 'thin' as const,
        color: { argb: colors.border }
      },
      bottom: {
        style: 'thin' as const,
        color: { argb: colors.border }
      },
      right: {
        style: 'thin' as const,
        color: { argb: colors.border }
      }
    };

    // Columns A:H: compact, balanced and print-friendly.
    sheet.columns = [
      { width: 7 },   // A: line number
      { width: 18 },  // B: product name
      { width: 16 },  // C: product name continuation
      { width: 15 },  // D: SKU
      { width: 11 },  // E: quantity
      { width: 17 },  // F: unit price
      { width: 15 },  // G: line total
      { width: 15 }   // H: extra width for merged totals
    ];

    sheet.properties.defaultRowHeight = 25;

    sheet.views = [{
      state: 'normal',
      zoomScale: 90,
      showGridLines: false
    }];

    sheet.pageSetup = {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.35,
        right: 0.35,
        top: 0.45,
        bottom: 0.45,
        header: 0.2,
        footer: 0.2
      }
    };

    sheet.headerFooter.oddFooter =
      '&LMoasher POS & Inventory&CPage &P of &N';

    // FORMATTING HELPER
    // Keeps numbers numeric and text readable.
    const putCell = (
      rowNumber: number,
      startColumn: number,
      endColumn: number,
      value: unknown,
      options: {
        fill?: string;
        bold?: boolean;
        size?: number;
        align?: 'left' | 'center' | 'right';
      } = {}
    ): void => {
      if (endColumn > startColumn) {
        sheet.mergeCells(
          rowNumber,
          startColumn,
          rowNumber,
          endColumn
        );
      }

      const fill = options.fill ?? colors.white;
      const align = options.align ?? 'left';

      for (
        let column = startColumn;
        column <= endColumn;
        column++
      ) {
        const cell = sheet.getCell(rowNumber, column);

        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: fill }
        };

        cell.border = border;

        cell.font = {
          name: 'Arial',
          size: options.size ?? 10,
          bold: options.bold ?? false,
          color: { argb: colors.text }
        };

        cell.alignment = {
          horizontal: align,
          vertical: 'middle',
          wrapText: false,
          shrinkToFit: true
        };
      }

      const cell = sheet.getCell(rowNumber, startColumn);

      if (value === null || value === undefined) {
        cell.value = '';
      } else if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        cell.value = value;
      } else {
        cell.value = String(value);
      }

      cell.font = {
        name: 'Arial',
        size: options.size ?? 10,
        bold: options.bold ?? false,
        color: { argb: colors.text }
      };

      cell.alignment = {
        horizontal: align,
        vertical: 'middle',
        wrapText: false,
        shrinkToFit: true
      };
    };

    const addGap = (height = 12): void => {
      const row = sheet.addRow([]);
      row.height = height;
    };

    const formatOrderDate = (value: string): string => {
      if (!value) {
        return '';
      }

      const date = new Date(value);

      return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleString();
    };

    // REPORT TITLE
    const titleRow = sheet.addRow([]);

    putCell(
      titleRow.number,
      1,
      8,
      'SALES ORDERS REPORT',
      {
        fill: colors.title,
        bold: true,
        size: 18,
        align: 'center'
      }
    );

    titleRow.height = 42;

    const subtitleRow = sheet.addRow([]);

    putCell(
      subtitleRow.number,
      1,
      8,
      `Moasher POS & Inventory | Currency: ${currency} | ` +
      `Generated: ${new Date().toLocaleDateString()}`,
      {
        align: 'center',
        size: 10
      }
    );

    subtitleRow.height = 28;

    addGap(16);

    // ORDER SECTIONS
    // One clearly separated section per order.

    ordersToExport.forEach((order, orderIndex) => {
      const items = order.items || [];

      if (orderIndex > 0) {
        addGap(20);
      }

      const ticketNumber =
        order.ticketNumber || `#${order.id ?? ''}`;

      // Order banner.
      const bannerRow = sheet.addRow([]);

      putCell(
        bannerRow.number,
        1,
        8,
        `SALES ORDER  |  ${ticketNumber}  |  ID: ${order.id ?? 'N/A'}`,
        {
          fill: 'FFB8B8B8',
          bold: true,
          size: 14
        }
      );

      bannerRow.height = 38;

      // Customer and order date.
      const customerRow = sheet.addRow([]);

      putCell(
        customerRow.number,
        1,
        2,
        'CUSTOMER',
        { fill: colors.label, bold: true }
      );

      putCell(
        customerRow.number,
        3,
        5,
        order.customerName || '',
      );

      putCell(
        customerRow.number,
        6,
        6,
        'DATE',
        { fill: colors.label, bold: true }
      );

      putCell(
        customerRow.number,
        7,
        8,
        formatOrderDate(order.createdAt || '')
      );

      customerRow.height = 30;

      // Status and payment details.
      const paymentMethod =
        (order as any).paymentMethod ||
        order.paymentStatus ||
        '';

      const statusRow = sheet.addRow([]);

      putCell(
        statusRow.number,
        1,
        2,
        'ORDER STATUS',
        { fill: colors.label, bold: true }
      );

      putCell(
        statusRow.number,
        3,
        5,
        order.status || ''
      );

      putCell(
        statusRow.number,
        6,
        6,
        'PAYMENT',
        { fill: colors.label, bold: true }
      );

      putCell(
        statusRow.number,
        7,
        8,
        paymentMethod
      );

      statusRow.height = 30;

      // Item count and customer ID.
      const infoRow = sheet.addRow([]);

      putCell(
        infoRow.number,
        1,
        2,
        'NUMBER OF LINES',
        { fill: colors.label, bold: true }
      );

      putCell(
        infoRow.number,
        3,
        5,
        items.length,
        { align: 'center' }
      );

      putCell(
        infoRow.number,
        6,
        6,
        'CUSTOMER ID',
        { fill: colors.label, bold: true }
      );

      putCell(
        infoRow.number,
        7,
        8,
        order.customerId || ''
      );

      infoRow.height = 30;

      addGap(10);

      // ITEMS TABLE
      const itemHeader = sheet.addRow([]);
      const headerNumber = itemHeader.number;

      putCell(
        headerNumber, 1, 1, '#',
        {
          fill: colors.header,
          bold: true,
          align: 'center'
        }
      );

      putCell(
        headerNumber, 2, 3, 'PRODUCT NAME',
        { fill: colors.header, bold: true }
      );

      putCell(
        headerNumber, 4, 4, 'SKU',
        { fill: colors.header, bold: true }
      );

      putCell(
        headerNumber, 5, 5, 'QUANTITY',
        {
          fill: colors.header,
          bold: true,
          align: 'center'
        }
      );

      putCell(
        headerNumber, 6, 6,
        `UNIT PRICE (${currency})`,
        {
          fill: colors.header,
          bold: true,
          align: 'center'
        }
      );

      putCell(
        headerNumber, 7, 8,
        `ITEM TOTAL (${currency})`,
        {
          fill: colors.header,
          bold: true,
          align: 'center'
        }
      );

      itemHeader.height = 34;

      const itemsToWrite =
        items.length > 0 ? items : [null];

      itemsToWrite.forEach((item, itemIndex) => {
        const row = sheet.addRow([]);
        const rowNumber = row.number;

        const fill =
          itemIndex % 2 === 0
            ? colors.white
            : colors.alternate;

        const product = item
          ? this.products.find(
              p => String(p.id) === String(item.productId)
            )
          : undefined;

        putCell(
          rowNumber, 1, 1,
          item ? itemIndex + 1 : '',
          { fill, align: 'center' }
        );

        putCell(
          rowNumber, 2, 3,
          item?.productName ??
            (items.length === 0 ? 'No items recorded' : ''),
          { fill }
        );

        putCell(
          rowNumber, 4, 4,
          product?.sku || '',
          { fill }
        );

        putCell(
          rowNumber, 5, 5,
          item?.quantity ?? '',
          { fill, align: 'center' }
        );

        putCell(
          rowNumber, 6, 6,
          item?.price ?? '',
          { fill, align: 'right' }
        );

        putCell(
          rowNumber, 7, 8,
          item?.total ?? '',
          { fill, align: 'right' }
        );

        [6, 7].forEach(column => {
          const cell = sheet.getCell(rowNumber, column);

          if (typeof cell.value === 'number') {
            cell.numFmt = moneyFormat;
          }
        });

        row.height = 29;
      });

      addGap(10);

      // ORDER TOTALS
      // These use the saved order values.
      const totals = [
        {
          label: 'SUBTOTAL',
          value: order.subtotal,
          fill: colors.label
        },
        {
          label: 'TAX',
          value: order.tax,
          fill: colors.label
        },
        {
          label: 'ORDER TOTAL',
          value: order.total,
          fill: colors.total
        }
      ];

      totals.forEach((total, totalIndex) => {
        const row = sheet.addRow([]);
        const rowNumber = row.number;
        const isFinal = totalIndex === 2;

        putCell(
          rowNumber,
          1,
          6,
          total.label,
          {
            fill: total.fill,
            bold: true,
            size: isFinal ? 12 : 10,
            align: 'right'
          }
        );

        putCell(
          rowNumber,
          7,
          8,
          total.value ?? '',
          {
            fill: total.fill,
            bold: true,
            size: isFinal ? 13 : 10,
            align: 'right'
          }
        );

        const amountCell = sheet.getCell(rowNumber, 7);

        if (typeof amountCell.value === 'number') {
          amountCell.numFmt = moneyFormat;
        }

        row.height = isFinal ? 34 : 28;

        // Keep each invoice on its own printed page
        // when there is another invoice after it.
        if (
          isFinal &&
          orderIndex < ordersToExport.length - 1
        ) {
          row.addPageBreak();
        }
      });
    });

    // DOWNLOAD XLSX
    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob(
      [buffer as BlobPart],
      {
        type:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download =
      `sales-orders-${new Date().toISOString().slice(0, 10)}.xlsx`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

  } catch (error) {
    console.error('Failed to export sales orders:', error);

    // Reuse the component's existing notification service.
    // Don't let an export error affect orders or inventory.
    console.error(
      'Excel export failed. Verify the ExcelJS installation and try again.'
    );
  }
}
  }