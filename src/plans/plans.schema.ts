import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum PlanCategory {
  PERSONAL = 'personal',
  DUO = 'duo',
  TRIO = 'trio',
  // Bono de hasta 12 sesiones al mes, sin cadencia fija ni número fijo de
  // personas por sesión. El precio no lo pone el admin: se calcula solo
  // a partir del plan de Entrenamiento personal a 2 días/semana de la
  // misma duración (ver plans.service.ts).
  SESIONES_LIBRES = 'sesiones_libres',
}

@Schema({ timestamps: true })
export class Plan extends Document {
  @Prop({ type: String, enum: PlanCategory, required: true })
  category!: PlanCategory;

  // Lo que introduce el admin. label/sessionPrice/sessionCount de abajo
  // se recalculan solos a partir de esto, no se editan a mano.
  @Prop({ required: true })
  sessionsPerWeek!: number;

  @Prop({ required: true })
  durationMinutes!: number;

  @Prop({ required: true })
  monthlyPrice!: number;

  @Prop({ required: true })
  label!: string; // ej. "2 días/sem · 1h"

  @Prop({ required: true })
  sessionPrice!: number;

  @Prop({ required: true })
  sessionCount!: number;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);
