import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TimeEntry } from './attendance.schema';

const AUTO_CLOCK_OUT_HOUR = 22;

function cutoffFor(date: Date): Date {
  const cutoff = new Date(date);
  cutoff.setHours(AUTO_CLOCK_OUT_HOUR, 0, 0, 0);
  return cutoff;
}

@Injectable()
export class AttendanceService {
  constructor(@InjectModel(TimeEntry.name) private timeEntryModel: Model<TimeEntry>) {}

  // Cierra solos los fichajes abiertos cuyo dia ya paso de las 22:00, en
  // vez de dejarlos fichados para siempre porque alguien se olvido de
  // fichar la salida. Se llama de pasada al listar o al fichar de nuevo,
  // no hay tarea programada aparte (mismo patron que los planes puntuales).
  private async resolveForgottenClockOuts(filter: Record<string, unknown> = {}): Promise<void> {
    const open = await this.timeEntryModel.find({ ...filter, clockOut: { $exists: false } });
    const now = new Date();

    for (const entry of open) {
      const cutoff = cutoffFor(entry.clockIn);
      if (now.getTime() > cutoff.getTime()) {
        entry.clockOut = cutoff;
        entry.autoClockedOut = true;
        await entry.save();
      }
    }
  }

  async clockIn(trainerId: string): Promise<TimeEntry> {
    await this.resolveForgottenClockOuts({ trainer: trainerId });

    const open = await this.timeEntryModel.findOne({ trainer: trainerId, clockOut: { $exists: false } });
    if (open) {
      throw new BadRequestException('Ya tienes una entrada fichada sin salida');
    }

    const created = new this.timeEntryModel({ trainer: trainerId, clockIn: new Date() });
    return created.save();
  }

  async clockOut(trainerId: string): Promise<TimeEntry> {
    await this.resolveForgottenClockOuts({ trainer: trainerId });

    const open = await this.timeEntryModel.findOne({ trainer: trainerId, clockOut: { $exists: false } });
    if (!open) {
      throw new BadRequestException('No tienes ninguna entrada fichada');
    }

    open.clockOut = new Date();
    return open.save();
  }

  async getStatus(trainerId: string): Promise<{ clockedIn: boolean; since?: Date }> {
    await this.resolveForgottenClockOuts({ trainer: trainerId });
    const open = await this.timeEntryModel.findOne({ trainer: trainerId, clockOut: { $exists: false } });
    return open ? { clockedIn: true, since: open.clockIn } : { clockedIn: false };
  }

  async findByTrainer(trainerId: string): Promise<TimeEntry[]> {
    await this.resolveForgottenClockOuts({ trainer: trainerId });
    return this.timeEntryModel.find({ trainer: trainerId }).sort({ clockIn: -1 }).exec();
  }

  // Para el admin: todos los fichajes de todos los entrenadores.
  async findAll(): Promise<TimeEntry[]> {
    await this.resolveForgottenClockOuts();
    return this.timeEntryModel
      .find()
      .sort({ clockIn: -1 })
      .populate('trainer', 'firstName lastName color')
      .exec();
  }
}
