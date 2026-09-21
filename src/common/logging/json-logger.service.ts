import { LoggerService } from '@nestjs/common';
import { LogLevel, writeLogLine } from './log-line';

// Un Error no serializa nada útil con JSON.stringify (message y stack
// no son enumerables): hay que sacarlos a mano o se pierden.
function serializeParam(value: unknown): unknown {
  if (value instanceof Error) {
    return { message: value.message, stack: value.stack, name: value.name };
  }
  return value;
}

// Sustituye al logger de consola por defecto de Nest (se engancha una
// vez en el bootstrap de main.ts vía `app.useLogger(...)`): el uso de
// siempre no cambia, sigue siendo `new Logger(NombreDeLaClase)` +
// `this.logger.log/warn/error(...)` en cada servicio, pero cada línea
// sale en JSON en vez del texto coloreado de Nest.
//
// Nest siempre añade el contexto (el nombre de la clase) como último
// parámetro de texto al delegar en el logger activo; por eso, si el
// único extra que llega es un string, se guarda como "context" y no
// como "meta" genérico.
export class JsonLoggerService implements LoggerService {
  private write(level: LogLevel, message: unknown, optionalParams: unknown[]): void {
    const meta: Record<string, unknown> = {};
    if (optionalParams.length === 1 && typeof optionalParams[0] === 'string') {
      meta.context = optionalParams[0];
    } else if (optionalParams.length === 1) {
      meta.meta = serializeParam(optionalParams[0]);
    } else if (optionalParams.length > 1) {
      meta.meta = optionalParams.map(serializeParam);
    }
    writeLogLine(level, typeof message === 'string' ? message : JSON.stringify(message), meta);
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('log', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }
}
