import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SettingsEntity } from './settings.entity';

const SINGLETON_ID = 1;

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SettingsEntity)
    private readonly settingsRepository: Repository<SettingsEntity>,
  ) {}

  // Returns the singleton settings row, creating it with defaults if absent.
  async get(): Promise<SettingsEntity> {
    const existing = await this.settingsRepository.findOne({
      where: { id: SINGLETON_ID },
    });
    if (existing) return existing;
    try {
      const created = this.settingsRepository.create({ id: SINGLETON_ID });
      return await this.settingsRepository.save(created);
    } catch (error: any) {
      // Concurrent creation — fall back to the row the other writer inserted
      if (error?.code === '23505') {
        const found = await this.settingsRepository.findOne({
          where: { id: SINGLETON_ID },
        });
        if (found) return found;
      }
      throw error;
    }
  }

  async update(partial: {
    codeLength?: number;
    prefixAppName?: boolean;
  }): Promise<SettingsEntity> {
    const settings = await this.get();
    if (partial.codeLength !== undefined) {
      settings.codeLength = partial.codeLength;
    }
    if (partial.prefixAppName !== undefined) {
      settings.prefixAppName = partial.prefixAppName;
    }
    return this.settingsRepository.save(settings);
  }
}
