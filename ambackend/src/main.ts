import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  app
    .getHttpAdapter()
    .getInstance()
    .addContentTypeParser(
      'text/csv',
      { parseAs: 'string' },
      (_req: any, body: string, done: (err: null, body: string) => void) => {
        done(null, body);
      },
    );

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
