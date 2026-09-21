import { Routes } from '@angular/router';
import { Login } from './features/auth-settings/login/login';
import { ForgotPassword } from './features/auth-settings/forgot-password/forgot-password';
import { Dashboard } from './features/dashboard/dashboard';
import { Products } from './features/products/products';
import { PurchaseInvoices } from './features/purchase-invoices/purchase-invoices';
import { Categories } from './features/categories/categories';
import { PosComponent } from './features/pos/pos.component';
import { Reports } from './features/reports/reports';
import { SettingsComponent } from './features/auth-settings/store-settings/settings';
import { TeamMembers } from './features/auth-settings/team-members/team-members';
import { Orders } from './features/orders/orders';
import { Returns } from './features/returns/returns';
import { authGuard } from './core/guards/auth-guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'dashboard', component: Dashboard, canActivate: [authGuard, roleGuard], data: { roles: ['Employee', 'Manager', 'Owner'] } },
  { path: 'products', component: Products, canActivate: [authGuard, roleGuard], data: { roles: ['Employee', 'Manager', 'Owner'] } },
  { path: 'categories', component: Categories, canActivate: [authGuard, roleGuard], data: { roles: ['Employee', 'Manager', 'Owner'] } },
  { path: 'inventory', component: Products, canActivate: [authGuard, roleGuard], data: { roles: ['Employee', 'Manager', 'Owner'] } },
  { path: 'pos', component: PosComponent, canActivate: [authGuard, roleGuard], data: { roles: ['Employee', 'Manager', 'Owner'] } },
  { path: 'orders', component: Orders, canActivate: [authGuard, roleGuard], data: { roles: ['Employee','Manager', 'Owner'] } },
  { path: 'returns', component: Returns, canActivate: [authGuard, roleGuard], data: { roles: ['Manager', 'Owner']} },
  { path: 'sales', component: PosComponent, canActivate: [authGuard, roleGuard], data: { roles: ['Employee', 'Manager', 'Owner'] } },
  { path: 'purchase-invoices', component: PurchaseInvoices, canActivate: [authGuard, roleGuard], data: { roles: ['Manager', 'Owner'] }},
  { path: 'reports', component: Reports, canActivate: [authGuard, roleGuard], data: { roles: ['Manager', 'Owner'] } },
  { path: 'team-members', component: TeamMembers, canActivate: [authGuard, roleGuard], data: { roles: ['Manager', 'Owner'] } },
  { path: 'store-settings', component: SettingsComponent, canActivate: [authGuard, roleGuard], data: { roles: ['Owner'] } },
  { path: '**', redirectTo: 'login' },
];
