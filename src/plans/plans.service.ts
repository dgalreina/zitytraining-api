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

// "Sesiones libres" no es un plan que el admin cree/edite a mano: son
// siempre estas dos duraciones fijas, calculadas al vuelo (no se guardan
// en la base de datos) a partir del precio por sesión de Entrenamiento
// personal a 2 días/semana de la misma duración. Así, si el admin cambia
// ese precio, "Sesiones libres" lo refleja al momento, sin tener que
// tocar nada más.
const FREE_SESSIONS_DURATIONS = [60, 40];
const FREE_SESSIONS_PER_MONTH = 12;
const FREE_SESSIONS_ANCHOR_SESSIONS_PER_WEEK = 2;
// Sin cadencia semanal fija; solo de relleno para el tipo, no se enseña.
const FREE_SESSIONS_PLACEHOLDER_PER_WEEK = 3;

@Injectable()
export class PlansService {
  constructor(@InjectModel(Plan.name) private planModel: Model<Plan>) {}

  private async buildFreeSessionsPlan(durationMinutes: number): Promise<any | null> {
    const anchor = await this.planModel.findOne({
      category: PlanCategory.PERSONAL,
      sessionsPerWeek: FREE_SESSIONS_ANCHOR_SESSIONS_PER_WEEK,
      durationMinutes,
    });
    if (!anchor) return null;

    const sessionCount = FREE_SESSIONS_PER_MONTH;
    const sessionPrice = anchor.sessionPrice;
    return {
      _id: `sesiones-libres-${durationMinutes}`,
      category: PlanCategory.SESIONES_LIBRES,
      sessionsPerWeek: FREE_SESSIONS_PLACEHOLDER_PER_WEEK,
      durationMinutes,
      monthlyPrice: Math.round(sessionPrice * sessionCount * 100) / 100,
      label: `Sesiones libres · ${formatDuration(durationMinutes)}`,
      sessionPrice,
      sessionCount,
    };
  }

  private async buildFreeSessionsPlans(): Promise<any[]> {
    const plans = await Promise.all(
      FREE_SESSIONS_DURATIONS.map((d) => this.buildFreeSessionsPlan(d)),
    );
    return plans.filter((p): p is NonNullable<typeof p> => p !== null);
  }

  // sessionCount y sessionPrice no los toca el admin a mano: se derivan
  // de sesiones/semana, duración y precio mensual (4 semanas al mes).
  private computeDerivedFields(sessionsPerWeek: number, durationMinutes: number, monthlyPrice: number) {
    const sessionCount = sessionsPerWeek * 4;
    const sessionPrice = Math.round((monthlyPrice / sessionCount) * 100) / 100;
    const label = `${sessionsPerWeek} días/sem · ${formatDuration(durationMinutes)}`;
    return { label, sessionPrice, sessionCount };
  }

  async create(data: CreatePlanDto): Promise<Plan> {
    if (data.category === PlanCategory.SESIONES_LIBRES) {
      throw new BadRequestException(
        'Sesiones libres se calcula solo a partir de Entrenamiento personal, no se puede crear a mano',
      );
    }
    const created = new this.planModel({
      ...data,
      ...this.computeDerivedFields(data.sessionsPerWeek, data.durationMinutes, data.monthlyPrice),
    });
    return created.save();
  }

  async findAll(): Promise<any[]> {
    // Dentro de cada categoria: primero por sesiones/semana (2, 3, 4...),
    // y dentro de las mismas sesiones/semana, la duracion mas larga
    // primero (1h antes que 40').
    const stored = await this.planModel
      .find({ category: { $ne: PlanCategory.SESIONES_LIBRES } })
      .sort({ category: 1, sessionsPerWeek: 1, durationMinutes: -1 })
      .exec();

    const freeSessionsPlans = await this.buildFreeSessionsPlans();
    return [...stored, ...freeSessionsPlans];
  }

  async update(id: string, data: UpdatePlanDto): Promise<Plan> {
    const existing = await this.planModel.findById(id);
    if (!existing) {
      throw new NotFoundException(`Plan with id ${id} not found`);
    }
    if (existing.category === PlanCategory.SESIONES_LIBRES || data.category === PlanCategory.SESIONES_LIBRES) {
      throw new BadRequestException(
        'Sesiones libres se calcula solo a partir de Entrenamiento personal, no se puede editar a mano',
      );
    }

    const sessionsPerWeek = data.sessionsPerWeek ?? existing.sessionsPerWeek;
    const durationMinutes = data.durationMinutes ?? existing.durationMinutes;
    const monthlyPrice = data.monthlyPrice ?? existing.monthlyPrice;

    Object.assign(existing, data, this.computeDerivedFields(sessionsPerWeek, durationMinutes, monthlyPrice));
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
