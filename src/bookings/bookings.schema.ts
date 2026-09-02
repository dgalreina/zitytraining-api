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
}

export const BookingSchema = SchemaFactory.createForClass(Booking);