import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OwedSession } from './owed-session.schema';
import { CreateOwedSessionDto } from './dto/create-owed-session.dto';

@Injectable()
export class OwedSessionsService {
  constructor(@InjectModel(OwedSession.name) private owedSessionModel: Model<OwedSession>) {}

  async findByClient(clientId: string): Promise<OwedSession[]> {
    return this.owedSessionModel.find({ client: clientId }).sort({ createdAt: 1 }).exec();
  }

  async create(data: CreateOwedSessionDto): Promise<OwedSession> {
    const created = new this.owedSessionModel(data);
    return created.save();
  }

  async remove(id: string): Promise<void> {
    const existing = await this.owedSessionModel.findByIdAndDelete(id);
    if (!existing) {
      throw new NotFoundException('Clase debida no encontrada');
    }
  }

  // Al dar una sesión marcada como "debida" se da por recuperada la más
  // antigua de las que se le debían (FIFO); si no le quedaba ninguna
  // pendiente, no hace nada (la sesión se marca igual, sin fallar).
  async removeOldestForClient(clientId: string): Promise<void> {
    const oldest = await this.owedSessionModel.findOne({ client: clientId }).sort({ createdAt: 1 });
    if (oldest) {
      await this.owedSessionModel.findByIdAndDelete(oldest._id);
    }
  }
}
