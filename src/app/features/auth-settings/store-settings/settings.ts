import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StoreSettingsService, CurrencyOption } from '../../../core/services/store-settings.service';
import { StoreSettings } from '../../../core/models/store-settings.model';
import { PaymentAccountService } from '../../../core/services/payment-account.service';
import {
  PaymentAccount,
  PaymentAccountType
} from '../../../core/models/payment-account.model';
import { PopupService } from '../../../core/services/popup.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css'
})

export class SettingsComponent implements OnInit {
  settings: StoreSettings = {
    id: 1,
    storeName: '',
    phone: '',
    address: '',
    currency: 'EGP',
    taxRate: 14
  };

  originalSettings: StoreSettings = {
    ...this.settings
  };

  fieldErrors: { [key: string]: string } = {};
  successMessage = '';
  errorMessage = '';
  isSaving = false;
  currencyDropdownOpen = false;
  currencies: CurrencyOption[] = [];

  constructor(
    private storeSettingsService: StoreSettingsService,
    private paymentAccountService: PaymentAccountService,
    private popupService: PopupService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.currencies =
      this.storeSettingsService.getCurrencies();

    this.getSettings();
    this.loadPaymentAccounts();
  }

  getSettings(): void {
    this.successMessage = '';
    this.errorMessage = '';
    this.storeSettingsService.getSettings()
    .subscribe({ next: (data: StoreSettings[]) => {
        console.log('Settings response:', data);
        if (data && data.length > 0) {
          this.settings = { ...data[0] };
          this.originalSettings = { ...data[0]};
          this.storeSettingsService.setCurrentSettings( this.settings );
        }
        this.fieldErrors = {};
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error( 'Error loading settings:', error );
        this.showError( 'Failed to load settings.');
      }
    });
  }

  allowLettersOnly(event: KeyboardEvent): void {
    const key = event.key;
    const allowedKeys = [ 'Backspace','Delete','ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End' ];
    if (allowedKeys.includes(key)) {
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      return;
    }
    if (!/^[A-Za-z\u0600-\u06FF\s]$/.test(key)) {
      event.preventDefault();
    }
  }

  allowNumbersOnly(event: KeyboardEvent): void {
    const key = event.key;
    const allowedKeys = ['Backspace', 'Delete','ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End' ];
    if (allowedKeys.includes(key)) {
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      return;
    }
    if (!/^[0-9]$/.test(key)) {
      event.preventDefault();
    }
  }

  toggleCurrencyDropdown(): void {
    this.currencyDropdownOpen = !this.currencyDropdownOpen;
  }
  
  selectCurrency(currency: string): void {
    this.settings.currency = currency;
    this.validateField('currency');
    this.currencyDropdownOpen = false;
    this.cdr.detectChanges();
  }
  
  getSelectedCurrencyLabel(): string {
    return this.storeSettingsService
      .getCurrencyLabel(
        this.settings.currency
      );
  }
  
  @HostListener('document:click')
  onDocumentClick(): void {
  
    if (this.currencyDropdownOpen) {
      this.currencyDropdownOpen = false;
    }
  
    if (this.paymentAccountTypeDropdownOpen) {
      this.paymentAccountTypeDropdownOpen = false;
    }
  
    this.cdr.detectChanges();
  }

  validateField(field: string): void {
    const value = this.settings[ field as keyof StoreSettings ];

    if (field === 'storeName') {
      const storeName = String(value ?? '').trim();
      if (!storeName) {
        this.fieldErrors[field] =  'required';
      } else if (
        !/^[A-Za-z\u0600-\u06FF\s]+$/.test( storeName )
      ) {

        this.fieldErrors[field] = 'letters';
      } else {
        delete this.fieldErrors[field];
      }
    }

    if (field === 'phone') {
      const phone = String(value ?? '').trim();
      if (!phone) {
        this.fieldErrors[field] = 'required';
      } else if (
        !/^01[0125][0-9]{8}$/.test(phone)
      ) {
        this.fieldErrors[field] ='invalid';
      } else {
        delete this.fieldErrors[field];
      }
    }

    if (field === 'address') {
      const address = String(value ?? '').trim();
      if (!address) {
        this.fieldErrors[field] = 'required';
      } else {
        delete this.fieldErrors[field];
      }
    }

    if (field === 'currency') {
      if (!value) {
        this.fieldErrors[field] = 'required';
      } else {
        delete this.fieldErrors[field];
      }
    }

    if (field === 'taxRate') {
      if (
        value === '' ||
        value === null ||
        value === undefined
      ) {
        this.fieldErrors[field] = 'required';
        return;
      }

      const tax = Number(value);
      if (
        Number.isNaN(tax) || tax < 0 || tax > 100
      ) {
        this.fieldErrors[field] ='invalid';
      } else {
        delete this.fieldErrors[field];
      }
    }
  }

