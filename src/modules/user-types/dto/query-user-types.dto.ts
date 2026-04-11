import { IsIn, IsOptional } from 'class-validator';

/** Query values for GET /api/user-types. INTERNAL is an alias for SYSTEM (internal staff). */
export type UserTypeCategoryQuery =
  | 'SYSTEM'
  | 'EXTERNAL'
  | 'INTERNAL';

export class QueryUserTypesDto {
  @IsOptional()
  @IsIn(['SYSTEM', 'EXTERNAL', 'INTERNAL'], {
    message: 'category must be SYSTEM, EXTERNAL, or INTERNAL',
  })
  category?: UserTypeCategoryQuery;
}
