import { registerAs } from '@nestjs/config';

export default registerAs('security', () => ({
  securityKey: process.env.SECURITY_KEY,
  operatorKey: process.env.OPERATOR_KEY,
  adminAppName: process.env.ADMIN_APP_NAME || 'am-panel',
}));
