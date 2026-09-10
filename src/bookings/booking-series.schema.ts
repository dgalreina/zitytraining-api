import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// Plantilla de una sesión que se repite cada semana, para siempre (sin
// fecha de fin salvo que se "pare" a mano). Las sesiones de verdad son
// documentos Booking normales con "series" apuntando aquí: se van
// generando de pasada (como resolveExpiredPunctualPlans en purchases),
// no con una tarea programada aparte.
@Schema({ timestamps: true })
export class BookingSeries extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  trainer!: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], required: true })
  clients!: Types.ObjectId[];

  @Prop({ required: true })
  durationMinutes!: number;

  @Prop({ required: false })
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'Workout', required: false })
  workout?: Types.ObjectId;

  @Prop({ type: Boolean, default: false })
  isPrivate!: boolean;

  // Fecha+hora de la primera sesión: fija el día de la semana y la hora
  // de todas las que le siguen.
  @Prop({ required: true })
  firstStartTime!: Date;

  // Hasta qué fecha hay ya sesiones generadas de verdad (documentos
  // Booking). Se va empujando hacia delante según haga falta más rango.
  @Prop({ required: true })
  generatedUntil!: Date;

  // Sin valor: la serie sigue generando sesiones para siempre. Con
  // valor: no se generan sesiones a partir de esta fecha (se puso al
  // borrar "esta sesión y las futuras" desde una de ellas; lo ya
  // generado antes de esa fecha no se toca).
  @Prop({ required: false })
  endDate?: Date;
}

export const BookingSeriesSchema = SchemaFactory.createForClass(BookingSeries);
