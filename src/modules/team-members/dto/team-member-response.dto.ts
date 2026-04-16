import { ApiProperty } from '@nestjs/swagger';

class TeamMemberUserTypeResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

class TeamMemberCompanyResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

export class TeamMemberResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ nullable: true })
  phone: string | null;

  @ApiProperty({ type: () => TeamMemberUserTypeResponseDto, nullable: true })
  user_type: TeamMemberUserTypeResponseDto | null;

  @ApiProperty()
  status: string;

  @ApiProperty()
  account_type: string;

  @ApiProperty({ type: () => TeamMemberCompanyResponseDto, nullable: true })
  company: TeamMemberCompanyResponseDto | null;

  @ApiProperty({ nullable: true })
  department: string | null;

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

export class TeamMemberListResponseDto {
  @ApiProperty({ type: () => [TeamMemberResponseDto] })
  data: TeamMemberResponseDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta: PaginationMetaDto;
}

class TeamMemberSummaryByTypeDto {
  @ApiProperty()
  user_type: string;

  @ApiProperty()
  count: number;
}

export class TeamMemberSummaryResponseDto {
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

  @ApiProperty({ type: () => [TeamMemberSummaryByTypeDto] })
  by_user_type: TeamMemberSummaryByTypeDto[];
}

export class TeamMemberInviteSentResponseDto {
  @ApiProperty()
  sent: boolean;
}
