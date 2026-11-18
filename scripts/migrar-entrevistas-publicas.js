// Las entrevistas (isInterview) dejaron de forzar isPrivate=true: ahora las
// ve y gestiona cualquier entrenador, no solo quien las creó. Esto pone
// isPrivate=false en las entrevistas (y series de entrevistas) ya
// guardadas con isPrivate=true, para que se vean desde ya sin esperar a
// que alguien las edite. Idempotente.
//
//   MONGO_URI="mongodb://..." node scripts/migrar-entrevistas-publicas.js
const mongoose = require('mongoose');

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('Falta MONGO_URI');
    process.exit(1);
  }
  await mongoose.connect(uri);

  const bookings = mongoose.connection.db.collection('bookings');
  const series = mongoose.connection.db.collection('bookingseries');

  const resultBookings = await bookings.updateMany(
    { isInterview: true, isPrivate: true },
    { $set: { isPrivate: false } },
  );
  const resultSeries = await series.updateMany(
    { isInterview: true, isPrivate: true },
    { $set: { isPrivate: false } },
  );

  console.log(`Sesiones de entrevista actualizadas: ${resultBookings.modifiedCount}`);
  console.log(`Series de entrevista actualizadas: ${resultSeries.modifiedCount}`);
  await mongoose.disconnect();
})();
