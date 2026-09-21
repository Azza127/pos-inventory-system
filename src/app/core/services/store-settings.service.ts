import { Injectable } from '@angular/core';
import { HttpClient} from '@angular/common/http';
import { BehaviorSubject, Observable, timeout } from 'rxjs';
import {StoreSettings} from '../models/store-settings.model';

// CURRENCY OPTION
export interface CurrencyOption { code: string; name: string; symbol: string;}

// SERVICE
@Injectable({ providedIn: 'root' })
export class StoreSettingsService {
  private apiUrl = 'http://localhost:3000/storeSettings';

  // CURRENCY LIST
  private readonly currencies: CurrencyOption[] = [
// Middle Eastern / Regional currencies
{ code: 'EGP', name: 'Egyptian Pound', symbol: 'EGP'},
{ code: 'SAR', name: 'Saudi Riyal', symbol: 'SAR'},
{ code: 'AED', name: 'UAE Dirham', symbol: 'AED'},
{ code: 'QAR', name: 'Qatari Riyal', symbol: 'QAR'},
{ code: 'KWD', name: 'Kuwaiti Dinar',symbol: 'KWD'},
{ code: 'BHD', name: 'Bahraini Dinar', symbol: 'BHD'},
{ code: 'OMR', name: 'Omani Rial', symbol: 'OMR'},
{ code: 'JOD', name: 'Jordanian Dinar',symbol: 'JOD'},
{ code: 'MAD', name: 'Moroccan Dirham', symbol: 'MAD'},
{ code: 'DZD', name: 'Algerian Dinar', symbol: 'DZD'},
{ code: 'TND', name: 'Tunisian Dinar', symbol: 'TND'},
{ code: 'LYD', name: 'Libyan Dinar', symbol: 'LYD'},
{ code: 'IQD', name: 'Iraqi Dinar', symbol: 'IQD'},
{ code: 'LBP', name: 'Lebanese Pound', symbol: 'LBP'},
{ code: 'YER', name: 'Yemeni Rial', symbol: 'YER'},
{ code: 'SYP', name: 'Syrian Pound', symbol: 'SYP'},
{ code: 'ILS', name: 'Israeli New Shekel', symbol: 'ILS'},
{ code: 'SDG', name: 'Sudanese Pound', symbol: 'SDG'},

 // Major international currencies
{ code: 'USD', name: 'US Dollar', symbol: '$'},
{ code: 'EUR', name: 'Euro', symbol: '€' },
{ code: 'GBP', name: 'British Pound', symbol: '£'},
{ code: 'CAD', name: 'Canadian Dollar', symbol: 'C$'},
{ code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
{ code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
{ code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
{ code: 'CNY', name: 'Chinese Yuan', symbol: '¥'},
{ code: 'INR', name: 'Indian Rupee', symbol: '₹'},
{ code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
{ code: 'KRW', name: 'South Korean Won', symbol: '₩' },
{ code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
{ code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
{ code: 'MXN', name: 'Mexican Peso', symbol: 'MX$'},
{ code: 'ZAR', name: 'South African Rand', symbol: 'R'},
{ code: 'SGD', name: 'Singapore Dollar', symbol: 'S$'},
{ code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$'},
{ code: 'NOK', name: 'Norwegian Krone', symbol: 'kr'},
{ code: 'SEK', name: 'Swedish Krona', symbol: 'kr'},
{ code: 'DKK', name: 'Danish Krone', symbol: 'kr'},
{ code: 'PLN', name: 'Polish Zloty', symbol: 'zł'}
];

// CURRENT SETTINGS
  private readonly settingsSubject =
    new BehaviorSubject<StoreSettings | null>(null);

  // CONSTRUCTOR
  constructor(
    private http: HttpClient
  ) {
    const cachedSettings = localStorage.getItem('storeSettings');
    if (cachedSettings) {
      try {
        this.settingsSubject.next(JSON.parse(cachedSettings) as StoreSettings );
      } catch {
        localStorage.removeItem( 'storeSettings' );
      }
    }
  }

  // GET CURRENT SETTINGS
  getCurrentSettings():
    Observable<StoreSettings | null> {
    return this.settingsSubject.asObservable();
  }

  getOrLoadSettings():
    Observable<StoreSettings | null> {
    const currentSettings = this.settingsSubject.value;
    if (currentSettings) {
      return new Observable<StoreSettings>(
        subscriber => { subscriber.next( currentSettings ); subscriber.complete();
        }
      );
    }

    return new Observable<StoreSettings | null>(
      subscriber => {
        this.getSettings().subscribe({ next: (settingsList) => {
            if (
              settingsList && settingsList.length > 0
            ) {
              const settings = settingsList[0];
              this.setCurrentSettings( settings );
              subscriber.next(settings);
            } else {
              subscriber.next(null);
            }
            subscriber.complete();
          },
          error: (error) => {
            subscriber.error(error);
          }
        });
      }
    );
  }

  // SET CURRENT SETTINGS
  setCurrentSettings( settings: StoreSettings): void {
    this.settingsSubject.next(settings);
    localStorage.setItem('storeSettings', JSON.stringify(settings));
  }

  // GET SETTINGS FROM API
  getSettings():
    Observable<StoreSettings[]> {
    return this.http.get<StoreSettings[]>( this.apiUrl).pipe( timeout(5000));
  }

  // UPDATE SETTINGS
  updateSettings(settings: StoreSettings): Observable<StoreSettings> {
    console.log('PUT URL:',`${this.apiUrl}/${settings.id}` );
    console.log('PUT DATA:',settings);
    return this.http.put<StoreSettings>( `${this.apiUrl}/${settings.id}`, settings).pipe( timeout(5000) );
  }

  // GET ALL CURRENCIES
  getCurrencies():
    CurrencyOption[] {
    return this.currencies;
  }

  // GET CURRENCY BY CODE
  getCurrency(currencyCode: string): CurrencyOption | undefined {
    return this.currencies.find( currency => currency.code === currencyCode);
  }

  // GET CURRENCY SYMBOL
  getCurrencySymbol( currencyCode: string): string {
    const currency = this.getCurrency(currencyCode);
    return currency?.symbol ?? currencyCode;
  }

  getCurrencyLabel( currencyCode: string ): string {
    const currency = this.getCurrency(currencyCode);
    if (!currency) {
      return 'Select currency';
    }
    return `${currency.code} (${currency.symbol})`;
  }
}