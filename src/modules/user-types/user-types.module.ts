import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserTypesService } from './user-types.service';
import { UserTypesController } from './user-types.controller';
import { UserType } from '../../database/entities/user-type.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserType])],
  controllers: [UserTypesController],
  providers: [UserTypesService],
  exports: [UserTypesService],
})
export class UserTypesModule {}
