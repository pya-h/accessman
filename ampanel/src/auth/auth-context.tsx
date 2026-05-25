import { createContext } from 'preact';
import { useContext, useState, useCallback, useEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { clearCredentials, getCredentials, saveCredentials, setAuthErrorHandler } from '@/api/client';
import { listApps } from '@/api/apps';

interface AuthState {
  isAuthenticated: boolean;
}

interface AuthContextValue {
  auth: AuthState;
  login: (securityKey: string, operatorKey: string, remember: boolean) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>(null!);

export function AuthProvider({ children }: { children: ComponentChildren }) {
  const [auth, setAuth] = useState<AuthState>(() => ({
    isAuthenticated: getCredentials() !== null,
  }));

  const login = useCallback(async (securityKey: string, operatorKey: string, remember: boolean) => {
    saveCredentials(securityKey, operatorKey, remember);

    try {
      await listApps();
      setAuth({ isAuthenticated: true });
    } catch (err) {
      clearCredentials();
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    clearCredentials();
    setAuth({ isAuthenticated: false });
  }, []);

  useEffect(() => {
    setAuthErrorHandler(logout);
    return () => setAuthErrorHandler(null);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
