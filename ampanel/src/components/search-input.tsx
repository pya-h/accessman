import styles from './search-input.module.css';

interface SearchInputProps {
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onInput, placeholder }: SearchInputProps) {
  return (
    <div class={styles.wrapper}>
      <span class={styles.icon}>🔍</span>
      <input
        type="text"
        class={styles.input}
        value={value}
        onInput={(e) => onInput((e.target as HTMLInputElement).value)}
        placeholder={placeholder || 'Search...'}
      />
      {value && (
        <button
          class={styles.clear}
          onClick={() => onInput('')}
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
}
