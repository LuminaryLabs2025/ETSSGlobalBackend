import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryCompaniesDto {
  /** Filters by name/email/phone — used by the Transporter picker on booking-creation forms. */
  @ApiPropertyOptional({
    description: 'Free-text match against name, email, or phone.',
    example: 'Logistics',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({
    description:
      'Filter by user type id (companies.user_type_id). Look up the id via GET /api/user-types?search=<name> first — e.g. resolve a "Transporter" type before passing it here. Mutually exclusive with user_type_slug (id takes precedence if both are sent).',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  user_type_id?: string;

  @ApiPropertyOptional({
    description:
      'Filter by user type slug (user_types.slug), e.g. "transporter". Convenience alternative to user_type_id when the id is not already known. Ignored if user_type_id is also sent.',
    example: 'transporter',
  })
  @IsOptional()
  @IsString()
  user_type_slug?: string;
}
