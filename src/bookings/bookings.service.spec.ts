import { BookingsService } from './bookings.service';
import { DateTime } from 'luxon';
import { GYM_TIMEZONE } from './timezone';

// Igual que con accounting.service.spec.ts: nada aquí necesita una base de
// datos real, solo mocks mínimos de los modelos de Mongoose inyectados.
function makeSeriesModelMock() {
  const Ctor: any = jest.fn().mockImplementation(function (this: any, data: any) {
    Object.assign(this, data);
    this._id = 'series-1';
    this.save = jest.fn().mockResolvedValue(this);
  });
  Ctor.find = jest.fn();
  Ctor.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
  return Ctor;
}

function makeBookingModelMock() {
  const Ctor: any = jest.fn();
  Ctor.insertMany = jest.fn().mockResolvedValue([]);
  Ctor.findOne = jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue({ _id: 'first' }) });
  Ctor.findById = jest.fn();
  Ctor.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 0 });
  Ctor.findByIdAndDelete = jest.fn();
  Ctor.findByIdAndUpdate = jest.fn().mockReturnValue({
    populate: () => ({
      populate: () => ({
        populate: () => ({ exec: () => Promise.resolve({ _id: 'updated' }) }),
      }),
    }),
  });
  return Ctor;
}

function makeHolidayModelMock(holidayDates: string[] = []) {
  return {
    countDocuments: jest.fn().mockImplementation(({ date }: any) => {
      const day = date.$gte.toISOString().slice(0, 10);
      return Promise.resolve(holidayDates.includes(day) ? 1 : 0);
    }),
  };
}

const baseBooking = {
  trainer: 't1',
  clients: ['c1'],
  recurrence: 'weekly' as const,
};

