import { DateTime } from 'luxon';

// El gimnasio solo opera en Madrid: hace falta saber su huso horario
// para repetir una clase semana a semana sin que se desplace la hora.
export const GYM_TIMEZONE = 'Europe/Madrid';

// Sumar una semana en milisegundos fijos mantiene igual la hora UTC,
// pero desplaza la hora de pared en Madrid en cuanto de por medio hay
// un cambio de horario de verano/invierno (una clase de las 10:25
// pasaría a las 9:25 en cuanto se cruza el cambio de octubre; fue un
// error real). Esto suma semanas en el huso horario del gimnasio: la
// hora de pared se mantiene fija y es el instante UTC el que se ajusta
// solo. `weeks` puede ser negativo, para ir hacia atrás.
export function addWeeksKeepingLocalTime(date: Date, weeks: number): Date {
  return DateTime.fromJSDate(date, { zone: GYM_TIMEZONE }).plus({ weeks }).toJSDate();
}

// Al mover una sesión de una serie a otro día/hora para "esta y todas las
// futuras", hay que repetir el mismo cambio en cada ocurrencia: no un
// desplazamiento fijo en milisegundos (eso arrastra el lío del cambio de
// hora, igual que addWeeksKeepingLocalTime), sino "pasa a caer este día de
// la semana, a esta hora", calculado en la zona del gimnasio.
export function shiftKeepingWeekPattern(date: Date, oldAnchor: Date, newAnchor: Date): Date {
  const oldLocal = DateTime.fromJSDate(oldAnchor, { zone: GYM_TIMEZONE });
  const newLocal = DateTime.fromJSDate(newAnchor, { zone: GYM_TIMEZONE });
  const dayDelta = newLocal.weekday - oldLocal.weekday;

  return DateTime.fromJSDate(date, { zone: GYM_TIMEZONE })
    .plus({ days: dayDelta })
    .set({ hour: newLocal.hour, minute: newLocal.minute, second: 0, millisecond: 0 })
    .toJSDate();
}

// Los formularios de fichaje manual mandan la fecha/hora tal cual se ve
// en pantalla ("2024-06-03T09:00", sin zona horaria). `new Date(...)`
// interpreta eso como hora local del SERVIDOR, no del gimnasio: en local
// coincide (el dev corre en Madrid), pero en producción el servidor va en
// UTC, así que un fichaje de las 09:00 se guardaba como 09:00 UTC (las
// 11:00 en Madrid) en vez de las 07:00 UTC que tocan. Esto lo interpreta
// siempre como hora de Madrid, sea cual sea la zona del servidor.
export function parseMadridDateTime(value: string): Date {
  return DateTime.fromISO(value, { zone: GYM_TIMEZONE }).toJSDate();
}

// Mismo problema que parseMadridDateTime pero al revés: para calcular
// "las 22:00 de ese día" hace falta saber qué día es EN MADRID (no en el
// servidor) y fijar la hora en esa misma zona.
export function atMadridHour(date: Date, hour: number): Date {
  return DateTime.fromJSDate(date, { zone: GYM_TIMEZONE })
    .set({ hour, minute: 0, second: 0, millisecond: 0 })
    .toJSDate();
}

// Día y hora en Madrid, en castellano, para dejar constancia de qué
// sesión recuperó una clase debida (p.ej. "26 de octubre a las 10:00").
export function formatMadridDateTime(date: Date): string {
  return DateTime.fromJSDate(date, { zone: GYM_TIMEZONE })
    .setLocale('es')
    .toFormat("d 'de' LLLL 'a las' HH:mm");
}
