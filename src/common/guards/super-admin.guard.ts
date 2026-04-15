import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { is_super_admin?: boolean } | undefined;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    if (!user.is_super_admin) {
      throw new ForbiddenException('SuperAdmin access is required');
    }
    return true;
  }
}
