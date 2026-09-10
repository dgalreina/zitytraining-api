import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum HolidayOrigin {
  // Traído solo de la API de festivos (nacionales + Castilla y León).
  API = 'api',
  // Festivo local (Valladolid) añadido a mano por un admin: la API de
  // festivos no baja a nivel de municipio, así que estos no hay forma de
  // traerlos solos.
  MANUAL = 'manual',
}

@Schema({ timestamps: true })
export class Holiday extends Document {
  @Prop({ required: true })
  date!: Date;

  @Prop({ required: true })
  name!: string;

  @Prop({ type: String, enum: HolidayOrigin, default: HolidayOrigin.MANUAL })
  origin!: HolidayOrigin;
}

export const HolidaySchema = SchemaFactory.createForClass(Holiday);
