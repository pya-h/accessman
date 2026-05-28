import { Module } from '@nestjs/common';
import { AppsModule } from '../apps/apps.module';
import { SettingsModule } from '../settings/settings.module';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';

@Module({
  imports: [AppsModule, SettingsModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
