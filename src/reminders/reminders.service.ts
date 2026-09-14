import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ReminderLog } from './reminders.schema';
import { LogReminderDto } from './dto/log-reminder.dto';

@Injectable()
export class RemindersService {
  constructor(
    @InjectModel(ReminderLog.name) private reminderModel: Model<ReminderLog>,
  ) {}

  async findWeek(trainerId: string, weekStart: string) {
    const start = new Date(weekStart);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('weekStart debe ser una fecha válida');
    }

    const logs = await this.reminderModel
      .find({ trainer: trainerId, weekStart: start })
      .exec();

    return logs.map((log) => ({
      clientId: log.client.toString(),
      sessionsFingerprint: log.sessionsFingerprint,
      sentAt: log.sentAt,
    }));
  }

  // Reenviar a alguien no crea otra fila: se pisa la suya con la huella
  // nueva, que es justo lo que hace que deje de salir como "cambió".
  async log(trainerId: string, data: LogReminderDto) {
    const start = new Date(data.weekStart);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('weekStart debe ser una fecha válida');
    }

    await this.reminderModel.findOneAndUpdate(
      { trainer: trainerId, client: data.client, weekStart: start },
      { $set: { sessionsFingerprint: data.sessionsFingerprint, sentAt: new Date() } },
      { upsert: true },
    );

    return { success: true as const };
  }
}
