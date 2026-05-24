import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenEntity } from './token.entity';
import { TokensService } from './tokens.service';
import { TokensController } from './tokens.controller';
import { AppsModule } from '../apps/apps.module';

@Module({
  imports: [TypeOrmModule.forFeature([TokenEntity]), AppsModule],
  controllers: [TokensController],
  providers: [TokensService],
  exports: [TokensService],
})
export class TokensModule {}
