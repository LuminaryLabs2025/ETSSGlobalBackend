import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  IsUUID,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType, UserStatus } from '../../../common/enums';

export class QueryUsersDto {
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
  @IsUUID()
  user_type_id?: string;

  @ApiPropertyOptional({
    enum: ['SYSTEM', 'EXTERNAL', 'INTERNAL'],
    description:
      'Filter by user type category. INTERNAL is an alias for SYSTEM (internal staff).',
  })
  @IsOptional()
  @IsIn(['SYSTEM', 'EXTERNAL', 'INTERNAL'], {
    message: 'user_type_category must be SYSTEM, EXTERNAL, or INTERNAL',
  })
  user_type_category?: 'SYSTEM' | 'EXTERNAL' | 'INTERNAL';

  @IsOptional()
  @IsEnum(AccountType)
  account_type?: AccountType;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsUUID()
  company_id?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  date_from?: string;

  @IsOptional()
  @IsString()
  date_to?: string;

  @IsOptional()
  @IsString()
  sort_by?: string = 'created_at';

  @IsOptional()
  @IsString()
  sort_order?: 'ASC' | 'DESC' = 'DESC';
}