describe('BookingsService — generación de series recurrentes', () => {
  it('genera una ocurrencia por semana hasta el colchón de generación, una por cada lunes', async () => {
    const bookingModel = makeBookingModelMock();
    const seriesModel = makeSeriesModelMock();
    const holidayModel = makeHolidayModelMock();
    const service = new BookingsService(bookingModel, seriesModel, holidayModel as any);

    await service.create({
      ...baseBooking,
      startTime: '2024-06-03T08:00:00.000Z', // 10:00 en Madrid
      endTime: '2024-06-03T08:45:00.000Z',
    } as any);

    expect(bookingModel.insertMany).toHaveBeenCalledTimes(1);
    const docs = bookingModel.insertMany.mock.calls[0][0] as any[];

    // El colchón son 26 semanas (ver SERIES_GENERATION_BUFFER_MS); el
    // rango cubre un cambio de horario (octubre 2024), así que el hueco en
    // milisegundos entre dos ocurrencias no siempre es el mismo, pero la
    // hora de pared en Madrid sí: por eso se comprueba así y no con
    // restas de milisegundos (ver el siguiente test para el porqué).
    expect(docs.length).toBeGreaterThanOrEqual(26);
    expect(docs.length).toBeLessThanOrEqual(28);
    expect(docs[0].startTime.toISOString()).toBe('2024-06-03T08:00:00.000Z');
    const horasLocales = docs.map((d) =>
      DateTime.fromJSDate(d.startTime, { zone: GYM_TIMEZONE }).toFormat('HH:mm'),
    );
    expect(new Set(horasLocales)).toEqual(new Set(['10:00']));
  });

  it('mantiene la hora de pared en Madrid al generar ocurrencias que cruzan el cambio de horario de octubre', async () => {
    const bookingModel = makeBookingModelMock();
    const seriesModel = makeSeriesModelMock();
    const holidayModel = makeHolidayModelMock();
    const service = new BookingsService(bookingModel, seriesModel, holidayModel as any);

    await service.create({
      ...baseBooking,
      startTime: '2024-10-13T08:25:00.000Z', // 10:25 en Madrid (UTC+2), unas semanas antes del cambio
      endTime: '2024-10-13T09:10:00.000Z',
    } as any);

    const docs = bookingModel.insertMany.mock.calls[0][0] as any[];
    const horasLocales = docs.map((d) =>
      DateTime.fromJSDate(d.startTime, { zone: GYM_TIMEZONE }).toFormat('HH:mm'),
    );

    // Todas las ocurrencias deben seguir siendo "10:25" en Madrid, se cruce
    // o no el cambio de horario por medio — si se sumaran milisegundos
    // fijos, las posteriores al cambio pasarían a ser "09:25" (bug real).
    expect(new Set(horasLocales)).toEqual(new Set(['10:25']));
  });

  it('respeta la fecha de fin de la serie y deja de generar a partir de ahí', async () => {
    const bookingModel = makeBookingModelMock();
    const seriesModel = makeSeriesModelMock();
    const holidayModel = makeHolidayModelMock();
    seriesModel.mockImplementation(function (this: any, data: any) {
      Object.assign(this, data);
      this._id = 'series-1';
      this.endDate = new Date('2024-06-24T08:00:00.000Z'); // corta justo en la 4ª ocurrencia (semana 3)
      this.save = jest.fn().mockResolvedValue(this);
    });
    const service = new BookingsService(bookingModel, seriesModel, holidayModel as any);

    await service.create({
      ...baseBooking,
      startTime: '2024-06-03T08:00:00.000Z',
      endTime: '2024-06-03T08:45:00.000Z',
    } as any);

    const docs = bookingModel.insertMany.mock.calls[0][0] as any[];
    // Semanas 0, 1 y 2 (3/06, 10/06, 17/06): la de 24/06 no entra porque
    // la condición del bucle es "cursor < endDate", estricta.
    expect(docs).toHaveLength(3);
    expect(docs[2].startTime.toISOString()).toBe('2024-06-17T08:00:00.000Z');
  });

  it('marca holidaySkip en las ocurrencias que caen en festivo', async () => {
    const bookingModel = makeBookingModelMock();
    const seriesModel = makeSeriesModelMock();
    const holidayModel = makeHolidayModelMock(['2024-06-10']); // festivo en la 2ª semana
    seriesModel.mockImplementation(function (this: any, data: any) {
      Object.assign(this, data);
      this._id = 'series-1';
      this.endDate = new Date('2024-06-24T08:00:00.000Z');
      this.save = jest.fn().mockResolvedValue(this);
    });
    const service = new BookingsService(bookingModel, seriesModel, holidayModel as any);

    await service.create({
      ...baseBooking,
      startTime: '2024-06-03T08:00:00.000Z',
      endTime: '2024-06-03T08:45:00.000Z',
    } as any);

    const docs = bookingModel.insertMany.mock.calls[0][0] as any[];
    expect(docs.map((d) => d.holidaySkip)).toEqual([false, true, false]);
  });
});

