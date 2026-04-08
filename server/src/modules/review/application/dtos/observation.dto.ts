import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  IsUUID,
  Min,
} from 'class-validator';

export enum ObservationTypeEnum {
  STRUCTURE = 'STRUCTURE',
  METHODOLOGY = 'METHODOLOGY',
  COHERENCE = 'COHERENCE',
  CITATIONS = 'CITATIONS',
  FORMAT = 'FORMAT',
  INTEGRITY = 'INTEGRITY',
}

export enum ObservationSeverityEnum {
  INFO = 'INFO',
  SUGGESTION = 'SUGGESTION',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

export class CreateObservationDto {
  @IsUUID()
  reviewId: string;

  @IsEnum(ObservationTypeEnum)
  type: ObservationTypeEnum;

  @IsEnum(ObservationSeverityEnum)
  severity: ObservationSeverityEnum;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsOptional()
  @IsString()
  suggestion?: string;

  @IsOptional()
  @IsString()
  textFragment?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  offsetStart?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offsetEnd?: number;
}

export class UpdateObservationDto {
  @IsOptional()
  @IsEnum(ObservationSeverityEnum)
  severity?: ObservationSeverityEnum;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  message?: string;

  @IsOptional()
  @IsString()
  suggestion?: string;

  @IsOptional()
  @IsString()
  textFragment?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  offsetStart?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  offsetEnd?: number;
}
