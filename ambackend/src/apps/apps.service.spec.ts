import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { AppsService } from './apps.service';
import { AppEntity } from './app.entity';

const mockApp = (overrides: Partial<AppEntity> = {}): AppEntity =>
  ({
    id: 1,
    name: 'test-app',
    isActive: true,
    createdAt: new Date(),
    tokens: [],
    ...overrides,
  }) as AppEntity;

describe('AppsService', () => {
  let service: AppsService;
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppsService,
        { provide: getRepositoryToken(AppEntity), useValue: repo },
      ],
    }).compile();

    service = module.get(AppsService);
  });

  describe('findByName', () => {
    it('returns app when found', async () => {
      const app = mockApp();
      repo.findOne.mockResolvedValue(app);

      const result = await service.findByName('test-app');

      expect(result).toBe(app);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { name: 'test-app' },
      });
    });

    it('returns null when not found', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.findByName('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('returns ordered list', async () => {
      const apps = [
        mockApp({ name: 'alpha' }),
        mockApp({ id: 2, name: 'beta' }),
      ];
      repo.find.mockResolvedValue(apps);

      const result = await service.findAll();

      expect(result).toEqual(apps);
      expect(repo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
    });

    it('returns empty list', async () => {
      repo.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('creates app successfully', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.create('new-app');

      expect(result).toMatchObject({ name: 'new-app' });
      expect(repo.create).toHaveBeenCalledWith({ name: 'new-app' });
      expect(repo.save).toHaveBeenCalled();
    });

    it('throws ConflictException on duplicate name', async () => {
      repo.findOne.mockResolvedValue(mockApp());

      await expect(service.create('test-app')).rejects.toThrow(
        ConflictException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('findOrCreate', () => {
    it('returns existing app when found', async () => {
      const app = mockApp();
      repo.findOne.mockResolvedValue(app);

      const result = await service.findOrCreate('test-app');

      expect(result).toBe(app);
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('creates and returns app when not found', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.findOrCreate('new-app');

      expect(result).toMatchObject({ name: 'new-app' });
      expect(repo.create).toHaveBeenCalledWith({ name: 'new-app' });
      expect(repo.save).toHaveBeenCalled();
    });
  });
});
