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
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { SuperAdminGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TrucksService } from './trucks.service';
import {
  BulkCreateTrucksDto,
  CreateTruckDto,
  QueryTrucksDto,
  ReasonDto,
} from './dto/operations.dto';

@ApiTags('trucks')
@ApiBearerAuth('access-token')
@Controller('api/trucks')
@UseGuards(AuthGuard('jwt'), SuperAdminGuard)
export class TrucksController {
  constructor(private readonly trucksService: TrucksService) {}

  @Get('summary')
  @ApiOkResponse({ description: 'Truck dashboard summary counts' })
  async summary() {
    return this.ok(
      'Trucks summary fetched successfully',
      await this.trucksService.trucksSummary(),
    );
  }

  @Get('export')
  async exportCsv(@Query() query: QueryTrucksDto, @Res() res: Response) {
    const csv = await this.trucksService.exportCsv(query);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=trucks-export-${Date.now()}.csv`,
    });
    res.send(csv);
  }

  @Get()
  @ApiOkResponse({ description: 'Paginated truck list' })
  async findAll(@Query() query: QueryTrucksDto) {
    return this.ok(
      'Trucks fetched successfully',
      await this.trucksService.findTrucks(query),
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Truck fetched successfully',
      await this.trucksService.findTruck(id),
    );
  }

  @Post()
  async create(@Body() dto: CreateTruckDto, @CurrentUser('id') userId: string) {
    return this.ok(
      'Truck created successfully',
      await this.trucksService.createTruck(dto, userId),
    );
  }

  @Post('bulk')
  async bulkCreate(
    @Body() dto: BulkCreateTrucksDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.ok(
      'Trucks created successfully',
      await this.trucksService.bulkCreateTrucks(dto, userId),
    );
  }

  @Patch(':id/disable')
  async disable(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: { first_name: string; last_name: string },
  ) {
    const actor = `${user.first_name} ${user.last_name}`;
    return this.ok(
      'Truck disabled successfully',
      await this.trucksService.disableTruck(id, dto, actor),
    );
  }

  @Patch(':id/archive')
  async archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Truck archived successfully',
      await this.trucksService.archiveTruck(id),
    );
  }

  @Patch(':id/request-verification')
  async requestVerification(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'MSS verification requested successfully',
      await this.trucksService.requestVerification(id),
    );
  }

  @Patch(':id/override-penalty')
  async overridePenalty(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: { first_name: string; last_name: string },
  ) {
    const actor = `${user.first_name} ${user.last_name}`;
    return this.ok(
      'Penalty overridden successfully',
      await this.trucksService.overridePenalty(id, dto, actor),
    );
  }

  @Patch(':id/re-enable')
  async reEnable(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.ok(
      'Truck re-enabled successfully',
      await this.trucksService.reEnableTruck(id, dto),
    );
  }

  private ok(message: string, data: unknown) {
    return { success: true, message, data };
  }
}