describe('BookingsService.removeSeriesFrom', () => {
  it('borra esta sesión y las futuras de la serie, y cierra la serie en esa fecha', async () => {
    const bookingModel = makeBookingModelMock();
    const seriesModel = makeSeriesModelMock();
    const existing = {
      _id: 'b1',
      isPrivate: false,
      trainer: { toString: () => 't1' },
      series: 'series-x',
      startTime: new Date('2024-06-10T08:00:00.000Z'),
    };
    bookingModel.findById.mockResolvedValue(existing);
    const service = new BookingsService(bookingModel, seriesModel, {} as any);

    await service.removeSeriesFrom('b1', 't1');

    expect(bookingModel.deleteMany).toHaveBeenCalledWith({
      series: 'series-x',
      startTime: { $gte: existing.startTime },
    });
    expect(seriesModel.findByIdAndUpdate).toHaveBeenCalledWith('series-x', {
      endDate: existing.startTime,
    });
  });

  it('si la sesión no pertenece a ninguna serie, se borra solo ella', async () => {
    const bookingModel = makeBookingModelMock();
    const seriesModel = makeSeriesModelMock();
    const existing = {
      _id: 'b1',
      isPrivate: false,
      trainer: { toString: () => 't1' },
      series: null,
      startTime: new Date('2024-06-10T08:00:00.000Z'),
    };
    bookingModel.findById.mockResolvedValue(existing);
    const service = new BookingsService(bookingModel, seriesModel, {} as any);

    await service.removeSeriesFrom('b1', 't1');

    expect(bookingModel.findByIdAndDelete).toHaveBeenCalledWith('b1');
    expect(bookingModel.deleteMany).not.toHaveBeenCalled();
  });

  it('impide borrar una sesión privada de otro entrenador', async () => {
    const bookingModel = makeBookingModelMock();
    const seriesModel = makeSeriesModelMock();
    const existing = {
      _id: 'b1',
      isPrivate: true,
      trainer: { toString: () => 't1' },
      series: null,
      startTime: new Date('2024-06-10T08:00:00.000Z'),
    };
    bookingModel.findById.mockResolvedValue(existing);
    const service = new BookingsService(bookingModel, seriesModel, {} as any);

    await expect(service.removeSeriesFrom('b1', 'otro-usuario')).rejects.toThrow(
      'No puedes borrar una sesión privada de otro usuario',
    );
  });
});

describe('BookingsService.ensureSeriesGenerated (privado) — ampliar una serie ya existente', () => {
  it('genera solo las ocurrencias que faltan a partir de donde se quedó, no desde el principio', async () => {
    const bookingModel = makeBookingModelMock();
    const holidayModel = makeHolidayModelMock();
    const seriesModel = makeSeriesModelMock();

    const existingSeries: any = {
      _id: 'series-existente',
      trainer: 't1',
      clients: ['c1'],
      durationMinutes: 60,
      isPrivate: false,
      isInterview: false,
      generatedUntil: new Date('2024-06-03T08:00:00.000Z'), // ya generada hasta aquí
      save: jest.fn().mockResolvedValue(undefined),
    };
    seriesModel.find.mockResolvedValue([existingSeries]);

    const service = new BookingsService(bookingModel, seriesModel, holidayModel as any);

    // Pide hasta el 24 de junio: la serie solo llega generada hasta el 3,
    // así que hay que ampliarla.
    const rangeEnd = '2024-06-24T00:00:00.000Z';
    await (service as any).ensureSeriesGenerated({ trainer: 't1' }, rangeEnd);

    expect(seriesModel.find).toHaveBeenCalledWith({
      trainer: 't1',
      generatedUntil: { $lt: new Date(rangeEnd) },
      $or: [{ endDate: { $exists: false } }, { endDate: { $gt: new Date(rangeEnd) } }],
    });

    expect(bookingModel.insertMany).toHaveBeenCalledTimes(1);
    const docs = bookingModel.insertMany.mock.calls[0][0] as any[];
    // La primera ocurrencia nueva es la semana siguiente a donde se quedó
    // (3 de junio + 1 semana = 10 de junio): no vuelve a generar el 3.
    expect(docs[0].startTime.toISOString()).toBe('2024-06-10T08:00:00.000Z');
    expect(docs.every((d) => d.series === 'series-existente')).toBe(true);

    // generatedUntil queda por delante de lo pedido (rangeEnd + colchón).
    expect(existingSeries.generatedUntil.getTime()).toBeGreaterThan(new Date(rangeEnd).getTime());
    expect(existingSeries.save).toHaveBeenCalledTimes(1);
  });
});

