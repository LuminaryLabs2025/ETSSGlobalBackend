import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { PermissionsGuard } from '../../common/guards';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LiveTrucksService } from './live-trucks.service';
import { LiveLocationsService, TrafficActor } from './live-locations.service';
import { OccService } from './occ.service';
import {
  CreateBarrierTagEventDto,
  QueryBarrierTagEventsDto,
  QueryCancelledBookingsDto,
  QueryEmergenciesDto,
  QueryLiveLocationsDto,
  QueryLiveTruckMatrixDto,
  QueryLiveTrucksDto,
  QueryOccDto,
} from './dto/traffic-command.dto';

@ApiTags('traffic-command')
@ApiBearerAuth('access-token')
@Controller('api/traffic-command')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class TrafficCommandController {
  constructor(
    private readonly liveTrucksService: LiveTrucksService,
    private readonly liveLocationsService: LiveLocationsService,
    private readonly occService: OccService,
  ) {}

  // ── Live Truck Updates ──

  @Get('live-trucks/summary')
  @Permissions('view_traffic_command')
  @ApiOperation({
    summary:
      'Status cards: Total Bookings, On-Trip, Left-Facility, Left-Pregate, In-Terminal (+ per stage)',
  })
  async liveTrucksSummary(@Query() query: QueryLiveTrucksDto) {
    return this.ok(
      'Live truck summary fetched successfully',
      await this.liveTrucksService.summary(query),
    );
  }

  @Get('live-trucks/matrix')
  @Permissions('view_traffic_command')
  @ApiOperation({
    summary: 'Truck real-time activity — plates per location and stage',
  })
  async liveTrucksMatrix(@Query() query: QueryLiveTruckMatrixDto) {
    return this.ok(
      'Live truck activity fetched successfully',
      await this.liveTrucksService.matrix(query),
    );
  }

  @Get('live-trucks')
  @Permissions('view_traffic_command')
  @ApiOperation({ summary: 'Flat list of live trucks with their stage' })
  async liveTrucks(@Query() query: QueryLiveTrucksDto) {
    return this.ok(
      'Live trucks fetched successfully',
      await this.liveTrucksService.list(query),
    );
  }

  // ── Live Location Updates ──

  @Get('locations')
  @Permissions('view_traffic_command')
  @ApiOperation({
    summary:
      'Map locations with gate barrier status, trucks tagged per hour and ATAT',
  })
  async locations(@Query() query: QueryLiveLocationsDto) {
    return this.ok(
      'Live locations fetched successfully',
      await this.liveLocationsService.locations(query),
    );
  }

  @Post('barrier-events')
  @ApiOperation({
    summary:
      'Record a truck tagged at a barrier (SuperAdmin, manage_traffic_command, or the handheld-device user on that barrier)',
  })
  async recordTagEvent(
    @Body() dto: CreateBarrierTagEventDto,
    @CurrentUser() user: TrafficActor,
  ) {
    return this.ok(
      'Barrier tag recorded successfully',
      await this.liveLocationsService.recordTagEvent(dto, user),
    );
  }

  @Get('barrier-events')
  @Permissions('view_traffic_command')
  @ApiOperation({ summary: 'Barrier tag event log' })
  async tagEvents(@Query() query: QueryBarrierTagEventsDto) {
    return this.ok(
      'Barrier tag events fetched successfully',
      await this.liveLocationsService.listTagEvents(query),
    );
  }

  // ── Operations Command Centre ──

  @Get('occ/overview')
  @Permissions('view_traffic_command')
  @ApiOperation({
    summary:
      'OCC dashboard: truck KPIs, facility / transit park capacity, TAT, destinations, terminals, emergencies',
  })
  async occOverview(@Query() query: QueryOccDto) {
    return this.ok(
      'OCC overview fetched successfully',
      await this.occService.overview(query),
    );
  }

  @Get('occ/emergencies')
  @Permissions('view_traffic_command')
  @ApiOperation({
    summary: 'Emergency truck requests: tow requests, breakdowns, accidents',
  })
  async emergencies(@Query() query: QueryEmergenciesDto) {
    return this.ok(
      'Emergency requests fetched successfully',
      await this.occService.emergencies(query),
    );
  }

  @Get('occ/cancelled-bookings/export')
  @Permissions('view_traffic_command')
  @ApiProduces('text/csv')
  async exportCancelledBookings(
    @Query() query: QueryCancelledBookingsDto,
    @Res() res: Response,
  ) {
    const csv = await this.occService.exportCancelledBookings(query);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=cancelled-bookings-${Date.now()}.csv`,
    });
    res.send(csv);
  }

  @Get('occ/cancelled-bookings')
  @Permissions('view_traffic_command')
  async cancelledBookings(@Query() query: QueryCancelledBookingsDto) {
    return this.ok(
      'Cancelled bookings fetched successfully',
      await this.occService.cancelledBookings(query),
    );
  }

  private ok(message: string, data: unknown) {
    return { success: true, message, data };
  }
}
