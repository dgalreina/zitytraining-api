import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking } from './bookings.schema';
import { BookingSeries } from './booking-series.schema';
import { Holiday } from '../holidays/holidays.schema';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

// Un solo nivel de populate no basta: dentro del workout hace falta el
// nombre/categoria de cada ejercicio para poder pintarlo (icono, etc.)
const WORKOUT_POPULATE = {
  path: 'workout',
  populate: { path: 'slots.exercise', select: 'name category' },
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Cada vez que una serie necesita más rango generado (al crearla, o de
// pasada al listar si alguien mira más adelante de lo ya generado), se
// amplía hasta cubrir lo pedido más este colchón, para no tener que
// volver a ampliar en la próxima petición de la semana siguiente.
const SERIES_GENERATION_BUFFER_MS = 26 * WEEK_MS;

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<Booking>,
    @InjectModel(BookingSeries.name) private seriesModel: Model<BookingSeries>,
    @InjectModel(Holiday.name) private holidayModel: Model<Holiday>,
  ) {}

  async create(data: CreateBookingDto): Promise<Booking> {
    const { workoutId, recurrence, ...rest } = data;
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    const clients = data.clients ?? [];

    if (endTime <= startTime) {
      throw new ConflictException('La hora de fin debe ser posterior a la de inicio');
    }

    if (recurrence === 'weekly') {
      return this.createSeries(rest, clients, startTime, endTime, workoutId);
    }

    const created = new this.bookingModel({
      ...rest,
      clients,
      startTime,
      endTime,
      workout: workoutId || undefined,
    });
    return created.save();
  }

  // Crea la plantilla de la serie y genera de golpe las primeras
  // semanas; el resto se va generando de pasada según haga falta (ver
  // ensureSeriesGenerated).
  private async createSeries(
    rest: Omit<CreateBookingDto, 'workoutId' | 'recurrence'>,
    clients: string[],
    startTime: Date,
    endTime: Date,
    workoutId?: string | null,
  ): Promise<Booking> {
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

    const series = new this.seriesModel({
      trainer: rest.trainer,
      clients,
      durationMinutes,
      notes: rest.notes,
      workout: workoutId || undefined,
      isPrivate: !!rest.isPrivate,
      firstStartTime: startTime,
      // Se resta una semana para que el bucle de generación (que siempre
      // arranca en generatedUntil + 1 semana) empiece justo en firstStartTime.
      generatedUntil: new Date(startTime.getTime() - WEEK_MS),
    });
    await series.save();

    await this.generateSeriesOccurrences(
      series,
      new Date(startTime.getTime() + SERIES_GENERATION_BUFFER_MS),
    );

    const firstBooking = await this.bookingModel.findOne({ series: series._id }).sort({ startTime: 1 });
    return firstBooking!;
  }

  private async generateSeriesOccurrences(series: BookingSeries, until: Date): Promise<void> {
    const durationMs = series.durationMinutes * 60000;
    const docs: Partial<Booking>[] = [];
    let cursor = new Date(series.generatedUntil.getTime() + WEEK_MS);

    while (cursor.getTime() <= until.getTime() && (!series.endDate || cursor < series.endDate)) {
      docs.push({
        trainer: series.trainer,
        clients: series.clients,
        startTime: new Date(cursor),
        endTime: new Date(cursor.getTime() + durationMs),
        notes: series.notes,
        workout: series.workout,
        isPrivate: series.isPrivate,
        series: series._id as any,
        holidaySkip: await this.isHoliday(cursor),
      });
      cursor = new Date(cursor.getTime() + WEEK_MS);
    }

    if (docs.length > 0) {
      await this.bookingModel.insertMany(docs);
    }
    series.generatedUntil = until;
    await series.save();
  }

  private async isHoliday(date: Date): Promise<boolean> {
    const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const count = await this.holidayModel.countDocuments({ date: { $gte: dayStart, $lt: dayEnd } });
    return count > 0;
  }

  // Se llama de pasada al listar (mismo estilo que resolveExpiredPunctualPlans
  // en purchases): si alguna serie que encaja en este filtro no llega
  // generada hasta el rango pedido, se amplía ahora mismo.
  private async ensureSeriesGenerated(
    seriesFilter: Record<string, unknown>,
    to: string,
  ): Promise<void> {
    const rangeEnd = new Date(to);
    const pending = await this.seriesModel.find({
      ...seriesFilter,
      generatedUntil: { $lt: rangeEnd },
      $or: [{ endDate: { $exists: false } }, { endDate: { $gt: rangeEnd } }],
    });
    for (const series of pending) {
      const horizon = new Date(
        Math.max(rangeEnd.getTime(), series.generatedUntil.getTime()) + SERIES_GENERATION_BUFFER_MS,
      );
      await this.generateSeriesOccurrences(series, horizon);
    }
  }

  async findByTrainerAndRange(
    trainerId: string,
    requestingUserId: string,
    from: string,
    to: string,
  ): Promise<Booking[]> {
    await this.ensureSeriesGenerated({ trainer: trainerId }, to);
    const query: Record<string, unknown> = {
      trainer: trainerId,
      startTime: { $lt: new Date(to) },
      endTime: { $gt: new Date(from) },
    };
    // Las sesiones privadas de otro entrenador ni se listan.
    if (trainerId !== requestingUserId) {
      query.isPrivate = { $ne: true };
    }
    return this.bookingModel
      .find(query)
      // El telefono lo necesita el envio de recordatorios por WhatsApp.
      // Solo va en las vistas de entrenador/admin: en la de un cliente
      // expondria el numero de sus companeros de duo o trio.
      .populate('clients', 'firstName lastName phone')
      .populate(WORKOUT_POPULATE)
      .exec();
  }

  // Varios entrenadores a la vez (de 1 a N), para el filtro tipo checklist
  // del calendario. Sustituye a "un entrenador" y a "todos" con una única
  // consulta flexible.
  async findByTrainersAndRange(
    trainerIds: string[],
    requestingUserId: string,
    from: string,
    to: string,
  ): Promise<Booking[]> {
    if (trainerIds.length === 0) return [];
    await this.ensureSeriesGenerated({ trainer: { $in: trainerIds } }, to);
    return this.bookingModel
      .find({
        trainer: { $in: trainerIds },
        startTime: { $lt: new Date(to) },
        endTime: { $gt: new Date(from) },
        $or: [{ isPrivate: { $ne: true } }, { trainer: requestingUserId }],
      })
      .populate('trainer', 'firstName lastName color')
      .populate('clients', 'firstName lastName phone')
      .populate(WORKOUT_POPULATE)
      .exec();
  }

  async findByClientAndRange(
    clientId: string,
    from: string,
    to: string,
  ): Promise<Booking[]> {
    await this.ensureSeriesGenerated({ clients: clientId }, to);
    return this.bookingModel
      .find({
        clients: clientId,
        startTime: { $lt: new Date(to) },
        endTime: { $gt: new Date(from) },
      })
      .populate('trainer', 'firstName lastName color')
      .populate('clients', 'firstName lastName')
      .populate(WORKOUT_POPULATE)
      .exec();
  }

  // Igual que findByClientAndRange pero para muchos clientes de una vez:
  // una sola generacion de series y una sola consulta, en lugar de dos
  // por cliente. Sin populate a proposito, porque quien agrega estas
  // reservas (Contabilidad) solo mira fechas y estado. Un mismo Booking
  // sale una vez aunque lo compartan varios clientes (duo/trio): quien
  // llama lo reparte mirando su campo "clients".
  async findByClientsAndRange(
    clientIds: string[],
    from: string,
    to: string,
  ): Promise<Booking[]> {
    if (clientIds.length === 0) return [];
    await this.ensureSeriesGenerated({ clients: { $in: clientIds } }, to);
    return this.bookingModel
      .find({
        clients: { $in: clientIds },
        startTime: { $lt: new Date(to) },
        endTime: { $gt: new Date(from) },
      })
      .select('clients startTime status holidaySkip')
      .exec();
  }

  // Se mantiene por compatibilidad con otras posibles llamadas existentes.
  async findAllInRange(
    requestingUserId: string,
    from: string,
    to: string,
  ): Promise<Booking[]> {
    await this.ensureSeriesGenerated({}, to);
    return this.bookingModel
      .find({
        startTime: { $lt: new Date(to) },
        endTime: { $gt: new Date(from) },
        $or: [{ isPrivate: { $ne: true } }, { trainer: requestingUserId }],
      })
      .populate('trainer', 'firstName lastName color')
      .populate('clients', 'firstName lastName phone')
      .populate(WORKOUT_POPULATE)
      .exec();
  }

  async update(id: string, data: UpdateBookingDto, requestingUserId: string): Promise<Booking> {
    const existing = await this.bookingModel.findById(id);
    if (!existing) {
      throw new NotFoundException(`Booking with id ${id} not found`);
    }
    if (existing.isPrivate && existing.trainer.toString() !== requestingUserId) {
      throw new ForbiddenException('No puedes modificar una sesión privada de otro usuario');
    }

    const startTime = data.startTime ? new Date(data.startTime) : existing.startTime;
    const endTime = data.endTime ? new Date(data.endTime) : existing.endTime;

    if (endTime <= startTime) {
      throw new ConflictException('La hora de fin debe ser posterior a la de inicio');
    }

    // workoutId no forma parte del schema (el campo se llama "workout");
    // se traduce aparte. undefined = no tocar, null o id = reemplazar.
    // recurrence tampoco: no se puede convertir una sesión ya creada en
    // una serie (ni al revés) desde aquí.
    const { workoutId, recurrence, ...rest } = data;
    const updatePayload: Record<string, unknown> = { ...rest, startTime, endTime };
    if (workoutId !== undefined) {
      updatePayload.workout = workoutId;
    }

    const updated = await this.bookingModel
      .findByIdAndUpdate(id, updatePayload, { new: true })
      .populate('trainer', 'firstName lastName color')
      .populate('clients', 'firstName lastName phone')
      .populate(WORKOUT_POPULATE)
      .exec();
    return updated!;
  }

  async remove(id: string, requestingUserId: string): Promise<void> {
    const existing = await this.bookingModel.findById(id);
    if (!existing) {
      throw new NotFoundException(`Booking with id ${id} not found`);
    }
    if (existing.isPrivate && existing.trainer.toString() !== requestingUserId) {
      throw new ForbiddenException('No puedes borrar una sesión privada de otro usuario');
    }
    await this.bookingModel.findByIdAndDelete(id);
  }

  // Borra esta sesión y todas las futuras (misma fecha en adelante) de su
  // serie, y para la serie para que no genere más a partir de aquí. El
  // pasado ya generado no se toca. Si la sesión no es de ninguna serie,
  // se comporta como un borrado normal.
  async removeSeriesFrom(id: string, requestingUserId: string): Promise<void> {
    const existing = await this.bookingModel.findById(id);
    if (!existing) {
      throw new NotFoundException(`Booking with id ${id} not found`);
    }
    if (existing.isPrivate && existing.trainer.toString() !== requestingUserId) {
      throw new ForbiddenException('No puedes borrar una sesión privada de otro usuario');
    }

    if (!existing.series) {
      await this.bookingModel.findByIdAndDelete(id);
      return;
    }

    await this.bookingModel.deleteMany({
      series: existing.series,
      startTime: { $gte: existing.startTime },
    });
    await this.seriesModel.findByIdAndUpdate(existing.series, { endDate: existing.startTime });
  }
}
