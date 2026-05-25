import { useState } from 'preact/hooks';
import styles from './json-viewer.module.css';

interface JsonViewerProps {
  data: unknown;
}

export function JsonViewer({ data }: JsonViewerProps) {
  return (
    <div class={styles.viewer}>
      <JsonNode value={data} depth={0} />
    </div>
  );
}

function JsonNode({ value, depth }: { value: unknown; depth: number }) {
  if (value === null) return <span class={styles.null}>null</span>;
  if (value === undefined) return <span class={styles.null}>undefined</span>;

  if (typeof value === 'string') return <span class={styles.string}>"{value}"</span>;
  if (typeof value === 'number') return <span class={styles.number}>{value}</span>;
  if (typeof value === 'boolean') return <span class={styles.boolean}>{String(value)}</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span class={styles.bracket}>[]</span>;
    return <CollapsibleNode label={`Array(${value.length})`} open={depth < 2}>
      {value.map((item, i) => (
        <div key={i} class={styles.entry}>
          <span class={styles.key}>{i}</span>
          <span class={styles.colon}>: </span>
          <JsonNode value={item} depth={depth + 1} />
        </div>
      ))}
    </CollapsibleNode>;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span class={styles.bracket}>{'{}'}</span>;
    return <CollapsibleNode label={`{${entries.length}}`} open={depth < 2}>
      {entries.map(([k, v]) => (
        <div key={k} class={styles.entry}>
          <span class={styles.key}>{k}</span>
          <span class={styles.colon}>: </span>
          <JsonNode value={v} depth={depth + 1} />
        </div>
      ))}
    </CollapsibleNode>;
  }

  return <span>{String(value)}</span>;
}

function CollapsibleNode({
  label,
  open: defaultOpen,
  children,
}: {
  label: string;
  open: boolean;
  children: preact.ComponentChildren;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <span>
      <button class={styles.toggle} onClick={() => setOpen(!open)}>
        {open ? '▼' : '▶'} {label}
      </button>
      {open && <div class={styles.nested}>{children}</div>}
    </span>
  );
}
