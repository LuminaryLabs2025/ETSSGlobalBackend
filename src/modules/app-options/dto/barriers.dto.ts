import { Type } from 'class-transformer';
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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const BARRIER_SITE_TYPES = [
  'FACILITY',
  'TRANSIT_PARK',
  'TERMINAL',
] as const;

export const BARRIER_ROLES = ['ENTRY', 'EXIT'] as const;

export const BARRIER_OPERATIONAL_STATUSES = ['ONLINE', 'OFFLINE'] as const;

export const BARRIER_STATUSES = ['ACTIVE', 'INACTIVE'] as const;

export const FACILITY_PARK_TYPES_FOR_BARRIERS = [
  'BONDED_TERMINAL',
  'TRUCK_PARK',
  'FISH_VAN_PARK',
] as const;

export class QueryBarriersDto {
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

  /** FACILITY | TRANSIT_PARK | TERMINAL — scopes list to site links */
  @IsOptional()
  @IsIn(BARRIER_SITE_TYPES)
  site_type?: string;

  /** When site_type=FACILITY: BONDED_TERMINAL | TRUCK_PARK | FISH_VAN_PARK */
  @IsOptional()
  @IsIn(FACILITY_PARK_TYPES_FOR_BARRIERS)
  park_type?: string;

  @IsOptional()
  @IsUUID()
  site_id?: string;

  @IsOptional()
  @IsIn(BARRIER_ROLES)
  barrier_role?: string;

  @IsOptional()
  @IsIn(BARRIER_OPERATIONAL_STATUSES)
  operational_status?: string;

  @IsOptional()
  @IsIn(BARRIER_STATUSES)
  status?: string;
}

export class CreateBarrierDto {
  @ApiProperty({ example: 'Access Control Co.' })
  @IsString()
  @IsNotEmpty()
  service_provider_name: string;

  @ApiProperty({ example: 'BR-049' })
  @IsString()
  @IsNotEmpty()
  barrier_id_number: string;

  @ApiPropertyOptional({ enum: BARRIER_OPERATIONAL_STATUSES })
  @IsOptional()
  @IsIn(BARRIER_OPERATIONAL_STATUSES)
  operational_status?: string;

  @ApiPropertyOptional({ enum: BARRIER_STATUSES })
  @IsOptional()
  @IsIn(BARRIER_STATUSES)
  status?: string;
}

export class UpdateBarrierDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  service_provider_name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  barrier_id_number?: string;

  @IsOptional()
  @IsIn(BARRIER_OPERATIONAL_STATUSES)
  operational_status?: string;

  @IsOptional()
  @IsIn(BARRIER_STATUSES)
  status?: string;
}

export class CreateBarrierSiteLinkDto {
  @ApiProperty({ enum: BARRIER_SITE_TYPES })
  @IsIn(BARRIER_SITE_TYPES)
  site_type: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  site_id: string;

  @ApiProperty({ enum: BARRIER_ROLES })
  @IsIn(BARRIER_ROLES)
  barrier_role: string;
}

export class AssignSiteBarriersDto {
  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  entry_barrier_ids?: string[];

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  exit_barrier_ids?: string[];
}

export class ReplaceSiteBarrierLinksDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  barrier_ids: string[];

  @ApiProperty({ enum: BARRIER_ROLES })
  @IsIn(BARRIER_ROLES)
  barrier_role: string;
}
