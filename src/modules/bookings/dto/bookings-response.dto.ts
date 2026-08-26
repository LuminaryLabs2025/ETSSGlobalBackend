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
