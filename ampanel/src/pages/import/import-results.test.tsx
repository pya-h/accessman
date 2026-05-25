import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';

// Must set lastImportResult before importing the component
// We do this by importing the setter from the import page module
let mockLastResult: unknown = null;
vi.mock('./import', () => ({
  getLastImportResult: () => {
    const r = mockLastResult;
    mockLastResult = null;
    return r;
  },
}));

const mockRoute = vi.fn();
vi.mock('preact-iso', () => ({
  useLocation: () => ({ route: mockRoute, url: '/import/results' }),
}));

const mockShowToast = vi.fn();
vi.mock('@/components/toast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}));

// Mock csv-export
const mockDownloadCsv = vi.fn();
vi.mock('@/lib/csv-export', () => ({
  downloadCsv: (...args: unknown[]) => mockDownloadCsv(...args),
}));

import { ImportResultsPage } from './import-results';

beforeEach(() => {
  vi.clearAllMocks();
  mockLastResult = null;

  // Mock clipboard
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe('ImportResultsPage', () => {
  it('redirects to /import when no result state', () => {
    mockLastResult = null;
    render(<ImportResultsPage />);
    expect(mockRoute).toHaveBeenCalledWith('/import', true);
  });

  it('renders imported tokens table', () => {
    mockLastResult = {
      imported: [
        { userId: 'u1', appName: 'myapp', token: 'myapp_ABC123', expiresAt: '2026-01-01' },
        { userId: 'u2', appName: 'myapp', token: 'myapp_DEF456', expiresAt: '2026-02-01' },
      ],
      errors: [],
    };

    render(<ImportResultsPage />);

    expect(screen.getByText(/these tokens are shown only once/i)).toBeInTheDocument();
    expect(screen.getByText('Imported Tokens (2)')).toBeInTheDocument();
    expect(screen.getByText('u1')).toBeInTheDocument();
    expect(screen.getByText('u2')).toBeInTheDocument();
    expect(screen.getByText('myapp_ABC123')).toBeInTheDocument();
    expect(screen.getByText('myapp_DEF456')).toBeInTheDocument();
  });

  it('renders errors section with reasons', () => {
    mockLastResult = {
      imported: [],
      errors: [
        { userId: 'u3', appName: 'badapp', reason: 'App not found' },
        { userId: 'u4', appName: 'myapp', reason: 'Duplicate user' },
      ],
    };

    render(<ImportResultsPage />);

    expect(screen.getByText('Errors (2)')).toBeInTheDocument();
    expect(screen.getByText('App not found')).toBeInTheDocument();
    expect(screen.getByText('Duplicate user')).toBeInTheDocument();
  });

  it('copies individual token to clipboard', () => {
    mockLastResult = {
      imported: [
        { userId: 'u1', appName: 'myapp', token: 'myapp_ABC123', expiresAt: '2026-01-01' },
      ],
      errors: [],
    };

    render(<ImportResultsPage />);

    const copyBtns = screen.getAllByText('copy');
    fireEvent.click(copyBtns[0]);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('myapp_ABC123');
  });

  it('copies all tokens in formatted output', () => {
    mockLastResult = {
      imported: [
        { userId: 'u1', appName: 'myapp', token: 'myapp_ABC123', expiresAt: '2026-01-01' },
        { userId: 'u2', appName: 'myapp', token: 'myapp_DEF456', expiresAt: '2026-02-01' },
      ],
      errors: [],
    };

    render(<ImportResultsPage />);

    fireEvent.click(screen.getByText('Copy All Tokens'));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'u1: myapp_ABC123\nu2: myapp_DEF456',
    );
  });

  it('downloads CSV with correct content', () => {
    mockLastResult = {
      imported: [
        { userId: 'u1', appName: 'myapp', token: 'myapp_ABC123', expiresAt: '2026-01-01' },
      ],
      errors: [],
    };

    render(<ImportResultsPage />);

    fireEvent.click(screen.getByText('Download CSV'));

    expect(mockDownloadCsv).toHaveBeenCalledWith(
      ['userId', 'appName', 'token', 'expiresAt'],
      [['u1', 'myapp', 'myapp_ABC123', '2026-01-01']],
      'imported-tokens.csv',
    );
  });

  it('downloads JSON with correct content', () => {
    mockLastResult = {
      imported: [
        { userId: 'u1', appName: 'myapp', token: 'myapp_ABC123', expiresAt: '2026-01-01' },
      ],
      errors: [],
    };

    // Mock URL.createObjectURL and revokeObjectURL
    const mockUrl = 'blob:test';
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => mockUrl);
    URL.revokeObjectURL = vi.fn();

    const clickSpy = vi.fn();
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreateElement(tag);
      if (tag === 'a') {
        Object.defineProperty(el, 'click', { value: clickSpy });
      }
      return el;
    });

    render(<ImportResultsPage />);

    fireEvent.click(screen.getByText('Download JSON'));

    expect(URL.createObjectURL).toHaveBeenCalled();
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/json');
    expect(clickSpy).toHaveBeenCalled();

    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
  });

  it('navigates to /import on "New Import" click', () => {
    mockLastResult = { imported: [], errors: [{ userId: 'u1', appName: 'a', reason: 'fail' }] };

    render(<ImportResultsPage />);

    fireEvent.click(screen.getByText('New Import'));
    expect(mockRoute).toHaveBeenCalledWith('/import');
  });

  it('navigates to /tokens on "Go to Tokens" click', () => {
    mockLastResult = { imported: [{ userId: 'u1', appName: 'a', token: 't', expiresAt: '' }], errors: [] };

    render(<ImportResultsPage />);

    fireEvent.click(screen.getByText('Go to Tokens'));
    expect(mockRoute).toHaveBeenCalledWith('/tokens');
  });

  it('collapses and expands sections', () => {
    mockLastResult = {
      imported: [{ userId: 'u1', appName: 'a', token: 'tok', expiresAt: '' }],
      errors: [{ userId: 'u2', appName: 'a', reason: 'fail' }],
    };

    render(<ImportResultsPage />);

    // Both expanded by default — tokens visible
    expect(screen.getByText('tok')).toBeInTheDocument();
    expect(screen.getByText('fail')).toBeInTheDocument();

    // Collapse tokens
    fireEvent.click(screen.getByText('Imported Tokens (1)'));
    expect(screen.queryByText('tok')).not.toBeInTheDocument();

    // Expand again
    fireEvent.click(screen.getByText('Imported Tokens (1)'));
    expect(screen.getByText('tok')).toBeInTheDocument();
  });
});
