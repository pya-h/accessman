import { LocationProvider, Router, Route } from 'preact-iso';
import { applySettings, getSettings } from '@/lib/settings';
import { AuthProvider } from '@/auth/auth-context';
import { AuthGuard } from '@/auth/auth-guard';
import { LoginPage } from '@/pages/login/login';

applySettings(getSettings());

function PlaceholderPage({ name }: { name: string }) {
  return <div style={{ padding: 'var(--space-6)' }}><h2>{name}</h2></div>;
}

function TokenListPage() { return <PlaceholderPage name="Tokens" />; }
function TokenDetailPage() { return <PlaceholderPage name="Token Detail" />; }
function AppListPage() { return <PlaceholderPage name="Apps" />; }
function ImportPage() { return <PlaceholderPage name="Import" />; }
function ImportResultsPage() { return <PlaceholderPage name="Import Results" />; }
function SettingsPage() { return <PlaceholderPage name="Settings" />; }

function AuthenticatedRoutes() {
  return (
    <AuthGuard>
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
      </LocationProvider>
    </AuthProvider>
  );
}
