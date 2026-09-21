import { randomUUID } from 'crypto';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { JsonLoggerService } from './common/logging/json-logger.service';
import { LoggingInterceptor } from './common/logging/logging.interceptor';
import { AllExceptionsFilter } from './common/logging/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    // Todo lo que pase por Logger de Nest (el propio arranque, y el
    // `new Logger(NombreDeLaClase)` de cada servicio) sale en JSON en
    // vez del texto coloreado por defecto: así se puede enganchar a un
    // visor de logs de verdad en vez de leerlo suelto en DO.
    logger: new JsonLoggerService(),
  });

  // Id de correlación por petición: va en todos los logs de esa
  // petición (acceso y error, si lo hay) y en la cabecera de la
  // respuesta, para poder seguirle la pista a una sola búsqueda en el
  // visor de logs en vez de adivinar qué líneas van juntas.
  app.use((req: Request & { id?: string }, res: Response, next: NextFunction) => {
    req.id = randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://zitytraining-web-6tkjf.ondigitalocean.app',
    ],
  });
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
