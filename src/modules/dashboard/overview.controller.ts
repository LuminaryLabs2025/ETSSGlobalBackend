import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionsGuard, SuperAdminGuard } from '../../common/guards';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OverviewService } from './overview.service';
import { OpsActor, OpsCommandService } from './ops-command.service';
import { SystemStaffGuard } from './system-staff.guard';
import {
  AuthoriseOpsCommandDto,
  LiftOpsCommandDto,
  OverviewLimitDto,
  OverviewPeriodDto,
  QueryOpsCommandOrdersDto,
  QueryRecentActivityDto,
} from './dto/overview.dto';

/**
 * Dashboard overview (/dashboard home) — one endpoint per section so each
 * card loads and refreshes on its own. SuperAdmin and SYSTEM staff only.
 */
@ApiTags('dashboard-overview')
@ApiBearerAuth('access-token')
@Controller('api/dashboard/overview')
@UseGuards(AuthGuard('jwt'), PermissionsGuard, SystemStaffGuard)
@Permissions('view_overview')
export class OverviewController {
  constructor(
    private readonly overviewService: OverviewService,
    private readonly opsCommandService: OpsCommandService,
  ) {}

  @Get('corridor')
  @ApiOperation({
    summary:
      'Corridor status banner: live movements, active sites, verified trucks/drivers on corridor, congestion index',
  })
  async corridor() {
    return this.ok(
      'Corridor status fetched successfully',
      await this.overviewService.corridor(),
    );
  }

  @Get('red-zone')
  @ApiOperation({
    summary: 'Congestion by site (Red-Zone button), most congested first',
  })
  async redZone() {
    return this.ok(
      'Red-zone status fetched successfully',
      await this.overviewService.redZone(),
    );
  }

  @Get('executive')
  @ApiOperation({
    summary:
      'Executive Intelligence tiles with 7-day trends: live bookings, verified trucks/drivers, avg TAT Apapa/Tincan, exceptions',
  })
  async executive() {
    return this.ok(
      'Executive metrics fetched successfully',
      await this.overviewService.executive(),
    );
  }

  @Get('revenue')
  @ApiOperation({
    summary:
      'e-Revenue breakdown cards (bookings, penalties, utility tickets, tow requests) and the header total',
  })
  async revenue() {
    return this.ok(
      'Revenue breakdown fetched successfully',
      await this.overviewService.revenue(),
    );
  }

  @Get('lifecycle')
  @ApiOperation({
    summary: 'Booking → Manifest lifecycle: trucks currently in each stage',
  })
  async lifecycle() {
    return this.ok(
      'Lifecycle counts fetched successfully',
      await this.overviewService.lifecycle(),
    );
  }

  @Get('bookings-by-terminal')
  @ApiOperation({
    summary: 'Live / completed / cancelled bookings per destination terminal',
  })
  async bookingsByTerminal(@Query() query: OverviewPeriodDto) {
    return this.ok(
      'Bookings by terminal fetched successfully',
      await this.overviewService.bookingsByTerminal(query),
    );
  }

  @Get('matchings-by-facility')
  @ApiOperation({
    summary: 'Truck entry permits per facility, matched vs unmatched',
  })
  async matchingsByFacility(@Query() query: OverviewPeriodDto) {
    return this.ok(
      'Matchings by facility fetched successfully',
      await this.overviewService.matchingsByFacility(query),
    );
  }

  @Get('bookings-by-category')
  @ApiOperation({ summary: 'Bookings per booking category (donut)' })
  async bookingsByCategory(@Query() query: OverviewPeriodDto) {
    return this.ok(
      'Bookings by category fetched successfully',
      await this.overviewService.bookingsByCategory(query),
    );
  }

  @Get('recent-activity')
  @ApiOperation({
    summary:
      'Recent Bookings (bookings + utility tickets) or Recent Matchings feed',
  })
  async recentActivity(@Query() query: QueryRecentActivityDto) {
    return this.ok(
      'Recent activity fetched successfully',
      await this.overviewService.recentActivity(query),
    );
  }

  @Get('incident-board')
  @ApiOperation({
    summary:
      'Open incidents (most severe first) and the Left-Manifest tow-request count',
  })
  async incidentBoard(@Query() query: OverviewLimitDto) {
    return this.ok(
      'Incident board fetched successfully',
      await this.overviewService.incidentBoard(query),
    );
  }

  // ── Operations Command & Control ──

  @Get('ops-command')
  @ApiOperation({
    summary:
      'Five intervention cards with rule-based recommendations and active orders',
  })
  async opsCommand() {
    return this.ok(
      'Ops command board fetched successfully',
      await this.opsCommandService.board(),
    );
  }

  @Get('ops-command/orders')
  @ApiOperation({ summary: 'Ops command order log' })
  async opsCommandOrders(@Query() query: QueryOpsCommandOrdersDto) {
    return this.ok(
      'Ops command orders fetched successfully',
      await this.opsCommandService.list(query),
    );
  }

  @Post('ops-command/orders')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({
    summary:
      'SuperAdmin authorises an intervention — logged and sent to LASTMA / Ops Control',
  })
  async authoriseOpsCommand(
    @Body() dto: AuthoriseOpsCommandDto,
    @CurrentUser() user: OpsActor,
  ) {
    return this.ok(
      'Ops command order authorised',
      await this.opsCommandService.authorise(dto, user),
    );
  }

  @Patch('ops-command/orders/:id/lift')
  @UseGuards(SuperAdminGuard)
  @ApiOperation({ summary: 'SuperAdmin lifts an active order' })
  async liftOpsCommand(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LiftOpsCommandDto,
    @CurrentUser() user: OpsActor,
  ) {
    return this.ok(
      'Ops command order lifted',
      await this.opsCommandService.lift(id, dto, user),
    );
  }

  private ok<T>(message: string, data: T) {
    return { success: true, message, data };
  }
}
