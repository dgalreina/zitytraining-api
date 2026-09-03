import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ActivityLevel {
  SEDENTARIA = 'sedentaria',
  BAJA = 'baja',
  MEDIA = 'media',
  ALTA = 'alta',
  MUY_ALTA = 'muy_alta',
}

export enum OccupationActivityLevel {
  NINGUNA = 'ninguna',
  POCO_ACTIVA = 'poco_activa',
  ACTIVA = 'activa',
  MUY_ACTIVA = 'muy_activa',
}

export enum HabitFrequency {
  NUNCA = 'nunca',
  A_VECES = 'a_veces',
  A_MENUDO = 'a_menudo',
  A_DIARIO = 'a_diario',
}

export enum SpineDeviation {
  NO = 'no',
  ESCOLIOSIS = 'escoliosis',
  HIPERCIFOSIS_TORACICA = 'hipercifosis_toracica',
  HIPERLORDOSIS_LUMBAR = 'hiperlordosis_lumbar',
}

export const WEEKDAYS = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
] as const;

// Ficha de salud/anamnesis en papel que se rellenaba al dar de alta un
// cliente; una por cliente (clientId único). Todo opcional a nivel de
// esquema porque en la práctica se puede guardar a medio rellenar y
// completar más tarde; la obligatoriedad real la marca el frontend.
@Schema({ timestamps: true })
export class HealthForm extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  client!: Types.ObjectId;

  @Prop({ required: false })
  dni?: string;

  @Prop({ required: false })
  height?: number; // cm

  // 1. Días disponibles para entrenar
  @Prop({ required: false })
  availableDaysCount?: number;

  @Prop({ type: [String], enum: WEEKDAYS, default: [] })
  availableDays!: string[];

  // 2. Nivel de actividad diaria
  @Prop({ type: String, enum: ActivityLevel, required: false })
  dailyActivityLevel?: ActivityLevel;

  // 3. Actividad laboral
  @Prop({ type: String, enum: OccupationActivityLevel, required: false })
  occupationActivityLevel?: OccupationActivityLevel;

  @Prop({ required: false })
  occupationWhich?: string;

  @Prop({ required: false })
  occupationHoursPerDay?: number;

  // 4. Deporte practicado de forma sistemática
  @Prop({ default: false })
  systematicSportPracticed!: boolean;

  @Prop({ required: false })
  systematicSportName?: string;

  @Prop({ required: false })
  systematicSportFrequency?: string;

  @Prop({ required: false })
  systematicSportDuration?: string;

  // 5. Experiencia en sala de musculación
  @Prop({ default: false })
  gymExperience!: boolean;

  @Prop({ required: false })
  gymExperienceDuration?: string;

  // 6. Experiencia con entrenador personal
  @Prop({ default: false })
  personalTrainerExperience!: boolean;

  @Prop({ required: false })
  personalTrainerStopReason?: string;

  // 7. Otra actividad física actual
  @Prop({ required: false })
  currentActivity?: string;

  @Prop({ required: false })
  currentActivityFrequency?: string;

  // 8. Control dietético / suplementación
  @Prop({ default: false })
  dietControl!: boolean;

  @Prop({ default: false })
  wantsNutritionAdvice!: boolean;

  @Prop({ required: false })
  dietControlReason?: string;

  @Prop({ required: false })
  dietControlDescription?: string;

  // 9-10. Hábitos
  @Prop({ type: String, enum: HabitFrequency, required: false })
  alcoholFrequency?: HabitFrequency;

  @Prop({ type: String, enum: HabitFrequency, required: false })
  smokingFrequency?: HabitFrequency;

  @Prop({ required: false })
  cigarettesPerDay?: number;

  // 11. Sistema cardiovascular
  @Prop({ default: false })
  cardiovascularCondition!: boolean;

  @Prop({ required: false })
  cardiovascularConditionWhich?: string;

  // 12. Colesterol
  @Prop({ default: false })
  knowsCholesterol!: boolean;

  @Prop({ required: false })
  cholesterolTotal?: number;

  @Prop({ required: false })
  cholesterolHdl?: number;

  // 13. Antecedentes familiares
  @Prop({ default: false })
  familyHistoryCoronary!: boolean;

  // 14. Diabetes
  @Prop({ default: false })
  diabetes!: boolean;

  @Prop({ required: false })
  diabetesTimeSinceOnset?: string;

  // 15. Afección respiratoria
  @Prop({ default: false })
  respiratoryCondition!: boolean;

  @Prop({ required: false })
  respiratoryConditionWhich?: string;

  // 16. Huesos/articulaciones
  @Prop({ default: false })
  boneJointProblems!: boolean;

  @Prop({ required: false })
  boneJointProblemsWhichAndWhere?: string;

  // 17. Desviación de columna
  @Prop({ type: String, enum: SpineDeviation, required: false })
  spineDeviation?: SpineDeviation;

  // 18. Embarazo
  @Prop({ default: false })
  pregnant!: boolean;

  @Prop({ required: false })
  pregnancyMonth?: string;

  // 19. Menopausia
  @Prop({ default: false })
  menopause!: boolean;

  @Prop({ default: false })
  hormoneTherapy!: boolean;

  // 20. Medicación
  @Prop({ default: false })
  takesMedication!: boolean;

  @Prop({ required: false })
  medicationWhich?: string;

  // 21. Objetivos, por orden de importancia
  @Prop({ type: [String], default: [] })
  objectives!: string[];

  // 22-23. Texto libre
  @Prop({ required: false })
  otherConditions?: string;

  @Prop({ required: false })
  otherObservations?: string;
}

export const HealthFormSchema = SchemaFactory.createForClass(HealthForm);
