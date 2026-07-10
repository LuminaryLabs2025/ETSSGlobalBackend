import { ApiProperty } from '@nestjs/swagger';
import {
  DISPUTE_STATUSES,
  DRIVER_OPERATIONAL_STATUSES,
  DRIVER_SEXES,
  DRIVER_VERIFICATION_STATUSES,
  FLAG_STATUSES,
  FLAG_TYPES,
  PAYMENT_STATUSES,
  PENALTY_TYPES,
  RESOLUTION_OUTCOMES,
  TEP_CLASSIFICATIONS,
  TEP_MATCH_STATUSES,
  TEP_SOURCES,
  TEP_STATUSES,
  TRUCK_REGISTRATION_STATUSES,
  TRUCK_STATUSES,
  TRUCK_TYPES,
  VISIBILITIES,
} from './operations.dto';

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

class CompanyInfoDto {
  @ApiProperty({ example: 'ABC Logistics Ltd' })
  company_name: string;

  @ApiProperty({ example: 'Emeka Okafor' })
  user_account: string;
}

class DisableInfoDto {
  @ApiProperty({ example: 'SuperAdmin — Femi Okunlola' })
  disabled_by: string;

  @ApiProperty({ example: 'Safety inspection failure' })
  disable_reason: string;

  @ApiProperty()
  disable_timestamp: Date;
}

// ─── Trucks ───
class TruckPenaltyDto {
  @ApiProperty({ example: 'PEN-2026-00117' })
  penalty_id: string;

  @ApiProperty({ enum: PENALTY_TYPES })
  penalty_type: string;

  @ApiProperty({ example: 50000 })
  amount: number;

  @ApiProperty()
  date_issued: Date;

  @ApiProperty({ example: 'Okonkwo Samuel (EO-001)' })
  issued_by: string;

  @ApiProperty({ enum: PAYMENT_STATUSES })
  payment_status: string;

  @ApiProperty({ type: () => CompanyInfoDto })
  booked_by: CompanyInfoDto;
}

export class TruckDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'AAA-423-WA' })
  plate_number: string;

  @ApiProperty({ enum: TRUCK_TYPES })
  truck_type: string;

  @ApiProperty({ example: 'White' })
  color: string;

  @ApiProperty({ example: 'WDB9300341L123456' })
  chassis_number: string;

  @ApiProperty({ example: 'Mercedes-Benz' })
  brand: string;

  @ApiProperty({ example: 'Actros 2548' })
  model: string;

  @ApiProperty({ example: '12.2m' })
  truck_length: string;

  @ApiProperty({ example: '40 Tons' })
  truck_capacity: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty({ enum: TRUCK_REGISTRATION_STATUSES })
  registration_status: string;

  @ApiProperty({ type: () => CompanyInfoDto })
  registered_by: CompanyInfoDto;

  @ApiProperty({ enum: VISIBILITIES })
  visibility: string;

  @ApiProperty({
    enum: TRUCK_STATUSES,
    required: false,
    description: 'Present for MSS-verified trucks only',
  })
  truck_status?: string;

  @ApiProperty({ example: 'MSS-2024-001234', required: false })
  mss_verification_number?: string;

  @ApiProperty({ required: false })
  verification_timestamp?: Date;

  @ApiProperty({ example: 'RFID-ETSS-001234', required: false })
  rfid_tag_number?: string;

  @ApiProperty({
    type: () => TruckPenaltyDto,
    required: false,
    description: 'Present for flagged trucks (latest active penalty)',
  })
  penalty?: TruckPenaltyDto;

  @ApiProperty({
    type: () => DisableInfoDto,
    required: false,
    description: 'Present for disabled trucks',
  })
  disable_info?: DisableInfoDto;
}

class TruckListDataDto {
  @ApiProperty({ type: () => [TruckDto] })
  data: TruckDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class TruckResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => TruckDto })
  data: TruckDto;
}

export class TruckListResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => TruckListDataDto })
  data: TruckListDataDto;
}

class TrucksSummaryDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  mss_verified: number;

  @ApiProperty()
  unverified: number;

  @ApiProperty()
  verification_requested: number;

  @ApiProperty()
  flagged: number;

  @ApiProperty()
  disabled: number;

  @ApiProperty()
  archived: number;

  @ApiProperty()
  available: number;

  @ApiProperty()
  on_trip: number;
}

export class TrucksSummaryResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => TrucksSummaryDto })
  data: TrucksSummaryDto;
}

class BulkTrucksResultDto {
  @ApiProperty({ example: 2 })
  created: number;

