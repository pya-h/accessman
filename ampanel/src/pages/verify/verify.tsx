import { useState } from 'preact/hooks';
import { listApps } from '@/api/apps';
import { verifyToken } from '@/api/tokens';
import type { VerifyResult } from '@/api/tokens';
import { useQuery } from '@/lib/use-query';
import { CustomSelect } from '@/components/custom-select';
import { MetadataViewer } from '@/components/metadata-viewer';
import { IconShield, IconCheck, IconAlert } from '@/components/icons';
import { relativeTime } from '@/lib/relative-time';
import styles from './verify.module.css';

export function VerifyPage() {
  const { data: apps } = useQuery(() => listApps(), []);
  const [appName, setAppName] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = appName !== '' && token.trim() !== '' && !loading;

  const handleVerify = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await verifyToken(appName, token.trim());
      setResult(res);
    } catch (err) {
      setError((err as { message?: string })?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class={styles.page}>
      <h2 class={styles.title}>Verify Token</h2>
      <p class={styles.subtitle}>
        Check a token against its app and inspect the verification result.
      </p>

      <div class={styles.card}>
        <div class={styles.field}>
          <label class={styles.label}>App</label>
          <CustomSelect
            fullWidth
            value={appName}
            options={[
              { value: '', label: 'Select app...' },
              ...(apps || []).map((a) => ({ value: a.name, label: a.name })),
            ]}
            onChange={setAppName}
          />
        </div>

        <div class={styles.field}>
          <label class={styles.label}>Token</label>
          <input
            type="text"
            class={`${styles.input} mono`}
            placeholder="Paste the raw token / code..."
            value={token}
            onInput={(e) => setToken((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleVerify();
            }}
          />
        </div>

        <button class={styles.verifyBtn} onClick={handleVerify} disabled={!canSubmit}>
          <IconShield size={15} /> {loading ? 'Verifying...' : 'Verify Token'}
        </button>
      </div>

      {error && <div class={styles.errorBox}>{error}</div>}

      {result && (
        <div class={styles.resultCard}>
          <div
            class={`${styles.resultHeader} ${result.valid ? styles.valid : styles.invalid}`}
          >
            {result.valid ? <IconCheck size={16} /> : <IconAlert size={16} />}
            <span class={styles.resultLabel}>{result.valid ? 'Valid' : 'Invalid'}</span>
            {!result.valid && result.reason && (
              <span class={styles.reason}>{result.reason}</span>
            )}
          </div>

          {result.valid && (
            <div class={styles.fields}>
              <div class={styles.row}>
                <span class={styles.rowLabel}>User ID</span>
                <span class={`${styles.rowValue} mono`}>{result.userId}</span>
              </div>
              <div class={styles.row}>
                <span class={styles.rowLabel}>App</span>
                <span class={styles.rowValue}>{result.appName}</span>
              </div>
              <div class={styles.row}>
                <span class={styles.rowLabel}>Expires At</span>
                <span class={styles.rowValue}>
                  {result.expiresAt
                    ? `${new Date(result.expiresAt).toLocaleString()} (${relativeTime(result.expiresAt)})`
                    : 'Never'}
                </span>
              </div>
              <div class={styles.metaBlock}>
                <span class={styles.rowLabel}>Metadata</span>
                <MetadataViewer data={result.metadata || {}} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
