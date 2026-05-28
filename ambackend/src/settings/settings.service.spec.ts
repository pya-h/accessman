import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SettingsService } from './settings.service';
import { SettingsEntity } from './settings.entity';

describe('SettingsService', () => {
  let service: SettingsService;
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: getRepositoryToken(SettingsEntity), useValue: repo },
      ],
    }).compile();

    service = module.get(SettingsService);
  });

  describe('get', () => {
    it('returns the existing singleton row', async () => {
      const row = { id: 1, codeLength: 8, prefixAppName: true };
      repo.findOne.mockResolvedValue(row);

      const result = await service.get();

      expect(result).toBe(row);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('creates the singleton with defaults when absent', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.save.mockImplementation((e) =>
        Promise.resolve({ codeLength: 4, prefixAppName: false, ...e }),
      );

      const result = await service.get();

      expect(repo.create).toHaveBeenCalledWith({ id: 1 });
      expect(repo.save).toHaveBeenCalled();
      expect(result.id).toBe(1);
    });

    it('re-reads on concurrent-creation unique violation', async () => {
      const row = { id: 1, codeLength: 4, prefixAppName: false };
      repo.findOne
        .mockResolvedValueOnce(null) // initial lookup → not found
        .mockResolvedValueOnce(row); // re-read after conflict
      repo.save.mockRejectedValue({ code: '23505' });

      const result = await service.get();

      expect(result).toBe(row);
    });

    it('rethrows non-unique-violation save errors', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.save.mockRejectedValue({ code: 'OTHER' });

      await expect(service.get()).rejects.toEqual({ code: 'OTHER' });
    });
  });

  describe('update', () => {
    it('applies codeLength and preserves prefixAppName', async () => {
      repo.findOne.mockResolvedValue({
        id: 1,
        codeLength: 4,
        prefixAppName: false,
      });
      repo.save.mockImplementation((e) => Promise.resolve(e));

      const result = await service.update({ codeLength: 16 });

      expect(result.codeLength).toBe(16);
      expect(result.prefixAppName).toBe(false);
    });

    it('applies prefixAppName and preserves codeLength', async () => {
      repo.findOne.mockResolvedValue({
        id: 1,
        codeLength: 4,
        prefixAppName: false,
      });
      repo.save.mockImplementation((e) => Promise.resolve(e));

      const result = await service.update({ prefixAppName: true });

      expect(result.prefixAppName).toBe(true);
      expect(result.codeLength).toBe(4);
    });
  });
});
