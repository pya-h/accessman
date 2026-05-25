import styles from './status-badge.module.css';

type Status = 'active' | 'expired' | 'revoked';

interface StatusBadgeProps {
  status: Status;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span class={`${styles.badge} ${styles[status]}`}>
      {status}
    </span>
  );
}
