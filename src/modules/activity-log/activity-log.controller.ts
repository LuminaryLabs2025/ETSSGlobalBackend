import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ActivityLogService } from './activity-log.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('activity-logs')
@ApiBearerAuth('access-token')
@Controller('api/activity-logs')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get()
  @Roles('Super Admin', 'Admin')
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.activityLogService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('user/:userId')
  @Roles('Super Admin', 'Admin')
  findByUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.activityLogService.findByUser(userId);
  }
}
