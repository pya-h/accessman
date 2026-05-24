import { registerAs } from '@nestjs/config';

export default registerAs('token', () => ({
  defaultExpiryDays: parseInt(process.env.DEFAULT_TOKEN_EXPIRY_DAYS, 10) || 365,
}));
