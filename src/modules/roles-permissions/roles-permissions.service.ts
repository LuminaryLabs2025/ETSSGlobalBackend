import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../database/entities/role.entity';
import { Permission } from '../../database/entities/permission.entity';
import { RolePermission } from '../../database/entities/role-permission.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';

@Injectable()
export class RolesPermissionsService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
  ) {}

  // --- Roles ---

  async createRole(dto: CreateRoleDto): Promise<Role> {
    const existing = await this.roleRepository.findOne({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException('Role with this name already exists');
    }
    const role = this.roleRepository.create(dto);
    return this.roleRepository.save(role);
  }

  async findAllRoles(): Promise<Role[]> {
    return this.roleRepository.find({
      relations: ['role_permissions', 'role_permissions.permission'],
    });
  }

  async findOneRole(id: string): Promise<Role> {
    const role = await this.roleRepository.findOne({
      where: { id },
      relations: ['role_permissions', 'role_permissions.permission'],
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.findOneRole(id);
    await this.roleRepository.remove(role);
  }

  // --- Permissions ---

  async createPermission(dto: CreatePermissionDto): Promise<Permission> {
    const existing = await this.permissionRepository.findOne({
      where: { name: dto.name },
    });
    if (existing) {
      throw new ConflictException('Permission with this name already exists');
    }
    const permission = this.permissionRepository.create(dto);
    return this.permissionRepository.save(permission);
  }

  async findAllPermissions(): Promise<Permission[]> {
    return this.permissionRepository.find();
  }

  async findOnePermission(id: string): Promise<Permission> {
    const permission = await this.permissionRepository.findOne({
      where: { id },
    });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }
    return permission;
  }

  async deletePermission(id: string): Promise<void> {
    const permission = await this.findOnePermission(id);
    await this.permissionRepository.remove(permission);
  }

  // --- Role ↔ Permission assignment ---

  async assignPermissionToRole(
    roleId: string,
    permissionId: string,
  ): Promise<RolePermission> {
    await this.findOneRole(roleId);
    await this.findOnePermission(permissionId);

    const existing = await this.rolePermissionRepository.findOne({
      where: { role_id: roleId, permission_id: permissionId },
    });
    if (existing) {
      throw new ConflictException('Permission already assigned to this role');
    }

    const rp = this.rolePermissionRepository.create({
      role_id: roleId,
      permission_id: permissionId,
    });
    return this.rolePermissionRepository.save(rp);
  }

  async removePermissionFromRole(
    roleId: string,
    permissionId: string,
  ): Promise<void> {
    const rp = await this.rolePermissionRepository.findOne({
      where: { role_id: roleId, permission_id: permissionId },
    });
    if (!rp) {
      throw new NotFoundException('Permission assignment not found');
    }
    await this.rolePermissionRepository.remove(rp);
  }
}
