import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject} from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '../../../core/services/order.service';
import { Order, OrderItem} from '../../../core/models/order.model';
import { Product } from '../../../core/models/product.model';
import { PaymentAccount } from '../../../core/models/payment-account.model';
import { PaymentAccountService } from '../../../core/services/payment-account.service';
interface ResolvedOrderLine { item: OrderItem; product: Product | null;
}

@Component({
  selector: 'app-order-details-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-details-drawer.html',
  styleUrl: './order-details-drawer.css',
})

export class OrderDetailsDrawer implements OnInit, OnChanges {
  @Input() order: Order | null = null;
  @Input() products: Product[] = [];
  @Input() currencySymbol = 'EGP';
  @Output() closed = new EventEmitter<void>();
  @Output() orderUpdated = new EventEmitter<Order>();
  @Output() orderDeleted = new EventEmitter<string | number>();

  private readonly orderService = inject(OrderService);
  private readonly paymentAccountService = inject(PaymentAccountService);

  paymentAccounts: PaymentAccount[] = [];
  resolvedLines: ResolvedOrderLine[] = [];
  updatingStatus = false;

  ngOnInit(): void {
    this.paymentAccountService.getActivePaymentAccounts().subscribe({
      next: accounts => {
        this.paymentAccounts = accounts || [];
      },
      error: (err: unknown) => {
        console.error('Failed to load payment accounts for order details:', err);
        this.paymentAccounts = [];
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['order'] || changes['products']) {
      this.resolveLines();
    }
  }

  private resolveLines(): void {
    if (!this.order) {
      this.resolvedLines = [];
      return;
    }
    this.resolvedLines = (this.order.items || []).map((item) => ({
      item, product: this.products.find((p) => String(p.id) === String(item.productId)) || null, }));
  }

  get ticketNumber(): string {
    if (!this.order) return '';
    return (this.order as any).ticketNumber || `#${this.order.id}`;
  }
  get subtotal(): number {
    const raw = (this.order as any)?.subtotal;
    if (typeof raw === 'number') return raw;
    return (this.order?.items || []).reduce((sum, i) => sum + (i.total || 0), 0);
  }
  get tax(): number {
    const raw = (this.order as any)?.tax;
    return typeof raw === 'number' ? raw : 0;
  }
private get selectedPaymentAccount(): PaymentAccount | undefined {
  const accountId = (this.order as any)?.paymentAccountId;

  if (accountId === undefined || accountId === null) {
    return undefined;
  }

  return this.paymentAccounts.find(
    account => String(account.id) === String(accountId)
  );
}

get paymentMethodImage(): string {
  return this.selectedPaymentAccount?.image || '';
}

get paymentMethod(): string {
  const accountName = this.selectedPaymentAccount?.name;

  if (accountName) {
    return accountName;
  }

  const savedMethod = String(
    (this.order as any)?.paymentMethod || ''
  ).trim();

  if (savedMethod) {
    return savedMethod;
  }

  const status = (this.order as any)?.paymentStatus;

  if (status === 'OnAccount') {
    return 'On Account';
  }

  if (status === 'Paid') {
    return 'Paid';
  }

  return '—';
}

  get canCancel(): boolean {
    return !!this.order &&
      this.order.status === 'Pending' &&
      this.order.id !== undefined &&
      this.order.id !== null;
  }

  close(): void {
    this.closed.emit();
  }

cancelOrder(): void {
  if (!this.order || !this.canCancel || this.updatingStatus) {
    return;
  }

  const orderId = this.order.id!;

  const confirmed = confirm(
    'Delete this pending invoice? It has not been sold, so it will be removed without marking it as Cancelled or changing stock.'
  );

  if (!confirmed) {
    return;
  }

  this.updatingStatus = true;

  this.orderService.deleteOrder(orderId).subscribe({
    next: () => {
      this.updatingStatus = false;

      // Notify the parent Orders page to remove the deleted invoice.
      this.orderDeleted.emit(orderId);

      // Close the drawer after successful deletion.
      this.close();
    },

    error: (err: unknown) => {
      console.error('Failed to delete pending invoice:', err);
      this.updatingStatus = false;
    }
  });
}

  printReceipt(): void {
    window.print();
  }

  productImage(product: Product | null): string {
    return product?.image && product.image.trim() !== '' ? product.image : '';
  }
}
