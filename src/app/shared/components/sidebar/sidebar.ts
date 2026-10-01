import {
  Component,
  inject
} from '@angular/core';

import {
  Router,
  RouterLink,
  RouterLinkActive,
  NavigationEnd
} from '@angular/router';

import {
  CommonModule
} from '@angular/common';

import {
  filter
} from 'rxjs';

import {
  PopupService
} from '../../../core/services/popup.service';


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


  // =========================================================
  // SERVICES
  // =========================================================

  private readonly popupService =
    inject(PopupService);

  private readonly router =
    inject(Router);


  // =========================================================
  // USER ROLE
  // =========================================================

  userRole = 'Employee';


  // =========================================================
  // CURRENT PAGE
  // =========================================================

  currentPageTitle = 'Dashboard';


  // =========================================================
  // CONSTRUCTOR
  // =========================================================

  constructor() {

    const user =
      localStorage.getItem('currentUser');

    if (user) {

      try {

        const currentUser =
          JSON.parse(user);

        this.userRole =
          currentUser.role || 'Employee';

      } catch (e) {

        this.popupService.showAlert(
          'Error parsing current user in sidebar',
          'error'
        );

      }

    }


    // Update page title whenever
    // the route changes

    this.router.events
      .pipe(
        filter(
          event =>
            event instanceof NavigationEnd
        )
      )
      .subscribe(
        (event) => {

          const navigationEnd =
            event as NavigationEnd;

          this.updatePageTitle(
            navigationEnd.urlAfterRedirects
          );

        }
      );


    // Set initial page title

    this.updatePageTitle(
      this.router.url
    );

  }


  // =========================================================
  // UPDATE CURRENT PAGE TITLE
  // =========================================================

  private updatePageTitle(
    url: string
  ): void {

    const path =
      url
        .split('?')[0]
        .split('#')[0]
        .replace(/^\/+/, '')
        .split('/')[0];


    const pageTitles: {
      [key: string]: string;
    } = {

      dashboard:
        'Dashboard',

      inventory:
        'Inventory',

      products:
        'Inventory',

      'purchase-invoices':
        'Purchase Invoices',

      pos:
        'Sales (POS)',

      sales:
        'Sales (POS)',

      customers:
        'Customers',

      accounts:
        'Accounts',

      orders:
        'Orders',

      returns:
        'Returns',

      reports:
        'Reports',

      'team-members':
        'Users',

      'store-settings':
        'Settings'

    };


    this.currentPageTitle =
      pageTitles[path] || '';

  }

}

