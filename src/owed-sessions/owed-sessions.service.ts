import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

  // Una ya recuperada (con recoveredNote) no se puede borrar: es el único
  // rastro de qué sesión la recuperó, y perderlo deja la sesión excluida
  // de Contabilidad para siempre sin forma de saber por qué.
  async remove(id: string): Promise<void> {
    const existing = await this.owedSessionModel.findById(id);
    if (!existing) {
      throw new NotFoundException('Clase debida no encontrada');
    }
    if (existing.recoveredNote) {
      throw new BadRequestException('Esta clase ya está recuperada, no se puede borrar');
    }
    await this.owedSessionModel.findByIdAndDelete(id);
  }

  // Al dar una sesión marcada como "debida" se da por recuperada la más
  // antigua de las que todavía estuvieran pendientes (FIFO): se deja
  // constancia de qué sesión la recuperó, pero NO se borra sola — eso lo
  // decide el usuario a mano, cuando quiera (ver remove). Si no le
  // quedaba ninguna pendiente, no hace nada (la sesión se marca igual,
  // sin fallar).
  async markOldestAsRecovered(clientId: string, label: string): Promise<void> {
    const oldest = await this.owedSessionModel
      .findOne({ client: clientId, recoveredNote: { $exists: false } })
      .sort({ createdAt: 1 });
    if (oldest) {
      oldest.recoveredNote = label;
      await oldest.save();
    }
  }

  // Cuántas clases pendientes (sin recuperar todavía) se le deben a cada
  // uno de estos clientes. Lo usa el calendario para solo enseñar la
  // opción de "clase debida" cuando de verdad hay algo que recuperar.
  async countPendingByClients(clientIds: string[]): Promise<Record<string, number>> {
    const pending = await this.owedSessionModel
      .find({ client: { $in: clientIds }, recoveredNote: { $exists: false } })
      .select('client')
      .exec();
    const counts: Record<string, number> = {};
    for (const o of pending) {
      const key = o.client.toString();
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }
}
