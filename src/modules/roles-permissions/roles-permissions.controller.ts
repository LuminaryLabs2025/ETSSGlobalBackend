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
import { RolesPermissionsService } from './roles-permissions.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('roles-permissions')
@ApiBearerAuth('access-token')
@Controller('api/roles-permissions')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class RolesPermissionsController {
  constructor(
    private readonly rolesPermissionsService: RolesPermissionsService,
  ) {}

  // --- Roles ---

  @Post('roles')
  @Roles('Super Admin')
  createRole(@Body() dto: CreateRoleDto) {
    return this.rolesPermissionsService.createRole(dto);
  }

  @Get('roles')
  @Permissions('manage_roles')
  findAllRoles() {
    return this.rolesPermissionsService.findAllRoles();
  }

  @Get('roles/:id')
  @Permissions('manage_roles')
  findOneRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesPermissionsService.findOneRole(id);
  }

  @Delete('roles/:id')
  @Roles('Super Admin')
  deleteRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesPermissionsService.deleteRole(id);
  }

  // --- Permissions ---

  @Post('permissions')
  @Roles('Super Admin')
  createPermission(@Body() dto: CreatePermissionDto) {
    return this.rolesPermissionsService.createPermission(dto);
  }

  @Get('permissions')
  @Permissions('manage_roles')
  findAllPermissions() {
    return this.rolesPermissionsService.findAllPermissions();
  }

  @Get('permissions/:id')
  @Permissions('manage_roles')
  findOnePermission(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesPermissionsService.findOnePermission(id);
  }

  @Delete('permissions/:id')
  @Roles('Super Admin')
  deletePermission(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesPermissionsService.deletePermission(id);
  }

  // --- Role ↔ Permission Assignment ---

  @Post('assign')
  @Roles('Super Admin')
  assignPermission(@Body() dto: AssignPermissionDto) {
    return this.rolesPermissionsService.assignPermissionToRole(
      dto.role_id,
      dto.permission_id,
    );
  }

  @Delete('roles/:roleId/permissions/:permissionId')
  @Roles('Super Admin')
  removePermission(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ) {
    return this.rolesPermissionsService.removePermissionFromRole(
      roleId,
      permissionId,
    );
  }
}
