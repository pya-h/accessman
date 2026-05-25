import { LocationProvider, Router, Route } from 'preact-iso';
import { applySettings, getSettings } from '@/lib/settings';
import { AuthProvider } from '@/auth/auth-context';
import { AuthGuard } from '@/auth/auth-guard';
import { Shell } from '@/components/layout/shell';
import { ToastContainer } from '@/components/toast';
import { LoginPage } from '@/pages/login/login';
import { TokenListPage } from '@/pages/tokens/token-list';
import { TokenDetailPage } from '@/pages/tokens/token-detail';
import { AppListPage } from '@/pages/apps/app-list';
import { ImportPage } from '@/pages/import/import';
import { ImportResultsPage } from '@/pages/import/import-results';

applySettings(getSettings());

function SettingsPage() {
  return <div><h2>Settings</h2></div>;
}

function AuthenticatedRoutes() {
  return (
    <AuthGuard>
      <Shell>
        <Router>
          <Route path="/" component={TokenListPage} />
          <Route path="/tokens" component={TokenListPage} />
          <Route path="/tokens/:id" component={TokenDetailPage} />
          <Route path="/apps" component={AppListPage} />
          <Route path="/import" component={ImportPage} />
          <Route path="/import/results" component={ImportResultsPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route default component={TokenListPage} />
        </Router>
      </Shell>
    </AuthGuard>
  );
}

export function App() {
  return (
    <AuthProvider>
      <LocationProvider>
        <Router>
          <Route path="/login" component={LoginPage} />
          <Route default component={AuthenticatedRoutes} />
        </Router>
        <ToastContainer />
      </LocationProvider>
    </AuthProvider>
  );
}