  validateAll(): boolean {
    this.validateField('storeName');
    this.validateField('phone');
    this.validateField('address');
    this.validateField('currency');
    this.validateField('taxRate');
    return Object.keys( this.fieldErrors).length === 0;
  }
  isFieldInvalid(field: string): boolean {
    return !!this.fieldErrors[field];
  }

  getError(field: string): string {
    return this.fieldErrors[field] || '';
  }

  updateSettings(): void {
    if (this.isSaving) {
      return;
    }

    this.successMessage = '';
    this.errorMessage = '';

    if (!this.validateAll()) {
      this.showError( 'Please fix the errors before saving.' );
      return;
    }
    
    this.isSaving = true;
    this.cdr.detectChanges();
    console.log( 'Saving settings:', this.settings );
    this.storeSettingsService
      .updateSettings(this.settings)
      .subscribe({ next: (data: StoreSettings) => {
          console.log( 'Settings saved successfully:',  data  );
          this.settings = { ...data };
          this.storeSettingsService.setCurrentSettings(this.settings);
          this.originalSettings = { ...data };
          this.fieldErrors = {};
          this.isSaving = false;
          this.successMessage = 'Settings saved successfully!';
          this.errorMessage = '';
          this.cdr.detectChanges();
          setTimeout(() => {this.successMessage = ''; this.cdr.detectChanges(); }, 4000);
        },
          error: (error) => {
          console.error(  'Error saving settings:', error );
          this.isSaving = false;
          this.successMessage = '';
          this.errorMessage = 'Failed to save settings. Please try again.';
          this.cdr.detectChanges();

          setTimeout(() => {
            this.errorMessage = '';
            this.cdr.detectChanges(); }, 5000);}
      });
  }

  private showSuccess(message: string): void {
    this.errorMessage = '';
    this.successMessage = message;
    this.cdr.detectChanges();

    setTimeout(() => {
      this.successMessage = '';
      this.cdr.detectChanges(); }, 4000);
  }

  private showError(message: string): void {
    this.successMessage = '';
    this.errorMessage = message;
    this.cdr.detectChanges();

    setTimeout(() => {
      this.errorMessage = '';
      this.cdr.detectChanges(); }, 5000);
  }

  discardChanges(): void {
    this.settings = { ...this.originalSettings };
    this.fieldErrors = {};
    this.successMessage = '';
    this.errorMessage = '';
    this.cdr.detectChanges();
  }

    // =========================================================
  // PAYMENT ACCOUNTS
  // =========================================================

  paymentAccounts: PaymentAccount[] = [];

  showPaymentAccountModal = false;
  editingPaymentAccountId: string | null = null;

  paymentAccountForm = {
    name: '',
    type: 'cash' as PaymentAccountType,
    description: '',
    image: '',
    isActive: true
  };

    // =========================================================
  // LOAD PAYMENT ACCOUNTS
  // =========================================================

  loadPaymentAccounts(): void {

    this.paymentAccountService
      .getPaymentAccounts()
      .subscribe({
        next: (accounts) => {

          this.paymentAccounts = accounts;

          this.cdr.detectChanges();
        },

        error: (error) => {

          console.error(
            'Error loading payment accounts:',
            error
          );

          this.showError(
            'Failed to load payment accounts.'
          );
        }
      });
  }


  // =========================================================
  // PAYMENT ACCOUNT TYPE LABEL
  // =========================================================

  getPaymentAccountTypeLabel(
    type: PaymentAccountType
  ): string {

    switch (type) {

      case 'cash':
        return 'Cash';

      case 'card':
        return 'Card';

      case 'bank':
        return 'Bank';

      case 'wallet':
        return 'Wallet';

      default:
        return type;
    }
  }


  // =========================================================
  // OPEN ADD MODAL
  // =========================================================

  openAddPaymentAccountModal(): void {

    this.editingPaymentAccountId = null;

    this.paymentAccountForm = {
      name: '',
      type: 'cash',
      description: '',
      image: '',
      isActive: true
    };

    this.showPaymentAccountModal = true;

    this.cdr.detectChanges();
  }


  // =========================================================
  // OPEN EDIT MODAL
  // =========================================================

  openEditPaymentAccountModal(
    account: PaymentAccount
  ): void {

    this.editingPaymentAccountId = account.id;

    this.paymentAccountForm = {
      name: account.name,
      type: account.type,
      description: account.description || '',
      image: account.image || '',
      isActive: account.isActive
    };

    this.showPaymentAccountModal = true;

    this.cdr.detectChanges();
  }


  // =========================================================
  // CLOSE MODAL
  // =========================================================

  closePaymentAccountModal(): void {

    this.showPaymentAccountModal = false;
    this.editingPaymentAccountId = null;

    this.cdr.detectChanges();
  }


  // =========================================================
  // SAVE PAYMENT ACCOUNT
  // =========================================================

