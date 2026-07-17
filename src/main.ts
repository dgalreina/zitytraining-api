import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.enableCors({
  origin: [
    'http://localhost:3000',
    'https://https://zitytraining-api-cjy9c.ondigitalocean.app/',
  ],
});
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
