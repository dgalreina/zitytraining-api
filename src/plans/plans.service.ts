import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Plan } from './plans.schema';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

// 40' o 1h: solo se sale a horas exactas cuando cuadra, si no en minutos.
function formatDuration(minutes: number): string {
  if (minutes % 60 === 0) {
    return `${minutes / 60}h`;
  }
  return `${minutes}'`;
}

// sessionCount y sessionPrice no los toca el admin a mano: se derivan
// de sesiones/semana, duración y precio mensual (4 semanas al mes).
function computeDerivedFields(sessionsPerWeek: number, durationMinutes: number, monthlyPrice: number) {
  const sessionCount = sessionsPerWeek * 4;
  const sessionPrice = Math.round((monthlyPrice / sessionCount) * 100) / 100;
  const label = `${sessionsPerWeek} días/sem · ${formatDuration(durationMinutes)}`;
  return { label, sessionPrice, sessionCount };
}

@Injectable()
export class PlansService {
  constructor(@InjectModel(Plan.name) private planModel: Model<Plan>) {}

  async create(data: CreatePlanDto): Promise<Plan> {
    const created = new this.planModel({
      ...data,
      ...computeDerivedFields(data.sessionsPerWeek, data.durationMinutes, data.monthlyPrice),
    });
    return created.save();
  }

  async findAll(): Promise<Plan[]> {
    // Dentro de cada categoria: primero por sesiones/semana (2, 3, 4...),
    // y dentro de las mismas sesiones/semana, la duracion mas larga
    // primero (1h antes que 40').
    return this.planModel
      .find()
      .sort({ category: 1, sessionsPerWeek: 1, durationMinutes: -1 })
      .exec();
  }

  async update(id: string, data: UpdatePlanDto): Promise<Plan> {
    const existing = await this.planModel.findById(id);
    if (!existing) {
      throw new NotFoundException(`Plan with id ${id} not found`);
    }

    const sessionsPerWeek = data.sessionsPerWeek ?? existing.sessionsPerWeek;
    const durationMinutes = data.durationMinutes ?? existing.durationMinutes;
    const monthlyPrice = data.monthlyPrice ?? existing.monthlyPrice;

    Object.assign(existing, data, computeDerivedFields(sessionsPerWeek, durationMinutes, monthlyPrice));
    return existing.save();
  }

  // Borrado normal (no blando): los planes ya asignados guardan su
  // propio nombre y precio en la compra (itemLabel/price), así que
  // borrar el plan del catálogo no afecta al historial.
  async remove(id: string): Promise<void> {
    const deleted = await this.planModel.findByIdAndDelete(id);
    if (!deleted) {
      throw new NotFoundException(`Plan with id ${id} not found`);
    }
  }
}
