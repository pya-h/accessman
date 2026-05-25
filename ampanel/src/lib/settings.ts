export interface Settings {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  tableDensity: 'compact' | 'default' | 'comfortable';
}

const DEFAULTS: Settings = {
  theme: 'system',
  fontSize: 'medium',
  tableDensity: 'default',
};

const STORAGE_KEY = 'am_settings';

const FONT_SIZE_MAP: Record<Settings['fontSize'], string> = {
  small: '13px',
  medium: '14px',
  large: '16px',
};

const TABLE_DENSITY_MAP: Record<Settings['tableDensity'], string> = {
  compact: '6px',
  default: '10px',
  comfortable: '14px',
};

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
}
