import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppEntity } from './app.entity';

@Injectable()
export class AppsService {
  constructor(
    @InjectRepository(AppEntity)
    private readonly appsRepository: Repository<AppEntity>,
  ) {}

  async findByName(name: string): Promise<AppEntity | null> {
    return this.appsRepository.findOne({ where: { name } });
  }

  async findAll(): Promise<AppEntity[]> {
    return this.appsRepository.find({ order: { name: 'ASC' } });
  }

  async create(name: string): Promise<AppEntity> {
    const existing = await this.findByName(name);
    if (existing) {
      throw new ConflictException(`App "${name}" already exists`);
    }
    try {
      const app = this.appsRepository.create({ name });
      return await this.appsRepository.save(app);
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new ConflictException(`App "${name}" already exists`);
      }
      throw error;
    }
  }

  async findOrCreate(name: string): Promise<AppEntity> {
    const existing = await this.findByName(name);
    if (existing) return existing;
    try {
      const app = this.appsRepository.create({ name });
      return await this.appsRepository.save(app);
    } catch (error: any) {
      if (error?.code === '23505') {
        const found = await this.findByName(name);
        if (found) return found;
      }
      throw error;
    }
  }
}
