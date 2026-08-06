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
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Search barrier ID number or service provider name',
    example: 'BR-049',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: BARRIER_SITE_TYPES,
    description:
      'When set (with optional site_id / park_type / barrier_role), returns one row per barrier↔site link',
  })
  @IsOptional()
  @IsIn(BARRIER_SITE_TYPES)
  site_type?: string;

  @ApiPropertyOptional({
    enum: FACILITY_PARK_TYPES_FOR_BARRIERS,
    description:
      'When site_type is FACILITY (or omitted with this filter), scopes to facilities of that park type',
  })
  @IsOptional()
  @IsIn(FACILITY_PARK_TYPES_FOR_BARRIERS)
  park_type?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Filter links to a specific facility / transit park / terminal',
  })
  @IsOptional()
  @IsUUID()
  site_id?: string;

  @ApiPropertyOptional({ enum: BARRIER_ROLES })
  @IsOptional()
  @IsIn(BARRIER_ROLES)
  barrier_role?: string;

  @ApiPropertyOptional({ enum: BARRIER_OPERATIONAL_STATUSES })
  @IsOptional()
  @IsIn(BARRIER_OPERATIONAL_STATUSES)
  operational_status?: string;

  @ApiPropertyOptional({ enum: BARRIER_STATUSES })
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

  @ApiPropertyOptional({
    enum: BARRIER_OPERATIONAL_STATUSES,
    default: 'OFFLINE',
    description: 'Partner/live status; defaults to OFFLINE until access-control sync',
  })
  @IsOptional()
  @IsIn(BARRIER_OPERATIONAL_STATUSES)
  operational_status?: string;

  @ApiPropertyOptional({
    enum: BARRIER_STATUSES,
    default: 'ACTIVE',
    description: 'Admin enable/disable status',
  })
  @IsOptional()
  @IsIn(BARRIER_STATUSES)
  status?: string;
}

export class UpdateBarrierDto {
  @ApiPropertyOptional({ example: 'Access Control Co.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  service_provider_name?: string;

  @ApiPropertyOptional({ example: 'BR-049' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  barrier_id_number?: string;

  @ApiPropertyOptional({ enum: BARRIER_OPERATIONAL_STATUSES })
  @IsOptional()
  @IsIn(BARRIER_OPERATIONAL_STATUSES)
  operational_status?: string;

  @ApiPropertyOptional({ enum: BARRIER_STATUSES })
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
  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description:
      'Replace ENTRY barriers for the site. Omit to leave entry links unchanged; pass [] to clear. ' +
      'A barrier cannot also be listed in exit_barrier_ids for this same site (it may still be EXIT on another site).',
    example: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  entry_barrier_ids?: string[];

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description:
      'Replace EXIT barriers for the site. Omit to leave exit links unchanged; pass [] to clear. ' +
      'A barrier cannot also be listed in entry_barrier_ids for this same site (it may still be ENTRY on another site).',
    example: ['b2c3d4e5-f6a7-8901-bcde-f12345678901'],
  })
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
