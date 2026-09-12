import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum BookingStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
}

@Schema({ timestamps: true })
export class Booking extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  trainer!: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], required: true })
  clients!: Types.ObjectId[];

  @Prop({ required: true })
  startTime!: Date;

  @Prop({ required: true })
  endTime!: Date;

  @Prop({ required: false })
  notes?: string;

  @Prop({ type: String, enum: BookingStatus, default: BookingStatus.ACTIVE })
  status!: BookingStatus;

  // Sesion personal del entrenador (bloquear su propio hueco, apuntarse
  // algo, etc.): solo la ve y la gestiona quien la creo (trainer). No se
  // puede cancelar, solo borrar.
  @Prop({ type: Boolean, default: false })
  isPrivate!: boolean;

  // Entrenamiento asignado a esta sesion (opcional). Uno solo por sesion,
  // compartido por todos sus clientes si es dueto/trio.
  @Prop({ type: Types.ObjectId, ref: 'Workout', required: false })
  workout?: Types.ObjectId;

  // Si esta sesion viene de una serie semanal (ver BookingSeries), aqui
  // se guarda cual. Sin valor: sesion puntual normal.
  @Prop({ type: Types.ObjectId, ref: 'BookingSeries', required: false })
  series?: Types.ObjectId;

  // Para sesiones de una serie que caen en festivo: no cuenta como
  // sesion dada (de cara a Contabilidad), pero se puede desmarcar a mano
  // por si esa clase concreta sí se dio pese al festivo.
  @Prop({ type: Boolean, default: false })
  holidaySkip!: boolean;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);

// Esta colección es la que más crece: cada cliente deja unas 150 sesiones
// al año, y las series se generan con medio año de adelanto. Sin estos
// índices, listar una semana obliga a recorrerlas todas.
BookingSchema.index({ trainer: 1, startTime: 1 });
BookingSchema.index({ clients: 1, startTime: 1 });
// Vista sin filtrar por entrenador ni cliente (ver findAllInRange).
BookingSchema.index({ startTime: 1 });
// Al generar, borrar o mover una serie entera se buscan sus sesiones.
BookingSchema.index({ series: 1 });