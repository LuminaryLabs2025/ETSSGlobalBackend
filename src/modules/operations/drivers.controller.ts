import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { SuperAdminGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DriversService } from './drivers.service';
import {
  CreateDriverDto,
  QueryBookingOptionsDto,
  QueryDriversDto,
  ReasonDto,
} from './dto/operations.dto';
import {
  DriverListResponseDto,
  DriverResponseDto,
  DriversSummaryResponseDto,
} from './dto/operations-response.dto';

@ApiTags('drivers')
@ApiBearerAuth('access-token')
@Controller('api/drivers')
@UseGuards(AuthGuard('jwt'), SuperAdminGuard)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get('summary')
  @ApiOkResponse({ type: DriversSummaryResponseDto })
  async summary() {
    return this.ok(
      'Drivers summary fetched successfully',
      await this.driversService.driversSummary(),
    );
  }

  @Get('export')
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'CSV export of drivers (respects list query filters)',
    schema: { type: 'string', example: 'First Name,Last Name,...' },
  })
  async exportCsv(@Query() query: QueryDriversDto, @Res() res: Response) {
    const csv = await this.driversService.exportCsv(query);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=drivers-export-${Date.now()}.csv`,
    });
    res.send(csv);
  }

  @Get()
  @ApiOkResponse({ type: DriverListResponseDto })
  async findAll(@Query() query: QueryDriversDto) {
    return this.ok(
      'Drivers fetched successfully',
      await this.driversService.findDrivers(query),
    );
  }

  @Get('booking-options')
  @ApiOkResponse({
    description:
      '"Mine" (by transporter_company_id) vs "Public" driver options for booking-creation forms',
  })
  async bookingOptions(@Query() query: QueryBookingOptionsDto) {
    return this.ok(
      'Driver booking options fetched successfully',
      await this.driversService.findDriverBookingOptions(query),
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: DriverResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Driver fetched successfully',
      await this.driversService.findDriver(id),
    );
  }

  @Post()
  @ApiOkResponse({ type: DriverResponseDto })
  async create(
    @Body() dto: CreateDriverDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.ok(
      'Driver created successfully',
      await this.driversService.createDriver(dto, userId),
    );
  }

  @Patch(':id/disable')
  @ApiOkResponse({ type: DriverResponseDto })
  async disable(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: { first_name: string; last_name: string },
  ) {
    const actor = `${user.first_name} ${user.last_name}`;
    return this.ok(
      'Driver disabled successfully',
      await this.driversService.disableDriver(id, dto, actor),
    );
  }

  @Patch(':id/archive')
  @ApiOkResponse({ type: DriverResponseDto })
  async archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Driver archived successfully',
      await this.driversService.archiveDriver(id),
    );
  }

  @Patch(':id/start-verification')
  @ApiOkResponse({ type: DriverResponseDto })
  async startVerification(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Driver verification started successfully',
      await this.driversService.startVerification(id),
    );
  }

  @Patch(':id/clear-flag')
  @ApiOkResponse({ type: DriverResponseDto })
  async clearFlag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: { first_name: string; last_name: string },
  ) {
    const actor = `${user.first_name} ${user.last_name}`;
    return this.ok(
      'Driver flag cleared successfully',
      await this.driversService.clearFlag(id, dto, actor),
    );
  }

  @Patch(':id/enable')
  @ApiOkResponse({ type: DriverResponseDto })
  async enable(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Driver enabled successfully',
      await this.driversService.enableDriver(id),
    );
  }

  private ok(message: string, data: unknown) {
    return { success: true, message, data };
  }
}
