import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum Role {
  ADMIN = 'admin',
  TRAINER = 'trainer',
  CLIENT = 'client',
}

export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  REJECTED = 'rejected',
}

@Schema({
  timestamps: true,
  toJSON: {
    transform: (_doc, ret: Record<string, unknown>) => {
      delete ret.password;
      return ret;
    },
  },
})
export class User extends Document {
  @Prop({ required: true })
  firstName!: string;

  @Prop({ required: true })
  lastName!: string;

  @Prop({ required: true })
  dateOfBirth!: Date;

  // Solo obligatorio para admin/entrenador (se valida en el DTO); un
  // cliente puede no tener email. sparse: para que varios clientes sin
  // email no choquen entre sí en el índice único.
  @Prop({ required: false, unique: true, sparse: true })
  email?: string;

  // Igual que email: obligatorio para admin/entrenador (pueden entrar en
  // la app), pero un cliente no lo necesita.
  @Prop({ required: false })
  password?: string;

  @Prop({ required: true })
  phone!: string;

  @Prop({ required: false })
  address?: string;

  @Prop({ type: [String], enum: Role, default: [Role.CLIENT] })
  roles!: Role[];

  @Prop({ type: String, enum: UserStatus, default: UserStatus.PENDING })
  status!: UserStatus;

  @Prop({ required: false })
  color?: string; // color asignado al entrenador, ej. '#6aa842'
}

export const UserSchema = SchemaFactory.createForClass(User);