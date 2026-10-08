import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { DATE_PRESETS, DatePreset } from '../../../common/utils/date-range';
import {
  PAYMENT_METHODS,
  PAYMENT_SOURCES,
  PaymentMethod,
  PaymentSource,
  REVENUE_MODULES,
  REVENUE_STATUSES,
  RevenueModule,
} from '../e-revenue.constants';

export const REVENUE_SORT_FIELDS = [
  'transacted_at',
  'amount_paid',
  'amount_due',
  'payment_source',
  'status',
  'payer_name',
  'transaction_id',
] as const;

export class RevenueModuleParamDto {
  @IsIn(REVENUE_MODULES)
  module: RevenueModule;
}

/** Shared by summary, breakdown, transactions and export (summary/breakdown ignore paging, sort and status). */
export class QueryRevenueDto {
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

  @ApiPropertyOptional({
    description:
      'Matches transaction ID, payment reference, invoice number, linked booking/service reference, payer name, plate number',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: PAYMENT_SOURCES,
    description:
      'Sub-tab: Bookings / Utility Tickets / Tow Truck Requests / Penalties / Demurrage (omit for "All")',
  })
  @IsOptional()
  @IsIn(PAYMENT_SOURCES)
  payment_source?: PaymentSource;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  payment_method?: PaymentMethod;

  @ApiPropertyOptional({
    enum: REVENUE_STATUSES,
    description: 'Omit to list everything except ABANDONED checkouts',
  })
  @IsOptional()
  @IsIn(REVENUE_STATUSES)
  status?: (typeof REVENUE_STATUSES)[number];

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

  @ApiPropertyOptional({
    description:
      'Min of the amount the tab displays (gross for etss, the beneficiary share otherwise)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount_min?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount_max?: number;

  @IsOptional()
  @IsUUID()
  facility_id?: string;

  @IsOptional()
  @IsUUID()
  transit_park_id?: string;

  @IsOptional()
  @IsUUID()
  tow_company_id?: string;

  @ApiPropertyOptional({ enum: REVENUE_SORT_FIELDS, default: 'transacted_at' })
  @IsOptional()
  @IsIn(REVENUE_SORT_FIELDS)
  sort_by?: (typeof REVENUE_SORT_FIELDS)[number];

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  sort_order?: 'ASC' | 'DESC' | 'asc' | 'desc';
}

export class QueryFeeScheduleDto {
  @ApiPropertyOptional({
    enum: ['ACTIVE', 'INACTIVE'],
    description: 'Omit for all',
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;

  @ApiPropertyOptional({ example: 'BOOK_BONDED_TERMINAL' })
  @IsOptional()
  @IsString()
  linked_form?: string;
}
