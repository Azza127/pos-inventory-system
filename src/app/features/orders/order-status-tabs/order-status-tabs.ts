import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Order } from '../../../core/models/order.model';
export type OrderStatusFilter = 'all' | 'Pending' | 'Completed' | 'Cancelled';

@Component({
  selector: 'app-order-status-tabs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-status-tabs.html',
  styleUrl: './order-status-tabs.css',
})

export class OrderStatusTabs {
  /** Full (unfiltered) order list — used only to compute the per-tab counts. */
  @Input() orders: Order[] = [];
  @Input() activeStatus: OrderStatusFilter = 'all';
  @Output() statusChange = new EventEmitter<OrderStatusFilter>();

  get allCount(): number {
    return this.orders.length;
  }
  get pendingCount(): number {
    return this.orders.filter((o) => o.status === 'Pending').length;
  }
  get completedCount(): number {
    return this.orders.filter((o) => o.status === 'Completed').length;
  }
  get cancelledCount(): number {
    return this.orders.filter((o) => o.status === 'Cancelled').length;
  }
  select(status: OrderStatusFilter): void {
    this.statusChange.emit(status);
  }
}
