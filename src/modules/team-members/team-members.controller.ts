import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TeamMembersService } from './team-members.service';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';
import { AssignTeamMemberRoleDto } from './dto/assign-team-member-role.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/team-members')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class TeamMembersController {
  constructor(private readonly teamMembersService: TeamMembersService) {}

  @Post()
  @Permissions('create_user')
  create(
    @Body() createDto: CreateTeamMemberDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('email') invitedByEmail: string,
    @CurrentUser('company_id') companyId: string,
  ) {
    return this.teamMembersService.create(
      createDto,
      userId,
      companyId,
      invitedByEmail,
    );
  }

  @Get()
  @Permissions('manage_users')
  findAll(@CurrentUser('company_id') companyId: string) {
    return this.teamMembersService.findAllByCompany(companyId);
  }

  @Get(':id')
  @Permissions('manage_users')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamMembersService.findOne(id);
  }

  @Delete(':id')
  @Permissions('manage_users')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.teamMembersService.remove(id);
  }

  @Post(':id/roles')
  @Permissions('manage_roles')
  assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTeamMemberRoleDto,
  ) {
    return this.teamMembersService.assignRole(id, dto.role_id);
  }

  @Delete(':id/roles/:roleId')
  @Permissions('manage_roles')
  removeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ) {
    return this.teamMembersService.removeRole(id, roleId);
  }
}
