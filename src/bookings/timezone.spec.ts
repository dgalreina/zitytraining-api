import { addWeeksKeepingLocalTime } from './timezone';

describe('addWeeksKeepingLocalTime', () => {
  it('mantiene la hora de pared en Madrid al cruzar el fin del horario de verano (octubre)', () => {
    // Clase de las 10:25, último domingo de octubre: España pasa de
    // CEST (UTC+2) a CET (UTC+1). Sumar 7*24h en milisegundos desplazaría
    // la hora de pared a las 9:25 (el bug real que esto reemplaza).
    const antesDelCambio = new Date('2024-10-20T08:25:00.000Z'); // 10:25 en Madrid (UTC+2)
    const siguiente = addWeeksKeepingLocalTime(antesDelCambio, 1);

    // Tras el cambio, Madrid está en UTC+1: 10:25 local son las 09:25 UTC.
    expect(siguiente.toISOString()).toBe('2024-10-27T09:25:00.000Z');
  });

  it('mantiene la hora de pared al cruzar el inicio del horario de verano (marzo)', () => {
    // Último domingo de marzo de 2024 (31): Madrid pasa de CET (UTC+1) a CEST (UTC+2).
    const antesDelCambio = new Date('2024-03-24T09:25:00.000Z'); // 10:25 en Madrid (UTC+1)
    const siguiente = addWeeksKeepingLocalTime(antesDelCambio, 1);

    expect(siguiente.toISOString()).toBe('2024-03-31T08:25:00.000Z'); // 10:25 en Madrid (UTC+2)
  });

  it('suma varias semanas seguidas sin desplazar la hora, aunque no haya cambio de horario por medio', () => {
    const inicio = new Date('2024-06-03T08:00:00.000Z'); // 10:00 en Madrid (UTC+2)
    const cuatroSemanas = addWeeksKeepingLocalTime(inicio, 4);

    expect(cuatroSemanas.toISOString()).toBe('2024-07-01T08:00:00.000Z');
  });

  it('acepta semanas negativas para ir hacia atrás', () => {
    const despuesDelCambio = new Date('2024-10-27T09:25:00.000Z'); // 10:25 en Madrid (UTC+1)
    const anterior = addWeeksKeepingLocalTime(despuesDelCambio, -1);

    expect(anterior.toISOString()).toBe('2024-10-20T08:25:00.000Z'); // 10:25 en Madrid (UTC+2)
  });
});
