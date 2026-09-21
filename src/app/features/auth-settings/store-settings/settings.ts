import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StoreSettingsService, CurrencyOption } from '../../../core/services/store-settings.service';
import { StoreSettings } from '../../../core/models/store-settings.model';

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
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.currencies =
    this.storeSettingsService.getCurrencies();
    this.getSettings();
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
      this.cdr.detectChanges();
    }
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
}
