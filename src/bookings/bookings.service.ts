import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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
    startTime: Date,
    endTime: Date,
    excludeId?: string,
  ) {
    const query: any = {
      trainer: trainerId,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const overlapping = await this.bookingModel.findOne(query).exec();

    if (overlapping) {
      throw new ConflictException(
        'El entrenador ya tiene una sesión en ese horario',
      );
    }
  }

  async create(data: CreateBookingDto): Promise<Booking> {
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);

    if (endTime <= startTime) {
      throw new ConflictException('La hora de fin debe ser posterior a la de inicio');
    }

    await this.assertNoOverlap(data.trainer, startTime, endTime);

    const created = new this.bookingModel({
      ...data,
      startTime,
      endTime,
    });
    return created.save();
  }

  async findByTrainerAndRange(
    trainerId: string,
    from: string,
    to: string,
  ): Promise<Booking[]> {
    return this.bookingModel
      .find({
        trainer: trainerId,
        startTime: { $gte: new Date(from) },
        endTime: { $lte: new Date(to) },
      })
      .populate('clients', 'firstName lastName')
      .exec();
  }

  async update(id: string, data: UpdateBookingDto): Promise<Booking> {
    const existing = await this.bookingModel.findById(id);
    if (!existing) {
      throw new NotFoundException(`Booking with id ${id} not found`);
    }

    const startTime = data.startTime ? new Date(data.startTime) : existing.startTime;
    const endTime = data.endTime ? new Date(data.endTime) : existing.endTime;
    const trainerId = data.trainer || existing.trainer.toString();

    if (endTime <= startTime) {
      throw new ConflictException('La hora de fin debe ser posterior a la de inicio');
    }

    await this.assertNoOverlap(trainerId, startTime, endTime, id);

    const updated = await this.bookingModel.findByIdAndUpdate(
      id,
      { ...data, startTime, endTime },
      { new: true },
    );
    return updated!;
  }

  async remove(id: string): Promise<void> {
    const result = await this.bookingModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException(`Booking with id ${id} not found`);
    }
  }
}