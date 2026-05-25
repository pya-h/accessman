import { IconInbox } from '@/components/icons';
import styles from './empty-state.module.css';

interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div class={styles.wrapper}>
      <div class={styles.iconCircle}>
        <IconInbox size={28} />
      </div>
      <p class={styles.message}>{message}</p>
      {actionLabel && onAction && (
        <button class={styles.action} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
