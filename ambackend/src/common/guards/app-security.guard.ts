import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { AppsService } from '../../apps/apps.service';

@Injectable()
export class AppSecurityGuard implements CanActivate {
  private readonly securityKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly appsService: AppsService,
  ) {
    this.securityKey = this.configService.get<string>('SECURITY_KEY');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const securityHeader = request.headers['x-security'] as string;
    if (!securityHeader) {
      throw new UnauthorizedException('Primary security key not provided!');
    }

    if (!this.safeEqual(securityHeader, this.securityKey)) {
      throw new UnauthorizedException('Invalid security key');
    }

    const appName = request.headers['x-app-name'] as string;
    if (!appName) {
      throw new ForbiddenException('App name header not provided!');
    }

    const app = await this.appsService.findByName(appName);
    if (!app) {
      throw new ForbiddenException(`Unknown app: "${appName}"`);
    }

    if (!app.isActive) {
      throw new ForbiddenException(`App "${appName}" is inactive`);
    }

    request.appEntity = app;
    return true;
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
