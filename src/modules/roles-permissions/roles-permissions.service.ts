import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../../database/entities/permission.entity';
import { PermissionModule } from '../../database/entities/permission-module.entity';

@Injectable()
export class RolesPermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(PermissionModule)
    private readonly permissionModuleRepository: Repository<PermissionModule>,
  ) {}

  async findAllPermissions(): Promise<Permission[]> {
    return this.permissionRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.module', 'm')
      .orderBy('m.sort_order', 'ASC')
      .addOrderBy('p.sort_order', 'ASC')
      .addOrderBy('p.name', 'ASC')
      .getMany();
  }

  async findOnePermission(id: string): Promise<Permission> {
    const permission = await this.permissionRepository.findOne({
      where: { id },
      relations: ['module'],
    });
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }
    return permission;
  }

  /** Modules with nested permissions for nav-aligned assignment UIs (seeded only). */
  async findAllPermissionModules(): Promise<PermissionModule[]> {
    return this.permissionModuleRepository
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.permissions', 'p')
      .orderBy('m.sort_order', 'ASC')
      .addOrderBy('p.sort_order', 'ASC')
      .addOrderBy('p.name', 'ASC')
      .getMany();
  }
}
