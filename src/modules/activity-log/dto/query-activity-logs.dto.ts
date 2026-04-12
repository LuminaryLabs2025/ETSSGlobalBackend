import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  IsUUID,
  IsDateString,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ActivityLogEntryStatus } from '../../../common/enums';

export class QueryActivityLogsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  sort_by?: 'timestamp' | 'action' | 'module' | 'entry_status' = 'timestamp';

  @IsOptional()
  @IsString()
  sort_order?: 'ASC' | 'DESC' = 'DESC';

  /** Matches user first name, last name, or email (partial). */
  @IsOptional()
  @IsString()
  user_name?: string;

  @IsOptional()
  @IsString()
  user_email?: string;

  @IsOptional()
  @IsUUID()
  user_type_id?: string;

  @IsOptional()
  @IsUUID()
  company_id?: string;

  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsString()
  action_type?: string;

  /** Broad search: name, email, action, action_label, module, metadata JSON. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  @IsOptional()
  @IsEnum(ActivityLogEntryStatus)
  status?: ActivityLogEntryStatus;

  /** For incremental polling (ISO); returns rows strictly after this time. */
  @IsOptional()
  @IsDateString()
  since?: string;

  /** Filter by the acting user (`log.user_id`). */
  @IsOptional()
  @IsUUID()
  performed_by_user_id?: string;

  /** Export only: `csv` (default), `xlsx`, or `pdf`. Ignored for list/summary. */
  @IsOptional()
  @IsIn(['csv', 'xlsx', 'pdf'])
  format?: 'csv' | 'xlsx' | 'pdf';
}
