import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, LessThanOrEqual, Brackets } from 'typeorm';
import { TokenEntity } from './token.entity';
import { hashToken, extractAppName } from './token.utils';
import {
  ListTokensQueryDto,
  TokenStatus,
} from './dto/list-tokens-query.dto';

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

  async findAll(
    query: ListTokensQueryDto,
  ): Promise<{ data: TokenEntity[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const qb = this.tokensRepository
      .createQueryBuilder('token')
      .leftJoinAndSelect('token.app', 'app');

    if (query.appName) {
      qb.andWhere('app.name = :appName', { appName: query.appName });
    }

    if (query.userId) {
      qb.andWhere('token.userId = :userId', { userId: query.userId });
    }

    const now = new Date();
    switch (query.status) {
      case TokenStatus.ACTIVE:
        qb.andWhere('token.revokedAt IS NULL');
        qb.andWhere(
          new Brackets((sub) =>
            sub
              .where('token.expiresAt IS NULL')
              .orWhere('token.expiresAt > :now', { now }),
          ),
        );
        break;
      case TokenStatus.EXPIRED:
        qb.andWhere('token.expiresAt IS NOT NULL');
        qb.andWhere('token.expiresAt <= :now', { now });
        qb.andWhere('token.revokedAt IS NULL');
        break;
      case TokenStatus.REVOKED:
        qb.andWhere('token.revokedAt IS NOT NULL');
        break;
      // 'all' or undefined — no status filter
    }

    qb.orderBy('token.createdAt', 'DESC');
    qb.skip((page - 1) * limit);
    qb.take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  private computeStatus(token: TokenEntity): string {
    if (token.revokedAt) return 'revoked';
    if (token.expiresAt && token.expiresAt <= new Date()) return 'expired';
    return 'active';
  }

  async findOne(id: number): Promise<TokenEntity & { status: string }> {
    const token = await this.tokensRepository.findOne({
      where: { id },
      relations: ['app'],
    });

    if (!token) {
      throw new NotFoundException('Token not found');
    }

    return Object.assign(token, { status: this.computeStatus(token) });
  }

  async revoke(id: number): Promise<{ success: true; revokedAt: Date }> {
    const token = await this.tokensRepository.findOne({ where: { id } });

    if (!token) {
      throw new NotFoundException('Token not found');
    }

    if (token.revokedAt) {
      throw new BadRequestException('Token is already revoked');
    }

    token.revokedAt = new Date();
    await this.tokensRepository.save(token);

    return { success: true, revokedAt: token.revokedAt };
  }
}
