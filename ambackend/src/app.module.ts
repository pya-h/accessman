import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeormConfig } from './typeorm.config';
import { AppsModule } from './apps/apps.module';
import { TokensModule } from './tokens/tokens.module';
import securityConfig from './config/security.config';
import tokenConfig from './config/token.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [securityConfig, tokenConfig],
    }),
    TypeOrmModule.forRoot(typeormConfig),
    AppsModule,
    TokensModule,
  ],
})
export class AppModule {}
