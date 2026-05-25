import { useLayoutEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { useLocation } from 'preact-iso';
import { useAuth } from './auth-context';

export function AuthGuard({ children }: { children: ComponentChildren }) {
  const { auth } = useAuth();
  const { route } = useLocation();

  useLayoutEffect(() => {
    if (!auth.isAuthenticated) {
      route('/login', true);
    }
  }, [auth.isAuthenticated]);

  if (!auth.isAuthenticated) return null;

  return <>{children}</>;
}
