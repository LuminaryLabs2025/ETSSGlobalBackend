import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BOOKING_CATEGORIES,
  BOOKING_STATUSES,
  TRANSFER_TYPES,
} from './bookings.dto';

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

class BookingTimelineEntryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'BOOKING_CREATED' })
  status: string;

  @ApiProperty()
  timestamp: Date;

  @ApiPropertyOptional({ example: 'Emeka Okafor' })
  performed_by?: string;

  @ApiPropertyOptional({ example: 'Booking created.' })
  notes?: string;

  @ApiPropertyOptional()
  is_latest?: boolean;
}

class BookingExceptionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ['PENALTY', 'DELAY', 'EXCEPTION'] })
  type: string;

  @ApiProperty({ example: 'Truck breakdown — tow requested.' })
  description: string;

  @ApiProperty()
  timestamp: Date;
}

class TowTruckRequestDto {
  @ApiProperty()
  requested_at: Date;

  @ApiProperty({ example: 'Engine failure at Mile 2 corridor.' })
  reason: string;

  @ApiProperty({ example: 'Amina Suleiman' })
  requested_by: string;

  @ApiPropertyOptional({ example: 'RapidTow Nigeria' })
  tow_company?: string;

  @ApiProperty({ enum: ['PENDING', 'ASSIGNED', 'COMPLETED'] })
  status: string;
}

class BookingTruckPreviewDto {
  @ApiPropertyOptional()
  truck_type?: string;

  @ApiPropertyOptional()
  brand?: string;

  @ApiPropertyOptional()
  model?: string;

  @ApiPropertyOptional()
  mss_verification_number?: string;

  @ApiPropertyOptional()
  truck_status?: string;
}

class BookingSiteRefDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  code?: string;

  @ApiPropertyOptional()
  location?: string;

  @ApiPropertyOptional()
  type?: string;
}

class BookingNamedRefDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;
}

class BookingTimeslotRefDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  start_time: string;

  @ApiProperty()
  end_time: string;
}

class BookingFeeBreakdownDto {
  @ApiProperty()
  fee_configured: boolean;

  @ApiProperty()
  total: number;

  @ApiProperty({ type: () => [Object] })
  lines: { name: string; amount: number }[];
}