  @ApiProperty({ type: () => [TruckDto] })
  trucks: TruckDto[];
}

export class BulkTrucksResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => BulkTrucksResultDto })
  data: BulkTrucksResultDto;
}

// ─── Drivers ───
class DriverFlagDto {
  @ApiProperty({ example: 'FLG-DRV-00117' })
  flag_id: string;

  @ApiProperty({ enum: FLAG_TYPES })
  flag_type: string;

  @ApiProperty({ example: 'Exceeded speed limit in port zone' })
  flag_details: string;

  @ApiProperty({ example: 'Enforcement Officer — Okonkwo Samuel' })
  flagged_by: string;

  @ApiProperty()
  flagged_at: Date;

  @ApiProperty({ enum: FLAG_STATUSES })
  flag_status: string;
}

export class DriverDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Femi' })
  first_name: string;

  @ApiProperty({ example: 'Okunlola' })
  last_name: string;

  @ApiProperty({ example: '+2348034512290' })
  mobile_number: string;

  @ApiProperty({ example: 'LAG-2024-001234' })
  license_number: string;

  @ApiProperty({ example: '2027-03-23' })
  license_expiry_date: string;

  @ApiProperty({ example: '1985-06-15' })
  date_of_birth: string;

  @ApiProperty({ enum: DRIVER_SEXES })
  sex: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty({ enum: DRIVER_VERIFICATION_STATUSES })
  verification_status: string;

  @ApiProperty({ type: () => CompanyInfoDto })
  registered_by: CompanyInfoDto;

  @ApiProperty({ enum: VISIBILITIES })
  visibility: string;

  @ApiProperty({ required: false })
  verification_timestamp?: Date;

  @ApiProperty({ enum: DRIVER_OPERATIONAL_STATUSES, required: false })
  operational_status?: string;

  @ApiProperty({
    type: () => DriverFlagDto,
    required: false,
    description: 'Present for flagged drivers (latest active flag)',
  })
  flag?: DriverFlagDto;

  @ApiProperty({
    type: () => DisableInfoDto,
    required: false,
    description: 'Present for disabled drivers',
  })
  disable_info?: DisableInfoDto;
}

class DriverListDataDto {
  @ApiProperty({ type: () => [DriverDto] })
  data: DriverDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class DriverResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => DriverDto })
  data: DriverDto;
}

export class DriverListResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => DriverListDataDto })
  data: DriverListDataDto;
}

class DriversSummaryDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  verified: number;

  @ApiProperty()
  unverified: number;

  @ApiProperty()
  verification_in_progress: number;

  @ApiProperty()
  flagged: number;

  @ApiProperty()
  disabled: number;

  @ApiProperty()
  archived: number;

  @ApiProperty()
  available: number;

  @ApiProperty()
  on_trip: number;
}

export class DriversSummaryResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => DriversSummaryDto })
  data: DriversSummaryDto;
}

// ─── TEPs ───
class TepMatchedTruckDto {
  @ApiProperty({ example: 'AAA-423-WA' })
  plate_number: string;

  @ApiProperty({ example: 'Femi Okunlola' })
  driver_name: string;

  @ApiProperty({ example: '' })
  driver_id: string;

  @ApiProperty()
  match_timestamp: Date;
}

class TepActivityEventDto {
  @ApiProperty({
    enum: [
      'CREATED',
      'UPDATED',
      'VALIDATED',
      'MATCHED',
      'UNMATCHED',
      'REVOKED',
      'EXPIRED',
    ],
  })
  event_type: string;

  @ApiProperty({ example: 'SuperAdmin' })
  performed_by: string;

  @ApiProperty()
  timestamp: Date;

  @ApiProperty({ example: 'TEP created manually' })
  details: string;
}

export class TepDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'ETDO-2026-00001' })
  reference_number: string;

  @ApiProperty({ enum: TEP_CLASSIFICATIONS })
  classification: string;

  @ApiProperty({
    enum: TEP_SOURCES,
    description: 'Auto-derived from classification',
  })
  source: string;

  @ApiProperty({ example: 'Maersk Line Apapa' })
  facility_name: string;

  @ApiProperty({ example: 'Maersk Nigeria' })
  company_name: string;

  @ApiProperty({ example: 'SuperAdmin' })
  user_account: string;

  @ApiProperty({ enum: TEP_MATCH_STATUSES })
  match_status: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty({ enum: TEP_STATUSES })
  status: string;

  @ApiProperty({ example: 'AAA-423-WA', required: false })
  truck_plate_number?: string;

  @ApiProperty({ required: false })
  expiry_date?: Date;

  @ApiProperty({ type: () => [TepMatchedTruckDto], required: false })
  matched_trucks?: TepMatchedTruckDto[];

  @ApiProperty({ type: () => [TepActivityEventDto] })
  activity_log: TepActivityEventDto[];
}

