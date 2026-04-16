import { ApiProperty } from '@nestjs/swagger';

class UserTypeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

class CompanyResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  first_name: string;

  @ApiProperty()
  last_name: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ nullable: true })
  phone: string | null;

  @ApiProperty()
  account_type: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ type: () => UserTypeResponseDto, nullable: true })
  user_type: UserTypeResponseDto | null;

  @ApiProperty({ type: () => CompanyResponseDto, nullable: true })
  company: CompanyResponseDto | null;

  @ApiProperty()
  created_at: Date;
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

export class UserListResponseDto {
  @ApiProperty({ type: () => [UserResponseDto] })
  data: UserResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}

class UserSummaryByTypeDto {
  @ApiProperty()
  user_type: string;

  @ApiProperty({ nullable: true })
  category: string | null;

  @ApiProperty()
  count: number;
}

export class UserSummaryResponseDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  active: number;

  @ApiProperty()
  inactive: number;

  @ApiProperty()
  awaiting_activation: number;

  @ApiProperty()
  archived: number;

  @ApiProperty({ type: () => [UserSummaryByTypeDto] })
  by_user_type: UserSummaryByTypeDto[];
}

export class InviteSentResponseDto {
  @ApiProperty()
  sent: boolean;
}
