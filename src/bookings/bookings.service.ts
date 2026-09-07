import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking } from './bookings.schema';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';

// Un solo nivel de populate no basta: dentro del workout hace falta el
// nombre/categoria de cada ejercicio para poder pintarlo (icono, etc.)
const WORKOUT_POPULATE = {
  path: 'workout',
  populate: { path: 'slots.exercise', select: 'name category' },
};

@Injectable()
export class BookingsService {
  constructor(@InjectModel(Booking.name) private bookingModel: Model<Booking>) {}

  async create(data: CreateBookingDto): Promise<Booking> {
    const { workoutId, ...rest } = data;
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    const clients = data.clients ?? [];

    if (endTime <= startTime) {
      throw new ConflictException('La hora de fin debe ser posterior a la de inicio');
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

  async findByTrainerAndRange(
    trainerId: string,
    requestingUserId: string,
    from: string,
    to: string,
  ): Promise<Booking[]> {
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
      .populate('clients', 'firstName lastName')
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
    return this.bookingModel
      .find({
        trainer: { $in: trainerIds },
        startTime: { $lt: new Date(to) },
        endTime: { $gt: new Date(from) },
        $or: [{ isPrivate: { $ne: true } }, { trainer: requestingUserId }],
      })
      .populate('trainer', 'firstName lastName color')
      .populate('clients', 'firstName lastName')
      .populate(WORKOUT_POPULATE)
      .exec();
  }

  async findByClientAndRange(
    clientId: string,
    from: string,
    to: string,
  ): Promise<Booking[]> {
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

  // Se mantiene por compatibilidad con otras posibles llamadas existentes.
  async findAllInRange(
    requestingUserId: string,
    from: string,
    to: string,
  ): Promise<Booking[]> {
    return this.bookingModel
      .find({
        startTime: { $lt: new Date(to) },
        endTime: { $gt: new Date(from) },
        $or: [{ isPrivate: { $ne: true } }, { trainer: requestingUserId }],
      })
      .populate('trainer', 'firstName lastName color')
      .populate('clients', 'firstName lastName')
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
    const { workoutId, ...rest } = data;
    const updatePayload: Record<string, unknown> = { ...rest, startTime, endTime };
    if (workoutId !== undefined) {
      updatePayload.workout = workoutId;
    }

    const updated = await this.bookingModel
      .findByIdAndUpdate(id, updatePayload, { new: true })
      .populate('trainer', 'firstName lastName color')
      .populate('clients', 'firstName lastName')
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
}