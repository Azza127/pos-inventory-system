import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Order } from '../../../core/models/order.model';
import { PaymentAccount, PaymentAccountType } from '../../../core/models/payment-account.model';
import { PaymentAccountService } from '../../../core/services/payment-account.service';
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
  private readonly paymentAccountService = inject(PaymentAccountService);
  private readonly cdr = inject(ChangeDetectorRef);

  currencySymbol = 'EGP';
  paymentAccounts: PaymentAccount[] = [];

  ngOnInit(): void {
    this.loadStoreSettings();
    this.loadPaymentAccounts();
  }

  private loadStoreSettings(): void {
    this.storeSettingsService
      .getOrLoadSettings()
      .subscribe({
        next: (settings) => {
          if (!settings) return;
          this.currencySymbol = this.storeSettingsService.getCurrencySymbol(settings.currency);
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading store settings:', error);
        }
      });
  }

  /** Load all accounts, including inactive ones, so historic orders retain their method. */
  private loadPaymentAccounts(): void {
    this.paymentAccountService.getPaymentAccounts().subscribe({
      next: (accounts) => {
        this.paymentAccounts = (accounts || []).map(account => ({
          ...account,
          id: String(account.id)
        }));
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error loading payment accounts for orders:', error);
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orders']) {
      // Orders are already filtered and sorted by the parent Orders component.
    }
  }

  get pagedOrders(): Order[] {
    return this.orders;
  }

  select(order: Order): void {
    this.orderSelect.emit(order);
  }

  itemCount(order: Order): number {
    return (order.items || [])
      .reduce((sum, item) => sum + (item.quantity || 0), 0);
  }

  ticketNumber(order: Order): string {
    return (order as any).ticketNumber || `#${order.id}`;
  }

  getPaymentAccount(order: Order): PaymentAccount | undefined {
    const paymentAccountId = order.paymentAccountId;
    if (paymentAccountId === undefined || paymentAccountId === null || paymentAccountId === '') {
      return undefined;
    }

    return this.paymentAccounts.find(account => String(account.id) === String(paymentAccountId));
  }

  paymentMethod(order: Order): string {
    if (order.paymentStatus === 'OnAccount') {
      return 'On Account';
    }

    const account = this.getPaymentAccount(order);
    const storedName = String((order as any).paymentAccountName || '').trim();

    return account?.name || storedName || (order.paymentAccountId ? `Account ${order.paymentAccountId}` : '—');
  }

  getPaymentImageUrl(imagePath: string | undefined): string {
    const path = String(imagePath || '').trim();
    if (!path) return '';

    // Images stored as "payment-accounts/cash.svg" are served from the app's public root.
    if (/^(https?:|data:|\/)/i.test(path)) {
      return path;
    }

    return `/${path}`;
  }

  getPaymentIconClass(type: PaymentAccountType | undefined): string {
    switch (type) {
      case 'cash': return 'bi-cash-stack';
      case 'card': return 'bi-credit-card';
      case 'bank': return 'bi-bank';
      case 'wallet': return 'bi-wallet2';
      default: return 'bi-wallet2';
    }
  }

  getFallbackPaymentType(order: Order): PaymentAccountType | undefined {
    const account = this.getPaymentAccount(order);
    if (account) return account.type;

    const label = this.paymentMethod(order).toLowerCase();
    if (label.includes('cash drawer') || label === 'cash' || label.includes('drawer')) return 'cash';
    if (label.includes('visa') || label.includes('card')) return 'card';
    if (label.includes('instapay') || label.includes('bank')) return 'bank';
    if (label.includes('vodafone') || label.includes('orange cash') || label.includes('etisalat') || label.includes('wallet')) return 'wallet';
    return undefined;
  }

  trackByOrderId(_index: number, order: Order): string | number {
    return order.id ?? _index;
  }
}
