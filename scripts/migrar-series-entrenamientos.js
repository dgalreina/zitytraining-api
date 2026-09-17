// Pasa los entrenamientos del formato antiguo (slots[].reps: number[]) al
// nuevo (slots[].sets: [{ reps, weight }]), que permite guardar el peso de
// cada serie. Idempotente: los slots que ya tienen "sets" no se tocan.
//
//   MONGO_URI="mongodb://..." node scripts/migrar-series-entrenamientos.js
const mongoose = require('mongoose');

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('Falta MONGO_URI');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const col = mongoose.connection.db.collection('workouts');
  const workouts = await col.find({ 'slots.reps': { $exists: true } }).toArray();

  let migrados = 0;
  for (const w of workouts) {
    const slots = w.slots.map((s) => {
      if (!Array.isArray(s.reps)) return s;
      const { reps, ...rest } = s;
      return { ...rest, sets: s.sets && s.sets.length ? s.sets : reps.map((r) => ({ reps: r })) };
    });
    await col.updateOne({ _id: w._id }, { $set: { slots } });
    migrados++;
  }
  console.log(`Entrenamientos migrados: ${migrados}`);
  await mongoose.disconnect();
})();
