import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

// Mismo shape que WorkoutSet (workouts.schema.ts), pero para el peso real
// de UNA sesion/serie concreta: el Workout de catalogo se queda como
// plantilla compartida (estructura), esto es lo que de verdad se levanto.
@Schema({ _id: false })
export class WeightOverrideSet {
  @Prop({ required: false })
  reps?: number;

  @Prop({ required: false })
  weight?: number;
}

export const WeightOverrideSetSchema = SchemaFactory.createForClass(WeightOverrideSet);

// Por ejercicio (no por indice de slot): si la plantilla cambia de orden
// no se desincroniza. Si una plantilla repite el mismo ejercicio en dos
// slots distintos, ambos comparten override (caso raro, no compensa mas
// complejidad).
@Schema({ _id: false })
export class WeightOverrideSlot {
  @Prop({ type: Types.ObjectId, ref: 'Exercise', required: true })
  exercise!: Types.ObjectId;

  @Prop({ type: [WeightOverrideSetSchema], default: [] })
  sets!: WeightOverrideSet[];
}

export const WeightOverrideSlotSchema = SchemaFactory.createForClass(WeightOverrideSlot);
