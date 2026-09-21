import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PopupService } from '../../../core/services/popup.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class SidebarComponent {
  userRole = 'Employee';
  private readonly popupService = inject(PopupService);

  constructor() {
    const user = localStorage.getItem('currentUser');
    if (user) {
      try {
        const currentUser = JSON.parse(user);
        this.userRole = currentUser.role || 'Employee';
      } catch (e) {
        this.popupService.showAlert('Error parsing current user in sidebar', 'error');
      }
    }
  }
}