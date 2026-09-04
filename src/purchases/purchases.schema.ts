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
  // El plan "de fondo" mientras hay un plan puntual corriendo por encima.
  // No es lo mismo que cancelado: se retoma solo cuando el puntual acaba.
  PAUSED = 'paused',
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

  @Prop({ required: false })
  endedAt?: Date; // fecha en la que se paró (solo planes asignados a mano, sin Stripe)

  // Asignado por un entrenador/admin y pagado en mano, sin pasar por
  // Stripe. Importa para no dejar "parar" desde la app un plan que en
  // realidad sigue cobrando por Stripe (aquí se pararía solo en la BD).
  @Prop({ default: false })
  assignedInPerson!: boolean;

  // Solo en planes puntuales (con fecha de fin conocida de antemano, a
  // diferencia de una suscripción normal). Cuando esta fecha pasa, este
  // plan se cierra solo y se retoma el que pausó (si había alguno).
  @Prop({ required: false })
  scheduledEndDate?: Date;

  // Si este plan puntual pausó otro plan al empezar, aquí se guarda cuál,
  // para saber a cuál volver cuando el puntual termine.
  @Prop({ type: Types.ObjectId, ref: 'Purchase', required: false })
  pausedPlan?: Types.ObjectId;

  // Quién lo creó: el propio cliente en el autoservicio de Stripe, o el
  // entrenador/admin que lo asignó a mano. Para el historial.
  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  createdBy?: Types.ObjectId;

  // Quién lo paró o cambió (solo planes asignados a mano). Para el historial.
  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  endedBy?: Types.ObjectId;

  @Prop({ type: String, enum: ['cancelled', 'changed'], required: false })
  endReason?: 'cancelled' | 'changed';

  // Solo si endReason es 'changed': snapshot del nombre del plan que lo sustituyó.
  @Prop({ required: false })
  replacedByLabel?: string;
}

export const PurchaseSchema = SchemaFactory.createForClass(Purchase);