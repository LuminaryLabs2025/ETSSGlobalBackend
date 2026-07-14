import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export const TERMINAL_TYPES = ['PORT', 'NON_PORT'] as const;

export const UTILITY_TICKET_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
] as const;

export const REQUEST_TYPES = [
  'POWER',
  'WATER',
  'MAINTENANCE',
  'WASTE_MANAGEMENT',
  'SECURITY',
  'FUEL',
  'OTHER',
] as const;

export const BOOKING_PRIORITIES = ['PRIORITY', 'STANDARD'] as const;

export const UTILITY_TICKET_SORT_FIELDS = [
  'date_raised',
  'status',
  'terminal_name',
] as const;

export const SORT_DIRS = ['ASC', 'DESC'] as const;

export class QueryUtilityTicketsDto {
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
  @IsIn(TERMINAL_TYPES)
  terminal_type?: (typeof TERMINAL_TYPES)[number];

  @IsOptional()
  @IsIn(UTILITY_TICKET_STATUSES)
  status?: (typeof UTILITY_TICKET_STATUSES)[number];

  @IsOptional()
  @IsString()
  raised_by?: string;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  @IsOptional()
  @IsIn(UTILITY_TICKET_SORT_FIELDS)
  sort?: (typeof UTILITY_TICKET_SORT_FIELDS)[number] = 'date_raised';

  @IsOptional()
  @IsIn(SORT_DIRS)
  sort_dir?: (typeof SORT_DIRS)[number] = 'DESC';
}

export class CreateUtilityTicketDto {
  @IsString()
  @IsNotEmpty()
  terminal_name: string;

  @IsIn(TERMINAL_TYPES)
  terminal_type: (typeof TERMINAL_TYPES)[number];

  @IsOptional()
  @IsString()
  terminal_code?: string;

  @IsOptional()
  @IsString()
  terminal_location?: string;

  @IsOptional()
  @IsUUID()
  terminal_id?: string;

  @IsIn(REQUEST_TYPES)
  request_type: (typeof REQUEST_TYPES)[number];

  @IsString()
  @IsNotEmpty()
  delivery_company_name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  truck_plate_number?: string;
}

export class UpdateUtilityTicketDto {
  @IsOptional()
  @IsIn(REQUEST_TYPES)
  request_type?: (typeof REQUEST_TYPES)[number];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  delivery_company_name?: string;

  @IsOptional()
  @IsString()
  truck_plate_number?: string;

  @IsOptional()
  @IsIn(UTILITY_TICKET_STATUSES)
  status?: (typeof UTILITY_TICKET_STATUSES)[number];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  full_description?: string;
}
