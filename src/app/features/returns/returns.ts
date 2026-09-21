import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { OrderService } from '../../core/services/order.service';
import { PurchaseInvoiceService } from '../../core/services/purchase-invoice.service';
import { ReturnService } from '../../core/services/return.service';
import { ProductService } from '../../core/services/product.service';
import { StoreSettingsService } from '../../core/services/store-settings.service';
import { PopupService } from '../../core/services/popup.service';
import { Order } from '../../core/models/order.model';
import { PurchaseInvoice, PurchaseInvoiceItem } from '../../core/models/purchase-invoice.model';
import { Product } from '../../core/models/product.model';
import { ReturnTransaction, ReturnType } from '../../core/models/return.model';
  
  /* TYPES */
  interface ReturnableItem {
    productId: string;
    productName: string;
    sku: string;
    image?: string;
    originalQuantity: number;
    alreadyReturnedQuantity: number;
    returnableQuantity: number;
    unitPrice: number;
    costPrice?: number;
    returnQuantity: number;
  }
  
  /* Compatibility shape used by the existing returns.html template. */
  type ReturnReference = (Order | PurchaseInvoice) & {
    referenceNumber: string;
    date: string;
    itemCount: number;
  };

  /* COMPONENT */
  @Component({
    selector: 'app-returns',
    standalone: true,
    imports: [ CommonModule, FormsModule],
    templateUrl: './returns.html',
    styleUrl: './returns.css'
  })
  
  
  export class Returns implements OnInit {
  
    /* SERVICES */
    private readonly orderService = inject(OrderService);
    private readonly purchaseInvoiceService = inject(PurchaseInvoiceService);
    private readonly returnService = inject(ReturnService);
    private readonly productService = inject(ProductService);
    private readonly storeSettingsService = inject(StoreSettingsService);
    private readonly popupService = inject(PopupService);
    private readonly cdr = inject(ChangeDetectorRef);
  
    /* TYPE */
    returnType: ReturnType = 'sale';
  
    /* DATA */
    orders: Order[] = [];
    purchaseInvoices: PurchaseInvoice[] = [];
    returns: ReturnTransaction[] = [];
    products: Product[] = [];
  
    /* SEARCH */
    searchTerm = '';
    fromDate = '';
    toDate = '';
  
    /* STATE */
    isLoading = false;
    loadError = false;
    selectedReference: ReturnReference | null = null;
    selectedItems: ReturnableItem[] = [];
    returnReason = '';
    currencySymbol = 'EGP';
    showReasonInput = false;
  
    /* INIT */
    ngOnInit(): void {
      this.loadStoreSettings();
      this.loadData();
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
            this.cdr.markForCheck();
          },
          error: (error: unknown) => {
            console.error( 'Failed to load store settings:', error
            );
          }
        });
    }
  
    /* LOAD DATA */
    loadData(): void {
      this.isLoading = true;
      this.loadError = false;
      this.selectedReference = null;
      this.selectedItems = [];

      forkJoin({
        orders:this.orderService.getOrders(),
        purchaseInvoices: this.purchaseInvoiceService.getPurchaseInvoices(),
        returns: this.returnService.getReturns(),
        products: this.productService.getProducts()
      }).subscribe({ next: ({ orders, purchaseInvoices, returns, products }) => {
          this.orders = orders || [];
          this.purchaseInvoices = purchaseInvoices || [];
          this.returns = returns || [];
          this.products = products || [];
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          console.error( 'Failed to load returns data:', error );

          this.loadError = true;
          this.isLoading = false;
          this.popupService.showAlert( 'Failed to load returns data.', 'error', 'Loading Error');
          this.cdr.markForCheck();
        }
      });
    }
  
    /* SWITCH RETURN TYPE */
    selectReturnType(
      type: ReturnType
    ): void {
      this.returnType = type;
      this.searchTerm = '';
      this.fromDate = '';
      this.toDate = '';
      this.selectedReference = null;
      this.selectedItems = [];
      this.returnReason = '';
      this.cdr.markForCheck();
    }
  
    /* SEARCH / FILTER */
    get filteredReferences():
      ReturnReference[] {
      const term = this.searchTerm.trim().toLowerCase();
      const source = this.returnType === 'sale' ? this.orders : this.purchaseInvoices;
      return source

        /* FILTER */
        .filter((reference) => {
          const matchesSearch = this.matchesSearch( reference, term );
          if (!matchesSearch) {
            return false;
          }

          const referenceDate = this.getReferenceDate(reference);
          if ( this.fromDate && referenceDate < this.fromDate) {
            return false;
          }
  
          if (this.toDate && referenceDate > this.toDate) {
            return false;
          }

          return true;
        })
  
        /* SORT */
        .sort((a, b) => {
          if (term === '') {
            return (
              new Date(this.getReferenceCreatedAt(b) ).getTime() - new Date(this.getReferenceCreatedAt(a)).getTime());
          }

          const scoreA = this.getSearchScore( a, term );
          const scoreB = this.getSearchScore( b, term );
          if (scoreA !== scoreB) {
            return scoreA - scoreB;
          }
  
          if (
            this.isProductSearch( a, term ) ||
            this.isProductSearch( b, term )
          ) {

            const productNameA = this.getBestProductName( a, term );
            const productNameB = this.getBestProductName( b, term );
            const nameComparison = productNameA.localeCompare( productNameB, undefined, { sensitivity: 'base' });
            if (nameComparison !== 0) {
              return nameComparison;
            }
          }
  
          const referenceNumberA = this.getReferenceNumber(a) .toLowerCase();
          const referenceNumberB = this.getReferenceNumber(b) .toLowerCase();
          const referenceComparison = referenceNumberA.localeCompare( referenceNumberB, undefined, { numeric: true,sensitivity: 'base' } );
          if (referenceComparison !== 0) {
            return referenceComparison;
          }
  
          return (
            new Date( this.getReferenceCreatedAt(b) ).getTime() - new Date( this.getReferenceCreatedAt(a) ).getTime());
        })

        .map((reference) => ({...reference, 
          referenceNumber: this.getReferenceNumber(reference), 
          date: this.getReferenceCreatedAt(reference),
          itemCount: this.getReferenceItemCount(reference) }));
    }
  
  
    /* SEARCH MATCH */
    private matchesSearch( reference: Order | PurchaseInvoice, term: string ): boolean {
      if (term === '') {
        return true;
      }
  
      if (this.returnType === 'sale') {
        const order = reference as Order;
        const ticketNumber =  String((order as any).ticketNumber || '').toLowerCase();
        const orderId = String( order.id ?? '' ).toLowerCase();
        const itemMatch = (order.items || []) .some((item) => { 
          const productName =  String( item.productName || '').toLowerCase();
          const sku = String((item as any).sku || '').toLowerCase();
            return (
                productName.includes(term) || sku.includes(term)
              );
            });
  
        return (
          ticketNumber.includes(term) || orderId.includes(term) || itemMatch
        );
      }
  
      const invoice = reference as PurchaseInvoice;
      const invoiceNumber = String( invoice.invoiceNumber || '' ).toLowerCase();
      const supplierName = String( invoice.supplierName || '' ).toLowerCase();
      const invoiceId = String( invoice.id || '' ).toLowerCase();
      const itemMatch = (invoice.items || []) .some((item) => {
            const productName =String( item.productName || '' ).toLowerCase();
            const sku =  String(  item.sku || ''  ).toLowerCase();
            return (
              productName.includes(term) || sku.includes(term)
            );
          });
      return (
        invoiceNumber.includes(term) || supplierName.includes(term) || invoiceId.includes(term) || itemMatch
      );
  
    }
  
    /* SEARCH SCORE */
    private getSearchScore( reference: Order | PurchaseInvoice,term: string): number {
      const referenceNumber = this.getReferenceNumber( reference ).replace(/^#/, '') .toLowerCase();
      const referenceId = String( reference.id ?? '' ) .toLowerCase();
      const productNames = (reference.items || []).map(item => String( item.productName || '' ) .trim().toLowerCase()).filter(Boolean);
      const skus = (reference.items || []).map(item => String( (item as any).sku || '').trim().toLowerCase()).filter(Boolean);
      const isNumericSearch = /^\d+$/.test(term);
  
      if (isNumericSearch) {
        if (referenceNumber === term) {
          return 0;
        }

        if (referenceNumber.startsWith(term)) {
          return 1;
        }
  
        if (referenceNumber.includes(term)) {
          return 2;
        }
  
        if (referenceId === term) {
          return 3;
        }
  
        if (referenceId.startsWith(term)) {
          return 4;
        }
  
        if (referenceId.includes(term)) {
          return 5;
        }
  
        const productStarts = productNames.some( name => name.startsWith(term));
        if (productStarts) {
          return 6;
        }
  
        const productContains = productNames.some( name => name.includes(term));
        if (productContains) {
          return 7;
        }
        return 99;
      }

      const exactProduct = productNames.some( name => name === term);
      if (exactProduct) {
        return 0;
      }
  
      const productStarts = productNames.some( name => name.startsWith(term) );
      if (productStarts) {
        return 1;
      }
  
      const productContains = productNames.some( name => name.includes(term) );
      if (productContains) {
        return 2;
      }
  
      const exactSku = skus.some(
          sku => sku === term );
      if (exactSku) {
        return 3;
      }
  
      const skuStarts = skus.some( sku => sku.startsWith(term) );
      if (skuStarts) {
        return 4;
      }
  
      const skuContains = skus.some( sku => sku.includes(term));
      if (skuContains) {
        return 5;
      }
  
      if (referenceNumber === term) {
        return 6;
      }
  
      if (referenceNumber.startsWith(term)) {
        return 7;
      }
  
      if (referenceNumber.includes(term)) {
        return 8;
      }
  
      if (
        this.returnType === 'purchase'
      ) {
  
        const invoice = reference as PurchaseInvoice;
        const supplierName = String( invoice.supplierName || '' ).trim().toLowerCase();

        if (supplierName === term) {
          return 9;
        }
  
        if (
          supplierName.startsWith(term)
        ) {
          return 10;
        }
  
        if (
          supplierName.includes(term)
        ) {
          return 11;
        }
      }
  
      if (referenceId === term) {
        return 12;
      }
  
      if (referenceId.startsWith(term)) {
        return 13;
      }
  
      if (referenceId.includes(term)) {
        return 14;
      }
  
      return 99;
    }
  
    /* PRODUCT SEARCH DETECTION */
    private isProductSearch( reference: Order | PurchaseInvoice,  term: string): boolean {
      if (!term) {
        return false;
      }
  
      return (reference.items || []) .some(item => {
          const productName = String( item.productName || '') .trim() .toLowerCase();
          return ( productName === term || productName.startsWith(term) || productName.includes(term));
        });
    }
  
    /* BEST PRODUCT NAME */
    private getBestProductName( reference: Order | PurchaseInvoice, term: string): string {
      const names = (reference.items || []).map(item => String(item.productName || '').trim()).filter(Boolean);
      if (!names.length) {
        return '';
      }
  
      const matchingName = names.find(name =>
          name.toLowerCase().startsWith(term));
      if (matchingName) {
        return matchingName;
      }
  
      const containsName = names.find(name => name .toLowerCase() .includes(term) );
      return containsName || names[0];
    }
  
    /* DATE HELPERS */
    private getReferenceCreatedAt( reference: Order | PurchaseInvoice ): string {
      if (
        this.returnType === 'sale'
      ) {
        const order = reference as Order;
        return String( order.createdAt || '' );
      }

      const invoice = reference as PurchaseInvoice;
      return String( invoice.invoiceDate || (invoice as any).createdAt || '');
    }
  
    private getReferenceDate( reference: Order | PurchaseInvoice): string {
      const value = this.getReferenceCreatedAt( reference );
      if (!value) {
        return '';
      }

      const date = new Date(value);
      if ( Number.isNaN(date.getTime())
      ) {
        return '';
      }
  
      const year = date.getFullYear();
      const month = String( date.getMonth() + 1 ).padStart(2, '0');
      const day = String( date.getDate() ).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  
    /* DISPLAY DATE */
    getDisplayDate(reference: Order | PurchaseInvoice): string {

      const value = this.getReferenceCreatedAt( reference );
      if (!value) {
        return '—';
      }
  
      const date = new Date(value);
      if (
        Number.isNaN( date.getTime() )
      ) {
        return '—';
      }
      return date.toLocaleDateString( 'en-US',{ month: 'short', day: 'numeric', year: 'numeric' } );
    }
  
    /* REFERENCE NUMBER */
    getReferenceNumber( reference: Order | PurchaseInvoice): string {
      if (
        this.returnType === 'sale'
      ) {
  
        const order = reference as Order;
        const ticketNumber = (order as any).ticketNumber;
        if (ticketNumber) {
          return `#${ticketNumber}`;
        }
        return `#ORD-${order.id ?? ''}`;
      }
  
      const invoice = reference as PurchaseInvoice;
      return String( invoice.invoiceNumber || '');
    }
  
    /* REFERENCE ITEM COUNT*/
    getReferenceItemCount(reference: Order | PurchaseInvoice ): number {
      const items = reference.items || [];
      return items.reduce(( total, item ) => total + ( Number( item.quantity) || 0 ), 0 );
    }
  
    /* REFERENCE TOTAL */
    getReferenceTotal( reference: Order | PurchaseInvoice): number {

      if (
        this.returnType === 'sale'
      ) {
  
        const order =  reference as Order;
        return Number(  order.total || 0 );
      }
  
      const invoice = reference as PurchaseInvoice;
      return Number( invoice.total || 0 );
    }
  
    /* PRODUCT LOOKUP */
    private getProductById( productId: string ): Product | undefined {
      return this.products.find( product => String(product.id) === String(productId)
      );
    }
  
    private getProductImage( productId: string): string {
      return String(
        this.getProductById(productId)?.image || ''
      );
    }
  
    toggleReasonInput(): void {
        this.showReasonInput = !this.showReasonInput;
      }
  
    /* SELECT REFERENCE */
      selectReference( reference: Order | PurchaseInvoice ): void {
        this.selectedReference = { ...reference,  referenceNumber: this.getReferenceNumber(reference), date: this.getReferenceCreatedAt(reference), itemCount: this.getReferenceItemCount(reference) };
        this.returnReason = '';
        this.showReasonInput = false;
        this.loadReturnableItems(reference);
      }
  
    /* LOAD RETURNABLE ITEMS */
    private loadReturnableItems( reference: Order | PurchaseInvoice): void {
      const referenceId = String(reference.id);
      const previousReturns = this.returns.filter((returnTransaction) => returnTransaction.status === 'completed' && returnTransaction.type === this.returnType && String( returnTransaction.referenceId ) === referenceId );
      const returnedQuantities = new Map<string, number>();
  
      previousReturns.forEach(
        (returnTransaction) => { returnTransaction.items.forEach((item) => {
              const productId = String( item.productId);
              const current = returnedQuantities.get( productId) || 0;
              returnedQuantities.set( productId, current + Number( item.quantity || 0 ));
            });
        });
  
      /* SALES RETURN */
      if (
        this.returnType === 'sale'
      ) {
        const order = reference as Order;
        this.selectedItems = (order.items || []).map((item) => {
              const productId = String(item.productId);
              const product = this.getProductById(productId);
              const originalQuantity = Number( item.quantity || 0 );
              const alreadyReturnedQuantity = returnedQuantities.get( productId ) || 0;
              const returnableQuantity = Math.max( 0, originalQuantity - alreadyReturnedQuantity );
              const image = String( (item as any).image || product?.image || '');
  
              return {
                productId,
                productName: String( item.productName || '' ),
                sku: String((item as any).sku || product?.sku || '' ),
                image,
                originalQuantity,
                alreadyReturnedQuantity,
                returnableQuantity,
                unitPrice: Number( item.price || 0 ),
                costPrice: item.costPrice !== undefined? Number( item.costPrice ) : undefined,
                returnQuantity: 0
              };
            });
        return;
      }
  
      /* PURCHASE RETURN */
      const invoice = reference as PurchaseInvoice;
      this.selectedItems = (invoice.items || []).map((item: PurchaseInvoiceItem) => {
            const productId = String( item.productId );
            const product = this.getProductById( productId);
            const originalQuantity = Number( item.quantity || 0);
            const alreadyReturnedQuantity = returnedQuantities.get( productId ) || 0;
            const returnableQuantity = Math.max( 0, originalQuantity - alreadyReturnedQuantity);
              return {
                productId,
                productName: String( item.productName || '' ),
                sku: String( item.sku || product?.sku || '' ),
                image: String( product?.image || '' ),
                originalQuantity,
                alreadyReturnedQuantity,
                returnableQuantity,
                unitPrice: Number( item.purchasePrice || 0 ),
                costPrice: Number( item.purchasePrice || 0 ),
                returnQuantity: 0
              };
            }
          );
    }
  
    /* RETURN QUANTITY */
    increaseReturnQuantity( item: ReturnableItem): void {
      if (
        item.returnQuantity >= item.returnableQuantity
      ) {
        return;
      }
      item.returnQuantity++;
      this.cdr.markForCheck();
    }
  
    decreaseReturnQuantity( item: ReturnableItem ): void {
      if (
        item.returnQuantity <= 0
      ) {
        return;
      }
  
      item.returnQuantity--;
      this.cdr.markForCheck();
    }
  
    setReturnQuantity( item: ReturnableItem, quantity: number): void {
      const value = Number(quantity);
      if (
        !Number.isFinite(value)
      ) {
        item.returnQuantity = 0;
        return;
      }
  
      item.returnQuantity = Math.max( 0, Math.min( Math.floor(value), item.returnableQuantity ) );
      this.cdr.markForCheck();
    }
  
    /* RETURN ITEMS SELECTED? */
    get hasSelectedReturnItems(): boolean {
      return this.selectedItems
        .some( item => item.returnQuantity > 0 );
    }
  
    /* RETURN TOTAL */
    get returnTotal(): number {
      return this.selectedItems
        .reduce(( total, item ) => total + ( item.returnQuantity * item.unitPrice ), 0 );
    }
  
    /* SELECTED ITEMS COUNT */
    get selectedItemsCount(): number {
      return this.selectedItems.filter( item => item.returnQuantity > 0).length;
    }

    /* VALIDATE RETURN QUANTITY */
    validateReturnQuantity(item: ReturnableItem): void {
      this.setReturnQuantity(item, item.returnQuantity);
    }


    /* CLOSE SELECTED INVOICE */
    clearSelectedReference(): void {
      this.selectedReference = null;
      this.selectedItems = [];
      this.returnReason = '';
      this.showReasonInput = false;
      this.cdr.markForCheck();
    }

    /* Existing template name kept for compatibility. */
    closeDetails(): void {
      this.clearSelectedReference();
    }


 /*CONFIRM RETURN */
confirmReturn(): void {
    /*  Validate selected items- */
    if (!this.hasSelectedReturnItems) {
      this.popupService.showAlert(
        'Please select at least one item to return.',
        'warning',
        'No Items Selected'
      );
      return;
    }
  
    /* Validate selected invoice */
    if (!this.selectedReference) {
      return;
    }
  
    /* Return information */
    const referenceNumber = this.getReferenceNumber( this.selectedReference );
    const isFullReturn = this.selectedItems.every( item => item.returnQuantity === item.returnableQuantity );
    const selectedCount = this.selectedItemsCount;
    const total = this.returnTotal;
  
    /* Confirmation message- */
    const returnTypeLabel = this.returnType === 'sale'  ? 'sales invoice' : 'purchase invoice';
    const message = isFullReturn ? `Are you sure you want to return the entire ${returnTypeLabel} "${referenceNumber}"? This will update inventory and mark the invoice as cancelled.`
      : `Are you sure you want to return ${selectedCount} selected item${selectedCount === 1 ? '' : 's'} from ${returnTypeLabel} "${referenceNumber}"?`;
  
  
    /* Confirmation popup */
    this.popupService
      .showConfirm( message, this.returnType === 'sale' ? 'Confirm Sales Return' : 'Confirm Purchase Return' )
      .subscribe(
        (confirmed) => {
          if (!confirmed) {
            return;
          }
          /* User confirmed */
          this.processReturn( isFullReturn );
        }
      );
  
  }

  /* PROCESS RETURN */
private processReturn( isFullReturn: boolean ): void {
    if (!this.selectedReference) {
      return;
    }
  
    const selectedReference = this.selectedReference;
    const referenceId = String(this.selectedReference.id);
  
    /* Build returned items */
    const items = this.selectedItems.filter(item => item.returnQuantity > 0 )
        .map(item => ({ productId: String(item.productId),
          productName:  item.productName,
          sku: item.sku,
          quantity: Number(item.returnQuantity),
          unitPrice: Number(item.unitPrice),
          costPrice: item.costPrice !== undefined ? Number(item.costPrice) : undefined,
          total: Number(( item.returnQuantity * item.unitPrice ).toFixed(2))}));
  

    /* Build return transaction */
    const returnTransaction = {
      type: this.returnType,
      referenceId,
      referenceNumber: this.getReferenceNumber( this.selectedReference),
      items,
      reason: this.returnReason.trim(),
      total: Number( this.returnTotal.toFixed(2)),
      status:'completed',
      createdAt: new Date().toISOString()
    };
  
    /* Find ReturnService save method */
    const service = this.returnService as any;
    const createReturn = typeof service.createReturn === 'function' ? service.createReturn.bind(service) : typeof service.addReturn === 'function' ? service.addReturn.bind(service) : null;
  
    if (!createReturn) {
      console.error( 'ReturnService does not expose createReturn/addReturn.' );
      this.popupService.showAlert(
        'The return could not be saved because the return service method is missing.',
        'error',
        'Save Failed'
      );
      return;
    }
  
    /* Start processing */
    this.isLoading = true;
    this.cdr.markForCheck();
  
    /* Save return */
    createReturn( returnTransaction ).subscribe({next: () => {
        const stockUpdates = items.map(item => {
              const product = this.getProductById( String(item.productId));
              if (!product) {
                console.error( `Product ${item.productId} was not found.` );
                return null;
              }
  
              const currentStock = Number( product.stock ?? 0);
              const stockDelta = this.returnType === 'sale' ? item.quantity : -item.quantity;
              const updatedProduct: Product = { ...product, stock: Math.max( 0, currentStock + stockDelta )};
              return this.productService.updateProduct( product.id, updatedProduct);
            }).filter( request => request !== null );
  
        /* No stock updates*/
        if (stockUpdates.length === 0) {
          this.finishReturnSuccess();
          return;
        }
  
        /* Update inventory */
        forkJoin(stockUpdates).subscribe({next: () => {
            if ( 
              this.returnType === 'sale' && isFullReturn ) {
              this.cancelReturnedOrder(selectedReference);
              return;
            }
            this.finishReturnSuccess();
          },
          error: (error: unknown) => { console.error( 'Return saved but inventory update failed:', error);
            this.isLoading = false;
            this.popupService.showAlert(
              'The return was saved, but inventory stock could not be updated.',
              'error',
              'Inventory Update Failed'
            );
            this.cdr.markForCheck();
          }
        });
      },
      error: (error: unknown) => {
        console.error( 'Failed to save return:', error);
        this.isLoading = false;
        this.popupService.showAlert('Failed to save the return.', 'error', 'Save Failed' );
        this.cdr.markForCheck();
      }
    });
  }

/* CANCEL RETURNED ORDER */
    private cancelReturnedOrder(reference: Order | PurchaseInvoice): void {
  
    // Only sales orders can be cancelled here.
    if (this.returnType !== 'sale') {
      this.finishReturnSuccess();
      return;
    }
  
    const order = reference as Order;
    // Order.id is optional in the model,
    // so make sure it exists before updating.
    if (order.id === undefined) {
      console.error(
        'Cannot cancel returned order: order id is missing.'
      );
  
      this.isLoading = false;
      this.popupService.showAlert(
        'The return was completed, but the order could not be cancelled because its ID is missing.',
        'error',
        'Order Update Failed'
      );
      this.cdr.markForCheck();
      return;
    }
  
  
    /* Mark order as Cancelled */
    this.orderService
      .updateOrderStatus( order.id,'Cancelled' )
      .subscribe({ next: () => {
          this.finishReturnSuccess();
        },
        error: (error: unknown) => {
          console.error('Return completed but order status update failed:', error );
          this.isLoading = false;
          this.popupService.showAlert(
            'The return was completed, but the order could not be marked as cancelled.',
            'error',
            'Order Update Failed'
          );
          this.cdr.markForCheck();
        }
      });
  }

    private finishReturnSuccess(): void {
      this.isLoading = false;
      this.showReasonInput = false;
      this.popupService.showAlert(
        'Return saved and inventory updated successfully.',
        'success',
        'Return Completed'
      );

      this.clearSelectedReference();
      this.loadData();
    }

    isFullyReturned( reference: Order | PurchaseInvoice): boolean {
        const referenceId = String(reference.id);
        const relevantReturns = this.returns.filter( returnTransaction => returnTransaction.type === this.returnType &&
          String( returnTransaction.referenceId) === referenceId && returnTransaction.status === 'completed');
        if (
          !reference.items || reference.items.length === 0
        ) {
          return false;
        }
      
        return reference.items.every(
          originalItem => {
            const originalQuantity = Number( originalItem.quantity || 0 );
            const returnedQuantity = relevantReturns.reduce((sum, returnTransaction) => {
                const returnedItem = returnTransaction.items.find( item => String(item.productId) === String(originalItem.productId));
                  return ( sum + Number( returnedItem?.quantity || 0 ) ); }, 0);
            return (
              returnedQuantity >=
              originalQuantity
            );
          }
        );
      }

    /* RESET FILTERS */
    clearFilters(): void {
      this.searchTerm = '';
      this.fromDate = '';
      this.toDate = '';
      this.clearSelectedReference();
    }
  }

