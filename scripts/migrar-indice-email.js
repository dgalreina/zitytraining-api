// Retira el índice "email_1" (único a secas) que impedía dos cosas:
// reutilizar el email de alguien borrado, y tener más de un cliente sin
// email. Lo sustituye "email_unico_no_borrados", que la aplicación crea
// sola al arrancar (ver users.schema.ts); Mongo no reemplaza un índice
// cuyas opciones cambian, así que el viejo hay que quitarlo a mano.
//
// Se puede ejecutar las veces que haga falta: si ya está hecho, no toca
// nada. Antes de borrar comprueba que no haya emails repetidos entre los
// usuarios dados de alta, que es lo único que el índice viejo protegía.
//
//   node scripts/migrar-indice-email.js                  (base del .env)
//   MONGO_URI="mongodb+srv://..." node scripts/migrar-indice-email.js
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const VIEJO = 'email_1';
const NUEVO = 'email_unico_no_borrados';

function leerUri() {
  if (process.env.MONGO_URI) return process.env.MONGO_URI;
  const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  const linea = env.split(/\r?\n/).find((l) => l.startsWith('MONGO_URI='));
  if (!linea) throw new Error('No hay MONGO_URI ni en el entorno ni en .env');
  return linea.slice('MONGO_URI='.length).trim().replace(/^["']|["']$/g, '');
}

(async () => {
  await mongoose.connect(leerUri());
  const users = mongoose.connection.db.collection('users');

  const indices = await users.indexes();
  const tieneViejo = indices.some((i) => i.name === VIEJO);
  const tieneNuevo = indices.some((i) => i.name === NUEVO);
  console.log(`Índice viejo (${VIEJO}): ${tieneViejo ? 'existe' : 'ya no está'}`);
  console.log(`Índice nuevo (${NUEVO}): ${tieneNuevo ? 'creado' : 'todavía no'}`);

  if (!tieneViejo) {
    console.log('\nNada que hacer.');
    await mongoose.disconnect();
    return;
  }

  // Comprobación previa: si hubiera emails repetidos entre los que siguen
  // dados de alta, el índice nuevo no podría crearse y nos quedaríamos sin
  // ninguno protegiendo el email.
  const repetidos = await users
    .aggregate([
      { $match: { email: { $type: 'string' }, status: { $in: ['active', 'inactive'] } } },
      { $group: { _id: '$email', n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();

  if (repetidos.length > 0) {
    console.error('\nABORTADO: hay emails repetidos entre usuarios dados de alta.');
    repetidos.forEach((r) => console.error(`  ${r._id} -> ${r.n} usuarios`));
    console.error('Arregla esos duplicados antes de volver a ejecutarlo.');
    await mongoose.disconnect();
    process.exit(1);
  }

  await users.dropIndex(VIEJO);
  console.log(`\nBorrado ${VIEJO}.`);
  console.log('Al arrancar la aplicación se creará el nuevo en su lugar.');

  await mongoose.disconnect();
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
