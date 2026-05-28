import { randomBytes, randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { TokenEntity } from './token.entity';
import { generateToken } from './token.utils';
import { TokenStatus } from './dto/list-tokens-query.dto';

const APP_NAME = 'myapp';

const mockToken = (overrides: Partial<TokenEntity> = {}): TokenEntity =>
  ({
    id: 1,
    userId: 'user1',
    appId: 1,
    tokenHash: 'placeholder',
    tokenPrefix: `${APP_NAME}_abcd1234`,
    metadata: { role: 'admin' },
    expiresAt: new Date(Date.now() + 86400000),
    lastVerifiedAt: null,
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    app: {
      id: 1,
      name: APP_NAME,
      isActive: true,
      createdAt: new Date(),
      tokens: [],
    },
    ...overrides,
  }) as TokenEntity;

const mockQueryBuilder = () => {
  const qb: Record<string, jest.Mock> = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
  return qb;
};

describe('TokensService', () => {
  let service: TokensService;
  let repo: Record<string, jest.Mock>;
  let qb: Record<string, jest.Mock>;

  beforeEach(async () => {
    qb = mockQueryBuilder();
    repo = {
      findOne: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokensService,
        { provide: getRepositoryToken(TokenEntity), useValue: repo },
      ],
    }).compile();

    service = module.get(TokensService);
  });

  describe('verify', () => {
    it('returns valid result for correct token', async () => {
      const { raw, hash } = generateToken(APP_NAME);
      repo.findOne.mockResolvedValue(mockToken({ tokenHash: hash }));

      const result = await service.verify(raw, APP_NAME);

      expect(result).toMatchObject({
        valid: true,
        userId: 'user1',
        appName: APP_NAME,
        metadata: { role: 'admin' },
      });
    });

    it('updates lastVerifiedAt on success', async () => {
      const { raw, hash } = generateToken(APP_NAME);
      repo.findOne.mockResolvedValue(
        mockToken({ tokenHash: hash, lastVerifiedAt: null }),
      );

      await service.verify(raw, APP_NAME);

      expect(repo.save).toHaveBeenCalled();
      const saved = repo.save.mock.calls[0][0];
      expect(saved.lastVerifiedAt).toBeInstanceOf(Date);
    });

    it('returns not_found when token belongs to a different app', async () => {
      const { raw, hash } = generateToken(APP_NAME);
      repo.findOne.mockResolvedValue(
        mockToken({
          tokenHash: hash,
          app: {
            id: 2,
            name: 'other-app',
            isActive: true,
            createdAt: new Date(),
            tokens: [],
          },
        }),
      );

      const result = await service.verify(raw, APP_NAME);

      expect(result).toEqual({ valid: false, reason: 'not_found' });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('returns expired for expired token', async () => {
      const { raw, hash } = generateToken(APP_NAME);
      repo.findOne.mockResolvedValue(
        mockToken({
          tokenHash: hash,
          expiresAt: new Date(Date.now() - 86400000),
        }),
      );

      const result = await service.verify(raw, APP_NAME);

      expect(result).toEqual({ valid: false, reason: 'expired' });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('returns revoked for revoked token', async () => {
      const { raw, hash } = generateToken(APP_NAME);
      repo.findOne.mockResolvedValue(
        mockToken({ tokenHash: hash, revokedAt: new Date() }),
      );

      const result = await service.verify(raw, APP_NAME);

      expect(result).toEqual({ valid: false, reason: 'revoked' });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('returns not_found for non-existent token', async () => {
      const { raw } = generateToken(APP_NAME);
      repo.findOne.mockResolvedValue(null);

      const result = await service.verify(raw, APP_NAME);

      expect(result).toEqual({ valid: false, reason: 'not_found' });
    });

    it('returns valid for token with no expiresAt (never expires)', async () => {
      const { raw, hash } = generateToken(APP_NAME);
      repo.findOne.mockResolvedValue(
        mockToken({ tokenHash: hash, expiresAt: null }),
      );

      const result = await service.verify(raw, APP_NAME);

      expect(result).toMatchObject({ valid: true, expiresAt: null });
    });
  });

  describe('updateMetadata', () => {
    it('updates metadata successfully', async () => {
      const { raw, hash } = generateToken(APP_NAME);
      repo.findOne.mockResolvedValue(mockToken({ tokenHash: hash }));

      const result = await service.updateMetadata(raw, APP_NAME, {
        newKey: 'value',
      });

      expect(result).toEqual({ success: true });
      const saved = repo.save.mock.calls[0][0];
      expect(saved.metadata).toEqual({ newKey: 'value' });
    });

    it('throws NotFoundException when token belongs to a different app', async () => {
      const { raw, hash } = generateToken(APP_NAME);
      repo.findOne.mockResolvedValue(
        mockToken({
          tokenHash: hash,
          app: {
            id: 2,
            name: 'other-app',
            isActive: true,
            createdAt: new Date(),
            tokens: [],
          },
        }),
      );

      await expect(service.updateMetadata(raw, APP_NAME, {})).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for expired token', async () => {
      const { raw, hash } = generateToken(APP_NAME);
      repo.findOne.mockResolvedValue(
        mockToken({
          tokenHash: hash,
          expiresAt: new Date(Date.now() - 86400000),
        }),
      );

      await expect(service.updateMetadata(raw, APP_NAME, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for revoked token', async () => {
      const { raw, hash } = generateToken(APP_NAME);
      repo.findOne.mockResolvedValue(
        mockToken({ tokenHash: hash, revokedAt: new Date() }),
      );

      await expect(service.updateMetadata(raw, APP_NAME, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException for non-existent token', async () => {
      const { raw } = generateToken(APP_NAME);
      repo.findOne.mockResolvedValue(null);

      await expect(service.updateMetadata(raw, APP_NAME, {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('returns paginated results with defaults', async () => {
      const tokens = [mockToken()];
      qb.getManyAndCount.mockResolvedValue([tokens, 1]);

      const result = await service.findAll({});

      expect(result).toEqual({ data: tokens, total: 1, page: 1, limit: 50 });
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(50);
    });

    it('applies appName filter', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ appName: 'myapp' });

      expect(qb.andWhere).toHaveBeenCalledWith('app.name = :appName', {
        appName: 'myapp',
      });
    });

    it('applies userId filter', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ userId: 'user1' });

      expect(qb.andWhere).toHaveBeenCalledWith('token.userId ILIKE :userId', {
        userId: '%user1%',
      });
    });

    it('applies status=active filter', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ status: TokenStatus.ACTIVE });

      expect(qb.andWhere).toHaveBeenCalledWith('token.revokedAt IS NULL');
    });

    it('applies status=revoked filter', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ status: TokenStatus.REVOKED });

      expect(qb.andWhere).toHaveBeenCalledWith('token.revokedAt IS NOT NULL');
    });

    it('applies tokenPrefix filter with ILIKE', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ tokenPrefix: 'myapp_abc' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'token.tokenPrefix ILIKE :tokenPrefix',
        { tokenPrefix: '%myapp_abc%' },
      );
    });

    it('applies pagination correctly', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ page: 3, limit: 20 });

      expect(qb.skip).toHaveBeenCalledWith(40);
      expect(qb.take).toHaveBeenCalledWith(20);
    });

    it('defaults to createdAt DESC sort', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({});

      expect(qb.orderBy).toHaveBeenCalledWith('token.createdAt', 'DESC');
    });

    it('applies sortBy userId ASC', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ sortBy: 'userId', sortOrder: 'ASC' });

      expect(qb.orderBy).toHaveBeenCalledWith('token.userId', 'ASC');
    });

    it('applies sortBy appName DESC', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ sortBy: 'appName', sortOrder: 'DESC' });

      expect(qb.orderBy).toHaveBeenCalledWith('app.name', 'DESC');
    });

    it('applies sortBy expiresAt ASC', async () => {
      qb.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ sortBy: 'expiresAt', sortOrder: 'ASC' });

      expect(qb.orderBy).toHaveBeenCalledWith('token.expiresAt', 'ASC');
    });
  });

  describe('findOne', () => {
    it('returns token with computed status=active', async () => {
      const token = mockToken();
      repo.findOne.mockResolvedValue(token);

      const result = await service.findOne(1);

      expect(result.status).toBe('active');
      expect(result.id).toBe(1);
    });

    it('returns token with computed status=revoked', async () => {
      const token = mockToken({ revokedAt: new Date() });
      repo.findOne.mockResolvedValue(token);

      const result = await service.findOne(1);

      expect(result.status).toBe('revoked');
    });

    it('returns token with computed status=expired', async () => {
      const token = mockToken({
        expiresAt: new Date(Date.now() - 86400000),
        revokedAt: null,
      });
      repo.findOne.mockResolvedValue(token);

      const result = await service.findOne(1);

      expect(result.status).toBe('expired');
    });

    it('throws NotFoundException when not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('revoke', () => {
    it('revokes an active token', async () => {
      const token = mockToken({ revokedAt: null });
      repo.findOne.mockResolvedValue(token);

      const result = await service.revoke(1);

      expect(result.success).toBe(true);
      expect(result.revokedAt).toBeInstanceOf(Date);
      expect(repo.save).toHaveBeenCalled();
    });

    it('throws NotFoundException when token not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.revoke(999)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when already revoked', async () => {
      const token = mockToken({ revokedAt: new Date() });
      repo.findOne.mockResolvedValue(token);

      await expect(service.revoke(1)).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('dynamic inputs', () => {
    it('verify and updateMetadata with random appName and metadata', async () => {
      const randApp = `dynapp-${randomBytes(6).toString('hex')}`;
      const randUser = randomUUID();
      const randMeta = {
        role: randomBytes(4).toString('hex'),
        level: Math.floor(Math.random() * 100),
      };

      const { raw, hash } = generateToken(randApp);
      const futureDate = new Date();
      futureDate.setDate(
        futureDate.getDate() + Math.floor(Math.random() * 365) + 1,
      );

      repo.findOne.mockResolvedValue(
        mockToken({
          tokenHash: hash,
          userId: randUser,
          metadata: {},
          expiresAt: futureDate,
          app: {
            id: 1,
            name: randApp,
            isActive: true,
            createdAt: new Date(),
            tokens: [],
          },
        }),
      );

      const verifyResult = await service.verify(raw, randApp);
      expect(verifyResult).toMatchObject({
        valid: true,
        userId: randUser,
        appName: randApp,
      });

      repo.findOne.mockResolvedValue(
        mockToken({
          tokenHash: hash,
          userId: randUser,
          metadata: {},
          expiresAt: futureDate,
          app: {
            id: 1,
            name: randApp,
            isActive: true,
            createdAt: new Date(),
            tokens: [],
          },
        }),
      );

      const metaResult = await service.updateMetadata(raw, randApp, randMeta);
      expect(metaResult).toEqual({ success: true });
      const saved = repo.save.mock.calls[repo.save.mock.calls.length - 1][0];
      expect(saved.metadata).toEqual(randMeta);
    });
  });
});
