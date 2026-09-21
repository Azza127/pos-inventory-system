import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Order } from '../../../core/models/order.model';
import { StoreSettingsService } from '../../../core/services/store-settings.service';

@Component({
  selector: 'app-order-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-table.html',
  styleUrl: './order-table.css',
})
export class OrderTable implements OnInit, OnChanges {
  @Input() orders: Order[] = [];
  @Input() loading = false;
  @Output() orderSelect = new EventEmitter<Order>();

  private readonly storeSettingsService = inject(StoreSettingsService);
  currencySymbol = 'EGP';

  // INIT
  ngOnInit(): void {
    this.loadStoreSettings();
  }

  // LOAD STORE SETTINGS
  private loadStoreSettings(): void {
    this.storeSettingsService
      .getOrLoadSettings()
      .subscribe({ next: (settings) => {
          if (!settings) {
            return;
          }
          this.currencySymbol = this.storeSettingsService.getCurrencySymbol( settings.currency );
        },
        error: (error) => {
          console.error( 'Error loading store settings:', error );
        }
      });
  }

  // INPUT CHANGES
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orders']) {
      // Orders are already filtered and sorted
      // by the parent Orders component.
    }
  }

  // ALL ORDERS
  get pagedOrders(): Order[] {
    return this.orders;
  }

  // ORDER SELECTION
  select(order: Order): void {
    this.orderSelect.emit(order);
  }

  // ITEM COUNT
  itemCount(order: Order): number {
    return (order.items || [])
      .reduce((sum, item) => sum + (item.quantity || 0), 0);
  }

  // TICKET NUMBER
  ticketNumber(order: Order): string {
    return (
      (order as any).ticketNumber || `#${order.id}`
    );
  }

  // PAYMENT METHOD
  paymentMethod(order: Order): string {
    return (
      (order as any).paymentMethod || '—'
    );
  }

  // TRACK BY
  trackByOrderId( _index: number, order: Order): string | number {
    return order.id ?? _index;
  }
}