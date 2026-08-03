import { IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryUsersSummaryDto {
  @ApiPropertyOptional({
    enum: ['SYSTEM', 'EXTERNAL', 'INTERNAL'],
    description:
      'Filter summary by user type category. INTERNAL is an alias for SYSTEM (internal staff).',
  })
  @IsOptional()
  @IsIn(['SYSTEM', 'EXTERNAL', 'INTERNAL'], {
    message: 'user_type_category must be SYSTEM, EXTERNAL, or INTERNAL',
  })
  user_type_category?: 'SYSTEM' | 'EXTERNAL' | 'INTERNAL';
}
