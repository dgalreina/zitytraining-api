import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// Cuánto ha recibido el negocio de un cliente en un mes concreto (para
// comparar contra lo que Contabilidad calcula que debía, a partir de sus
// planes/reservas). No guarda cuánto debía: eso se calcula al vuelo cada
// vez, esto solo guarda la parte que no se puede derivar de otro sitio.
@Schema({ timestamps: true })
export class MonthlyPayment extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  client!: Types.ObjectId;

  @Prop({ required: true })
  year!: number;

  @Prop({ required: true })
  month!: number; // 1-12

  @Prop({ default: false })
  received!: boolean;

  // Puede no coincidir con lo calculado (de más o de menos); por eso se
  // guarda aparte en vez de asumir que "recibido" implica el importe exacto.
  @Prop({ required: false })
  amountReceived?: number;
}

export const MonthlyPaymentSchema = SchemaFactory.createForClass(MonthlyPayment);
MonthlyPaymentSchema.index({ client: 1, year: 1, month: 1 }, { unique: true });
