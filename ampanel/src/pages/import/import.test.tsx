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

    // Switch format to CSV via toggle button
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));

    const textarea = screen.getByPlaceholderText(/paste csv/i);
    fireEvent.input(textarea, { target: { value: 'userId,appName' } });

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

    // Switch scope to single app — click trigger, then option
    fireEvent.click(screen.getByRole('button', { name: 'All apps (per-row)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Single app' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /select app/i })).toBeInTheDocument();
    });

    // Select app
    fireEvent.click(screen.getByRole('button', { name: /select app/i }));
    fireEvent.click(screen.getByRole('button', { name: 'myapp' }));

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

    // Switch to reissue mode — click trigger, then option
    fireEvent.click(screen.getByRole('button', { name: 'Import (new tokens)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reissue (revoke + new)' }));

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

  it('switches format to CSV and imports CSV content', async () => {
    mockImportTokens.mockResolvedValue({ imported: [], errors: [] });

    render(<ImportPage />);

    // Switch to CSV format
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));

    const textarea = screen.getByPlaceholderText(/paste csv/i);
    fireEvent.input(textarea, { target: { value: 'userId,appName\nu1,myapp' } });

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

  it('converts JSON to CSV when switching format', async () => {
    render(<ImportPage />);

    const textarea = screen.getByPlaceholderText(/paste json/i);
    fireEvent.input(textarea, { target: { value: '[{"userId":"u1","appName":"myapp"}]' } });

    // Switch to CSV — should auto-convert
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('success', 'Converted to CSV');
    });
  });

  describe('Add Row', () => {
    it('populates an empty JSON box (regression: empty box used to drop the row)', async () => {
      render(<ImportPage />);

      fireEvent.click(screen.getByRole('button', { name: /add row/i }));
      fireEvent.input(screen.getByPlaceholderText('user-123'), { target: { value: 'u1' } });
      fireEvent.input(screen.getByPlaceholderText('myapp'), { target: { value: 'app1' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText(/paste json/i) as HTMLTextAreaElement;
        expect(textarea.value).toContain('"userId": "u1"');
        expect(textarea.value).toContain('"appName": "app1"');
      });
    });

    it('populates an empty CSV box', async () => {
      render(<ImportPage />);

      fireEvent.click(screen.getByRole('button', { name: 'CSV' }));
      fireEvent.click(screen.getByRole('button', { name: /add row/i }));
      fireEvent.input(screen.getByPlaceholderText('user-123'), { target: { value: 'u9' } });
      fireEvent.input(screen.getByPlaceholderText('myapp'), { target: { value: 'app9' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));

      await waitFor(() => {
        const textarea = screen.getByPlaceholderText(/paste csv/i) as HTMLTextAreaElement;
        expect(textarea.value).toContain('userId,appName');
        expect(textarea.value).toContain('u9,app9');
      });
    });

    it('appends a row to existing JSON content', async () => {
      render(<ImportPage />);

      const textarea = screen.getByPlaceholderText(/paste json/i);
      fireEvent.input(textarea, {
        target: { value: '[{"userId":"first","appName":"app1"}]' },
      });

      fireEvent.click(screen.getByRole('button', { name: /add row/i }));
      fireEvent.input(screen.getByPlaceholderText('user-123'), { target: { value: 'second' } });
      fireEvent.input(screen.getByPlaceholderText('myapp'), { target: { value: 'app2' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));

      await waitFor(() => {
        const ta = screen.getByPlaceholderText(/paste json/i) as HTMLTextAreaElement;
        expect(ta.value).toContain('first');
        expect(ta.value).toContain('second');
      });
    });
  });
});
