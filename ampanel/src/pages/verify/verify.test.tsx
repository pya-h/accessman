import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/preact';
import { VerifyPage } from './verify';

const mockListApps = vi.fn();
vi.mock('@/api/apps', () => ({
  listApps: (...args: unknown[]) => mockListApps(...args),
}));

const mockVerifyToken = vi.fn();
vi.mock('@/api/tokens', () => ({
  verifyToken: (...args: unknown[]) => mockVerifyToken(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockListApps.mockResolvedValue([
    { id: 1, name: 'myapp', isActive: true, createdAt: '2025-01-01T00:00:00Z' },
  ]);
});

async function selectAppAndToken(token: string) {
  await waitFor(() => expect(mockListApps).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: /select app/i }));
  fireEvent.click(screen.getByRole('button', { name: 'myapp' }));
  fireEvent.input(screen.getByPlaceholderText(/paste the raw token/i), {
    target: { value: token },
  });
}

describe('VerifyPage', () => {
  it('disables Verify until an app and token are provided', () => {
    render(<VerifyPage />);
    expect(screen.getByRole('button', { name: 'Verify Token' })).toBeDisabled();
  });

  it('shows a valid result with user, app and metadata', async () => {
    mockVerifyToken.mockResolvedValue({
      valid: true,
      userId: 'u1',
      appName: 'myapp',
      expiresAt: null,
      metadata: { role: 'admin' },
    });

    render(<VerifyPage />);
    await selectAppAndToken('abcd');
    fireEvent.click(screen.getByRole('button', { name: 'Verify Token' }));

    await waitFor(() => {
      expect(mockVerifyToken).toHaveBeenCalledWith('myapp', 'abcd');
      expect(screen.getByText('Valid')).toBeInTheDocument();
      expect(screen.getByText('u1')).toBeInTheDocument();
    });
  });

  it('shows an invalid result with the reason', async () => {
    mockVerifyToken.mockResolvedValue({ valid: false, reason: 'not_found' });

    render(<VerifyPage />);
    await selectAppAndToken('nope');
    fireEvent.click(screen.getByRole('button', { name: 'Verify Token' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid')).toBeInTheDocument();
      expect(screen.getByText('not_found')).toBeInTheDocument();
    });
  });
});
