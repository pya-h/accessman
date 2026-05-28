import { randomBytes, createHash } from 'crypto';

export const MIN_CODE_LENGTH = 4;
export const MAX_CODE_LENGTH = 64;
export const DEFAULT_CODE_LENGTH = 4;
// How many times generation retries when a random code collides with an existing one.
export const MAX_GENERATION_ATTEMPTS = 10;

// Display prefix shown to operators: the whole code if shorter than 8 chars,
// otherwise the first 8. When prefixAppName is on, the app name is prepended
// for readability only — it has no role in verification.
function buildPrefix(
  appName: string,
  code: string,
  prefixAppName: boolean,
): string {
  const display = code.length < 8 ? code : code.substring(0, 8);
  return prefixAppName ? `${appName}_${display}` : display;
}

export function generateToken(
  appName: string,
  codeLength: number = DEFAULT_CODE_LENGTH,
  prefixAppName: boolean = false,
): {
  raw: string;
  hash: string;
  prefix: string;
} {
  const code = randomBytes(Math.ceil(codeLength / 2))
    .toString('hex')
    .substring(0, codeLength);
  const raw = prefixAppName ? `${appName}_${code}` : code;
  const hash = createHash('sha256').update(raw).digest('hex');
  const prefix = buildPrefix(appName, code, prefixAppName);
  return { raw, hash, prefix };
}

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

// Custom tokens are arbitrary operator-supplied codes. The app name is no longer
// part of the token — the only constraint is the length range.
export function validateCustomToken(rawToken: string): string | null {
  if (rawToken.length < MIN_CODE_LENGTH || rawToken.length > MAX_CODE_LENGTH) {
    return `Token must be ${MIN_CODE_LENGTH}-${MAX_CODE_LENGTH} characters, got ${rawToken.length}`;
  }
  return null;
}

export function processCustomToken(rawToken: string): {
  raw: string;
  hash: string;
  prefix: string;
} {
  const hash = createHash('sha256').update(rawToken).digest('hex');
  const prefix = rawToken.length < 8 ? rawToken : rawToken.substring(0, 8);
  return { raw: rawToken, hash, prefix };
}
