import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TeamMembersService } from './team-members.service';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';
import { QueryTeamMembersDto } from './dto/query-team-members.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  TeamMemberInviteSentResponseDto,
  TeamMemberListResponseDto,
  TeamMemberResponseDto,
  TeamMemberSummaryResponseDto,
} from './dto/team-member-response.dto';

@ApiTags('team-members')
@ApiBearerAuth('access-token')
@Controller('api/team-members')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class TeamMembersController {
  constructor(private readonly teamMembersService: TeamMembersService) {}

  @Post()
  @Permissions('create_user', 'invite_team_members')
  @ApiOperation({
    summary: 'Create team member (sub-account user)',
    description:
      'Creates a User with account_type SUB_ACCOUNT. company_id is taken from the inviter JWT for external types; system types have no company. Do not send company_id in the body.',
  })
  @ApiOkResponse({ type: TeamMemberResponseDto })
  create(
    @Body() dto: CreateTeamMemberDto,
    @CurrentUser() user: any,
    @CurrentUser('email') actorEmail: string,
  ) {
    return this.teamMembersService.create(
      dto,
      {
        id: user.id,
        is_super_admin: user.is_super_admin,
        company_id: user.company_id ?? null,
      },
      actorEmail,
    );
  }

  @Get('summary')
  @Permissions('manage_users')
  @ApiOperation({ summary: 'Team member counts (sub-accounts only)' })
  @ApiOkResponse({ type: TeamMemberSummaryResponseDto })
  getSummary(@CurrentUser() user: any) {
    return this.teamMembersService.getSummary({
      id: user.id,
      is_super_admin: user.is_super_admin,
      company_id: user.company_id ?? null,
    });
  }

  @Get()
  @Permissions('manage_users')
  @ApiOperation({ summary: 'List team members (paginated, filtered)' })
  @ApiOkResponse({ type: TeamMemberListResponseDto })
  findAll(@Query() query: QueryTeamMembersDto, @CurrentUser() user: any) {
    return this.teamMembersService.findAll(query, {
      id: user.id,
      is_super_admin: user.is_super_admin,
      company_id: user.company_id ?? null,
    });
  }

  @Get(':id')
  @Permissions('manage_users')
  @ApiOkResponse({ type: TeamMemberResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.teamMembersService.findOne(id, {
      id: user.id,
      is_super_admin: user.is_super_admin,
      company_id: user.company_id ?? null,
    });
  }

  @Patch(':id/disable')
  @Permissions('manage_users')
  @ApiOkResponse({ type: TeamMemberResponseDto })
  disable(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.teamMembersService.disable(id, {
      id: user.id,
      is_super_admin: user.is_super_admin,
      company_id: user.company_id ?? null,
    });
  }

  @Patch(':id/enable')
  @Permissions('manage_users')
  @ApiOkResponse({ type: TeamMemberResponseDto })
  enable(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.teamMembersService.enable(id, {
      id: user.id,
      is_super_admin: user.is_super_admin,
      company_id: user.company_id ?? null,
    });
  }

  @Patch(':id/archive')
  @Permissions('manage_users')
  @ApiOkResponse({ type: TeamMemberResponseDto })
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.teamMembersService.archive(id, {
      id: user.id,
      is_super_admin: user.is_super_admin,
      company_id: user.company_id ?? null,
    });
  }

  @Post(':id/resend-invite')
  @Permissions('manage_users')
  @ApiOkResponse({ type: TeamMemberInviteSentResponseDto })
  resendInvite(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: any,
  ) {
    return this.teamMembersService.resendInvite(id, {
      id: user.id,
      is_super_admin: user.is_super_admin,
      company_id: user.company_id ?? null,
    });
  }
}
