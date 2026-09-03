import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  ActivityLevel,
  HabitFrequency,
  OccupationActivityLevel,
  SpineDeviation,
  WEEKDAYS,
} from '../health-forms.schema';

export class CreateHealthFormDto {
  @IsMongoId()
  client!: string;

  @IsOptional()
  @IsString()
  dni?: string;

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsOptional()
  @IsNumber()
  availableDaysCount?: number;

  @IsOptional()
  @IsArray()
  @IsEnum(WEEKDAYS, { each: true })
  availableDays?: string[];

  @IsOptional()
  @IsEnum(ActivityLevel)
  dailyActivityLevel?: ActivityLevel;

  @IsOptional()
  @IsEnum(OccupationActivityLevel)
  occupationActivityLevel?: OccupationActivityLevel;

  @IsOptional()
  @IsString()
  occupationWhich?: string;

  @IsOptional()
  @IsNumber()
  occupationHoursPerDay?: number;

  @IsOptional()
  @IsBoolean()
  systematicSportPracticed?: boolean;

  @IsOptional()
  @IsString()
  systematicSportName?: string;

  @IsOptional()
  @IsString()
  systematicSportFrequency?: string;

  @IsOptional()
  @IsString()
  systematicSportDuration?: string;

  @IsOptional()
  @IsBoolean()
  gymExperience?: boolean;

  @IsOptional()
  @IsString()
  gymExperienceDuration?: string;

  @IsOptional()
  @IsBoolean()
  personalTrainerExperience?: boolean;

  @IsOptional()
  @IsString()
  personalTrainerStopReason?: string;

  @IsOptional()
  @IsString()
  currentActivity?: string;

  @IsOptional()
  @IsString()
  currentActivityFrequency?: string;

  @IsOptional()
  @IsBoolean()
  dietControl?: boolean;

  @IsOptional()
  @IsBoolean()
  wantsNutritionAdvice?: boolean;

  @IsOptional()
  @IsString()
  dietControlReason?: string;

  @IsOptional()
  @IsString()
  dietControlDescription?: string;

  @IsOptional()
  @IsEnum(HabitFrequency)
  alcoholFrequency?: HabitFrequency;

  @IsOptional()
  @IsEnum(HabitFrequency)
  smokingFrequency?: HabitFrequency;

  @IsOptional()
  @IsNumber()
  cigarettesPerDay?: number;

  @IsOptional()
  @IsBoolean()
  cardiovascularCondition?: boolean;

  @IsOptional()
  @IsString()
  cardiovascularConditionWhich?: string;

  @IsOptional()
  @IsBoolean()
  knowsCholesterol?: boolean;

  @IsOptional()
  @IsNumber()
  cholesterolTotal?: number;

  @IsOptional()
  @IsNumber()
  cholesterolHdl?: number;

  @IsOptional()
  @IsBoolean()
  familyHistoryCoronary?: boolean;

  @IsOptional()
  @IsBoolean()
  diabetes?: boolean;

  @IsOptional()
  @IsString()
  diabetesTimeSinceOnset?: string;

  @IsOptional()
  @IsBoolean()
  respiratoryCondition?: boolean;

  @IsOptional()
  @IsString()
  respiratoryConditionWhich?: string;

  @IsOptional()
  @IsBoolean()
  boneJointProblems?: boolean;

  @IsOptional()
  @IsString()
  boneJointProblemsWhichAndWhere?: string;

  @IsOptional()
  @IsEnum(SpineDeviation)
  spineDeviation?: SpineDeviation;

  @IsOptional()
  @IsBoolean()
  pregnant?: boolean;

  @IsOptional()
  @IsString()
  pregnancyMonth?: string;

  @IsOptional()
  @IsBoolean()
  menopause?: boolean;

  @IsOptional()
  @IsBoolean()
  hormoneTherapy?: boolean;

  @IsOptional()
  @IsBoolean()
  takesMedication?: boolean;

  @IsOptional()
  @IsString()
  medicationWhich?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  objectives?: string[];

  @IsOptional()
  @IsString()
  otherConditions?: string;

  @IsOptional()
  @IsString()
  otherObservations?: string;
}
