# ZityTraining · API

NestJS + Mongoose. Sirve a `zitytraining-web`, que está en un repositorio
aparte (carpeta hermana `zitytraining-web`).

## Reglas de negocio que no se deducen leyendo el código

- **"Sesiones libres" no existe como `Plan` en la base de datos.** Se
  construye al vuelo y su `Purchase` lleva un `itemId` sintético
  `sesiones-libres-<duracion>`, nunca un `ObjectId`. Para reconocerla,
  mirar ese prefijo; nunca el texto de `itemLabel`.

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

## Convenciones

- Comentarios en español, y explicando el **porqué**, no el qué. Si el
  comentario repite lo que ya dice el código, sobra.
- `npx tsc --noEmit -p tsconfig.json` después de cada cambio.

## Git

- **No hacer `commit` ni `push` sin permiso explícito**, aunque se haya
  dado antes en esa misma conversación. Enseña lo que has hecho y
  pregunta.
