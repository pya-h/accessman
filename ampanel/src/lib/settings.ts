export interface Settings {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  tableDensity: 'compact' | 'default' | 'comfortable';
  accentColor: string;
  borderRadius: 'sharp' | 'default' | 'round';
}

const DEFAULTS: Settings = {
  theme: 'system',
  fontSize: 'medium',
  tableDensity: 'default',
  accentColor: '#2563eb',
  borderRadius: 'default',
};

const STORAGE_KEY = 'am_settings';

const FONT_SIZE_MAP: Record<Settings['fontSize'], string> = {
  small: '13px',
  medium: '14px',
  large: '16px',
  xlarge: '18px',
};

const TABLE_DENSITY_MAP: Record<Settings['tableDensity'], string> = {
  compact: '6px',
  default: '10px',
  comfortable: '14px',
};

const BORDER_RADIUS_MAP: Record<Settings['borderRadius'], [string, string, string]> = {
  sharp: ['4px', '6px', '8px'],
  default: ['8px', '12px', '16px'],
  round: ['14px', '18px', '24px'],
};

export const ACCENT_PRESETS = [
  { name: 'Blue', value: '#2563eb' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Teal', value: '#0d9488' },
  { name: 'Emerald', value: '#059669' },
  { name: 'Amber', value: '#d97706' },
  { name: 'Rose', value: '#e11d48' },
  { name: 'Slate', value: '#475569' },
] as const;

function hoverColor(hex: string): string {
  // Darken for light theme, lighten for dark — we darken by 15% universally
  // and let the dark theme override use a brighter variant via color-mix
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const darken = (v: number) => Math.max(0, Math.round(v * 0.82));
  return `#${darken(r).toString(16).padStart(2, '0')}${darken(g).toString(16).padStart(2, '0')}${darken(b).toString(16).padStart(2, '0')}`;
}

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setSettings(partial: Partial<Settings>): void {
  const current = getSettings();
  const updated = { ...current, ...partial };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function applySettings(settings: Settings): void {
  const root = document.documentElement;

  // Theme
  if (settings.theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.dataset.theme = settings.theme;
  }

  // Font size
  root.style.setProperty('--font-size-base', FONT_SIZE_MAP[settings.fontSize]);

  // Table density
  root.style.setProperty('--table-density', TABLE_DENSITY_MAP[settings.tableDensity]);

  // Accent color
  const accent = settings.accentColor || DEFAULTS.accentColor;
  root.style.setProperty('--color-accent', accent);
  root.style.setProperty('--color-accent-hover', hoverColor(accent));
  root.style.setProperty('--color-accent-subtle', `color-mix(in srgb, ${accent} 10%, transparent)`);
  root.style.setProperty('--shadow-glow', `0 0 0 3px color-mix(in srgb, ${accent} 15%, transparent)`);

  // Border radius
  const [br, brLg, brXl] = BORDER_RADIUS_MAP[settings.borderRadius] || BORDER_RADIUS_MAP.default;
  root.style.setProperty('--border-radius', br);
  root.style.setProperty('--border-radius-lg', brLg);
  root.style.setProperty('--border-radius-xl', brXl);
}
