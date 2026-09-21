import { Component, EventEmitter,  Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderService } from '../../../core/services/order.service';
import { Order, OrderItem } from '../../../core/models/order.model';
import { Product } from '../../../core/models/product.model';
interface ResolvedOrderLine { item: OrderItem; product: Product | null;
}

@Component({
  selector: 'app-order-details-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-details-drawer.html',
  styleUrl: './order-details-drawer.css',
})

export class OrderDetailsDrawer implements OnChanges {
  @Input() order: Order | null = null;
  @Input() products: Product[] = [];
  @Input() currencySymbol = 'EGP';
  @Output() closed = new EventEmitter<void>();
  @Output() orderUpdated = new EventEmitter<Order>();

  private readonly orderService = inject(OrderService);
  resolvedLines: ResolvedOrderLine[] = [];
  updatingStatus = false;

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
  get paymentMethod(): string {
    return (this.order as any)?.paymentMethod || '—';
  }
  get canCancel(): boolean {
    return !!this.order && this.order.status !== 'Cancelled' && this.order.status !== 'Completed';
  }

  close(): void {
    this.closed.emit();
  }

  cancelOrder(): void {
    if (!this.order || !this.canCancel || this.updatingStatus) return;
    const confirmed = confirm('Cancel this order? This cannot be undone.');

    if (!confirmed) return;
    const orderId = this.order.id;
    this.updatingStatus = true;
    this.orderService.updateOrderStatus(orderId as any, 'Cancelled').subscribe({
      next: () => { const updated: Order = { ...this.order!, status: 'Cancelled' };
        this.order = updated;
        this.resolveLines();
        this.updatingStatus = false;
        this.orderUpdated.emit(updated);
      },
      error: (err: unknown) => {
        console.error('Failed to cancel order:', err);
        this.updatingStatus = false;
      },
    });
  }

  printReceipt(): void {
    window.print();
  }

  productImage(product: Product | null): string {
    return product?.image && product.image.trim() !== '' ? product.image : '';
  }
}
