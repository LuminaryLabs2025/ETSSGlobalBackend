import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Raw, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../database/entities/user.entity';
import { Permission } from '../../database/entities/permission.entity';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { UserStatus } from '../../common/enums';
import { normalizeEmail } from '../../common/utils/email-normalize';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { password } = loginDto;
    const emailNorm = normalizeEmail(loginDto.email);

    const user = await this.userRepository.findOne({
      where: {
        email: Raw((alias) => `LOWER(TRIM(${alias})) = :e`, { e: emailNorm }),
      },
      relations: [
        'user_type',
        'user_permissions',
        'user_permissions.permission',
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

    if (user.status === UserStatus.AWAITING_ACTIVATION) {
      user.status = UserStatus.ACTIVE;
      await this.userRepository.save(user);
    }

    const permissions = await this.resolvePermissionNames(user);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      is_super_admin: user.is_super_admin,
      company_id: user.company_id,
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
        permissions,
      },
    };
  }

  private async resolvePermissionNames(user: User): Promise<string[]> {
    if (user.is_super_admin) {
      const rows = await this.permissionRepository.find({
        select: ['name'],
        order: { name: 'ASC' },
      });
      return rows.map((r) => r.name);
    }
    const set = new Set<string>();
    user.user_permissions?.forEach((up) => {
      if (up.permission?.name) set.add(up.permission.name);
    });
    return Array.from(set);
  }
}
