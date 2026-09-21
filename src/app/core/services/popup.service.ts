import { Injectable, signal } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface PopupConfig {
  type: 'info' | 'success' | 'warning' | 'error' | 'confirm';
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  resolve?: (value: boolean) => void;
}

@Injectable({ providedIn: 'root' })

export class PopupService {
  currentPopup = signal<PopupConfig | null>(null);
  showAlert(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', title?: string): void {
    this.currentPopup.set({ type, message, title: title || this.getDefaultTitle(type) });
  }

  showConfirm(message: string, title: string = 'Are you sure?'): Observable<boolean> {
    const subject = new Subject<boolean>();
    this.currentPopup.set({type: 'confirm', message, title, confirmText: 'Yes', cancelText: 'Cancel', resolve: (value: boolean) => {
        subject.next(value); 
        subject.complete(); 
        this.close(); }});
    return subject.asObservable();
  }
  close(): void {this.currentPopup.set(null);}

  private getDefaultTitle(type: 'info' | 'success' | 'warning' | 'error'): string {
    switch (type) {
      case 'success': return 'Success';
      case 'error': return 'Error';
      case 'warning': return 'Warning';
      default: return 'Notification';
    }
  }
}
