import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  InviteSentResponseDto,
  UserListResponseDto,
  UserResponseDto,
  UserSummaryResponseDto,
} from './dto/user-response.dto';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('api/users')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions('create_user')
  @ApiOkResponse({ type: UserResponseDto })
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.usersService.create(dto, userId);
  }

  @Get('summary')
  @Permissions('view_dashboard')
  @ApiOkResponse({ type: UserSummaryResponseDto })
  getSummary() {
    return this.usersService.getSummary();
  }

  @Get('export')
  @Permissions('manage_users')
  async exportCsv(@Query() query: QueryUsersDto, @Res() res: Response) {
    const csv = await this.usersService.exportCsv(query);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=users-export-${Date.now()}.csv`,
    });
    res.send(csv);
  }

  @Get()
  @Permissions('manage_users')
  @ApiOkResponse({ type: UserListResponseDto })
  findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @Permissions('manage_users')
  @ApiOkResponse({ type: UserResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  @Permissions('manage_users')
  @ApiOkResponse({ type: UserResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/disable')
  @Permissions('manage_users')
  @ApiOkResponse({ type: UserResponseDto })
  disable(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.usersService.disable(id, userId);
  }

  @Patch(':id/enable')
  @Permissions('manage_users')
  @ApiOkResponse({ type: UserResponseDto })
  enable(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.usersService.enable(id, userId);
  }

  @Patch(':id/archive')
  @Permissions('manage_users')
  @ApiOkResponse({ type: UserResponseDto })
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.usersService.archive(id, userId);
  }

  @Post(':id/resend-invite')
  @Permissions('manage_users')
  @ApiOkResponse({ type: InviteSentResponseDto })
  resendInvite(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.usersService.resendInvite(id, userId);
  }
}
