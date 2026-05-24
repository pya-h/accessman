import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenEntity } from './token.entity';
import { hashToken, extractAppName } from './token.utils';

@Injectable()
export class TokensService {
  constructor(
    @InjectRepository(TokenEntity)
    private readonly tokensRepository: Repository<TokenEntity>,
  ) {}

  async verify(
    rawToken: string,
    requestingAppName: string,
    userId: string,
  ): Promise<
    | {
        valid: true;
        userId: string;
        appName: string;
        metadata: Record<string, any>;
        expiresAt: Date | null;
      }
    | { valid: false; reason: string }
  > {
    const tokenAppName = extractAppName(rawToken);
    if (!tokenAppName || tokenAppName !== requestingAppName) {
      return { valid: false, reason: 'not_found' };
    }

    const tokenHash = hashToken(rawToken);
    const token = await this.tokensRepository.findOne({
      where: { tokenHash },
      relations: ['app'],
    });

    if (!token) {
      return { valid: false, reason: 'not_found' };
    }

    if (token.userId !== userId) {
      return { valid: false, reason: 'not_found' };
    }

    if (token.revokedAt) {
      return { valid: false, reason: 'revoked' };
    }

    if (token.expiresAt && token.expiresAt < new Date()) {
      return { valid: false, reason: 'expired' };
    }

    token.lastVerifiedAt = new Date();
    await this.tokensRepository.save(token);

    return {
      valid: true,
      userId: token.userId,
      appName: token.app.name,
      metadata: token.metadata,
      expiresAt: token.expiresAt,
    };
  }

  async updateMetadata(
    rawToken: string,
    requestingAppName: string,
    metadata: Record<string, any>,
  ): Promise<{ success: true }> {
    const tokenAppName = extractAppName(rawToken);
    if (!tokenAppName || tokenAppName !== requestingAppName) {
      throw new NotFoundException('Token not found');
    }

    const tokenHash = hashToken(rawToken);
    const token = await this.tokensRepository.findOne({
      where: { tokenHash },
      relations: ['app'],
    });

    if (!token) {
      throw new NotFoundException('Token not found');
    }

    if (token.app.name !== requestingAppName) {
      throw new NotFoundException('Token not found');
    }

    if (token.revokedAt) {
      throw new BadRequestException('Token is revoked');
    }

    if (token.expiresAt && token.expiresAt < new Date()) {
      throw new BadRequestException('Token is expired');
    }

    token.metadata = metadata;
    await this.tokensRepository.save(token);

    return { success: true };
  }
}
