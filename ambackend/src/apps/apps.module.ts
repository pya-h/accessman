import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppEntity } from './app.entity';
import { AppsService } from './apps.service';

@Module({
  imports: [TypeOrmModule.forFeature([AppEntity])],
  providers: [AppsService],
  exports: [AppsService],
})
export class AppsModule {}
