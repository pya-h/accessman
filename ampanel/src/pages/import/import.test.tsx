import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { ImportPage } from './import';

const mockRoute = vi.fn();
vi.mock('preact-iso', () => ({
  useLocation: () => ({ route: mockRoute, url: '/import' }),
}));

const mockImportTokens = vi.fn();
vi.mock('@/api/import', () => ({
  importTokens: (...args: unknown[]) => mockImportTokens(...args),
}));

const mockListApps = vi.fn();
vi.mock('@/api/apps', () => ({
  listApps: (...args: unknown[]) => mockListApps(...args),
}));

const mockShowToast = vi.fn();
vi.mock('@/components/toast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockListApps.mockResolvedValue([
    { id: 1, name: 'myapp', isActive: true, createdAt: '2025-01-01T00:00:00Z' },
  ]);
});

describe('ImportPage', () => {
  it('validates empty content', async () => {
    render(<ImportPage />);

    // Submit with empty content — button should be disabled
    const btn = screen.getByRole('button', { name: /import tokens/i });
    expect(btn).toBeDisabled();
  });

  it('validates invalid JSON', async () => {
    render(<ImportPage />);

    const textarea = screen.getByPlaceholderText(/paste json/i);
    // Starts with [ so auto-detects as JSON, but is invalid
    fireEvent.input(textarea, { target: { value: '[invalid json' } });

    fireEvent.click(screen.getByRole('button', { name: /import tokens/i }));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('error', 'Invalid JSON');
    });
    expect(mockImportTokens).not.toHaveBeenCalled();
  });

  it('validates JSON must be array', async () => {
    render(<ImportPage />);

    const textarea = screen.getByPlaceholderText(/paste json/i);
    fireEvent.input(textarea, { target: { value: '{"not": "array"}' } });

    fireEvent.click(screen.getByRole('button', { name: /import tokens/i }));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('error', 'JSON must be an array');
    });
  });

  it('validates CSV must have header + data', async () => {
    render(<ImportPage />);

    const textarea = screen.getByPlaceholderText(/paste json/i);
    fireEvent.input(textarea, { target: { value: 'userId,appName' } });

    // Switch format to CSV
    const formatSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(formatSelect, { target: { value: 'csv' } });

    fireEvent.click(screen.getByRole('button', { name: /import tokens/i }));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('error', 'CSV must have a header row and at least one data row');
    });
  });

  it('imports JSON via paste and navigates to results', async () => {
    const result = {
      imported: [{ userId: 'u1', appName: 'myapp', token: 'myapp_ABC123', expiresAt: '2026-01-01' }],
      errors: [],
    };
    mockImportTokens.mockResolvedValue(result);

    render(<ImportPage />);

    const textarea = screen.getByPlaceholderText(/paste json/i);
    fireEvent.input(textarea, { target: { value: '[{"userId":"u1","appName":"myapp"}]' } });

    fireEvent.click(screen.getByRole('button', { name: /import tokens/i }));

    await waitFor(() => {
      expect(mockImportTokens).toHaveBeenCalledWith(
        [{ userId: 'u1', appName: 'myapp' }],
        'json',
        'import',
        undefined,
      );
    });
    expect(mockRoute).toHaveBeenCalledWith('/import/results');
  });

  it('calls correct endpoint for single-app scope', async () => {
    mockImportTokens.mockResolvedValue({ imported: [], errors: [] });

    render(<ImportPage />);

    await waitFor(() => {
      // Wait for apps to load
      expect(mockListApps).toHaveBeenCalled();
    });

    const textarea = screen.getByPlaceholderText(/paste json/i);
    fireEvent.input(textarea, { target: { value: '[{"userId":"u1"}]' } });

    // Switch scope to single app
    const scopeSelect = screen.getAllByRole('combobox')[2];
    fireEvent.change(scopeSelect, { target: { value: 'single' } });

    await waitFor(() => {
      expect(screen.getByText('myapp')).toBeInTheDocument();
    });

    // Select app
    const appSelect = screen.getAllByRole('combobox')[3];
    fireEvent.change(appSelect, { target: { value: 'myapp' } });

    fireEvent.click(screen.getByRole('button', { name: /import tokens/i }));

    await waitFor(() => {
      expect(mockImportTokens).toHaveBeenCalledWith(
        [{ userId: 'u1' }],
        'json',
        'import',
        'myapp',
      );
    });
  });

  it('uses reissue mode when selected', async () => {
    mockImportTokens.mockResolvedValue({ imported: [], errors: [] });

    render(<ImportPage />);

    const textarea = screen.getByPlaceholderText(/paste json/i);
    fireEvent.input(textarea, { target: { value: '[{"userId":"u1","appName":"myapp"}]' } });

    // Switch to reissue mode
    const modeSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(modeSelect, { target: { value: 'reissue' } });

    fireEvent.click(screen.getByRole('button', { name: /reissue tokens/i }));

    await waitFor(() => {
      expect(mockImportTokens).toHaveBeenCalledWith(
        [{ userId: 'u1', appName: 'myapp' }],
        'json',
        'reissue',
        undefined,
      );
    });
  });

  it('auto-detects CSV format from pasted content', async () => {
    mockImportTokens.mockResolvedValue({ imported: [], errors: [] });

    render(<ImportPage />);

    const textarea = screen.getByPlaceholderText(/paste json/i);
    fireEvent.input(textarea, { target: { value: 'userId,appName\nu1,myapp' } });

    // Format should auto-detect to CSV
    const formatSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    expect(formatSelect.value).toBe('csv');

    fireEvent.click(screen.getByRole('button', { name: /import tokens/i }));

    await waitFor(() => {
      expect(mockImportTokens).toHaveBeenCalledWith(
        'userId,appName\nu1,myapp',
        'csv',
        'import',
        undefined,
      );
    });
  });

  it('shows error toast on import failure', async () => {
    mockImportTokens.mockRejectedValue({ message: 'Server error' });

    render(<ImportPage />);

    const textarea = screen.getByPlaceholderText(/paste json/i);
    fireEvent.input(textarea, { target: { value: '[{"userId":"u1","appName":"myapp"}]' } });

    fireEvent.click(screen.getByRole('button', { name: /import tokens/i }));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('error', 'Server error');
    });
    expect(mockRoute).not.toHaveBeenCalled();
  });

  it('shows upload tab with drop zone', () => {
    render(<ImportPage />);

    fireEvent.click(screen.getByText('Upload'));

    expect(screen.getByText(/drop a .json or .csv file here/i)).toBeInTheDocument();
    expect(screen.getByText(/or click to browse/i)).toBeInTheDocument();
  });
});
