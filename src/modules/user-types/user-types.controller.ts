import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserTypesService } from './user-types.service';
import { QueryUserTypesDto } from './dto/query-user-types.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('user-types')
@ApiBearerAuth('access-token')
@Controller('api/user-types')
@UseGuards(AuthGuard('jwt'), RolesGuard, PermissionsGuard)
export class UserTypesController {
  constructor(private readonly userTypesService: UserTypesService) {}

  @Get()
  @ApiQuery({
    name: 'category',
    required: false,
    enum: ['SYSTEM', 'EXTERNAL', 'INTERNAL'],
    description:
      'Filter by category. SYSTEM = internal ETSS staff; EXTERNAL = B2B entities; INTERNAL = same as SYSTEM.',
  })
  @Permissions('manage_users')
  findAll(@Query() query: QueryUserTypesDto) {
    return this.userTypesService.findAll(query.category);
  }

  @Get(':id')
  @Permissions('manage_users')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userTypesService.findOne(id);
  }
}
