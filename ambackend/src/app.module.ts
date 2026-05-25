import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { typeormConfig } from './typeorm.config';
import { AppsModule } from './apps/apps.module';
import { TokensModule } from './tokens/tokens.module';
import { ImportModule } from './import/import.module';
import securityConfig from './config/security.config';
import tokenConfig from './config/token.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [securityConfig, tokenConfig],
    }),
    TypeOrmModule.forRoot(typeormConfig),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api/(.*)'],
      serveStaticOptions: { fallthrough: true },
    }),
    AppsModule,
    TokensModule,
    ImportModule,
  ],
})
export class AppModule {}
