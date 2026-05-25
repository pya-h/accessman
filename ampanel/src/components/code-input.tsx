import styles from './code-input.module.css';

interface CodeInputProps {
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
}

export function CodeInput({ value, onInput, placeholder }: CodeInputProps) {
  return (
    <div class={styles.wrapper}>
      <textarea
        class={styles.textarea}
        value={value}
        onInput={(e) => onInput((e.target as HTMLTextAreaElement).value)}
        placeholder={placeholder}
        spellcheck={false}
      />
    </div>
  );
}
