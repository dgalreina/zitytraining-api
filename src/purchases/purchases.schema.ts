import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum PurchaseType {
  PLAN = 'plan',
  SERVICE = 'service',
}

export enum PaymentMode {
  MONTHLY = 'monthly',
  SESSIONS = 'sessions',
  ONE_TIME = 'one_time',
}

export enum PurchaseStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

@Schema({ timestamps: true })
export class Purchase extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  client!: Types.ObjectId;

  @Prop({ type: String, enum: PurchaseType, required: true })
  type!: PurchaseType;

  @Prop({ required: true })
  itemId!: string; // ej. 'personal-3-40' o 'rutina-dieta', coincide con lib/pricing.ts

  @Prop({ required: true })
  itemLabel!: string; // snapshot del nombre, por si el catálogo cambia luego

  @Prop({ type: String, enum: PaymentMode, required: true })
  paymentMode!: PaymentMode;

  @Prop({ required: true })
  price!: number; // snapshot del precio pagado

  @Prop({ required: false })
  sessionCount?: number; // solo para bonos de sesiones

  @Prop({ type: String, enum: PurchaseStatus, default: PurchaseStatus.PENDING })
  status!: PurchaseStatus;

  @Prop({ required: false })
  activatedAt?: Date; // fecha en la que el estado pasó a "active"
}

export const PurchaseSchema = SchemaFactory.createForClass(Purchase);