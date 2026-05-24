import { Module } from '@nestjs/common';
import { AppsModule } from '../apps/apps.module';
import { ImportService } from './import.service';
import { ImportController } from './import.controller';

@Module({
  imports: [AppsModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
