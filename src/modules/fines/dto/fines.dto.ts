import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const PENALTY_STATUSES = ['ACTIVE', 'INACTIVE', 'ARCHIVED'] as const;

export const ISSUED_FINE_STATUSES = ['ACCEPTED', 'DISPUTED'] as const;

export const FINE_BOOKING_CATEGORIES = ['IMPORT', 'EXPORT', 'EMPTY'] as const;

export const DISPUTE_STATUSES = [
  'PENDING_REVIEW',
  'UNDER_NPA_REVIEW',
  'RESOLVED',
  'REJECTED',
] as const;

export const RESOLUTION_OUTCOMES = [
  'FINE_UPHELD',
  'FINE_WAIVED',
  'FINE_ADJUSTED',
] as const;

export const SORT_DIRECTIONS = ['ASC', 'DESC'] as const;

class QueryFinesDto {
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
}

export class QueryPenaltiesDto extends QueryFinesDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsIn(['name', 'fine_amount', 'created_at'])
  sort?: string;

  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  sort_dir?: string;
}

export class CreatePenaltyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fine_amount: number;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
}

export class UpdatePenaltyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fine_amount?: number;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: string;
}

export class QueryIssuedFinesDto extends QueryFinesDto {
  @IsOptional()
  @IsString()
  penalty_name?: string;

  @IsOptional()
  @IsString()
  terminal?: string;

  @IsOptional()
  @IsIn(['penalty_name', 'fine_amount', 'date_issued'])
  sort?: string;

  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  sort_dir?: string;
}

export class QueryFineDisputesDto extends QueryFinesDto {
  @IsOptional()
  @IsString()
  dispute_status?: string;

  @IsOptional()
  @IsString()
  resolution_outcome?: string;

  @IsOptional()
  @IsIn(['penalty_name', 'fine_amount', 'date_disputed'])
  sort?: string;

  @IsOptional()
  @IsIn(SORT_DIRECTIONS)
  sort_dir?: string;
}

export class ResolveFineDisputeDto {
  @IsString()
  @IsIn(DISPUTE_STATUSES)
  dispute_status: string;

  @IsOptional()
  @IsString()
  @IsIn(RESOLUTION_OUTCOMES)
  resolution_outcome?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  adjusted_amount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
