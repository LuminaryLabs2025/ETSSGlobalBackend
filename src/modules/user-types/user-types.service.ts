import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserType } from '../../database/entities/user-type.entity';
import { UserTypeCategory } from '../../common/enums';
import type { UserTypeCategoryQuery } from './dto/query-user-types.dto';

@Injectable()
export class UserTypesService {
  constructor(
    @InjectRepository(UserType)
    private readonly userTypeRepository: Repository<UserType>,
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
