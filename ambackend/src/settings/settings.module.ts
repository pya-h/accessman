import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsEntity } from './settings.entity';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { AppsModule } from '../apps/apps.module';

@Module({
  imports: [TypeOrmModule.forFeature([SettingsEntity]), AppsModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
