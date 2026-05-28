import { LocationProvider, Router, Route } from 'preact-iso';
import { applySettings, getSettings } from '@/lib/settings';
import { AuthProvider } from '@/auth/auth-context';
import { useAuth } from '@/auth/auth-context';
import { Shell } from '@/components/layout/shell';
import { ToastContainer } from '@/components/toast';
import { LoginPage } from '@/pages/login/login';
import { TokenListPage } from '@/pages/tokens/token-list';
import { TokenDetailPage } from '@/pages/tokens/token-detail';
import { AppListPage } from '@/pages/apps/app-list';
import { ImportPage } from '@/pages/import/import';
import { ImportResultsPage } from '@/pages/import/import-results';
import { VerifyPage } from '@/pages/verify/verify';
import { SettingsPage } from '@/pages/settings/settings';

applySettings(getSettings());

function AppRouter() {
  const { auth } = useAuth();

  if (!auth.isAuthenticated) {
    return (
      <Router>
        <Route path="/login" component={LoginPage} />
        <Route default component={LoginPage} />
      </Router>
    );
  }

  return (
    <Shell>
      <Router>
        <Route path="/" component={TokenListPage} />
        <Route path="/tokens" component={TokenListPage} />
        <Route path="/tokens/:id" component={TokenDetailPage} />
        <Route path="/apps" component={AppListPage} />
        <Route path="/import" component={ImportPage} />
        <Route path="/import/results" component={ImportResultsPage} />
        <Route path="/verify" component={VerifyPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route default component={TokenListPage} />
      </Router>
    </Shell>
  );
}

export function App() {
  return (
    <AuthProvider>
      <LocationProvider>
        <AppRouter />
        <ToastContainer />
      </LocationProvider>
    </AuthProvider>
  );
}
