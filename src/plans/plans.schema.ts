import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum PlanCategory {
  PERSONAL = 'personal',
  DUO = 'duo',
  TRIO = 'trio',
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
