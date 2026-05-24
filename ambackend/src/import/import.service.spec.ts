import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { ImportService } from './import.service';
import { AppEntity } from '../apps/app.entity';
import { TokenEntity } from '../tokens/token.entity';
import { ImportItemDto } from './dto/import-item.dto';

describe('ImportService', () => {
  let service: ImportService;
  let mockManager: Record<string, jest.Mock>;
  let mockDataSource: { transaction: jest.Mock };
  let nextId: number;

  beforeEach(async () => {
    nextId = 1;
    mockManager = {
      findOne: jest.fn(),
      create: jest.fn((_, data) => ({ ...data })),
      save: jest.fn((entity) =>
        Promise.resolve(
          entity.id ? entity : { ...entity, id: nextId++ },
        ),
      ),
    };

    mockDataSource = {
      transaction: jest.fn((cb) => cb(mockManager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportService,
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(ImportService);
  });

  describe('importTokens', () => {
    it('imports single token successfully', async () => {
      mockManager.findOne
        .mockResolvedValueOnce({ id: 1, name: 'myapp' }) // App lookup
        .mockResolvedValueOnce(null); // No existing token

      const result = await service.importTokens(
        [{ userId: 'user1', appName: 'myapp' }],
        365,
      );

      expect(result.imported).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.imported[0].userId).toBe('user1');
      expect(result.imported[0].appName).toBe('myapp');
      expect(result.imported[0].token).toMatch(/^myapp_[0-9a-f]{64}$/);
      expect(result.imported[0].expiresAt).toBeInstanceOf(Date);
    });

    it('imports batch successfully', async () => {
      mockManager.findOne
        .mockResolvedValueOnce({ id: 1, name: 'app1' }) // App 1
        .mockResolvedValueOnce({ id: 2, name: 'app2' }) // App 2
        .mockResolvedValueOnce(null) // Token check user1@app1
        .mockResolvedValueOnce(null); // Token check user2@app2

      const result = await service.importTokens(
        [
          { userId: 'user1', appName: 'app1' },
          { userId: 'user2', appName: 'app2' },
        ],
        365,
      );

      expect(result.imported).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects duplicate (userId, appId) with active token', async () => {
      mockManager.findOne
        .mockResolvedValueOnce({ id: 1, name: 'myapp' }) // App
        .mockResolvedValueOnce({ id: 99, userId: 'user1', revokedAt: null }); // Active token exists

      const result = await service.importTokens(
        [{ userId: 'user1', appName: 'myapp' }],
        365,
      );

      expect(result.imported).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].reason).toContain('already exists');
    });

    it('imports successfully when only revoked token exists (returns null for IsNull query)', async () => {
      mockManager.findOne
        .mockResolvedValueOnce({ id: 1, name: 'myapp' }) // App
        .mockResolvedValueOnce(null); // IsNull() filters out revoked → returns null

      const result = await service.importTokens(
        [{ userId: 'user1', appName: 'myapp' }],
        365,
      );

      expect(result.imported).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it('auto-creates app when not found', async () => {
      mockManager.findOne
        .mockResolvedValueOnce(null) // App not found
        .mockResolvedValueOnce(null); // No existing token

      const result = await service.importTokens(
        [{ userId: 'user1', appName: 'newapp' }],
        365,
      );

      expect(result.imported).toHaveLength(1);
      expect(mockManager.create).toHaveBeenCalledWith(AppEntity, {
        name: 'newapp',
      });
    });

    it('uses custom expiresAt when provided', async () => {
      mockManager.findOne
        .mockResolvedValueOnce({ id: 1, name: 'myapp' })
        .mockResolvedValueOnce(null);

      const customDate = '2030-12-31T00:00:00.000Z';
      const result = await service.importTokens(
        [{ userId: 'user1', appName: 'myapp', expiresAt: customDate }],
        365,
      );

      expect(result.imported[0].expiresAt).toEqual(new Date(customDate));
    });
  });

  describe('importTokens — uniqueness enforcement', () => {
    it('queries with revokedAt: IsNull() to find only active tokens', async () => {
      mockManager.findOne
        .mockResolvedValueOnce({ id: 1, name: 'myapp' })
        .mockResolvedValueOnce(null);

      await service.importTokens(
        [{ userId: 'user1', appName: 'myapp' }],
        365,
      );

      const tokenFindCall = mockManager.findOne.mock.calls[1];
      expect(tokenFindCall[0]).toBe(TokenEntity);
      expect(tokenFindCall[1].where).toMatchObject({
        userId: 'user1',
        appId: 1,
        revokedAt: IsNull(),
      });
    });

    it('rejects second import for same (userId, appId) while first is active', async () => {
      // First import succeeds
      mockManager.findOne
        .mockResolvedValueOnce({ id: 1, name: 'myapp' })
        .mockResolvedValueOnce(null);

      const first = await service.importTokens(
        [{ userId: 'user1', appName: 'myapp' }],
        365,
      );
      expect(first.imported).toHaveLength(1);

      // Second import finds active token
      mockManager.findOne
        .mockResolvedValueOnce({ id: 1, name: 'myapp' })
        .mockResolvedValueOnce({ id: 99, userId: 'user1' }); // Active token found

      const second = await service.importTokens(
        [{ userId: 'user1', appName: 'myapp' }],
        365,
      );

      expect(second.imported).toHaveLength(0);
      expect(second.errors).toHaveLength(1);
    });

    it('succeeds after revocation (IsNull query returns null for revoked tokens)', async () => {
      // After revoking, the IsNull() query returns null → import succeeds
      mockManager.findOne
        .mockResolvedValueOnce({ id: 1, name: 'myapp' })
        .mockResolvedValueOnce(null); // Revoked tokens filtered out by IsNull()

      const result = await service.importTokens(
        [{ userId: 'user1', appName: 'myapp' }],
        365,
      );

      expect(result.imported).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('reIssueTokens', () => {
    it('revokes existing active token and issues new one', async () => {
      const existingToken = {
        id: 99,
        userId: 'user1',
        appId: 1,
        revokedAt: null,
      };
      mockManager.findOne
        .mockResolvedValueOnce({ id: 1, name: 'myapp' }) // App
        .mockResolvedValueOnce(existingToken); // Existing active token

      const result = await service.reIssueTokens(
        [{ userId: 'user1', appName: 'myapp' }],
        365,
      );

      expect(result.imported).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      // Verify old token was revoked
      expect(existingToken.revokedAt).toBeInstanceOf(Date);
      // save called twice: revoke existing + save new token
      expect(mockManager.save).toHaveBeenCalledTimes(2);
      expect(mockManager.save).toHaveBeenCalledWith(existingToken);
    });

    it('imports normally when no existing token', async () => {
      mockManager.findOne
        .mockResolvedValueOnce({ id: 1, name: 'myapp' })
        .mockResolvedValueOnce(null); // No existing

      const result = await service.reIssueTokens(
        [{ userId: 'user1', appName: 'myapp' }],
        365,
      );

      expect(result.imported).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      // save called once: only new token
      expect(mockManager.save).toHaveBeenCalledTimes(1);
    });

    it('handles batch with mixed scenarios', async () => {
      const existingToken = {
        id: 99,
        userId: 'user1',
        revokedAt: null,
      };
      mockManager.findOne
        .mockResolvedValueOnce({ id: 1, name: 'myapp' }) // App
        .mockResolvedValueOnce(existingToken) // user1 has active token
        .mockResolvedValueOnce(null); // user2 has no token

      const result = await service.reIssueTokens(
        [
          { userId: 'user1', appName: 'myapp' },
          { userId: 'user2', appName: 'myapp' },
        ],
        365,
      );

      expect(result.imported).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      // save: revoke user1 + new user1 + new user2 = 3
      expect(mockManager.save).toHaveBeenCalledTimes(3);
    });
  });

  describe('reIssueTokens — uniqueness enforcement', () => {
    it('queries with revokedAt: IsNull() to find only active tokens', async () => {
      mockManager.findOne
        .mockResolvedValueOnce({ id: 1, name: 'myapp' })
        .mockResolvedValueOnce(null);

      await service.reIssueTokens(
        [{ userId: 'user1', appName: 'myapp' }],
        365,
      );

      const tokenFindCall = mockManager.findOne.mock.calls[1];
      expect(tokenFindCall[0]).toBe(TokenEntity);
      expect(tokenFindCall[1].where).toMatchObject({
        userId: 'user1',
        revokedAt: IsNull(),
      });
    });

    it('ensures old token is revoked before new one is created', async () => {
      const existingToken = {
        id: 99,
        userId: 'user1',
        appId: 1,
        revokedAt: null,
      };
      mockManager.findOne
        .mockResolvedValueOnce({ id: 1, name: 'myapp' })
        .mockResolvedValueOnce(existingToken);

      await service.reIssueTokens(
        [{ userId: 'user1', appName: 'myapp' }],
        365,
      );

      // First save: revoke existing
      const firstSave = mockManager.save.mock.calls[0][0];
      expect(firstSave.revokedAt).toBeInstanceOf(Date);
      expect(firstSave.id).toBe(99);

      // Second save: new token (no revokedAt)
      const secondSave = mockManager.save.mock.calls[1][0];
      expect(secondSave.revokedAt).toBeUndefined();
      expect(secondSave.tokenHash).toBeDefined();
    });

    it('after multiple re-issues only one non-revoked token is created per call', async () => {
      // First re-issue: no existing
      mockManager.findOne
        .mockResolvedValueOnce({ id: 1, name: 'myapp' })
        .mockResolvedValueOnce(null);

      const first = await service.reIssueTokens(
        [{ userId: 'user1', appName: 'myapp' }],
        365,
      );
      expect(first.imported).toHaveLength(1);

      // Second re-issue: existing active token
      const active = { id: 50, userId: 'user1', appId: 1, revokedAt: null };
      mockManager.save.mockClear();
      mockManager.findOne
        .mockResolvedValueOnce({ id: 1, name: 'myapp' })
        .mockResolvedValueOnce(active);

      const second = await service.reIssueTokens(
        [{ userId: 'user1', appName: 'myapp' }],
        365,
      );
      expect(second.imported).toHaveLength(1);

      // Verify revoke + create = 2 saves
      expect(mockManager.save).toHaveBeenCalledTimes(2);
      // Old token revoked
      expect(active.revokedAt).toBeInstanceOf(Date);
    });

    it('two non-revoked tokens cannot exist — import always checks IsNull()', async () => {
      // importTokens always queries with revokedAt: IsNull()
      // If an active token is found, import is rejected
      // This guarantees at most one non-revoked token per (userId, appId)
      mockManager.findOne
        .mockResolvedValueOnce({ id: 1, name: 'myapp' })
        .mockResolvedValueOnce({ id: 10, revokedAt: null }); // Active token exists

      const importResult = await service.importTokens(
        [{ userId: 'user1', appName: 'myapp' }],
        365,
      );
      expect(importResult.errors).toHaveLength(1);
      expect(importResult.imported).toHaveLength(0);

      // reIssueTokens always revokes before creating
      const active = { id: 10, userId: 'user1', appId: 1, revokedAt: null };
      mockManager.findOne
        .mockResolvedValueOnce({ id: 1, name: 'myapp' })
        .mockResolvedValueOnce(active);

      const reissueResult = await service.reIssueTokens(
        [{ userId: 'user1', appName: 'myapp' }],
        365,
      );
      expect(reissueResult.imported).toHaveLength(1);
      expect(active.revokedAt).toBeInstanceOf(Date); // Old one revoked
    });
  });

  describe('resolveItems', () => {
    it('parses valid JSON array', () => {
      const body = [{ userId: 'user1', appName: 'myapp' }];
      const result = service.resolveItems(
        'application/json',
        body,
        ImportItemDto,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(ImportItemDto);
      expect(result[0].userId).toBe('user1');
      expect(result[0].appName).toBe('myapp');
    });

    it('parses valid CSV', () => {
      const csv = 'userId,appName\nuser1,myapp\nuser2,otherapp';
      const result = service.resolveItems('text/csv', csv, ImportItemDto);

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe('user1');
      expect(result[0].appName).toBe('myapp');
      expect(result[1].userId).toBe('user2');
    });

    it('throws BadRequestException on non-array JSON body', () => {
      expect(() =>
        service.resolveItems(
          'application/json',
          { userId: 'user1' },
          ImportItemDto,
        ),
      ).toThrow(BadRequestException);
    });

    it('throws BadRequestException on invalid DTO fields', () => {
      const body = [{ userId: '', appName: '' }];
      expect(() =>
        service.resolveItems('application/json', body, ImportItemDto),
      ).toThrow(BadRequestException);
    });
  });

  describe('parseCsv', () => {
    it('converts empty string values to undefined', () => {
      const csv = 'userId,appName,expiresAt\nuser1,myapp,';
      const result = service.resolveItems('text/csv', csv, ImportItemDto);

      expect(result[0].expiresAt).toBeUndefined();
    });

    it('throws BadRequestException on malformed CSV', () => {
      const malformed = '"unclosed quote\nfield';
      expect(() =>
        service.resolveItems('text/csv', malformed, ImportItemDto),
      ).toThrow(BadRequestException);
    });
  });
});
