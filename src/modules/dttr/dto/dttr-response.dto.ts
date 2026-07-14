import { ApiProperty } from '@nestjs/swagger';
import { DTTR_REQUEST_MODES } from './dttr.dto';

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

export class DttrBreakdownResponseDto {
  @ApiProperty({ example: 120 })
  exports: number;

  @ApiProperty({ example: 80 })
  imports: number;

  @ApiProperty({ example: 40 })
  empties: number;

  @ApiProperty({ example: 20 })
  gatepass: number;
}

export class DttrTerminalRequestDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'APM Terminals' })
  terminal_name: string;

  @ApiProperty({ example: 'APM' })
  terminal_code: string;

  @ApiProperty({ example: 500 })
  approved_daily_capacity: number;

  @ApiProperty({ type: () => DttrBreakdownResponseDto })
  requested: DttrBreakdownResponseDto;

  @ApiProperty()
  last_updated_at: Date;

  @ApiProperty({ enum: DTTR_REQUEST_MODES })
  request_mode: string;

  @ApiProperty({
    type: () => DttrBreakdownResponseDto,
    required: false,
    description: 'Present only when request_mode is AUTOMATED',
  })
  automated_template?: DttrBreakdownResponseDto;
}

class DttrTerminalListDataDto {
  @ApiProperty({ type: () => [DttrTerminalRequestDto] })
  data: DttrTerminalRequestDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}

export class DttrTerminalResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => DttrTerminalRequestDto })
  data: DttrTerminalRequestDto;
}

export class DttrTerminalListResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => DttrTerminalListDataDto })
  data: DttrTerminalListDataDto;
}

export class DttrSummaryDto {
  @ApiProperty()
  total_terminals: number;

  @ApiProperty()
  total_capacity: number;

  @ApiProperty()
  total_requested_today: number;

  @ApiProperty()
  manual_terminals: number;

  @ApiProperty()
  automated_terminals: number;

  @ApiProperty()
  at_capacity: number;

  @ApiProperty()
  under_capacity: number;
}

export class DttrSummaryResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => DttrSummaryDto })
  data: DttrSummaryDto;
}

export class DttrSubmissionDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Terminal request id (terminal_request_id)',
  })
  terminal_id: string;

  @ApiProperty()
  terminal_name: string;

  @ApiProperty()
  submitted_at: Date;

  @ApiProperty({ example: 'Femi Okunlola' })
  submitted_by: string;

  @ApiProperty({ nullable: true, format: 'uuid' })
  submitted_by_id: string | null;

  @ApiProperty({ type: () => DttrBreakdownResponseDto })
  breakdown: DttrBreakdownResponseDto;

  @ApiProperty()
  total_requested: number;

  @ApiProperty()
  approved_capacity: number;

  @ApiProperty({ enum: DTTR_REQUEST_MODES })
  request_mode: string;
}

export class DttrSubmissionListResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => [DttrSubmissionDto] })
  data: DttrSubmissionDto[];
}

export class DttrEditAuditDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  terminal_id: string;

  @ApiProperty()
  terminal_name: string;

  @ApiProperty({ type: [String], example: ['exports', 'imports'] })
  edited_fields: string[];

  @ApiProperty({ example: 'Femi Okunlola' })
  performed_by: string;

  @ApiProperty({ nullable: true, format: 'uuid' })
  performed_by_id: string | null;

  @ApiProperty()
  justification: string;

  @ApiProperty({ nullable: true })
  approval_reference: string | null;

  @ApiProperty({ nullable: true })
  approval_document_name: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { exports: 100, imports: 80 },
  })
  previous_values: Record<string, number>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { exports: 120, imports: 90 },
  })
  new_values: Record<string, number>;

  @ApiProperty()
  edited_at: Date;
}

export class DttrEditAuditListResponseDto extends ResponseEnvelopeDto {
  @ApiProperty({ type: () => [DttrEditAuditDto] })
  data: DttrEditAuditDto[];
}
