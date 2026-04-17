import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserType } from '../../database/entities/user-type.entity';
import { Permission } from '../../database/entities/permission.entity';
import { UserTypeCategory } from '../../common/enums';
import type { UserTypeCategoryQuery } from './dto/query-user-types.dto';
import { UserTypeFieldOptionsService } from './user-type-field-options.service';

@Injectable()
export class UserTypesService {
  constructor(
    @InjectRepository(UserType)
    private readonly userTypeRepository: Repository<UserType>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    private readonly userTypeFieldOptionsService: UserTypeFieldOptionsService,
  ) {}

  /**
   * Active user types, sorted by name. Each row includes `category` (SYSTEM | EXTERNAL).
   * @param categoryFilter - If set, only that category is returned (INTERNAL alias → SYSTEM).
   */
  async findAll(categoryFilter?: UserTypeCategoryQuery): Promise<UserType[]> {
    const types = await this.userTypeRepository.find({
      where: { is_active: true },
      order: { name: 'ASC' },
    });

    const matchCategory = this.resolveCategoryFilter(categoryFilter);
    const filtered = !matchCategory
      ? types
      : types.filter((t) => t.category === matchCategory);

    const optionsMap =
      await this.userTypeFieldOptionsService.buildOptionsMapForUserTypes(
        filtered,
      );
    return filtered.map((t) =>
      this.userTypeFieldOptionsService.toHydratedUserType(t, optionsMap),
    );
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
    const optionsMap =
      await this.userTypeFieldOptionsService.buildOptionsMapForUserTypes([
        userType,
      ]);
    return this.userTypeFieldOptionsService.toHydratedUserType(
      userType,
      optionsMap,
    );
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
    const optionsMap =
      await this.userTypeFieldOptionsService.buildOptionsMapForUserTypes([
        userType,
      ]);
    return this.userTypeFieldOptionsService.toHydratedUserType(
      userType,
      optionsMap,
    );
  }
}
