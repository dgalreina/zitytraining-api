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

  @Prop({ required: true })
  label!: string; // ej. "2 días/sem · 1h"

  @Prop({ required: true })
  monthlyPrice!: number;

  @Prop({ required: true })
  sessionPrice!: number;

  @Prop({ required: true })
  sessionCount!: number;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);
