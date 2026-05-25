import { useState, useMemo } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { listTokens, revokeToken } from '@/api/tokens';
import type { TokenRecord, TokenListParams } from '@/api/tokens';
import { listApps } from '@/api/apps';
import { useQuery } from '@/lib/use-query';
import { useDebounce } from '@/lib/use-debounce';
import { relativeTime } from '@/lib/relative-time';
import { DataTable } from '@/components/table/data-table';
import type { Column } from '@/components/table/data-table';
import { Pagination } from '@/components/pagination/pagination';
import { SearchInput } from '@/components/search-input';
import { StatusBadge } from '@/components/status-badge';
import { Modal } from '@/components/modal';
import { showToast } from '@/components/toast';
import styles from './token-list.module.css';

type StatusFilter = 'all' | 'active' | 'expired' | 'revoked';

function getTokenStatus(t: TokenRecord): 'active' | 'expired' | 'revoked' {
  if (t.revokedAt) return 'revoked';
  if (t.expiresAt && new Date(t.expiresAt) <= new Date()) return 'expired';
  return 'active';
}

function parseQuery(search: string) {
  const p = new URLSearchParams(search);
  return {
    userId: p.get('userId') || '',
    appName: p.get('appName') || '',
    status: (p.get('status') || 'all') as StatusFilter,
    page: Math.max(1, parseInt(p.get('page') || '1', 10) || 1),
  };
}

function buildSearch(filters: { userId: string; appName: string; status: StatusFilter; page: number }) {
  const p = new URLSearchParams();
  if (filters.userId) p.set('userId', filters.userId);
  if (filters.appName) p.set('appName', filters.appName);
  if (filters.status !== 'all') p.set('status', filters.status);
  if (filters.page > 1) p.set('page', String(filters.page));
  const s = p.toString();
  return s ? `?${s}` : '';
}

const LIMIT = 50;

export function TokenListPage() {
  const { url, route } = useLocation();
  const search = url.includes('?') ? url.slice(url.indexOf('?')) : '';
  const q = parseQuery(search);

  const [userIdInput, setUserIdInput] = useState(q.userId);
  const debouncedUserId = useDebounce(userIdInput, 300);

  const [revokeTarget, setRevokeTarget] = useState<TokenRecord | null>(null);
  const [revoking, setRevoking] = useState(false);

  const params: TokenListParams = {
    userId: debouncedUserId || undefined,
    appName: q.appName || undefined,
    status: q.status === 'all' ? undefined : q.status,
    page: q.page,
    limit: LIMIT,
  };

  const { data: tokenData, loading, refetch } = useQuery(
    () => listTokens(params),
    [debouncedUserId, q.appName, q.status, q.page],
  );

  const { data: apps } = useQuery(() => listApps(), []);

  const navigate = (overrides: Partial<typeof q>) => {
    const next = { ...q, ...overrides };
    // reset page to 1 when filters change
    if ('userId' in overrides || 'appName' in overrides || 'status' in overrides) {
      next.page = 1;
    }
    route(`/tokens${buildSearch(next)}`);
  };

  const handleRowClick = (row: TokenRecord) => {
    route(`/tokens/${row.id}`);
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await revokeToken(revokeTarget.id);
      showToast('success', `Token #${revokeTarget.id} revoked`);
      setRevokeTarget(null);
      refetch();
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Revoke failed';
      showToast('error', msg);
    } finally {
      setRevoking(false);
    }
  };

  const columns: Column<TokenRecord>[] = useMemo(() => [
    { key: 'id', header: 'ID', width: '60px', render: (t) => t.id },
    {
      key: 'userId',
      header: 'User ID',
      render: (t) => (
        <span class={styles.truncate} title={t.userId}>{t.userId}</span>
      ),
    },
    { key: 'app', header: 'App', render: (t) => t.app?.name || '—' },
    {
      key: 'tokenPrefix',
      header: 'Token Prefix',
      mono: true,
      render: (t) => t.tokenPrefix || '—',
    },
    {
      key: 'status',
      header: 'Status',
      width: '90px',
      render: (t) => <StatusBadge status={getTokenStatus(t)} />,
    },
    {
      key: 'expiresAt',
      header: 'Expires',
      render: (t) => relativeTime(t.expiresAt),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (t) => relativeTime(t.createdAt),
    },
    {
      key: 'actions',
      header: '',
      width: '80px',
      align: 'right',
      render: (t) => {
        const status = getTokenStatus(t);
        if (status !== 'active') return null;
        return (
          <button
            class={styles.revokeBtn}
            onClick={(e) => {
              e.stopPropagation();
              setRevokeTarget(t);
            }}
          >
            Revoke
          </button>
        );
      },
    },
  ], []);

  const tokens = tokenData?.data || [];
  const total = tokenData?.total || 0;

  return (
    <div class={styles.page}>
      <h2 class={styles.title}>Tokens</h2>

      <div class={styles.toolbar}>
        <SearchInput
          value={userIdInput}
          onInput={(v) => {
            setUserIdInput(v);
            navigate({ userId: v });
          }}
          placeholder="Search by User ID..."
        />

        <select
          class={styles.select}
          value={q.appName}
          onChange={(e) => navigate({ appName: (e.target as HTMLSelectElement).value })}
        >
          <option value="">All Apps</option>
          {(apps || []).map((a) => (
            <option key={a.id} value={a.name}>{a.name}</option>
          ))}
        </select>

        <select
          class={styles.select}
          value={q.status}
          onChange={(e) => navigate({ status: (e.target as HTMLSelectElement).value as StatusFilter })}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
        </select>

        <button class={styles.refreshBtn} onClick={refetch} title="Refresh">
          ↻
        </button>
      </div>

      <DataTable
        columns={columns}
        data={tokens}
        loading={loading}
        onRowClick={handleRowClick}
        emptyMessage="No tokens found"
      />

      {total > LIMIT && (
        <Pagination
          page={q.page}
          limit={LIMIT}
          total={total}
          onPageChange={(p) => navigate({ page: p })}
        />
      )}

      <Modal
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        title="Revoke Token"
        actions={
          <>
            <button class={styles.cancelBtn} onClick={() => setRevokeTarget(null)}>
              Cancel
            </button>
            <button class={styles.confirmBtn} onClick={handleRevoke} disabled={revoking}>
              {revoking ? 'Revoking...' : 'Revoke'}
            </button>
          </>
        }
      >
        <p>
          Are you sure you want to revoke token <strong>#{revokeTarget?.id}</strong> for user{' '}
          <strong>{revokeTarget?.userId}</strong>?
        </p>
        <p class={styles.revokeWarning}>This action cannot be undone.</p>
      </Modal>
    </div>
  );
}
