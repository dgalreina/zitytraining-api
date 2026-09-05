import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class RefreshToken extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user!: Types.ObjectId;

  // Se guarda el hash (sha256) del token, no el valor en claro: si
  // alguien accede a la base de datos no puede usarlo tal cual para
  // autenticarse, igual que con las contraseñas.
  @Prop({ required: true, unique: true })
  tokenHash!: string;

  @Prop({ required: true })
  expiresAt!: Date;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

// TTL: Mongo borra solo el documento en cuanto pasa expiresAt, sin
// tener que limpiar tokens caducados a mano.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
