import { useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import type { ComponentChildren, JSX } from 'preact';
import { useAuth } from '@/auth/auth-context';
import { IconKey, IconBox, IconImport, IconSettings, IconLogout, IconMenu, IconX } from '@/components/icons';
import styles from './shell.module.css';

interface NavItem {
  path: string;
  label: string;
  icon: () => JSX.Element;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/tokens', label: 'Tokens', icon: () => <IconKey size={18} /> },
  { path: '/apps', label: 'Apps', icon: () => <IconBox size={18} /> },
  { path: '/import', label: 'Import', icon: () => <IconImport size={18} /> },
  { path: '/settings', label: 'Settings', icon: () => <IconSettings size={18} /> },
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
        {sidebarOpen ? <IconX size={20} /> : <IconMenu size={20} />}
      </button>

      {/* Overlay */}
      <div
        class={`${styles.overlay} ${sidebarOpen ? styles.overlayVisible : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside class={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div class={styles.logoWrap}>
          <span class={styles.logoDot} />
          <span class={styles.logoText}>AccessMan</span>
          <span class={styles.logoVersion}>v1</span>
        </div>
        <nav class={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              class={`${styles.navLink} ${isActive(currentPath, item.path) ? styles.navLinkActive : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span class={styles.navIcon}>{item.icon()}</span>
              {item.label}
            </button>
          ))}
        </nav>
        <div class={styles.sidebarFooter}>
          <button class={styles.logoutBtn} onClick={handleLogout}>
            <span class={styles.navIcon}><IconLogout size={18} /></span>
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
            <span class={styles.bottomNavIcon}>{item.icon()}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
