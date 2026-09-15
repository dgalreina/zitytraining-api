import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum Role {
  ADMIN = 'admin',
  TRAINER = 'trainer',
  CLIENT = 'client',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  // Borrado "blando": no se toca el documento en si (los pagos, fichas
  // de salud, etc. siguen apuntando a este id), solo deja de aparecer
  // en los listados.
  DELETED = 'deleted',
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
  // cliente puede no tener email. La unicidad se define abajo, con un
  // índice parcial, y no aquí.
  @Prop({ required: false })
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

  @Prop({ type: String, enum: UserStatus, default: UserStatus.ACTIVE })
  status!: UserStatus;

  // La contraseña la puso el admin al darle de alta y solo vale para
  // entrar la primera vez: hasta que elija una suya, no puede hacer nada
  // más en la aplicación (ver JwtStrategy).
  @Prop({ type: Boolean, default: false })
  mustChangePassword!: boolean;

  @Prop({ required: false })
  color?: string; // color asignado al entrenador, ej. '#6aa842'

  // Clientes que este entrenador ha marcado como favoritos (cada
  // entrenador tiene su propia lista, no es un flag global del cliente).
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  favoriteClients?: Types.ObjectId[];
}

export const UserSchema = SchemaFactory.createForClass(User);

// Los listados siempre piden un rol y, casi siempre, un estado.
UserSchema.index({ roles: 1, status: 1 });

// El email es único, pero solo entre quienes lo tienen y siguen dados de
// alta. Dos motivos:
//
//  - Al borrar a alguien no se elimina su documento (borrado blando), y
//    con un índice único normal su email quedaba ocupado para siempre:
//    no se podía volver a dar de alta a esa persona.
//  - Un cliente puede no tener email, y un índice único corriente trata
//    todos los "sin email" como el mismo valor, así que solo admitía uno.
//
// Se le pone nombre propio para no chocar con el índice "email_1" de
// antes, que hay que borrar a mano (Mongo no reemplaza un índice cuyas
// opciones cambian).
UserSchema.index(
  { email: 1 },
  {
    unique: true,
    name: 'email_unico_no_borrados',
    partialFilterExpression: {
      email: { $type: 'string' },
      status: { $in: [UserStatus.ACTIVE, UserStatus.INACTIVE] },
    },
  },
);