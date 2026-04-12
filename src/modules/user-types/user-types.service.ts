import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserType } from '../../database/entities/user-type.entity';
import { Permission } from '../../database/entities/permission.entity';
import { UserTypeCategory } from '../../common/enums';
import type { UserTypeCategoryQuery } from './dto/query-user-types.dto';

@Injectable()
export class UserTypesService {
  constructor(
    @InjectRepository(UserType)
    private readonly userTypeRepository: Repository<UserType>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  /**
   * @param category - If set, only types in that category are returned (still grouped).
   *                   INTERNAL is treated the same as SYSTEM.
   */
  async findAll(categoryFilter?: UserTypeCategoryQuery) {
    const types = await this.userTypeRepository.find({
      where: { is_active: true },
      order: { name: 'ASC' },
    });

    const matchCategory = this.resolveCategoryFilter(categoryFilter);
    const scoped = matchCategory
      ? types.filter((t) => t.category === matchCategory)
      : types;

    const system = scoped.filter(
      (t) => t.category === UserTypeCategory.SYSTEM,
    );
    const external = scoped.filter(
      (t) => t.category === UserTypeCategory.EXTERNAL,
    );

    return { system, external };
  }

  private resolveCategoryFilter(
    category?: UserTypeCategoryQuery,
  ): UserTypeCategory | undefined {
    if (!category) return undefined;
    if (category === 'INTERNAL' || category === 'SYSTEM') {
      return UserTypeCategory.SYSTEM;
    }
    return UserTypeCategory.EXTERNAL;
  }

  async findOne(id: string): Promise<UserType> {
    const userType = await this.userTypeRepository.findOne({
      where: { id },
    });
    if (!userType) {
      throw new NotFoundException('User type not found');
    }
    return userType;
  }

  /** Permissions this user type may be granted (invite / checkbox UI). */
  async findAllowedPermissions(userTypeId: string): Promise<Permission[]> {
    await this.findOne(userTypeId);
    return this.permissionRepository
      .createQueryBuilder('p')
      .innerJoin(
        'p.user_type_permission_links',
        'utp',
        'utp.user_type_id = :tid',
        { tid: userTypeId },
      )
      .leftJoinAndSelect('p.module', 'm')
      .orderBy('m.sort_order', 'ASC')
      .addOrderBy('p.sort_order', 'ASC')
      .addOrderBy('p.name', 'ASC')
      .getMany();
  }

  async findBySlug(slug: string): Promise<UserType> {
    const userType = await this.userTypeRepository.findOne({
      where: { slug },
    });
    if (!userType) {
      throw new NotFoundException(`User type "${slug}" not found`);
    }
    return userType;
  }
}
