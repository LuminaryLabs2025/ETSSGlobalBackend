import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const TERMINAL_TYPES = ['PORT_TERMINAL', 'NON_PORT_TERMINAL'] as const;
export const TRANSIT_PARK_TYPES = ['PREGATE', 'EPT'] as const;
export const FACILITY_PARK_TYPES = [
  'BONDED_TERMINAL',
  'TRUCK_PARK',
  'FISH_VAN_PARK',
] as const;
export const FACILITY_TYPES = ['FACILITY', 'FACILITY_PREGATE'] as const;
export const TERMINAL_LOCATIONS = ['APAPA', 'TINCAN'] as const;
export const FACILITY_LOCATIONS = ['APAPA', 'TINCAN', 'APAPA_TINCAN'] as const;
export const STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export const BOOKING_STATUSES = ['OPEN', 'CLOSED'] as const;

export class QueryTerminalsParksFacilitiesDto {
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
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  park_type?: string;

  @IsOptional()
  @IsString()
  facility_type?: string;

  @IsOptional()
  @IsString()
  booking_status?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  include_archived?: boolean;
}

// Terminals
export class CreateTerminalDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsIn(TERMINAL_TYPES)
  terminal_type: string;

  @IsString()
  @IsIn(TERMINAL_LOCATIONS)
  location: string;

  @IsOptional()
  @IsString()
  address?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  approved_daily_truck_capacity: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  approved_trucks_per_hour?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  hourly_truck_tat_minutes?: number;

  @IsOptional()
  @IsString()
  @IsIn(STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @IsIn(BOOKING_STATUSES)
  booking_status?: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Barrier catalog UUIDs to assign as ENTRY gates',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  entry_barrier_ids?: string[];

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Barrier catalog UUIDs to assign as EXIT gates',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  exit_barrier_ids?: string[];
}

export class UpdateTerminalDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(TERMINAL_TYPES)
  terminal_type?: string;

  @IsOptional()
  @IsString()
  @IsIn(TERMINAL_LOCATIONS)
  location?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  approved_daily_truck_capacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  approved_trucks_per_hour?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  hourly_truck_tat_minutes?: number;

  @IsOptional()
  @IsString()
  @IsIn(STATUSES)
  status?: string;

  @IsOptional()
  @IsString()
  @IsIn(BOOKING_STATUSES)
  booking_status?: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Barrier catalog UUIDs to assign as ENTRY gates',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  entry_barrier_ids?: string[];

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Barrier catalog UUIDs to assign as EXIT gates',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  exit_barrier_ids?: string[];
}

export class UpdateBookingStatusDto {
  @IsString()
  @IsIn(BOOKING_STATUSES)
  booking_status: string;
}

// Transit parks
export class CreateTransitParkDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsIn(TRANSIT_PARK_TYPES)
  transit_park_type: string;

  @IsString()
  @IsIn(TERMINAL_LOCATIONS)
  location: string;

  @IsOptional()
  @IsString()
  address?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  approved_truck_capacity: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  approved_truck_exits_per_hour: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bay_capacity?: number;

  @IsOptional()
  @IsString()
  @IsIn(STATUSES)
  status?: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Barrier catalog UUIDs to assign as ENTRY gates',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  entry_barrier_ids?: string[];

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Barrier catalog UUIDs to assign as EXIT gates',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  exit_barrier_ids?: string[];
}

export class UpdateTransitParkDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(TRANSIT_PARK_TYPES)
  transit_park_type?: string;

  @IsOptional()
  @IsString()
  @IsIn(TERMINAL_LOCATIONS)
  location?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  approved_truck_capacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  approved_truck_exits_per_hour?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bay_capacity?: number;

  @IsOptional()
  @IsString()
  @IsIn(STATUSES)
  status?: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Barrier catalog UUIDs to assign as ENTRY gates',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  entry_barrier_ids?: string[];

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Barrier catalog UUIDs to assign as EXIT gates',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  exit_barrier_ids?: string[];
}

// Facilities
export class CreateFacilityDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsIn(FACILITY_PARK_TYPES)
  park_type: string;

  @IsString()
  @IsIn(FACILITY_TYPES)
  facility_type: string;

  @IsString()
  @IsIn(FACILITY_LOCATIONS)
  location: string;

  @IsOptional()
  @IsString()
  address?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  approved_truck_capacity: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  approved_truck_exits_per_hour: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bay_capacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  daily_empty_evacuation_limit?: number;

  @IsOptional()
  @IsString()
  @IsIn(STATUSES)
  status?: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Barrier catalog UUIDs to assign as ENTRY gates',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  entry_barrier_ids?: string[];

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Barrier catalog UUIDs to assign as EXIT gates',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  exit_barrier_ids?: string[];
}

export class UpdateFacilityDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(FACILITY_PARK_TYPES)
  park_type?: string;

  @IsOptional()
  @IsString()
  @IsIn(FACILITY_TYPES)
  facility_type?: string;

  @IsOptional()
  @IsString()
  @IsIn(FACILITY_LOCATIONS)
  location?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  approved_truck_capacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  approved_truck_exits_per_hour?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bay_capacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  daily_empty_evacuation_limit?: number;

  @IsOptional()
  @IsString()
  @IsIn(STATUSES)
  status?: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Barrier catalog UUIDs to assign as ENTRY gates',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  entry_barrier_ids?: string[];

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Barrier catalog UUIDs to assign as EXIT gates',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  exit_barrier_ids?: string[];
}

export class UpdateStatusDto {
  @IsString()
  @IsIn(STATUSES)
  status: string;
}
