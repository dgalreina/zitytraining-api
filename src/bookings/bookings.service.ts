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

@Injectable()
export class BookingsService {
  constructor(@InjectModel(Booking.name) private bookingModel: Model<Booking>) {}

  private async assertNoOverlap(
    trainerId: string,
    clientIds: string[],
    startTime: Date,
    endTime: Date,
    excludeId?: string,
  ) {
    const query: any = {
      $or: [{ trainer: trainerId }, { clients: { $in: clientIds } }],
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const overlapping = await this.bookingModel.findOne(query).exec();

    if (overlapping) {
      const trainerConflict = overlapping.trainer.toString() === trainerId;
      throw new ConflictException(
        trainerConflict
          ? 'El entrenador ya tiene una sesión en ese horario'
          : 'Uno de los clientes ya tiene una sesión en ese horario',
      );
    }
  }

  async create(data: CreateBookingDto): Promise<Booking> {
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    const clients = data.clients ?? [];

    if (endTime <= startTime) {
      throw new ConflictException('La hora de fin debe ser posterior a la de inicio');
    }

    await this.assertNoOverlap(data.trainer, clients, startTime, endTime);

    const created = new this.bookingModel({
      ...data,
      clients,
      startTime,
      endTime,
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
    return this.bookingModel.find(query).populate('clients', 'firstName lastName').exec();
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
    const trainerId = data.trainer || existing.trainer.toString();
    const clientIds = data.clients || existing.clients.map((c) => c.toString());

    if (endTime <= startTime) {
      throw new ConflictException('La hora de fin debe ser posterior a la de inicio');
    }

    await this.assertNoOverlap(trainerId, clientIds, startTime, endTime, id);

    const updated = await this.bookingModel.findByIdAndUpdate(
      id,
      { ...data, startTime, endTime },
      { new: true },
    );
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