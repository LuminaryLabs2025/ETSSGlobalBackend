import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesPermissionsService } from './roles-permissions.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('permissions')
@ApiBearerAuth('access-token')
@Controller('api/roles-permissions')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class RolesPermissionsController {
  constructor(
    private readonly rolesPermissionsService: RolesPermissionsService,
  ) {}

  @Get('permission-modules')
  @Permissions('manage_users', 'create_user', 'invite_team_members')
  @ApiOperation({
    summary: 'Permission modules with nested permissions (seeded catalog)',
    description:
      'Aligned with app navigation (`nav_section` for sidebar groups). Seeded only.',
  })
  findAllPermissionModules() {
    return this.rolesPermissionsService.findAllPermissionModules();
  }

  @Get('permissions')
  @Permissions('manage_users', 'create_user', 'invite_team_members')
  @ApiOperation({ summary: 'All permissions (flat, with module)' })
  findAllPermissions() {
    return this.rolesPermissionsService.findAllPermissions();
  }

  @Get('permissions/:id')
  @Permissions('manage_users', 'create_user', 'invite_team_members')
  findOnePermission(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesPermissionsService.findOnePermission(id);
  }
}
