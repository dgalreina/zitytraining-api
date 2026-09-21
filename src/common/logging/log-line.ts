// Una línea JSON por evento (una petición, un error, un mensaje suelto
// del Logger de Nest): así un visor de logs (OpenSearch, Better Stack,
// o cualquier otro que se enganche al reenvío de logs de DO) puede
// indexar campos sueltos —nivel, ruta, usuario— en vez de tener que
// hacer grep sobre texto libre. Todo lo demás de esta carpeta escribe a
// través de esto, para que el formato sea siempre el mismo.
export type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

export function writeLogLine(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  const line = JSON.stringify(entry);
  // Los niveles de error van a stderr (así se distinguen de un vistazo
  // en cualquier visor que separe ambos flujos), el resto a stdout.
  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}
