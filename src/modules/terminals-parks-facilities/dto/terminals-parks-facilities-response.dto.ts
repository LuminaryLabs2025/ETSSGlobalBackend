import { ApiProperty } from '@nestjs/swagger';
import {
  BOOKING_STATUSES,
  FACILITY_LOCATIONS,
  FACILITY_PARK_TYPES,
  FACILITY_TYPES,
  STATUSES,
  TERMINAL_LOCATIONS,
  TERMINAL_TYPES,
  TRANSIT_PARK_TYPES,
} from './terminals-parks-facilities.dto';

class ResponseEnvelopeDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty()
  message: string;
}

class PaginationMetaDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total_pages: number;
}

// Terminals
export class TerminalDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'APM Terminals' })
  name: string;

  @ApiProperty({ enum: TERMINAL_TYPES })
  terminal_type: string;

  @ApiProperty({ example: 'PT-001', description: 'Auto-generated (PT-/NPT-)' })
  terminal_code: string;

  @ApiProperty({ enum: TERMINAL_LOCATIONS })
  location: string;

  @ApiProperty({ nullable: true })
  address: string | null;

  @ApiProperty()
  approved_daily_truck_capacity: number;

  @ApiProperty({ nullable: true })
  approved_trucks_per_hour: number | null;

  @ApiProperty({ nullable: true })
  hourly_truck_tat_minutes: number | null;

  @ApiProperty({ enum: STATUSES })
  status: string;

  @ApiProperty({ enum: BOOKING_STATUSES })
  booking_status: string;

  @ApiProperty({ nullable: true, type: Date })
  archived_at: Date | null;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}

class TerminalListDataDto {
  @ApiProperty({ type: () => [TerminalDto] })
  data: TerminalDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class TerminalResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => TerminalDto })
  data: TerminalDto;
}

export class TerminalListResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => TerminalListDataDto })
  data: TerminalListDataDto;
}

class TerminalsSummaryDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  enabled: number;

  @ApiProperty()
  disabled: number;

  @ApiProperty()
  avg_trucks_per_hour: number;

  @ApiProperty()
  port_terminals: number;

  @ApiProperty()
  non_port_terminals: number;

  @ApiProperty()
  apapa_port_terminals: number;

  @ApiProperty()
  apapa_non_port_terminals: number;

  @ApiProperty()
  tincan_port_terminals: number;

  @ApiProperty()
  tincan_non_port_terminals: number;
}

export class TerminalsSummaryResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => TerminalsSummaryDto })
  data: TerminalsSummaryDto;
}

// Transit parks
export class TransitParkDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Lilypond Pregate' })
  name: string;

  @ApiProperty({ enum: TRANSIT_PARK_TYPES })
  transit_park_type: string;

  @ApiProperty({
    example: 'PRE-001',
    description: 'Auto-generated (PRE-/EPT-)',
  })
  transit_park_code: string;

  @ApiProperty({ enum: TERMINAL_LOCATIONS })
  location: string;

  @ApiProperty({ nullable: true })
  address: string | null;

  @ApiProperty()
  approved_truck_capacity: number;

  @ApiProperty()
  approved_truck_exits_per_hour: number;

  @ApiProperty({ nullable: true })
  bay_capacity: number | null;

  @ApiProperty({ enum: STATUSES })
  status: string;

  @ApiProperty({ nullable: true, type: Date })
  archived_at: Date | null;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}

class TransitParkListDataDto {
  @ApiProperty({ type: () => [TransitParkDto] })
  data: TransitParkDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class TransitParkResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => TransitParkDto })
  data: TransitParkDto;
}

export class TransitParkListResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => TransitParkListDataDto })
  data: TransitParkListDataDto;
}

class TransitParksSummaryDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  enabled: number;

  @ApiProperty()
  disabled: number;

  @ApiProperty()
  avg_truck_exits_per_hour: number;

  @ApiProperty()
  total_bay_capacity: number;

  @ApiProperty()
  pregates: number;

  @ApiProperty()
  export_processing_terminals: number;
}

export class TransitParksSummaryResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => TransitParksSummaryDto })
  data: TransitParksSummaryDto;
}

// Facilities
export class FacilityDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Lagos Bonded Terminal A' })
  name: string;

  @ApiProperty({ enum: FACILITY_PARK_TYPES })
  park_type: string;

  @ApiProperty({ enum: FACILITY_TYPES })
  facility_type: string;

  @ApiProperty({
    example: 'BDT-001',
    description: 'Auto-generated (BDT-/TRP-/FVP-)',
  })
  facility_code: string;

  @ApiProperty({ enum: FACILITY_LOCATIONS })
  location: string;

  @ApiProperty({ nullable: true })
  address: string | null;

  @ApiProperty()
  approved_truck_capacity: number;

  @ApiProperty()
  approved_truck_exits_per_hour: number;

  @ApiProperty({ nullable: true })
  bay_capacity: number | null;

  @ApiProperty({ nullable: true })
  daily_empty_evacuation_limit: number | null;

  @ApiProperty({ enum: STATUSES })
  status: string;

  @ApiProperty({ nullable: true, type: Date })
  archived_at: Date | null;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}

class FacilityListDataDto {
  @ApiProperty({ type: () => [FacilityDto] })
  data: FacilityDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class FacilityResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => FacilityDto })
  data: FacilityDto;
}

export class FacilityListResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => FacilityListDataDto })
  data: FacilityListDataDto;
}

class FacilitiesSummaryDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  enabled: number;

  @ApiProperty()
  disabled: number;

  @ApiProperty()
  avg_truck_exits_per_hour: number;

  @ApiProperty()
  total_daily_empty_evacuation_limit: number;

  @ApiProperty()
  bonded_terminals: number;

  @ApiProperty()
  truck_parks: number;

  @ApiProperty()
  fish_van_parks: number;
}

export class FacilitiesSummaryResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => FacilitiesSummaryDto })
  data: FacilitiesSummaryDto;
}

// Facility timeslots
class FacilityTimeslotDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Morning Slot' })
  name: string;

  @ApiProperty({ example: '06:00:00' })
  start_time: string;

  @ApiProperty({ example: '12:00:00' })
  end_time: string;

  @ApiProperty({ enum: STATUSES })
  status: string;
}

class FacilityTimeslotAssignmentDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid', description: 'Linked Location id' })
  facility_id: string;

  @ApiProperty({ format: 'uuid' })
  timeslot_id: string;

  @ApiProperty()
  is_active: boolean;

  @ApiProperty({ type: () => FacilityTimeslotDto })
  timeslot: FacilityTimeslotDto;
}

class FacilityTimeslotListDataDto {
  @ApiProperty({ type: () => [FacilityTimeslotAssignmentDto] })
  data: FacilityTimeslotAssignmentDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class FacilityTimeslotListResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => FacilityTimeslotListDataDto })
  data: FacilityTimeslotListDataDto;
}

// Deletes
export class DeleteResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: Object, nullable: true, example: null })
  data: null;
}