  savePaymentAccount(): void {

    const name =
      this.paymentAccountForm.name.trim();

    const description =
      this.paymentAccountForm.description.trim();

    if (!name) {

      this.showError(
        'Payment account name is required.'
      );

      return;
    }

    const accountData: Omit<PaymentAccount, 'id'> = {
      name,
      type: this.paymentAccountForm.type,
      description: description || undefined,
      image: this.paymentAccountForm.image || undefined,
      isActive: this.paymentAccountForm.isActive
    };


    // EDIT
    if (this.editingPaymentAccountId) {

      this.paymentAccountService
        .updatePaymentAccount(
          this.editingPaymentAccountId,
          accountData
        )
        .subscribe({

          next: (updatedAccount) => {

            this.paymentAccounts =
              this.paymentAccounts.map(
                account =>
                  account.id === updatedAccount.id
                    ? updatedAccount
                    : account
              );

            this.closePaymentAccountModal();

            this.showSuccess(
              'Payment account updated successfully.'
            );

            this.cdr.detectChanges();
          },

          error: (error) => {

            console.error(
              'Error updating payment account:',
              error
            );

            this.showError(
              'Failed to update payment account.'
            );
          }
        });

      return;
    }


    // ADD
    this.paymentAccountService
      .addPaymentAccount(accountData)
      .subscribe({

        next: (createdAccount) => {

          this.paymentAccounts = [
            ...this.paymentAccounts,
            createdAccount
          ];

          this.closePaymentAccountModal();

          this.showSuccess(
            'Payment account added successfully.'
          );

          this.cdr.detectChanges();
        },

        error: (error) => {

          console.error(
            'Error adding payment account:',
            error
          );

          this.showError(
            'Failed to add payment account.'
          );
        }
      });
  }

  onPaymentAccountImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
  
    if (!input.files || input.files.length === 0) {
      return;
    }
  
    const file = input.files[0];
  
    // Validate file type
    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/webp'
    ];
  
    if (!allowedTypes.includes(file.type)) {
      this.showError(
        'Please select a PNG, JPG or WebP image.'
      );
  
      input.value = '';
      return;
    }
  
    // Limit image size to 200 KB
    const maxSize = 200 * 1024;
  
    if (file.size > maxSize) {
      this.showError(
        'Image size must not exceed 200 KB.'
      );
  
      input.value = '';
      return;
    }
  
    const reader = new FileReader();
  
    reader.onload = () => {
  
      this.paymentAccountForm.image =
        reader.result as string;
  
      this.cdr.detectChanges();
    };
  
    reader.onerror = () => {
  
      this.showError(
        'Failed to read the selected image.'
      );
  
      input.value = '';
    };
  
    reader.readAsDataURL(file);
  }


  // =========================================================
  // TOGGLE ACTIVE STATUS
  // =========================================================

  togglePaymentAccountStatus(
    account: PaymentAccount
  ): void {

    const updatedAccount: Omit<PaymentAccount, 'id'> = {
      name: account.name,
      type: account.type,
      description: account.description,
      image: account.image,
      isActive: !account.isActive
    };

    this.paymentAccountService
      .updatePaymentAccount(
        account.id,
        updatedAccount
      )
      .subscribe({

        next: (updatedAccount) => {

          this.paymentAccounts =
            this.paymentAccounts.map(
              item =>
                item.id === updatedAccount.id
                  ? updatedAccount
                  : item
            );

          this.showSuccess(
            updatedAccount.isActive
              ? 'Payment account activated.'
              : 'Payment account deactivated.'
          );

          this.cdr.detectChanges();
        },

        error: (error) => {

          console.error(
            'Error updating payment account status:',
            error
          );

          this.showError(
            'Failed to update payment account status.'
          );
        }
      });
  }


  // =========================================================
  // DELETE PAYMENT ACCOUNT
  // =========================================================

  deletePaymentAccount(
    account: PaymentAccount
  ): void {

    this.popupService
      .showConfirm(
        `Are you sure you want to delete "${account.name}"?`,
        'Delete Payment Account'
      )
      .subscribe((confirmed: boolean) => {

        if (!confirmed) {
          return;
        }

        this.paymentAccountService
          .deletePaymentAccount(account.id)
          .subscribe({

            next: () => {

              this.paymentAccounts =
                this.paymentAccounts.filter(
                  item =>
                    item.id !== account.id
                );

              this.popupService.showAlert(
                'Payment account deleted successfully.',
                'success'
              );

              this.cdr.detectChanges();
            },

            error: (error) => {

              console.error(
                'Error deleting payment account:',
                error
              );

              this.popupService.showAlert(
                'Failed to delete payment account.',
                'error'
              );
            }
          });
      });
  }

  paymentAccountTypeDropdownOpen = false;

togglePaymentAccountTypeDropdown(): void {
  this.paymentAccountTypeDropdownOpen =
    !this.paymentAccountTypeDropdownOpen;
}

selectPaymentAccountType(
  type: PaymentAccountType
): void {

  this.paymentAccountForm.type = type;

  this.paymentAccountTypeDropdownOpen = false;

  this.cdr.detectChanges();
}
}
