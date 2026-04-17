import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserTypesService } from './user-types.service';
import { UserTypesController } from './user-types.controller';
import { UserType } from '../../database/entities/user-type.entity';
import { Permission } from '../../database/entities/permission.entity';
import { Company } from '../../database/entities/company.entity';
import { TerminalGate } from '../../database/entities/app-options.entities';
import { UserTypeFieldOptionsService } from './user-type-field-options.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserType, Permission, Company, TerminalGate]),
  ],
  controllers: [UserTypesController],
  providers: [UserTypesService, UserTypeFieldOptionsService],
  exports: [UserTypesService, UserTypeFieldOptionsService],
})
export class UserTypesModule {}
