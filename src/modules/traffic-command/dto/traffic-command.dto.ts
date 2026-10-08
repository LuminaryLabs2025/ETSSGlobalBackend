import { ApiPropertyOptional } from '@nestjs/swagger';
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
  MaxLength,
  Min,
} from 'class-validator';
import { DATE_PRESETS, DatePreset } from '../../../common/utils/date-range';
import {
  BOOKING_TYPES,
  EMERGENCY_TYPES,
  EmergencyType,
  LIVE_TRUCK_STAGES,
  LOCATION_KINDS,
  LiveTruckStage,
  LocationKind,
} from '../traffic-command.constants';

class PageDto {
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

class DateRangeDto extends PageDto {
  @ApiPropertyOptional({ enum: DATE_PRESETS })
  @IsOptional()
  @IsIn(DATE_PRESETS)
  date_preset?: DatePreset;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;
}

const toBoolean = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1'
    ? true
    : value === false || value === 'false' || value === '0'
      ? false
      : value;

export class QueryLiveTrucksDto extends PageDto {
  @ApiPropertyOptional({
    enum: BOOKING_TYPES,
    description:
      'Location filter: Bonded Terminals / Truck Parks / Fish-Van Parks / EPTs',
  })
  @IsOptional()
  @IsIn(BOOKING_TYPES)
  booking_type?: (typeof BOOKING_TYPES)[number];

  @ApiPropertyOptional({ description: 'Facility or transit park id' })
  @IsOptional()
  @IsUUID()
  location_id?: string;

  @ApiPropertyOptional({ enum: LIVE_TRUCK_STAGES })
  @IsOptional()
  @IsIn(LIVE_TRUCK_STAGES)
  stage?: LiveTruckStage;

  @ApiPropertyOptional({
    description: 'Plate number (also matches booking ID / driver)',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class QueryLiveTruckMatrixDto extends QueryLiveTrucksDto {
  @ApiPropertyOptional({
    default: 2,
    description:
      'Plates returned per cell; the rest are summarised as `more` (+N)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  cell_limit?: number = 2;
}

export class QueryLiveLocationsDto {
  @ApiPropertyOptional({ enum: LOCATION_KINDS })
  @IsOptional()
  @IsIn(LOCATION_KINDS)
  kind?: LocationKind;

  @ApiPropertyOptional({
    description:
      'BONDED_TERMINAL | TRUCK_PARK | FISH_VAN_PARK | PREGATE | EPT | PORT_TERMINAL | NON_PORT_TERMINAL',
  })
  @IsOptional()
  @IsString()
  park_type?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Only locations with a live (ONLINE) barrier',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  online?: boolean;
}

export const TAG_SOURCES = ['BARRIER', 'HANDHELD', 'MANUAL'] as const;

export class CreateBarrierTagEventDto {
  @ApiPropertyOptional({
    description: 'Barrier UUID (or send barrier_id_number)',
  })
  @IsOptional()
  @IsUUID()
  barrier_id?: string;

  @ApiPropertyOptional({ example: 'BR-049' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  barrier_id_number?: string;

  @ApiPropertyOptional({
    enum: ['FACILITY', 'TRANSIT_PARK', 'TERMINAL'],
    description:
      'Only needed when the barrier is linked to more than one site/role',
  })
  @IsOptional()
  @IsIn(['FACILITY', 'TRANSIT_PARK', 'TERMINAL'])
  site_type?: string;

  @IsOptional()
  @IsUUID()
  site_id?: string;

  @ApiPropertyOptional({ enum: ['ENTRY', 'EXIT'] })
  @IsOptional()
  @IsIn(['ENTRY', 'EXIT'])
  barrier_role?: string;

  @ApiPropertyOptional({ example: 'AAA111AA' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  truck_plate_number?: string;

  @ApiPropertyOptional({
    description: 'RFID or ETSS tag number (resolved to the truck)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  rfid_tag_number?: string;

  @ApiPropertyOptional({ description: 'Defaults to now' })
  @IsOptional()
  @IsDateString()
  tagged_at?: string;

  @ApiPropertyOptional({ enum: TAG_SOURCES, default: 'BARRIER' })
  @IsOptional()
  @IsIn(TAG_SOURCES)
  source?: (typeof TAG_SOURCES)[number];
}

export class QueryBarrierTagEventsDto extends DateRangeDto {
  @IsOptional()
  @IsUUID()
  barrier_id?: string;

  @IsOptional()
  @IsIn(['FACILITY', 'TRANSIT_PARK', 'TERMINAL'])
  site_type?: string;

  @IsOptional()
  @IsUUID()
  site_id?: string;

  @IsOptional()
  @IsIn(['ENTRY', 'EXIT'])
  barrier_role?: string;

  @ApiPropertyOptional({ description: 'Plate number' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class QueryOccDto {
  @ApiPropertyOptional({ enum: DATE_PRESETS, default: 'WEEKLY' })
  @IsOptional()
  @IsIn(DATE_PRESETS)
  date_preset?: DatePreset;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;
}

export class QueryEmergenciesDto extends DateRangeDto {
  @ApiPropertyOptional({ enum: EMERGENCY_TYPES })
  @IsOptional()
  @IsIn(EMERGENCY_TYPES)
  emergency_type?: EmergencyType;

  @ApiPropertyOptional({ description: 'true = still active only' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    description: 'Plate number, driver, booking / incident reference',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class QueryCancelledBookingsDto extends DateRangeDto {
  @ApiPropertyOptional({ description: 'Booking ID, plate number or driver' })
  @IsOptional()
  @IsString()
  search?: string;
}
