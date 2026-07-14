import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BOOKING_PRIORITIES,
  REQUEST_TYPES,
  TERMINAL_TYPES,
  UTILITY_TICKET_STATUSES,
} from './utility-tickets.dto';

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

class UtilityTicketTerminalDto {
  @ApiProperty({ example: '' })
  id: string;

  @ApiProperty({ example: 'APM Terminals T1' })
  name: string;

  @ApiProperty({ example: 'APM' })
  code: string;

  @ApiProperty({ enum: TERMINAL_TYPES })
  type: string;

  @ApiProperty({ example: 'Apapa, Lagos' })
  location: string;
}

class UtilityTicketRaisedByDto {
  @ApiProperty({ example: '' })
  user_id: string;

  @ApiProperty({ example: 'Femi Okunlola' })
  user_name: string;
}

class UtilityAssignedPersonnelDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Chidi Okafor' })
  name: string;

  @ApiProperty({ example: 'Field Technician' })
  role: string;

  @ApiProperty()
  assigned_at: Date;
}

class UtilityTicketHistoryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: UTILITY_TICKET_STATUSES })
  status: string;

  @ApiProperty()
  timestamp: Date;

  @ApiProperty({ example: 'Femi Okunlola' })
  performed_by: string;

  @ApiPropertyOptional({ example: 'Ticket approved by SuperAdmin.' })
  notes?: string;
}

export class UtilityTicketDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'UT-2026-004821' })
  ticket_id: string;

  @ApiProperty({ type: () => UtilityTicketTerminalDto })
  terminal: UtilityTicketTerminalDto;

  @ApiProperty({ enum: REQUEST_TYPES })
  request_type: string;

  @ApiProperty({ example: 'Power outage in berth 3 — backup generator required urgently.' })
  description: string;

  @ApiProperty()
  full_description: string;

  @ApiProperty({ enum: UTILITY_TICKET_STATUSES })
  status: string;

  @ApiProperty({ enum: BOOKING_PRIORITIES })
  booking_priority: string;

  @ApiProperty({ example: 'Swift Logistics Nigeria Ltd' })
  delivery_company_name: string;

  @ApiPropertyOptional({ example: 'LAG-887-KJA' })
  truck_plate_number?: string;

  @ApiProperty()
  date_raised: Date;

  @ApiProperty()
  last_updated_at: Date;

  @ApiProperty({ type: () => UtilityTicketRaisedByDto })
  raised_by: UtilityTicketRaisedByDto;

  @ApiProperty()
  super_admin_approved: boolean;

  @ApiPropertyOptional({ example: 'Femi Okunlola' })
  approved_by?: string;

  @ApiPropertyOptional()
  approved_at?: Date;

  @ApiPropertyOptional({ type: () => [UtilityAssignedPersonnelDto] })
  assigned_personnel?: UtilityAssignedPersonnelDto[];

  @ApiProperty({ type: () => [UtilityTicketHistoryDto] })
  request_history: UtilityTicketHistoryDto[];

  @ApiProperty()
  e_ticket_available: boolean;
}

class UtilityTicketListDataDto {
  @ApiProperty({ type: () => [UtilityTicketDto] })
  data: UtilityTicketDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class UtilityTicketResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => UtilityTicketDto })
  data: UtilityTicketDto;
}

export class UtilityTicketListResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => UtilityTicketListDataDto })
  data: UtilityTicketListDataDto;
}

class UtilityTicketsSummaryDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  pending: number;

  @ApiProperty()
  in_progress: number;

  @ApiProperty()
  resolved: number;

  @ApiProperty()
  closed: number;

  @ApiProperty()
  port_terminals: number;

  @ApiProperty()
  non_port_terminals: number;
}

export class UtilityTicketsSummaryResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => UtilityTicketsSummaryDto })
  data: UtilityTicketsSummaryDto;
}
