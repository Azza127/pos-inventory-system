import { inject } from '@angular/core';
import { CanActivateFn, Router} from '@angular/router';
import { PopupService } from '../services/popup.service';
import { User } from '../models/user.model';

export const roleGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const popupService = inject(PopupService);
  const currentUserData = localStorage.getItem('currentUser');

  if (!currentUserData) {
    return router.createUrlTree(['/login']);
  }

  let currentUser: User;
  try {
    currentUser = JSON.parse(currentUserData) as User;
  } catch {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isLoggedIn');
    return router.createUrlTree(['/login']);
  }

  const currentRole = String(currentUser.role).trim() .toLowerCase();
  const allowedRoles = route.data?.['roles'] as string[] | undefined;
  if (
    !allowedRoles || allowedRoles.length === 0
  ) {
    return true;
  }

  const hasPermission = allowedRoles.some( role => role.trim().toLowerCase() === currentRole );
  if (hasPermission) {
    return true;
  }

  popupService.showAlert( 'You do not have permission to access this page.', 'error', 'Access Denied' );
  return router.createUrlTree(['/dashboard']);
};