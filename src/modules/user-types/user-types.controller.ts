import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserTypesService } from './user-types.service';
import { QueryUserTypesDto } from './dto/query-user-types.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('user-types')
@ApiBearerAuth('access-token')
@Controller('api/user-types')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class UserTypesController {
  constructor(private readonly userTypesService: UserTypesService) {}

  @Get()
  @ApiOperation({
    summary: 'List user types',
    description:
      'Returns active user types. Any metadata field with `optionsSource` has `options` ' +
      'hydrated server-side as `{ label, value }[]` (shipping lines, port terminals, transit parks, barrier locations).',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: ['SYSTEM', 'EXTERNAL'],
    description:
      'Optional filter. Response is a flat array; each item has `category`. INTERNAL = same as SYSTEM.',
  })
  @Permissions('manage_users')
  findAll(@Query() query: QueryUserTypesDto) {
    return this.userTypesService.findAll(query.category);
  }

  @Get(':id/allowed-permissions')
  @Permissions('manage_users', 'create_user', 'invite_team_members')
  findAllowedPermissions(@Param('id', ParseUUIDPipe) id: string) {
    return this.userTypesService.findAllowedPermissions(id);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get user type by id',
    description:
      'Same metadata hydration as list: `optionsSource` fields receive resolved `options`.',
  })
  @Permissions('manage_users')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userTypesService.findOne(id);
  }
}
