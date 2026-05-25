import { useState, useMemo, useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { listTokens, revokeToken } from '@/api/tokens';
import type { TokenRecord, TokenListParams, SortableField } from '@/api/tokens';
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
import { CustomSelect } from '@/components/custom-select';
import { IconRefresh, IconSortAsc } from '@/components/icons';
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
    tokenPrefix: p.get('tokenPrefix') || '',
    appName: p.get('appName') || '',
    status: (p.get('status') || 'all') as StatusFilter,
    sortBy: (p.get('sortBy') || 'createdAt') as SortableField,
    sortOrder: (p.get('sortOrder') || 'DESC') as 'ASC' | 'DESC',
    page: Math.max(1, parseInt(p.get('page') || '1', 10) || 1),
  };
}

function buildSearch(filters: ReturnType<typeof parseQuery>) {
  const p = new URLSearchParams();
  if (filters.userId) p.set('userId', filters.userId);
  if (filters.tokenPrefix) p.set('tokenPrefix', filters.tokenPrefix);
  if (filters.appName) p.set('appName', filters.appName);
  if (filters.status !== 'all') p.set('status', filters.status);
  if (filters.sortBy !== 'createdAt') p.set('sortBy', filters.sortBy);
  if (filters.sortOrder !== 'DESC') p.set('sortOrder', filters.sortOrder);
  if (filters.page > 1) p.set('page', String(filters.page));
  const s = p.toString();
  return s ? `?${s}` : '';
}

const SORT_OPTIONS: { value: SortableField; label: string }[] = [
  { value: 'createdAt', label: 'Created' },
  { value: 'userId', label: 'User ID' },
  { value: 'appName', label: 'App Name' },
  { value: 'tokenPrefix', label: 'Token' },
  { value: 'expiresAt', label: 'Expires' },
];

const LIMIT = 50;

export function TokenListPage() {
  const { url, route } = useLocation();
  const search = url.includes('?') ? url.slice(url.indexOf('?')) : '';
  const q = parseQuery(search);

  const [userIdInput, setUserIdInput] = useState(q.userId);
  const debouncedUserId = useDebounce(userIdInput, 300);

  const [prefixInput, setPrefixInput] = useState(q.tokenPrefix);
  const debouncedPrefix = useDebounce(prefixInput, 300);

  const [revokeTarget, setRevokeTarget] = useState<TokenRecord | null>(null);
  const [revoking, setRevoking] = useState(false);

  const params: TokenListParams = {
    userId: debouncedUserId || undefined,
    tokenPrefix: debouncedPrefix || undefined,
    appName: q.appName || undefined,
    status: q.status === 'all' ? undefined : q.status,
    sortBy: q.sortBy,
    sortOrder: q.sortOrder,
    page: q.page,
    limit: LIMIT,
  };

  const { data: tokenData, loading, refetch } = useQuery(
    () => listTokens(params),
    [debouncedUserId, debouncedPrefix, q.appName, q.status, q.sortBy, q.sortOrder, q.page],
  );

  const { data: apps } = useQuery(() => listApps(), []);

  // Sync debounced inputs to URL (replaceState to avoid history pollution)
  useEffect(() => {
    if (debouncedUserId !== q.userId || debouncedPrefix !== q.tokenPrefix) {
      route(`/tokens${buildSearch({ ...q, userId: debouncedUserId, tokenPrefix: debouncedPrefix, page: 1 })}`, true);
    }
  }, [debouncedUserId, debouncedPrefix]);

  const navigate = (overrides: Partial<typeof q>) => {
    const next = { ...q, ...overrides };
    if ('appName' in overrides || 'status' in overrides) {
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

  const toggleSortOrder = () => {
    navigate({ sortOrder: q.sortOrder === 'ASC' ? 'DESC' : 'ASC', page: 1 });
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
        <div class={styles.toolbarSearch}>
          <SearchInput
            value={userIdInput}
            onInput={setUserIdInput}
            placeholder="Search User ID..."
          />
          <SearchInput
            value={prefixInput}
            onInput={setPrefixInput}
            placeholder="Search Token Prefix..."
          />
        </div>

        <div class={styles.toolbarControls}>
          <CustomSelect
            value={q.appName}
            options={[
              { value: '', label: 'All Apps' },
              ...(apps || []).map((a) => ({ value: a.name, label: a.name })),
            ]}
            onChange={(v) => navigate({ appName: v })}
          />

          <CustomSelect
            value={q.status}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'active', label: 'Active' },
              { value: 'expired', label: 'Expired' },
              { value: 'revoked', label: 'Revoked' },
            ]}
            onChange={(v) => navigate({ status: v as StatusFilter })}
          />

          <div class={styles.sortGroup}>
            <CustomSelect
              value={q.sortBy}
              triggerClass={styles.sortSelect}
              options={SORT_OPTIONS.map((o) => ({ value: o.value, label: `Sort: ${o.label}` }))}
              onChange={(v) => navigate({ sortBy: v as SortableField, page: 1 })}
            />
            <button
              class={`${styles.dirBtn} ${q.sortOrder === 'ASC' ? styles.dirBtnAsc : styles.dirBtnDesc}`}
              onClick={toggleSortOrder}
              title={q.sortOrder === 'ASC' ? 'Ascending — click for descending' : 'Descending — click for ascending'}
            >
              <IconSortAsc size={15} />
            </button>
          </div>

          <button class={styles.refreshBtn} onClick={refetch} title="Refresh">
            <IconRefresh size={16} />
          </button>
        </div>
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
