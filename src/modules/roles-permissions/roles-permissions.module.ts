import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesPermissionsService } from './roles-permissions.service';
import { RolesPermissionsController } from './roles-permissions.controller';
import { PermissionModule } from '../../database/entities/permission-module.entity';
import { Permission } from '../../database/entities/permission.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PermissionModule, Permission])],
  controllers: [RolesPermissionsController],
  providers: [RolesPermissionsService],
  exports: [RolesPermissionsService],
})
export class RolesPermissionsModule {}
