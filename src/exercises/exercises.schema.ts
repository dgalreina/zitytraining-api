import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Exercise extends Document {
  @Prop({ required: true, trim: true })
  name!: string;
}

export const ExerciseSchema = SchemaFactory.createForClass(Exercise);
