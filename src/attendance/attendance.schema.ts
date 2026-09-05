import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class TimeEntry extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  trainer!: Types.ObjectId;

  @Prop({ required: true })
  clockIn!: Date;

  // Sin cerrar (null) mientras el entrenador sigue fichado. Puede haber
  // varios tramos el mismo dia (entrada, salida a comer, vuelta, salida).
  @Prop({ required: false })
  clockOut?: Date;

  // Si nadie fichó la salida, el sistema la cierra solo a las 22:00 de
  // ese mismo día (ver resolveForgottenClockOuts en el service).
  @Prop({ default: false })
  autoClockedOut!: boolean;
}

export const TimeEntrySchema = SchemaFactory.createForClass(TimeEntry);
