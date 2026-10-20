import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DATE_PRESETS, DatePreset } from '../../../common/utils/date-range';
import {
  OPS_COMMAND_ACTIONS,
  OPS_COMMAND_STATUSES,
  OpsCommandAction,
} from '../dashboard.constants';

/** Optional period filter for the chart sections (no filter = all time). */
export class OverviewPeriodDto {
  @ApiPropertyOptional({ enum: DATE_PRESETS })
  @IsOptional()
  @IsIn(DATE_PRESETS)
  date_preset?: DatePreset;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @IsDateString()
  date_to?: string;
}

export class OverviewLimitDto {
  @ApiPropertyOptional({ default: 5, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number = 5;
}

export class QueryRecentActivityDto extends OverviewLimitDto {
  @ApiPropertyOptional({ enum: ['bookings', 'matchings'], default: 'bookings' })
  @IsOptional()
  @IsIn(['bookings', 'matchings'])
  type?: 'bookings' | 'matchings' = 'bookings';
}

export class OpsCommandTargetDto {
  @ApiPropertyOptional({
    example: 'TRANSIT_PARK',
    description: 'FACILITY | TRANSIT_PARK | TERMINAL | BOOKING',
  })
  @IsIn(['FACILITY', 'TRANSIT_PARK', 'TERMINAL', 'BOOKING'])
  type: string;

  @IsUUID()
  id: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}

export class AuthoriseOpsCommandDto {
  @ApiPropertyOptional({ enum: OPS_COMMAND_ACTIONS })
  @IsIn(OPS_COMMAND_ACTIONS)
  action: OpsCommandAction;

  @ApiPropertyOptional({
    type: [OpsCommandTargetDto],
    description:
      "Sites / bookings the order applies to. Omit to use the recommendation's targets.",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OpsCommandTargetDto)
  targets?: OpsCommandTargetDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class LiftOpsCommandDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class QueryOpsCommandOrdersDto {
  @ApiPropertyOptional({ enum: OPS_COMMAND_STATUSES })
  @IsOptional()
  @IsIn(OPS_COMMAND_STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: OPS_COMMAND_ACTIONS })
  @IsOptional()
  @IsIn(OPS_COMMAND_ACTIONS)
  action?: string;

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
