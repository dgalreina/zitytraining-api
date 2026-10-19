import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// "Le debemos una clase a este cliente": una lista plana por cliente.
// Añadir una entrada es apuntar que se le debe una. Marcar una sesión
// como "debida" no la borra sola: deja constancia en recoveredNote de
// qué sesión la recuperó, pero sigue en la lista hasta que el propio
// usuario decide quitarla a mano (ver owed-sessions.service). createdAt
// (de timestamps) ya sirve para saber desde cuándo se debe.
@Schema({ timestamps: true })
export class OwedSession extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  client!: Types.ObjectId;

  // Por qué se debe (p.ej. "Cancelada el 12/10"), para que la lista no
  // sean solo números sueltos. Opcional: añadida a mano puede no llevar nota.
  @Prop({ required: false })
  note?: string;

  // Con valor: ya se dio la clase que la recupera (p.ej. "Recuperada con
  // la sesión del 26 de octubre a las 10:00"), pero sigue en la lista
  // hasta que el usuario la borre a mano. Sin valor: todavía pendiente.
  @Prop({ required: false })
  recoveredNote?: string;
}

export const OwedSessionSchema = SchemaFactory.createForClass(OwedSession);
OwedSessionSchema.index({ client: 1, createdAt: 1 });
