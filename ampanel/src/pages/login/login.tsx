import { useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { useAuth } from '@/auth/auth-context';
import type { ApiError } from '@/api/client';
import styles from './login.module.css';

export function LoginPage() {
  const { login } = useAuth();
  const { route } = useLocation();

  const [baseUrl, setBaseUrl] = useState(
    () => localStorage.getItem('am_last_url') || window.location.origin,
  );
  const [securityKey, setSecurityKey] = useState('');
  const [operatorKey, setOperatorKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(baseUrl, securityKey, operatorKey);
      localStorage.setItem('am_last_url', baseUrl);
      route('/tokens');
    } catch (err) {
      setError((err as ApiError).message || 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class={styles.page}>
      <form class={styles.card} onSubmit={handleSubmit}>
        <h1 class={styles.title}>AccessMan Panel</h1>

        {error && <div class={styles.error}>{error}</div>}

        <label class={styles.label}>
          Backend URL
          <input
            type="text"
            class={styles.input}
            value={baseUrl}
            onInput={(e) => setBaseUrl((e.target as HTMLInputElement).value)}
            placeholder="https://accessman.example.com"
            required
          />
        </label>

        <label class={styles.label}>
          Security Key
          <input
            type="password"
            class={styles.input}
            value={securityKey}
            onInput={(e) => setSecurityKey((e.target as HTMLInputElement).value)}
            required
          />
        </label>

        <label class={styles.label}>
          Operator Key
          <input
            type="password"
            class={styles.input}
            value={operatorKey}
            onInput={(e) => setOperatorKey((e.target as HTMLInputElement).value)}
            required
          />
        </label>

        <button type="submit" class={styles.button} disabled={loading}>
          {loading ? 'Connecting...' : 'Connect'}
        </button>
      </form>
    </div>
  );
}
