import { randomBytes, createHash } from 'crypto';

export function generateToken(appName: string): {
  raw: string;
  hash: string;
  prefix: string;
} {
  const hex = randomBytes(32).toString('hex');
  const raw = `${appName}_${hex}`;
  const hash = createHash('sha256').update(raw).digest('hex');
  const prefix = `${appName}_${hex.substring(0, 8)}`;
  return { raw, hash, prefix };
}

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function extractAppName(rawToken: string): string | null {
  const separatorIndex = rawToken.lastIndexOf('_');
  if (separatorIndex === -1) return null;
  return rawToken.substring(0, separatorIndex);
}
