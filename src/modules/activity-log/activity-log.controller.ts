import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { ActivityLogService } from './activity-log.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QueryActivityLogsDto } from './dto/query-activity-logs.dto';

@ApiTags('activity-logs')
@ApiBearerAuth('access-token')
@Controller('api/activity-logs')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get()
  @Permissions('view_audit_logs')
  @ApiOperation({
    summary: 'List activity logs',
    description:
      'Paginated audit trail with filters. Use `since` (ISO) for polling without full refresh.',
  })
  findAll(@Query() query: QueryActivityLogsDto) {
    return this.activityLogService.findAll(query);
  }

  @Get('summary')
  @Permissions('view_audit_logs')
  @ApiOperation({ summary: 'Summary counts for dashboard panel' })
  getSummary() {
    return this.activityLogService.getSummary();
  }

  @Get('export')
  @Permissions('view_audit_logs', 'export_activity_log')
  @ApiOperation({
    summary: 'Export activity log',
    description:
      'Same filters as list (`search`, `date_from`, `status`, etc.). `format`: csv | xlsx | pdf.',
  })
  async export(
    @Query() query: QueryActivityLogsDto,
    @Res() res: Response,
  ) {
    const format = query.format ?? 'csv';
    if (!['csv', 'xlsx', 'pdf'].includes(format)) {
      throw new BadRequestException('format must be csv, xlsx, or pdf');
    }
    const { body, mime, ext } = await this.activityLogService.export(
      query,
      format,
    );
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="activity-log-${Date.now()}.${ext}"`,
    );
    res.send(body);
  }

  @Get('user/:userId')
  @Permissions('view_audit_logs')
  @ApiOperation({ summary: 'Activities performed by a specific user' })
  findByUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.activityLogService.findAll({
      performed_by_user_id: userId,
      page: 1,
      limit: 100,
    });
  }

  @Get(':id')
  @Permissions('view_audit_logs')
  @ApiOperation({ summary: 'Single activity record (detail drawer)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.activityLogService.findOne(id);
  }
}
