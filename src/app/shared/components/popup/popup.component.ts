import { Component, inject } from '@angular/core';
import { PopupService } from '../../../core/services/popup.service';

@Component({
  selector: 'app-popup',
  standalone: true,
  imports: [],
  template: `
    @if (currentPopup) {
      <div class="popup-overlay" (click)="onOverlayClick($event)">
        <div class="popup-card" [class]="currentPopup.type" (click)="$event.stopPropagation()">
          <div class="popup-icon-container">
            @switch (currentPopup.type) {
              @case ('success') {
                <svg viewBox="0 0 24 24" class="popup-icon">
                  <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              }
              @case ('error') {
                <svg viewBox="0 0 24 24" class="popup-icon">
                  <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
              }
              @case ('warning') {
                <svg viewBox="0 0 24 24" class="popup-icon">
                  <path fill="currentColor" d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                </svg>
              }
              @case ('confirm') {
                <svg viewBox="0 0 24 24" class="popup-icon">
                  <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 16h-2v-2h2v2zm1.07-7.75l-.9.92C12.45 11.9 12 12.5 12 14h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/>
                </svg>
              }
              @default {
                <svg viewBox="0 0 24 24" class="popup-icon">
                  <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                </svg>
              }
            }
          </div>

          <div class="popup-content">
            @if (currentPopup.title) {
              <h3 class="popup-title">{{ currentPopup.title }}</h3>
            }
            <p class="popup-message">{{ currentPopup.message }}</p>
          </div>

          <div class="popup-actions">
            @if (currentPopup.type === 'confirm') {
              <button class="btn btn-cancel" (click)="onCancel()">{{ currentPopup.cancelText || 'Cancel' }}</button>
              <button class="btn btn-confirm" (click)="onConfirm()">{{ currentPopup.confirmText || 'Yes' }}</button>
            } @else {
              <button class="btn btn-ok" (click)="onConfirm()">OK</button>
            }
          </div>
        </div>
      </div>
    }
  `,
  styleUrl: './popup.component.css'
})
export class PopupComponent {
  popupService = inject(PopupService);

  get currentPopup() {
    return this.popupService.currentPopup();
  }

  onConfirm(): void {
    const popup = this.currentPopup;
    if (popup) {
      if (popup.resolve) {
        popup.resolve(true);
      } else {
        this.popupService.close();
      }
    }
  }

  onCancel(): void {
    const popup = this.currentPopup;
    if (popup) {
      if (popup.resolve) {
        popup.resolve(false);
      } else {
        this.popupService.close();
      }
    }
  }

  onOverlayClick(event: MouseEvent): void {
    const popup = this.currentPopup;
    if (popup && popup.type !== 'confirm') {
      this.popupService.close();
    }
  }
}
