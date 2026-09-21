import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { writeLogLine } from './log-line';

type RequestWithExtras = Request & { id?: string; user?: { userId?: string; email?: string } };

// Una línea por petición HTTP (método, ruta, código, duración): sin
// esto no hay ni rastro de qué tráfico recibe la API, solo de lo que se
// rompe. Los errores los detalla el filtro global (con el stack); aquí
// solo se deja constancia de cuánto tardó en fallar.
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<RequestWithExtras>();
    const res = context.switchToHttp().getResponse<Response>();
    const start = Date.now();
    // Sin la query: aquí no suele llevar nada sensible, pero mejor no
    // arriesgarse a indexarla tal cual en el visor de logs.
    const path = (req.originalUrl || req.url).split('?')[0];

    const logAccess = (status: number) =>
      writeLogLine('log', `${req.method} ${path} -> ${status}`, {
        requestId: req.id,
        method: req.method,
        path,
        status,
        durationMs: Date.now() - start,
        userId: req.user?.userId,
        userEmail: req.user?.email,
      });

    return next.handle().pipe(
      tap({
        next: () => logAccess(res.statusCode),
        error: (err) => logAccess(err?.status ?? 500),
      }),
    );
  }
}
