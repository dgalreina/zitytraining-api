import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class WorkoutSlot {
  @Prop({ type: Types.ObjectId, ref: 'Exercise', required: true })
  exercise!: Types.ObjectId;

  // Una entrada por serie (ej. [12, 12, 10, 8]), no un numero unico:
  // cada serie puede tener sus propias repeticiones. No es obligatorio
  // rellenarlas (ej. un ejercicio a rest-pause puede no llevar numero).
  @Prop({ type: [Number], default: [] })
  reps!: number[];

  // Superserie: marca que este ejercicio va encadenado con el
  // siguiente de la lista (se numeran juntos como 1a, 1b, 1c...).
  // Apagarlo en cualquiera de la cadena solo rompe el enlace con el
  // siguiente; el resto de la cadena sigue intacta.
  @Prop({ default: false })
  linkedToNext!: boolean;

  // Solo una marca visual ("RP"), sin campos adicionales.
  @Prop({ default: false })
  restPause!: boolean;

  @Prop({ required: false, trim: true })
  notes?: string;
}

export const WorkoutSlotSchema = SchemaFactory.createForClass(WorkoutSlot);

@Schema({ timestamps: true })
export class Workout extends Document {
  @Prop({ required: true, trim: true })
  name!: string;

  // El orden de la lista es el orden de ejecucion, no hace falta un
  // campo aparte: se guarda tal cual se definio en el formulario.
  @Prop({ type: [WorkoutSlotSchema], default: [] })
  slots!: WorkoutSlot[];
}

export const WorkoutSchema = SchemaFactory.createForClass(Workout);
