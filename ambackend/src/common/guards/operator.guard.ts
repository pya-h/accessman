import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import securityConfig from '../../config/security.config';

@Injectable()
export class OperatorGuard implements CanActivate {
  private readonly operatorKey: string;
  private readonly adminAppName: string;

  constructor(
    @Inject(securityConfig.KEY)
    private readonly security: ConfigType<typeof securityConfig>,
  ) {
    if (!this.security.operatorKey) {
      throw new Error('OPERATOR_KEY environment variable is required');
    }
    this.operatorKey = this.security.operatorKey;
    this.adminAppName = this.security.adminAppName;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const appName = request.headers['x-app-name'] as string;
    if (appName !== this.adminAppName) {
      throw new ForbiddenException('Operator access requires admin app');
    }

    const operatorKey = request.headers['x-operator-key'] as string;
    if (!operatorKey) {
      throw new ForbiddenException('Missing X-Operator-Key header');
    }

    if (!this.safeEqual(operatorKey, this.operatorKey)) {
      throw new ForbiddenException('Invalid operator key');
    }

    return true;
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
