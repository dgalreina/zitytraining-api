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
