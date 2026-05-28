import { randomInt, createHash } from 'crypto';

export const MIN_CODE_LENGTH = 4;
export const MAX_CODE_LENGTH = 64;
export const DEFAULT_CODE_LENGTH = 4;
// How many times generation retries when a random code collides with an existing one.
export const MAX_GENERATION_ATTEMPTS = 10;

const LOWER_CHARS = 'abcdefghijklmnopqrstuvwxyz';
const UPPER_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGIT_CHARS = '0123456789';
// A small, recognizable set of basic special characters.
const SPECIAL_CHARS = '!@#$%^&*';

export type LetterCase = 'upper' | 'lower' | 'both';

export interface CharsetOptions {
  includeNumbers: boolean;
  letterCase: LetterCase;
  includeSpecial: boolean;
}

export const DEFAULT_CHARSET: CharsetOptions = {
  includeNumbers: true,
  letterCase: 'lower',
  includeSpecial: false,
};

// Builds the alphabet codes are drawn from. Letters are always present
// (the case toggle only picks which), so the alphabet is never empty.
export function buildAlphabet(charset: CharsetOptions): string {
  let alphabet = '';
  if (charset.letterCase === 'lower' || charset.letterCase === 'both') {
    alphabet += LOWER_CHARS;
  }
  if (charset.letterCase === 'upper' || charset.letterCase === 'both') {
    alphabet += UPPER_CHARS;
  }
  if (charset.includeNumbers) alphabet += DIGIT_CHARS;
  if (charset.includeSpecial) alphabet += SPECIAL_CHARS;
  return alphabet;
}

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
  charset: CharsetOptions = DEFAULT_CHARSET,
): {
  raw: string;
  hash: string;
  prefix: string;
} {
  const alphabet = buildAlphabet(charset);
  let code = '';
  // randomInt is unbiased (rejection sampling internally), so the code is
  // exactly codeLength characters drawn uniformly from the alphabet.
  for (let i = 0; i < codeLength; i++) {
    code += alphabet[randomInt(alphabet.length)];
  }
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
