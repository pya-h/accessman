import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { AppListPage } from './app-list';

const mockListApps = vi.fn();
const mockCreateApp = vi.fn();
vi.mock('@/api/apps', () => ({
  listApps: (...args: unknown[]) => mockListApps(...args),
  createApp: (...args: unknown[]) => mockCreateApp(...args),
}));

const mockShowToast = vi.fn();
vi.mock('@/components/toast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AppListPage', () => {
  it('renders app list in table', async () => {
    mockListApps.mockResolvedValue([
      { id: 1, name: 'myapp', isActive: true, createdAt: '2025-01-01T00:00:00Z' },
      { id: 2, name: 'otherapp', isActive: false, createdAt: '2025-02-01T00:00:00Z' },
    ]);

    render(<AppListPage />);

    await waitFor(() => {
      expect(screen.getByText('myapp')).toBeInTheDocument();
    });
    expect(screen.getByText('otherapp')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('revoked')).toBeInTheDocument();
  });

  it('shows empty state when no apps exist', async () => {
    mockListApps.mockResolvedValue([]);

    render(<AppListPage />);

    await waitFor(() => {
      expect(screen.getByText('No apps registered')).toBeInTheDocument();
    });
  });

  it('registers a new app on form submit', async () => {
    mockListApps.mockResolvedValue([]);
    mockCreateApp.mockResolvedValue({ id: 1, name: 'newapp', isActive: true, createdAt: '2025-01-01T00:00:00Z' });

    render(<AppListPage />);

    await waitFor(() => {
      expect(screen.getByText('No apps registered')).toBeInTheDocument();
    });

    // Open form
    fireEvent.click(screen.getByText('+ Register App'));

    // Fill and submit
    const input = screen.getByPlaceholderText('App name');
    fireEvent.input(input, { target: { value: 'newapp' } });
    fireEvent.click(screen.getByText('Register'));

    await waitFor(() => {
      expect(mockCreateApp).toHaveBeenCalledWith('newapp');
    });
    expect(mockShowToast).toHaveBeenCalledWith('success', 'App "newapp" registered');
  });

  it('shows error toast on 409 duplicate', async () => {
    mockListApps.mockResolvedValue([
      { id: 1, name: 'myapp', isActive: true, createdAt: '2025-01-01T00:00:00Z' },
    ]);
    mockCreateApp.mockRejectedValue({ status: 409, message: 'App already exists' });

    render(<AppListPage />);

    await waitFor(() => {
      expect(screen.getByText('myapp')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('+ Register App'));

    const input = screen.getByPlaceholderText('App name');
    fireEvent.input(input, { target: { value: 'myapp' } });
    fireEvent.click(screen.getByText('Register'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('error', 'App already exists');
    });
  });
});
