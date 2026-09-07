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

  // Fichaje a mano: para cuando el entrenador se olvidó de fichar en su
  // momento. Admite entrada y salida juntas (tramo ya cerrado), o solo una
  // de las dos: solo entrada deja un tramo abierto como un fichaje normal;
  // solo salida cierra el tramo que ya estuviera abierto. Se marca aparte
  // (manual) para que se note.
  async createManual(trainerId: string, clockIn?: string, clockOut?: string): Promise<TimeEntry> {
    await this.resolveForgottenClockOuts({ trainer: trainerId });

    if (!clockIn && !clockOut) {
      throw new BadRequestException('Indica al menos una hora de entrada o de salida');
    }

    if (!clockIn) {
      const open = await this.timeEntryModel.findOne({ trainer: trainerId, clockOut: { $exists: false } });
      if (!open) {
        throw new BadRequestException('No tienes ninguna entrada fichada para poder cerrarla');
      }
      const end = new Date(clockOut!);
      if (isNaN(end.getTime()) || end.getTime() <= open.clockIn.getTime()) {
        throw new BadRequestException('La hora de salida debe ser posterior a la de entrada');
      }
      open.clockOut = end;
      open.manual = true;
      return open.save();
    }

    const start = new Date(clockIn);
    if (isNaN(start.getTime())) {
      throw new BadRequestException('La hora de entrada no es válida');
    }

    if (!clockOut) {
      const open = await this.timeEntryModel.findOne({ trainer: trainerId, clockOut: { $exists: false } });
      if (open) {
        throw new BadRequestException('Ya tienes una entrada fichada sin salida');
      }
      const created = new this.timeEntryModel({ trainer: trainerId, clockIn: start, manual: true });
      return created.save();
    }

    const end = new Date(clockOut);
    if (isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
      throw new BadRequestException('La hora de salida debe ser posterior a la de entrada');
    }
    const created = new this.timeEntryModel({ trainer: trainerId, clockIn: start, clockOut: end, manual: true });
    return created.save();
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

  // Para el admin: todos los fichajes de todos los entrenadores. from/to
  // acotan por clockIn (para pedir solo la semana visible en el
  // calendario, en vez de todo el historico).
  async findAll(from?: string, to?: string): Promise<TimeEntry[]> {
    await this.resolveForgottenClockOuts();

    const filter: Record<string, unknown> = {};
    if (from || to) {
      const clockIn: Record<string, Date> = {};
      if (from) clockIn.$gte = new Date(from);
      if (to) clockIn.$lte = new Date(to);
      filter.clockIn = clockIn;
    }

    return this.timeEntryModel
      .find(filter)
      .sort({ clockIn: -1 })
      .populate('trainer', 'firstName lastName color')
      .exec();
  }
}
