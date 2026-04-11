import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../database/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { UserStatus } from '../../common/enums';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userRepository.findOne({
      where: { email },
      relations: [
        'user_type',
        'user_roles',
        'user_roles.role',
        'user_roles.role.role_permissions',
        'user_roles.role.role_permissions.permission',
      ],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (
      user.status === UserStatus.INACTIVE ||
      user.status === UserStatus.ARCHIVED
    ) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const roles = user.user_roles?.map((ur) => ur.role.name) || [];
    const permissions = this.extractPermissions(user);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      is_super_admin: user.is_super_admin,
      company_id: user.company_id,
      roles,
      permissions,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_super_admin: user.is_super_admin,
        account_type: user.account_type,
        status: user.status,
        user_type: user.user_type
          ? { id: user.user_type.id, name: user.user_type.name }
          : null,
        company_id: user.company_id,
        roles,
        permissions,
      },
    };
  }

  private extractPermissions(user: User): string[] {
    const permissionsSet = new Set<string>();
    user.user_roles?.forEach((ur) => {
      ur.role?.role_permissions?.forEach((rp) => {
        if (rp.permission?.name) {
          permissionsSet.add(rp.permission.name);
        }
      });
    });
    return Array.from(permissionsSet);
  }
}
