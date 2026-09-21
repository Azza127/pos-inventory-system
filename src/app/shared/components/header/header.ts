import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

import { PopupService } from '../../../core/services/popup.service';
import { StoreSettingsService } from '../../../core/services/store-settings.service';
import { StoreSettings } from '../../../core/models/store-settings.model';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class HeaderComponent implements OnInit {

  settings: StoreSettings | null = null;

  userName = 'Store Owner';
  userRole = 'Owner';

  constructor(
    private router: Router,
    private readonly popupService: PopupService,
    private readonly settingService: StoreSettingsService
  ) {}

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadStoreSettings();
  }

  private loadStoreSettings(): void {
    this.settingService.getOrLoadSettings().subscribe({
      next: (settings) => {
        if (!settings) {
          return;
        }

        this.settings = settings;
      },
      error: (error) => {
        console.error(
          'Failed to load store settings:',
          error
        );
      }
    });
  }

  private loadCurrentUser(): void {
    const user = localStorage.getItem('currentUser');

    if (!user) {
      return;
    }

    try {
      const currentUser = JSON.parse(user);

      this.userName =
        currentUser.name || 'Store Owner';

      this.userRole =
        currentUser.role || 'Owner';

    } catch (error) {
      console.error(
        'Failed to parse current user:',
        error
      );
    }
  }

  logout(): void {
    this.popupService
      .showConfirm(
        'Are you sure you want to logout?',
        'logout'
      )
      .subscribe({
        next: (confirmed) => {
          if (!confirmed) {
            return;
          }

          localStorage.removeItem('currentUser');
          localStorage.removeItem('isLoggedIn');

          window.location.href = '/login';
        }
      });
  }
}