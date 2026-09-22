// La generación de sesiones semanales sumaba una semana en milisegundos
// fijos a cada ocurrencia, así que la hora de pared en Madrid se
// desplazaba en cuanto una serie cruzaba un cambio de horario de
// verano/invierno (una clase de las 10:25 pasaba a las 9:25 al cruzar
// el cambio de octubre de 2026). El código ya está arreglado
// (bookings.service.ts, timezone.ts); esto corrige en la base de datos
// las sesiones futuras que ya se generaron mal antes del arreglo.
//
// Solo toca una sesión si su hora actual coincide EXACTAMENTE con lo
// que habría generado el cálculo antiguo (firstStartTime + n semanas en
// milisegundos fijos): así nunca se pisa una sesión que alguien haya
// cambiado a mano. Y solo toca sesiones futuras (startTime > ahora); las
// que ya pasaron no se tocan.
//
// Por defecto no escribe nada, solo enseña qué cambiaría:
//   node scripts/reparar-horario-verano-series.js
// Para aplicar los cambios de verdad:
//   node scripts/reparar-horario-verano-series.js --aplicar
//   MONGO_URI="mongodb+srv://..." node scripts/reparar-horario-verano-series.js --aplicar
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { DateTime } = require('luxon');

const GYM_TIMEZONE = 'Europe/Madrid';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function leerUri() {
  if (process.env.MONGO_URI) return process.env.MONGO_URI;
  const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  const linea = env.split(/\r?\n/).find((l) => l.startsWith('MONGO_URI='));
  if (!linea) throw new Error('No hay MONGO_URI ni en el entorno ni en .env');
  return linea.slice('MONGO_URI='.length).trim().replace(/^["']|["']$/g, '');
}

// Misma función que src/bookings/timezone.ts: se duplica aquí (no se
// puede importar TS directamente desde un script plano de Node) a
// propósito de mantenerla igual de simple.
function addWeeksKeepingLocalTime(date, weeks) {
  return DateTime.fromJSDate(date, { zone: GYM_TIMEZONE }).plus({ weeks }).toJSDate();
}

(async () => {
  const aplicar = process.argv.includes('--aplicar');
  await mongoose.connect(leerUri());
  const seriesCol = mongoose.connection.db.collection('bookingseries');
  const bookingsCol = mongoose.connection.db.collection('bookings');
  const ahora = new Date();

  const series = await seriesCol.find({}).toArray();
  console.log(`Series encontradas: ${series.length}\n`);

  let totalCorregidas = 0;
  let totalSaltadas = 0;

  for (const s of series) {
    const futuras = await bookingsCol
      .find({ series: s._id, startTime: { $gt: ahora } })
      .sort({ startTime: 1 })
      .toArray();
    if (futuras.length === 0) continue;

    let cambiosEnEstaSerie = 0;

    for (const b of futuras) {
      const n = Math.round((b.startTime.getTime() - s.firstStartTime.getTime()) / WEEK_MS);
      const esperadoAntiguo = new Date(s.firstStartTime.getTime() + n * WEEK_MS);
      if (esperadoAntiguo.getTime() !== b.startTime.getTime()) {
        // No coincide con el patrón de generación automática: alguien la
        // cambió a mano (u otra cosa rara). No se toca.
        totalSaltadas++;
        continue;
      }

      const nuevoInicio = addWeeksKeepingLocalTime(s.firstStartTime, n);
      if (nuevoInicio.getTime() === b.startTime.getTime()) {
        continue; // esta ocurrencia no cruza ningún cambio de horario
      }

      const duracionMs = b.endTime.getTime() - b.startTime.getTime();
      const nuevoFin = new Date(nuevoInicio.getTime() + duracionMs);

      if (cambiosEnEstaSerie === 0) {
        console.log(`Serie ${s._id} (empezó ${s.firstStartTime.toISOString()}):`);
      }
      console.log(`  ${b._id}: ${b.startTime.toISOString()} -> ${nuevoInicio.toISOString()}`);
      cambiosEnEstaSerie++;
      totalCorregidas++;

      if (aplicar) {
        await bookingsCol.updateOne(
          { _id: b._id },
          { $set: { startTime: nuevoInicio, endTime: nuevoFin } },
        );
      }
    }
  }

  console.log(`\n${aplicar ? 'Corregidas' : 'Se corregirían'}: ${totalCorregidas}`);
  console.log(`Saltadas (no coinciden con el patrón, no se tocan): ${totalSaltadas}`);
  if (!aplicar && totalCorregidas > 0) {
    console.log('\nNada escrito todavía. Repite con --aplicar para guardar los cambios.');
  }
  await mongoose.disconnect();
})();
