import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export const BOOKING_STATUSES = [
  'LIVE',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
] as const;

export const TRANSFER_TYPES = [
  'INBOUND',
  'OUTBOUND',
  'INTER_TERMINAL',
  'EMPTY_RETURN',
  'LOCAL',
] as const;

export const BOOKING_CATEGORIES = [
  'IMPORT',
  'EXPORT',
  'EMPTY',
  'DOMESTIC',
] as const;

export const MANIFEST_TABS = ['in', 'left'] as const;

export const BOOKING_DATE_FIELDS = ['created', 'completed'] as const;

export const BOOKING_SORT_FIELDS = [
  'created_at',
  'status',
  'terminal_name',
  'last_updated_at',
] as const;

export const SORT_DIRS = ['asc', 'desc'] as const;

export class QueryBookingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(BOOKING_STATUSES)
  status?: (typeof BOOKING_STATUSES)[number];

  /** Exact match filters (frontend BookingsListParams). */
  @IsOptional()
  @IsString()
  booking_id?: string;

  @IsOptional()
  @IsString()
  journey_code?: string;

  @IsOptional()
  @IsString()
  truck_plate_number?: string;

  @IsOptional()
  @IsString()
  driver_name?: string;

  /**
   * When true, only bookings with exceptions and/or a truck whose
   * registration_status is FLAGGED (matches frontend Flagged tab).
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  flagged?: boolean;

  @IsOptional()
  @IsString()
  terminal_name?: string;

  @IsOptional()
  @IsIn(TRANSFER_TYPES)
  transfer_type?: (typeof TRANSFER_TYPES)[number];

  @IsOptional()
  @IsString()
  transporter_company?: string;

  @IsOptional()
  @IsIn(BOOKING_DATE_FIELDS)
  date_field?: (typeof BOOKING_DATE_FIELDS)[number] = 'created';

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  @IsOptional()
  @IsIn(BOOKING_SORT_FIELDS)
  sort?: (typeof BOOKING_SORT_FIELDS)[number] = 'created_at';

  @IsOptional()
  @IsIn(SORT_DIRS)
  sort_dir?: (typeof SORT_DIRS)[number] = 'desc';
}

export class QueryManifestDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(MANIFEST_TABS)
  tab?: (typeof MANIFEST_TABS)[number] = 'in';

  /** Optional YYYY-MM-DD — filters by left_pregate_at (in) or left_manifest_at (left). */
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class QueryPregateQueueDto {
  @IsUUID()
  terminal_id: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class QueryFacilityQueueDto {
  @IsOptional()
  @IsUUID()
  facility_id?: string;

  @IsOptional()
  @IsUUID()
  transit_park_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
