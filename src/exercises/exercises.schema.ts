import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum ExerciseCategory {
  PECHO = 'pecho',
  ESPALDA = 'espalda',
  HOMBROS = 'hombros',
  BICEPS = 'biceps',
  TRICEPS = 'triceps',
  PIERNAS = 'piernas',
  CORE = 'core',
  ANTEBRAZO = 'antebrazo',
  FUNCIONAL = 'funcional',
  OLIMPICOS = 'olimpicos',
  OTROS = 'otros',
}

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

  // Solo para agrupar visualmente en la pestaña de gestion (icono +
  // sección). Los ejercicios creados al vuelo desde un entrenamiento
  // caen en OTROS por defecto y se pueden reclasificar despues.
  @Prop({ type: String, enum: ExerciseCategory, default: ExerciseCategory.OTROS })
  category!: ExerciseCategory;
}

export const ExerciseSchema = SchemaFactory.createForClass(Exercise);
