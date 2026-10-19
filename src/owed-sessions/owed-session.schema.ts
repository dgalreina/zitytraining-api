import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// "Le debemos una clase a este cliente": una lista plana por cliente, sin
// estado (pendiente/resuelta). Añadir una entrada es apuntar que se debe
// una; quitarla (a mano, o sola al dar una sesión marcada como "debida")
// es la forma de darla por recuperada. createdAt (de timestamps) ya sirve
// para saber desde cuándo se debe, no hace falta guardarlo aparte.
@Schema({ timestamps: true })
export class OwedSession extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  client!: Types.ObjectId;

  // Por qué se debe (p.ej. "Cancelada el 12/10"), para que la lista no
  // sean solo números sueltos. Opcional: añadida a mano puede no llevar nota.
  @Prop({ required: false })
  note?: string;
}

export const OwedSessionSchema = SchemaFactory.createForClass(OwedSession);
OwedSessionSchema.index({ client: 1, createdAt: 1 });
