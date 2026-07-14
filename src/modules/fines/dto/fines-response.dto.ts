import { ApiProperty } from '@nestjs/swagger';
import {
  DISPUTE_STATUSES,
  FINE_BOOKING_CATEGORIES,
  ISSUED_FINE_STATUSES,
  PENALTY_STATUSES,
  RESOLUTION_OUTCOMES,
} from './fines.dto';

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

class FineBookingDto {
  @ApiProperty({ example: 'BKG-2026-00421' })
  booking_reference: string;

  @ApiProperty({ example: 'APM Terminals Apapa' })
  terminal_destination: string;

  @ApiProperty()
  booking_date: Date;

  @ApiProperty({ enum: FINE_BOOKING_CATEGORIES })
  category: string;

  @ApiProperty({ example: 'LIVE' })
  truck_booking_status: string;
}

class FineTransporterDto {
  @ApiProperty({ example: 'ABC Logistics Ltd' })
  company_name: string;

  @ApiProperty({ example: 'Emeka Okafor' })
  user_account: string;

  @ApiProperty({ example: 'Emeka Okafor' })
  contact_person: string;

  @ApiProperty({ example: '+2348034512290' })
  contact_number: string;

  @ApiProperty({ example: 'emeka@abclogistics.com' })
  email: string;
}

class FineDisputeEventDto {
  @ApiProperty({ example: 'RESOLVED' })
  action: string;

  @ApiProperty({ example: 'SuperAdmin — Femi Okunlola' })
  performed_by: string;

  @ApiProperty()
  timestamp: Date;

  @ApiProperty({ required: false })
  notes?: string;
}

export class PenaltyDefinitionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'PEN-001' })
  penalty_code: string;

  @ApiProperty({ example: 'Overstay at Terminal' })
  name: string;

  @ApiProperty({ example: 'Truck exceeded allowed dwell time at terminal' })
  description: string;

  @ApiProperty({ example: 50000 })
  fine_amount: number;

  @ApiProperty({ enum: PENALTY_STATUSES })
  status: string;

  @ApiProperty({ example: 'SuperAdmin — Femi Okunlola' })
  created_by: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty({ required: false })
  updated_by?: string;

  @ApiProperty({ required: false })
  updated_at?: Date;
}

export class IssuedFineDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'IFN-2026-00117' })
  issued_fine_id: string;

  @ApiProperty({ example: 'PEN-001' })
  penalty_code: string;

  @ApiProperty({ example: 'Overstay at Terminal' })
  penalty_name: string;

  @ApiProperty({ example: 50000 })
  fine_amount: number;

  @ApiProperty({ type: () => FineBookingDto })
  booking: FineBookingDto;

  @ApiProperty({ example: 'AAA-423-WA' })
  truck_plate_number: string;

  @ApiProperty({ example: 'Okonkwo Samuel' })
  driver_name: string;

  @ApiProperty({ type: () => FineTransporterDto })
  transporter: FineTransporterDto;

  @ApiProperty()
  date_issued: Date;

  @ApiProperty({ example: 'Enforcement Officer — Okonkwo Samuel' })
  issued_by: string;

  @ApiProperty({ enum: ISSUED_FINE_STATUSES })
  status: string;
}

export class FineDisputeDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'DSP-2026-00118' })
  dispute_id: string;

  @ApiProperty({ example: 'IFN-2026-00117' })
  issued_fine_id: string;

  @ApiProperty({ example: 'PEN-001' })
  penalty_code: string;

  @ApiProperty({ example: 'Overstay at Terminal' })
  penalty_name: string;

  @ApiProperty({ example: 50000 })
  fine_amount: number;

  @ApiProperty({ type: () => FineBookingDto })
  booking: FineBookingDto;

  @ApiProperty({ example: 'AAA-423-WA' })
  truck_plate_number: string;

  @ApiProperty({ example: 'Okonkwo Samuel' })
  driver_name: string;

  @ApiProperty({ type: () => FineTransporterDto })
  transporter: FineTransporterDto;

  @ApiProperty()
  date_issued: Date;

  @ApiProperty()
  date_disputed: Date;

  @ApiProperty({ example: 'Fine was issued in error — truck had valid extension' })
  dispute_reason: string;

  @ApiProperty({ enum: DISPUTE_STATUSES })
  dispute_status: string;

  @ApiProperty({ enum: RESOLUTION_OUTCOMES, required: false })
  resolution_outcome?: string;

  @ApiProperty({ required: false })
  managed_by?: string;

  @ApiProperty({ required: false })
  resolution_date?: Date;

  @ApiProperty({ required: false, example: 25000 })
  adjusted_amount?: number;

  @ApiProperty({ type: () => [FineDisputeEventDto] })
  resolution_history: FineDisputeEventDto[];
}

class PenaltyListDataDto {
  @ApiProperty({ type: () => [PenaltyDefinitionDto] })
  data: PenaltyDefinitionDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class PenaltyResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => PenaltyDefinitionDto })
  data: PenaltyDefinitionDto;
}

export class PenaltyListResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => PenaltyListDataDto })
  data: PenaltyListDataDto;
}

class PenaltiesSummaryDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  active: number;

  @ApiProperty()
  inactive: number;

  @ApiProperty()
  archived: number;

  @ApiProperty({ example: 45000 })
  avg_fine_amount: number;
}

export class PenaltiesSummaryResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => PenaltiesSummaryDto })
  data: PenaltiesSummaryDto;
}

class IssuedFineListDataDto {
  @ApiProperty({ type: () => [IssuedFineDto] })
  data: IssuedFineDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class IssuedFineResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => IssuedFineDto })
  data: IssuedFineDto;
}

export class IssuedFineListResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => IssuedFineListDataDto })
  data: IssuedFineListDataDto;
}

class IssuedFinesSummaryDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  accepted: number;

  @ApiProperty()
  disputed: number;

  @ApiProperty({ example: 350000 })
  total_amount: number;

  @ApiProperty({ example: 200000 })
  accepted_amount: number;

  @ApiProperty({ example: 150000 })
  disputed_amount: number;
}

export class IssuedFinesSummaryResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => IssuedFinesSummaryDto })
  data: IssuedFinesSummaryDto;
}

class FineDisputeListDataDto {
  @ApiProperty({ type: () => [FineDisputeDto] })
  data: FineDisputeDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class FineDisputeResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => FineDisputeDto })
  data: FineDisputeDto;
}

export class FineDisputeListResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => FineDisputeListDataDto })
  data: FineDisputeListDataDto;
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

  @ApiProperty({ example: 150000 })
  total_amount_in_dispute: number;

  @ApiProperty({ example: 75000 })
  total_amount_waived_adjusted: number;
}

export class DisputesSummaryResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => DisputesSummaryDto })
  data: DisputesSummaryDto;
}