describe('BookingsService.update — convertir una sesión puntual en semanal', () => {
  it('con recurrence weekly y sin serie previa, crea la serie a partir de esta sesión y genera las semanas siguientes', async () => {
    const bookingModel = makeBookingModelMock();
    const seriesModel = makeSeriesModelMock();
    const holidayModel = makeHolidayModelMock();
    const existing: any = {
      _id: 'b1',
      isPrivate: false,
      trainer: { toString: () => 't1' },
      clients: ['c1'],
      notes: 'nota original',
      workout: undefined,
      series: null,
      startTime: new Date('2024-06-03T08:00:00.000Z'),
      endTime: new Date('2024-06-03T09:00:00.000Z'),
    };
    bookingModel.findById.mockResolvedValue(existing);
    const service = new BookingsService(bookingModel, seriesModel, holidayModel as any);

    await service.update(
      'b1',
      {
        trainer: 't1',
        clients: ['c1'],
        startTime: '2024-06-03T08:00:00.000Z',
        endTime: '2024-06-03T09:00:00.000Z',
        recurrence: 'weekly',
      } as any,
      't1',
    );

    // La serie se crea con esta misma sesión como primera ocurrencia: no
    // se genera otra vez el 3 de junio, generatedUntil ya cubre esa fecha.
    expect(seriesModel).toHaveBeenCalledTimes(1);
    const seriesData = seriesModel.mock.calls[0][0];
    expect(seriesData.firstStartTime).toEqual(new Date('2024-06-03T08:00:00.000Z'));
    expect(seriesData.generatedUntil).toEqual(new Date('2024-06-03T08:00:00.000Z'));
    expect(seriesData.trainer).toBe('t1');

    // Se generan las semanas siguientes (10 de junio en adelante).
    expect(bookingModel.insertMany).toHaveBeenCalledTimes(1);
    const docs = bookingModel.insertMany.mock.calls[0][0] as any[];
    expect(docs[0].startTime.toISOString()).toBe('2024-06-10T08:00:00.000Z');

    // La propia sesión editada queda enlazada a la serie nueva.
    expect(bookingModel.findByIdAndUpdate).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({ series: 'series-1' }),
      { new: true },
    );
  });

  it('si la sesión ya pertenece a una serie, recurrence weekly no crea una serie duplicada', async () => {
    const bookingModel = makeBookingModelMock();
    const seriesModel = makeSeriesModelMock();
    const holidayModel = makeHolidayModelMock();
    const existing: any = {
      _id: 'b1',
      isPrivate: false,
      trainer: { toString: () => 't1' },
      clients: ['c1'],
      series: 'series-ya-existente',
      startTime: new Date('2024-06-03T08:00:00.000Z'),
      endTime: new Date('2024-06-03T09:00:00.000Z'),
    };
    bookingModel.findById.mockResolvedValue(existing);
    const service = new BookingsService(bookingModel, seriesModel, holidayModel as any);

    await service.update(
      'b1',
      {
        startTime: '2024-06-03T08:00:00.000Z',
        endTime: '2024-06-03T09:00:00.000Z',
        recurrence: 'weekly',
      } as any,
      't1',
    );

    expect(seriesModel).not.toHaveBeenCalled();
    expect(bookingModel.insertMany).not.toHaveBeenCalled();
  });

  it('sin recurrence (o "once"), una edición normal no toca ninguna serie', async () => {
    const bookingModel = makeBookingModelMock();
    const seriesModel = makeSeriesModelMock();
    const holidayModel = makeHolidayModelMock();
    const existing: any = {
      _id: 'b1',
      isPrivate: false,
      trainer: { toString: () => 't1' },
      clients: ['c1'],
      series: null,
      startTime: new Date('2024-06-03T08:00:00.000Z'),
      endTime: new Date('2024-06-03T09:00:00.000Z'),
    };
    bookingModel.findById.mockResolvedValue(existing);
    const service = new BookingsService(bookingModel, seriesModel, holidayModel as any);

    await service.update(
      'b1',
      { notes: 'solo cambio la nota' } as any,
      't1',
    );

    expect(seriesModel).not.toHaveBeenCalled();
    expect(bookingModel.insertMany).not.toHaveBeenCalled();
  });
});
