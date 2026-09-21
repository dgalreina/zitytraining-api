import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request } from 'express';
import { writeLogLine } from './log-line';

type RequestWithExtras = Request & { id?: string; user?: { userId?: string; email?: string } };

// Nada se cae sin dejar un log con contexto (ruta, quién la pidió, el
// stack si lo hay). La respuesta que recibe el cliente es exactamente
// la misma que daría Nest por defecto (mismo cuerpo, mismo status):
// esto solo añade el registro por delante, no cambia el comportamiento.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithExtras>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    // Para un HttpException, getResponse() ya trae el cuerpo tal cual lo
    // arma Nest (incluye los arrays de mensajes del ValidationPipe); para
    // cualquier otra cosa, el mismo genérico que devolvería Nest por
    // defecto, sin colar el mensaje real ni el stack al cliente.
    const body = isHttpException
      ? exception.getResponse()
      : { statusCode: status, message: 'Internal server error' };

    const path = (request.originalUrl || request.url).split('?')[0];
    // Un 4xx (sin token, dato mal puesto, ruta que no existe) es tráfico
    // normal, no un fallo del código: con "warn" y sin el stack no
    // entierra en ruido los 5xx de verdad, que son los que hay que mirar.
    const is5xx = status >= HttpStatus.INTERNAL_SERVER_ERROR;
    writeLogLine(is5xx ? 'error' : 'warn', `${request.method} ${path} -> ${status}`, {
      requestId: request.id,
      method: request.method,
      path,
      status,
      userId: request.user?.userId,
      userEmail: request.user?.email,
      ...(is5xx && { stack: exception instanceof Error ? exception.stack : String(exception) }),
    });

    httpAdapter.reply(ctx.getResponse(), body, status);
  }
}
