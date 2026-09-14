import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// Deja constancia de que a un cliente ya se le mandó el recordatorio de una
// semana concreta, para no repetirlo sin querer y, sobre todo, para notar
// cuándo hay que volver a mandarlo.
@Schema({ timestamps: true })
export class ReminderLog extends Document {
  // Quien lo mandó: los recordatorios salen del WhatsApp de cada entrenador,
  // así que el registro es suyo, no del gimnasio.
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  trainer!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  client!: Types.ObjectId;

  // Lunes de la semana a la que se refería el recordatorio.
  @Prop({ required: true })
  weekStart!: Date;

  // Resumen de las sesiones que se le anunciaron (días y horas). Si al
  // volver a mirar no coincide con lo que hay ahora, es que algo se movió
  // desde que se le escribió y hay que avisarle otra vez.
  //
  // Se compara esto y no el texto del mensaje porque el texto se puede
  // editar a mano antes de enviar, y entonces cualquier retoque parecería
  // un cambio de horario.
  @Prop({ required: true })
  sessionsFingerprint!: string;

  @Prop({ required: true })
  sentAt!: Date;
}

export const ReminderLogSchema = SchemaFactory.createForClass(ReminderLog);

// Un único registro por entrenador, cliente y semana: al reenviar se
// actualiza el que ya existe en vez de acumular filas.
ReminderLogSchema.index({ trainer: 1, weekStart: 1, client: 1 }, { unique: true });
