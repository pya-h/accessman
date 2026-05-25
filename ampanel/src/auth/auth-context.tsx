import { createContext } from 'preact';
import { useContext, useState, useCallback } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { clearCredentials, getCredentials } from '@/api/client';
import { listApps } from '@/api/apps';

interface AuthState {
  isAuthenticated: boolean;
}

interface AuthContextValue {
  auth: AuthState;
  login: (baseUrl: string, securityKey: string, operatorKey: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>(null!);

export function AuthProvider({ children }: { children: ComponentChildren }) {
  const [auth, setAuth] = useState<AuthState>(() => ({
    isAuthenticated: getCredentials() !== null,
  }));

  const login = useCallback(async (baseUrl: string, securityKey: string, operatorKey: string) => {
    sessionStorage.setItem('am_base_url', baseUrl);
    sessionStorage.setItem('am_security_key', securityKey);
    sessionStorage.setItem('am_operator_key', operatorKey);

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

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
