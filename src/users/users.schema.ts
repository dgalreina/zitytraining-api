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
  REJECTED = 'rejected',
}

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true })
  firstName!: string;

  @Prop({ required: true })
  lastName!: string;

  @Prop({ required: true })
  dateOfBirth!: Date;

  @Prop({ required: true, unique: true })
  email!: string;

  @Prop({ required: true })
  password!: string;

  @Prop({ required: true })
  phone!: string;

  @Prop({ required: true })
  address!: string;

  @Prop({ type: [String], enum: Role, default: [Role.CLIENT] })
  roles!: Role[];

  @Prop({ type: String, enum: UserStatus, default: UserStatus.PENDING })
  status!: UserStatus;

  @Prop({ required: false, unique: true, sparse: true })
  membershipNumber?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);