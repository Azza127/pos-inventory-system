import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';

export const authGuard = (p0: RouterStateSnapshot | ActivatedRouteSnapshot) => {
  const router = inject(Router);
  const isLoggedIn = localStorage.getItem('isLoggedIn');
  if (isLoggedIn === 'true') {
    return true;
  }
  return router.createUrlTree(['/login']);
};