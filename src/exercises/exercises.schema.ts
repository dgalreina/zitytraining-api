import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Exercise extends Document {
  @Prop({ required: true, trim: true })
  name!: string;

  // Ejercicios del catalogo base (cargados por el admin de sistema, no
  // por un usuario desde la app): no se pueden editar ni borrar desde
  // la pestaña de gestion. Los que crea un usuario (a mano o al vuelo
  // desde el selector de un entrenamiento) sí.
  @Prop({ default: false })
  locked!: boolean;
}

export const ExerciseSchema = SchemaFactory.createForClass(Exercise);
