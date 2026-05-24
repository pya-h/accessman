import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { TokenEntity } from './token.entity';
import { generateToken } from './token.utils';

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

describe('TokensService', () => {
  let service: TokensService;
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
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
    it('returns valid result for correct token and userId', async () => {
      const { raw, hash } = generateToken(APP_NAME);
      repo.findOne.mockResolvedValue(mockToken({ tokenHash: hash }));

      const result = await service.verify(raw, APP_NAME, 'user1');

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

      await service.verify(raw, APP_NAME, 'user1');

      expect(repo.save).toHaveBeenCalled();
      const saved = repo.save.mock.calls[0][0];
      expect(saved.lastVerifiedAt).toBeInstanceOf(Date);
    });

    it('returns not_found for wrong userId', async () => {
      const { raw, hash } = generateToken(APP_NAME);
      repo.findOne.mockResolvedValue(mockToken({ tokenHash: hash }));

      const result = await service.verify(raw, APP_NAME, 'wrong-user');

      expect(result).toEqual({ valid: false, reason: 'not_found' });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('returns not_found for wrong app prefix', async () => {
      const { raw } = generateToken('other-app');

      const result = await service.verify(raw, APP_NAME, 'user1');

      expect(result).toEqual({ valid: false, reason: 'not_found' });
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('returns expired for expired token', async () => {
      const { raw, hash } = generateToken(APP_NAME);
      repo.findOne.mockResolvedValue(
        mockToken({
          tokenHash: hash,
          expiresAt: new Date(Date.now() - 86400000),
        }),
      );

      const result = await service.verify(raw, APP_NAME, 'user1');

      expect(result).toEqual({ valid: false, reason: 'expired' });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('returns revoked for revoked token', async () => {
      const { raw, hash } = generateToken(APP_NAME);
      repo.findOne.mockResolvedValue(
        mockToken({ tokenHash: hash, revokedAt: new Date() }),
      );

      const result = await service.verify(raw, APP_NAME, 'user1');

      expect(result).toEqual({ valid: false, reason: 'revoked' });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('returns not_found for non-existent token', async () => {
      const { raw } = generateToken(APP_NAME);
      repo.findOne.mockResolvedValue(null);

      const result = await service.verify(raw, APP_NAME, 'user1');

      expect(result).toEqual({ valid: false, reason: 'not_found' });
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

    it('throws NotFoundException for wrong app prefix', async () => {
      const { raw } = generateToken('other-app');

      await expect(
        service.updateMetadata(raw, APP_NAME, {}),
      ).rejects.toThrow(NotFoundException);
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for expired token', async () => {
      const { raw, hash } = generateToken(APP_NAME);
      repo.findOne.mockResolvedValue(
        mockToken({
          tokenHash: hash,
          expiresAt: new Date(Date.now() - 86400000),
        }),
      );

      await expect(
        service.updateMetadata(raw, APP_NAME, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for revoked token', async () => {
      const { raw, hash } = generateToken(APP_NAME);
      repo.findOne.mockResolvedValue(
        mockToken({ tokenHash: hash, revokedAt: new Date() }),
      );

      await expect(
        service.updateMetadata(raw, APP_NAME, {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for non-existent token', async () => {
      const { raw } = generateToken(APP_NAME);
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.updateMetadata(raw, APP_NAME, {}),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
