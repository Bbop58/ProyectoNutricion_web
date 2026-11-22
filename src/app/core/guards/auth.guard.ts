import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TokenService } from '../services/token.service';
import { AuthService } from '../services/auth.service';
import { map, of } from 'rxjs';

function access(platform: boolean) {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = auth.currentUser();
  return (user ? of(user) : auth.loadCurrentUser()).pipe(map(current => {
    if (!current) return router.createUrlTree(['/login']);
    const root = current.role_id === 'SUPERADMIN';
    return root === platform ? true : router.createUrlTree([root ? '/platform' : '/dashboard']);
  }));
}

export const platformGuard: CanActivateFn = () => access(true);
export const operationalGuard: CanActivateFn = () => access(false);

export const authGuard: CanActivateFn = () => {
  const tokenService = inject(TokenService);
  const router = inject(Router);

  if (tokenService.hasToken()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

export const guestGuard: CanActivateFn = () => {
  const tokenService = inject(TokenService);
  const router = inject(Router);

  if (!tokenService.hasToken()) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};
