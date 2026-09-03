import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// Una entrada de la báscula/analizador corporal (peso, % grasa, etc.) en
// una fecha concreta. Varias entradas por cliente a lo largo del tiempo
// forman la evolución que se ve en las gráficas.
@Schema({ timestamps: true })
export class ProgressEntry extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  client!: Types.ObjectId;

  @Prop({ required: true })
  date!: Date;

  @Prop({ required: false })
  weight?: number; // kg

  @Prop({ required: false })
  bodyFatPercent?: number; // % grasa

  @Prop({ required: false })
  water?: number; // % H2O

  @Prop({ required: false })
  muscleMass?: number; // MM, kg

  @Prop({ required: false })
  visceralFat?: number; // índice grasa visceral

  @Prop({ required: false })
  boneMass?: number; // masa ósea, kg
}

export const ProgressEntrySchema = SchemaFactory.createForClass(ProgressEntry);
