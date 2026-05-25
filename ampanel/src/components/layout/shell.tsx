import { useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import type { ComponentChildren } from 'preact';
import { useAuth } from '@/auth/auth-context';
import styles from './shell.module.css';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/tokens', label: 'Tokens', icon: '🔑' },
  { path: '/apps', label: 'Apps', icon: '📦' },
  { path: '/import', label: 'Import', icon: '📥' },
  { path: '/settings', label: 'Settings', icon: '⚙' },
];

function isActive(current: string, target: string): boolean {
  if (target === '/tokens') return current === '/' || current.startsWith('/tokens');
  return current.startsWith(target);
}

export function Shell({ children }: { children: ComponentChildren }) {
  const { logout } = useAuth();
  const { url, route } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigate = (path: string) => {
    route(path);
    setSidebarOpen(false);
  };

  const handleLogout = () => {
    logout();
    route('/login', true);
  };

  const currentPath = url.split('?')[0];

  return (
    <div class={styles.shell}>
      {/* Mobile toggle */}
      <button
        class={styles.toggleBtn}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Overlay */}
      <div
        class={`${styles.overlay} ${sidebarOpen ? styles.overlayVisible : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside class={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div class={styles.logo}>AccessMan</div>
        <nav class={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              class={`${styles.navLink} ${isActive(currentPath, item.path) ? styles.navLinkActive : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span class={styles.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div class={styles.sidebarFooter}>
          <button class={styles.logoutBtn} onClick={handleLogout}>
            <span class={styles.navIcon}>🚪</span>
            Logout
          </button>
        </div>
      </aside>

      {/* Content */}
      <main class={styles.content}>
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav class={styles.bottomNav}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.path}
            class={`${styles.bottomNavItem} ${isActive(currentPath, item.path) ? styles.bottomNavItemActive : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