export class BookingDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'BKG-2026-008421' })
  booking_id: string;

  @ApiProperty({ example: 'JRN-APT-4421' })
  journey_code: string;

  @ApiProperty({ example: 'LAG-887-KJA' })
  truck_plate_number: string;

  @ApiProperty({ example: 'White', nullable: true })
  truck_color: string | null;

  @ApiPropertyOptional({ type: () => BookingTruckPreviewDto })
  truck?: BookingTruckPreviewDto;

  @ApiPropertyOptional({
    description: 'Operational truck_status from linked truck record (by plate)',
  })
  current_truck_status?: string | null;

  @ApiProperty({ example: 'Chukwudi Nwosu' })
  driver_name: string;

  @ApiProperty({ example: 'DRV-003456', nullable: true })
  driver_id: string | null;

  @ApiProperty({ example: 'ABC Logistics Ltd' })
  transporter_company: string;

  @ApiProperty({ example: 'Apapa Port Terminal A' })
  terminal_name: string;

  @ApiProperty({ example: 'APM Terminals T1' })
  terminal_destination: string;

  @ApiProperty({ enum: TRANSFER_TYPES })
  transfer_type: string;

  @ApiProperty({ enum: BOOKING_CATEGORIES })
  booking_category: string;

  @ApiProperty({ enum: BOOKING_STATUSES })
  status: string;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  last_updated_at: Date;

  @ApiPropertyOptional()
  completed_at?: Date;

  @ApiProperty({ example: 'ABC Logistics Ltd' })
  truck_booked_by: string;

  @ApiProperty({ example: 'ABC Logistics Ltd' })
  truck_owned_by: string;

  @ApiPropertyOptional()
  left_pregate_at?: Date;

  @ApiPropertyOptional()
  left_manifest_at?: Date;

  @ApiProperty({
    enum: ['IN_MANIFEST', 'LEFT_MANIFEST'],
    nullable: true,
  })
  manifest_status: string | null;

  @ApiPropertyOptional({ type: () => TowTruckRequestDto })
  tow_truck_request?: TowTruckRequestDto;

  @ApiProperty({ type: () => [BookingTimelineEntryDto] })
  timeline: BookingTimelineEntryDto[];

  @ApiProperty({ type: () => [BookingExceptionDto] })
  exceptions: BookingExceptionDto[];

  // ── SuperAdmin booking-creation flows ──
  @ApiPropertyOptional({
    enum: ['BONDED_TERMINAL', 'TRUCK_PARK', 'FISH_VAN_PARK', 'EPT'],
    nullable: true,
  })
  booking_type?: string | null;

  @ApiPropertyOptional({ type: () => BookingSiteRefDto })
  facility?: BookingSiteRefDto;

  @ApiPropertyOptional({ type: () => BookingSiteRefDto })
  transit_park?: BookingSiteRefDto;

  @ApiPropertyOptional({
    type: () => BookingSiteRefDto,
    description:
      'Set by PATCH :id/mark-in-pregate — which Pregate the truck is transiting.',
  })
  pregate_transit_park?: BookingSiteRefDto;

  @ApiPropertyOptional({ type: () => BookingSiteRefDto })
  terminal?: BookingSiteRefDto;

  @ApiPropertyOptional({ type: () => BookingNamedRefDto })
  booking_category_ref?: BookingNamedRefDto;

  @ApiPropertyOptional({ type: () => BookingTimeslotRefDto })
  expected_arrival_time_slot?: BookingTimeslotRefDto;

  @ApiPropertyOptional()
  expected_arrival_date?: string | null;

  @ApiPropertyOptional()
  expected_arrival_time?: string | null;

  @ApiPropertyOptional({
    enum: ['AGRO_EXPORT', 'MANUFACTURED_EXPORT', 'OTHERS'],
  })
  export_type?: string | null;

  @ApiPropertyOptional({
    enum: [
      'LOADED_EXPORT_DELIVERY',
      'EMPTY_CONTAINER_DELIVERY',
      'VERIFIED_EXPORT_COLLECTION',
      'LOADED_DELIVERY_WITH_COLLECTION',
    ],
  })
  ept_operation_type?: string | null;

  @ApiPropertyOptional()
  gate_pass_number?: string | null;

  @ApiProperty({ enum: ['HIGH', 'MEDIUM', 'LOW'] })
  priority_level: string;

  @ApiProperty()
  priority_rank: number;

  @ApiPropertyOptional()
  matched_at?: Date | null;

  @ApiPropertyOptional()
  in_facility_at?: Date | null;

  @ApiPropertyOptional()
  in_pregate_at?: Date | null;

  @ApiPropertyOptional()
  gtg_facility_at?: Date | null;

  @ApiPropertyOptional()
  gtg_pregate_at?: Date | null;

  @ApiProperty({ enum: ['PENDING', 'PAID', 'FAILED'] })
  payment_status: string;

  @ApiPropertyOptional({ enum: ['WALLET', 'PAYSTACK'] })
  payment_method?: string | null;

  @ApiPropertyOptional()
  paid_at?: Date;

  @ApiPropertyOptional()
  confirmed_at?: Date;

  @ApiPropertyOptional()
  terms_accepted_at?: Date;

  @ApiPropertyOptional({ type: () => BookingFeeBreakdownDto })
  fee?: BookingFeeBreakdownDto;

  @ApiPropertyOptional()
  queue_position?: number;
}

class BookingListDataDto {
  @ApiProperty({ type: () => [BookingDto] })
  data: BookingDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class BookingResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => BookingDto })
  data: BookingDto;
}

export class BookingListResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => BookingListDataDto })
  data: BookingListDataDto;
}

class BookingsSummaryDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  live: number;

  @ApiProperty()
  completed: number;

  @ApiProperty()
  cancelled: number;

  @ApiProperty()
  expired: number;

  @ApiProperty({
    description:
      'Bookings with at least one exception, or linked truck registration_status = FLAGGED',
  })
  flagged: number;
}

export class BookingsSummaryResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => BookingsSummaryDto })
  data: BookingsSummaryDto;
}
