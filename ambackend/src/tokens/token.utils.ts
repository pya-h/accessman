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

export function validateCustomToken(
  rawToken: string,
  expectedAppName: string,
): string | null {
  const separatorIndex = rawToken.lastIndexOf('_');
  if (separatorIndex === -1) return 'Token must contain an underscore separator';

  const prefix = rawToken.substring(0, separatorIndex);
  const code = rawToken.substring(separatorIndex + 1);

  if (prefix !== expectedAppName) {
    return `Token prefix "${prefix}" does not match app name "${expectedAppName}"`;
  }

  if (code.length < 8 || code.length > 64) {
    return `Token code must be 8-64 characters, got ${code.length}`;
  }

  return null;
}

export function processCustomToken(
  rawToken: string,
  appName: string,
): { raw: string; hash: string; prefix: string } {
  const separatorIndex = rawToken.lastIndexOf('_');
  const code = rawToken.substring(separatorIndex + 1);
  const hash = createHash('sha256').update(rawToken).digest('hex');
  const prefix = `${appName}_${code.substring(0, 8)}`;
  return { raw: rawToken, hash, prefix };
}