class TepListDataDto {
  @ApiProperty({ type: () => [TepDto] })
  data: TepDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class TepResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => TepDto })
  data: TepDto;
}

export class TepListResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => TepListDataDto })
  data: TepListDataDto;
}

class TepsSummaryDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  active: number;

  @ApiProperty()
  expired: number;

  @ApiProperty()
  revoked: number;

  @ApiProperty()
  matched: number;

  @ApiProperty()
  unmatched: number;

  @ApiProperty({
    example: {
      EMPTY_TDO: 1,
      IMPORT_TDO: 1,
      EXPORT_TDO: 1,
      GATEPASS_PORT: 1,
      GATEPASS_NON_PORT: 1,
    },
  })
  by_classification: Record<string, number>;

  @ApiProperty({
    example: {
      SHIPPING_LINE: 1,
      PORT_TERMINAL: 2,
      NON_PORT_TERMINAL: 1,
      EPT: 1,
    },
  })
  by_source: Record<string, number>;
}

export class TepsSummaryResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => TepsSummaryDto })
  data: TepsSummaryDto;
}

class BulkTepsResultDto {
  @ApiProperty({ example: 2 })
  created: number;

  @ApiProperty({ type: () => [TepDto] })
  teps: TepDto[];
}

export class BulkTepsResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => BulkTepsResultDto })
  data: BulkTepsResultDto;
}

// ─── Disputes ───
class DisputeTransporterDto {
  @ApiProperty({ example: 'ABC Logistics Ltd' })
  company_name: string;

  @ApiProperty({ example: 'Emeka Okafor' })
  user_account: string;

  @ApiProperty({ example: 'Emeka Okafor' })
  contact_person: string;

  @ApiProperty({ example: '', description: 'Pending Bookings module' })
  contact_number: string;

  @ApiProperty({ example: '', description: 'Pending Bookings module' })
  email: string;
}

export class DisputeDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'PEN-2026-00118' })
  dispute_id: string;

  @ApiProperty({ example: 'PEN-2026-00118' })
  issued_fine_id: string;

  @ApiProperty({ enum: PENALTY_TYPES })
  penalty_code: string;

  @ApiProperty({ example: 'ROUTE VIOLATION' })
  penalty_name: string;

  @ApiProperty({ example: 30000 })
  fine_amount: number;

  @ApiProperty({ example: 'BDG-335-KJ' })
  truck_plate_number: string;

  @ApiProperty({ example: '', description: 'Pending Bookings module' })
  driver_name: string;

  @ApiProperty({ type: () => DisputeTransporterDto })
  transporter: DisputeTransporterDto;

  @ApiProperty()
  date_issued: Date;

  @ApiProperty({ nullable: true, type: Date })
  date_disputed: Date | null;

  @ApiProperty({ example: 'Route was approved by terminal operator' })
  dispute_reason: string;

  @ApiProperty({ enum: DISPUTE_STATUSES, nullable: true })
  dispute_status: string | null;

  @ApiProperty({ enum: RESOLUTION_OUTCOMES, required: false })
  resolution_outcome?: string;

  @ApiProperty({ required: false })
  managed_by?: string;

  @ApiProperty({ required: false })
  resolution_date?: Date;

  @ApiProperty({ required: false, example: 15000 })
  adjusted_amount?: number;

  @ApiProperty({ type: () => [Object], example: [] })
  resolution_history: unknown[];
}

class DisputeListDataDto {
  @ApiProperty({ type: () => [DisputeDto] })
  data: DisputeDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class DisputeResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => DisputeDto })
  data: DisputeDto;
}

export class DisputeListResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => DisputeListDataDto })
  data: DisputeListDataDto;
}

class DisputesSummaryDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  pending_review: number;

  @ApiProperty()
  under_npa_review: number;

  @ApiProperty()
  resolved: number;

  @ApiProperty()
  rejected: number;

  @ApiProperty()
  fine_upheld: number;

  @ApiProperty()
  fine_waived: number;

  @ApiProperty()
  fine_adjusted: number;

  @ApiProperty({ example: 30000 })
  total_amount_in_dispute: number;

  @ApiProperty({ example: 15000 })
  total_amount_waived_adjusted: number;
}

export class DisputesSummaryResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => DisputesSummaryDto })
  data: DisputesSummaryDto;
}
