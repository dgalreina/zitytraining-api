# ZityTraining · API

NestJS + Mongoose. Sirve a `zitytraining-web`, que está en un repositorio
aparte (carpeta hermana `zitytraining-web`).

## Reglas de negocio que no se deducen leyendo el código

- **"Sesiones libres" no existe como `Plan` en la base de datos.** Se
  construye al vuelo y su `Purchase` lleva un `itemId` sintético
  `sesiones-libres-<categoria>-<dias>d-<duracion>` (compras antiguas:
  `sesiones-libres-<duracion>` o `sesiones-libres-<dias>d-<duracion>`),
  nunca un `ObjectId`. Para reconocerla, mirar el prefijo
  `sesiones-libres-`; nunca el texto de `itemLabel`.

- **Los planes mensuales siempre empiezan el día 1 y se cobran enteros.**
  Un plan puntual va de día 1 a día 1, y si abarca varios meses se cobra
  el precio mensual **por cada mes**, no un importe único repartido.

- **Cuando un plan se para o se cambia a mitad de mes**, el admin elige
  cómo se cierra ese último mes (`finalMonthBilling`: mes completo,
  solo las sesiones dadas, o nada). Sin elección guardada se asume mes
  completo, que es como se facturaba antes de existir ese campo.

- **Un plan en pausa (`PAUSED`) está cubierto por un puntual** durante
  ese periodo, y no tiene fecha de fin propia. Al agregarlo en cálculos
  hay que excluirlo o el mes se cobra dos veces (fue un error real).

- **Las clases recurrentes se materializan bajo demanda**
  (`ensureSeriesGenerated`): leer las reservas de un rango puede escribir
  en la base de datos. Evita llamarlo dentro de un bucle por cliente;
  su filtro acepta varios de golpe.

- **Una clase semanal nunca se repite sumando milisegundos fijos.** El
  gimnasio está en Madrid, que cambia de horario dos veces al año: sumar
  `7 * 24h` en milisegundos mantiene igual la hora UTC pero desplaza la
  hora de pared en cuanto de por medio hay un cambio de horario (fue un
  bug real: una clase de las 10:25 pasaba a las 9:25 sola en octubre).
  Usar siempre `addWeeksKeepingLocalTime` (`bookings/timezone.ts`), que
  suma semanas en el huso horario del gimnasio.

## Convenciones

- Comentarios en español, y explicando el **porqué**, no el qué. Si el
  comentario repite lo que ya dice el código, sobra.
- `npx tsc --noEmit -p tsconfig.json` después de cada cambio.

## Git

- **No hacer `commit` ni `push` sin permiso explícito**, aunque se haya
  dado antes en esa misma conversación. Enseña lo que has hecho y
  pregunta.
