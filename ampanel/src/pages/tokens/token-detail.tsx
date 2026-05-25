import { useState } from 'preact/hooks';
import { useLocation, useRoute } from 'preact-iso';
import { getToken, revokeToken } from '@/api/tokens';
import { useQuery } from '@/lib/use-query';
import { relativeTime } from '@/lib/relative-time';
import { StatusBadge } from '@/components/status-badge';
import { MetadataViewer } from '@/components/metadata-viewer';
import { Modal } from '@/components/modal';
import { showToast } from '@/components/toast';
import styles from './token-detail.module.css';

function getTokenStatus(t: { revokedAt: string | null; expiresAt: string | null }): 'active' | 'expired' | 'revoked' {
  if (t.revokedAt) return 'revoked';
  if (t.expiresAt && new Date(t.expiresAt) <= new Date()) return 'expired';
  return 'active';
}

function formatTimestamp(dateStr: string | null): string {
  if (!dateStr) return '—';
  return `${new Date(dateStr).toISOString()} (${relativeTime(dateStr)})`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(
    () => showToast('success', 'Copied to clipboard'),
    () => showToast('error', 'Failed to copy'),
  );
}

export function TokenDetailPage() {
  const { route } = useLocation();
  const { params } = useRoute();
  const id = parseInt(params['id'] || '', 10);

  const [showRevoke, setShowRevoke] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const { data: token, loading, error } = useQuery(
    () => getToken(id),
    [id],
  );

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      await revokeToken(id);
      showToast('success', `Token #${id} revoked`);
      route('/tokens');
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Revoke failed';
      showToast('error', msg);
    } finally {
      setRevoking(false);
      setShowRevoke(false);
    }
  };

  if (loading) {
    return (
      <div class={styles.page}>
        <div class={styles.backRow}>
          <button class={styles.backBtn} onClick={() => route('/tokens')}>← Back</button>
        </div>
        <p class={styles.loading}>Loading token...</p>
      </div>
    );
  }

  if (error || !token) {
    return (
      <div class={styles.page}>
        <div class={styles.backRow}>
          <button class={styles.backBtn} onClick={() => route('/tokens')}>← Back</button>
        </div>
        <p class={styles.error}>{error || 'Token not found'}</p>
      </div>
    );
  }

  const status = getTokenStatus(token);

  return (
    <div class={styles.page}>
      <div class={styles.backRow}>
        <button class={styles.backBtn} onClick={() => route('/tokens')}>← Back</button>
        {status === 'active' && (
          <button class={styles.revokeBtn} onClick={() => setShowRevoke(true)}>Revoke</button>
        )}
      </div>

      <h2 class={styles.title}>Token #{token.id}</h2>

      <div class={styles.card}>
        <dl class={styles.fields}>
          <Field label="ID" value={String(token.id)} />
          <Field label="User ID" value={token.userId} copyable />
          <Field label="App Name" value={token.app?.name || '—'} />
          <Field label="Token Prefix" value={token.tokenPrefix || '—'} mono copyable={!!token.tokenPrefix} />
          <div class={styles.fieldRow}>
            <dt class={styles.fieldLabel}>Status</dt>
            <dd class={styles.fieldValue}><StatusBadge status={status} /></dd>
          </div>
          <Field label="Expires At" value={formatTimestamp(token.expiresAt)} />
          <Field label="Last Verified At" value={formatTimestamp(token.lastVerifiedAt)} />
          <Field label="Revoked At" value={formatTimestamp(token.revokedAt)} />
          <Field label="Created At" value={formatTimestamp(token.createdAt)} />
          <Field label="Updated At" value={formatTimestamp(token.updatedAt)} />
        </dl>

        <div class={styles.metadataSection}>
          <h3 class={styles.sectionTitle}>Metadata</h3>
          <MetadataViewer data={token.metadata} />
        </div>
      </div>

      <Modal
        open={showRevoke}
        onClose={() => setShowRevoke(false)}
        title="Revoke Token"
        actions={
          <>
            <button class={styles.cancelBtn} onClick={() => setShowRevoke(false)}>Cancel</button>
            <button class={styles.confirmBtn} onClick={handleRevoke} disabled={revoking}>
              {revoking ? 'Revoking...' : 'Revoke'}
            </button>
          </>
        }
      >
        <p>
          Are you sure you want to revoke token <strong>#{token.id}</strong> for user{' '}
          <strong>{token.userId}</strong>?
        </p>
        <p class={styles.revokeWarning}>This action cannot be undone.</p>
      </Modal>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  copyable,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  return (
    <div class={styles.fieldRow}>
      <dt class={styles.fieldLabel}>{label}</dt>
      <dd class={`${styles.fieldValue} ${mono ? styles.mono : ''}`}>
        {value}
        {copyable && value !== '—' && (
          <button class={styles.copyBtn} onClick={() => copyToClipboard(value)} title="Copy">
            📋
          </button>
        )}
      </dd>
    </div>
  );
}
