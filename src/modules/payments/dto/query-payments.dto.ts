import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const PAYMENT_TRANSACTION_STATUSES = [
  'PENDING',
  'SUCCESSFUL',
  'FAILED',
  'ABANDONED',
] as const;

export class QueryPaymentsDto {
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

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(PAYMENT_TRANSACTION_STATUSES)
  status?: (typeof PAYMENT_TRANSACTION_STATUSES)[number];

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;
}
