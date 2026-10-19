import { Controller, Get } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { AppService } from './app.service';

// Se lee del propio package.json en vez de importarlo (el tsconfig no
// tiene resolveJsonModule), y una sola vez al arrancar: no cambia en
// caliente, así que no hace falta releerlo en cada petición.
const APP_VERSION: string = JSON.parse(
  readFileSync(join(process.cwd(), 'package.json'), 'utf-8'),
).version;

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Pública (sin login): para que el front pueda enseñar qué versión del
  // backend está corriendo sin pedir nada antes.
  @Get('version')
  getVersion(): { version: string } {
    return { version: APP_VERSION };
  }
}
