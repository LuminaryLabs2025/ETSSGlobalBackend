import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export const DTTR_REQUEST_MODES = ['MANUAL', 'AUTOMATED'] as const;

export const DTTR_SORT_FIELDS = [
  'terminal_name',
  'last_updated_at',
  'request_mode',
  'total_requested',
] as const;

export class DttrBreakdownDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  exports: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  imports: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  empties: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  gatepass: number;
}

export class QueryDttrDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  /** Filters `last_updated_at` to the given calendar day (YYYY-MM-DD). */
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsIn(DTTR_REQUEST_MODES)
  request_mode?: (typeof DTTR_REQUEST_MODES)[number];

  @IsOptional()
  @IsIn(DTTR_SORT_FIELDS)
  sort?: (typeof DTTR_SORT_FIELDS)[number] = 'terminal_name';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sort_dir?: 'ASC' | 'DESC' = 'ASC';
}

export class ConfigureModeDto {
  @IsIn(DTTR_REQUEST_MODES)
  request_mode: (typeof DTTR_REQUEST_MODES)[number];

  @IsOptional()
  @ValidateNested()
  @Type(() => DttrBreakdownDto)
  automated_template?: DttrBreakdownDto;
}

export class SuperAdminEditDttrDto {
  @ValidateNested()
  @Type(() => DttrBreakdownDto)
  breakdown: DttrBreakdownDto;

  @IsString()
  @IsNotEmpty()
  justification: string;

  @IsOptional()
  @IsString()
  approval_reference?: string;

  @IsOptional()
  @IsString()
  approval_document_name?: string;
}
