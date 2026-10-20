import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities';
import { UserTypeCategory } from '../../common/enums';

/**
 * The corridor-wide overview is for SuperAdmins and SYSTEM user types
 * (Admin, Customer Service, Operations Verifier, Road Marshall). External
 * user types also hold view_overview (every view_* is granted to them), so
 * the permission alone is not enough. The JWT carries no user type, hence
 * the lookup.
 */
@Injectable()
export class SystemStaffGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const actor = context
      .switchToHttp()
      .getRequest<{ user?: { id: string; is_super_admin?: boolean } }>().user;
    if (!actor) throw new UnauthorizedException('Authentication required');
    if (actor.is_super_admin) return true;

    const user = await this.userRepository.findOne({
      where: { id: actor.id },
      relations: ['user_type'],
    });
    if (user?.user_type?.category !== UserTypeCategory.SYSTEM) {
      throw new ForbiddenException(
        'The overview is available to SuperAdmin and system staff only',
      );
    }
    return true;
  }
}
