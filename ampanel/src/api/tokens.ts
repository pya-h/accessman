import { request } from './client';

export interface TokenListParams {
  appName?: string;
  userId?: string;
  tokenPrefix?: string;
  status?: 'active' | 'expired' | 'revoked' | 'all';
  page?: number;
  limit?: number;
}

export interface TokenRecord {
  id: number;
  userId: string;
  app: { id: number; name: string };
  tokenPrefix: string;
  metadata: Record<string, unknown>;
  expiresAt: string | null;
  lastVerifiedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
  status?: string;
}

export interface TokenListResponse {
  data: TokenRecord[];
  total: number;
  page: number;
  limit: number;
}

export function listTokens(params: TokenListParams): Promise<TokenListResponse> {
  return request('/api/tokens', { params: params as Record<string, string | number | undefined> });
}

export function getToken(id: number): Promise<TokenRecord> {
  return request(`/api/tokens/${id}`);
}

export function revokeToken(id: number): Promise<{ success: true; revokedAt: string }> {
  return request(`/api/tokens/${id}/revoke`, { method: 'POST' });
}
