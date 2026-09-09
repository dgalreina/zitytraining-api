import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Plan, PlanCategory } from './plans.schema';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

// 40' o 1h: solo se sale a horas exactas cuando cuadra, si no en minutos.
function formatDuration(minutes: number): string {
  if (minutes % 60 === 0) {
    return `${minutes / 60}h`;
  }
  return `${minutes}'`;
}

// Sesiones libres: sin cadencia semanal fija (por eso este número es solo
// un valor interno para cumplir el esquema, nunca se enseña), con un tope
// de sesiones/mes propio en vez de sesionesPerWeek*4.
const FREE_SESSIONS_PLACEHOLDER_PER_WEEK = 3;
const FREE_SESSIONS_PER_MONTH = 12;
const FREE_SESSIONS_ANCHOR_SESSIONS_PER_WEEK = 2;

@Injectable()
export class PlansService {
  constructor(@InjectModel(Plan.name) private planModel: Model<Plan>) {}

  // sessionCount y sessionPrice no los toca el admin a mano: normalmente se
  // derivan de sesiones/semana, duración y precio mensual (4 semanas al
  // mes). "Sesiones libres" es la excepción: su precio por sesión se copia
  // del plan de Entrenamiento personal a 2 días/semana de la misma
  // duración, y de ahí se deriva el precio mensual (al revés que el resto).
  private async computeDerivedFields(
    category: PlanCategory,
    sessionsPerWeek: number,
    durationMinutes: number,
    monthlyPrice: number,
  ) {
    if (category === PlanCategory.SESIONES_LIBRES) {
      const anchor = await this.planModel.findOne({
        category: PlanCategory.PERSONAL,
        sessionsPerWeek: FREE_SESSIONS_ANCHOR_SESSIONS_PER_WEEK,
        durationMinutes,
      });
      if (!anchor) {
        throw new BadRequestException(
          `Crea antes el plan de Entrenamiento personal a 2 días/semana de ${formatDuration(durationMinutes)}: el precio de Sesiones libres se calcula a partir de ese`,
        );
      }
      const sessionCount = FREE_SESSIONS_PER_MONTH;
      const sessionPrice = anchor.sessionPrice;
      return {
        sessionsPerWeek: FREE_SESSIONS_PLACEHOLDER_PER_WEEK,
        monthlyPrice: Math.round(sessionPrice * sessionCount * 100) / 100,
        label: `Sesiones libres · ${formatDuration(durationMinutes)}`,
        sessionPrice,
        sessionCount,
      };
    }

    const sessionCount = sessionsPerWeek * 4;
    const sessionPrice = Math.round((monthlyPrice / sessionCount) * 100) / 100;
    const label = `${sessionsPerWeek} días/sem · ${formatDuration(durationMinutes)}`;
    return { label, sessionPrice, sessionCount, sessionsPerWeek, monthlyPrice };
  }

  async create(data: CreatePlanDto): Promise<Plan> {
    const derived = await this.computeDerivedFields(
      data.category,
      data.sessionsPerWeek,
      data.durationMinutes,
      data.monthlyPrice,
    );
    const created = new this.planModel({ ...data, ...derived });
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

    const category = data.category ?? existing.category;
    const sessionsPerWeek = data.sessionsPerWeek ?? existing.sessionsPerWeek;
    const durationMinutes = data.durationMinutes ?? existing.durationMinutes;
    const monthlyPrice = data.monthlyPrice ?? existing.monthlyPrice;

    const derived = await this.computeDerivedFields(category, sessionsPerWeek, durationMinutes, monthlyPrice);
    Object.assign(existing, data, derived);
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
