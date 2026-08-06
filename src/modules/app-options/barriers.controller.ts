import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SuperAdminGuard } from '../../common/guards';
import { BarriersService } from './barriers.service';
import {
  AssignSiteBarriersDto,
  CreateBarrierDto,
  CreateBarrierSiteLinkDto,
  QueryBarriersDto,
  UpdateBarrierDto,
} from './dto/barriers.dto';

@ApiTags('barriers')
@ApiBearerAuth('access-token')
@Controller('api/barriers')
@UseGuards(AuthGuard('jwt'), SuperAdminGuard)
export class BarriersController {
  constructor(private readonly barriersService: BarriersService) {}

  private ok(message: string, data: unknown) {
    return { success: true, message, data };
  }

  private normalizeSiteType(
    siteType: string,
  ): 'FACILITY' | 'TRANSIT_PARK' | 'TERMINAL' {
    const normalized = siteType.toUpperCase().replace(/-/g, '_');
    if (
      normalized === 'FACILITY' ||
      normalized === 'TRANSIT_PARK' ||
      normalized === 'TERMINAL'
    ) {
      return normalized;
    }
    throw new BadRequestException(
      'siteType must be FACILITY, TRANSIT_PARK, or TERMINAL',
    );
  }

  @Post()
  async create(@Body() dto: CreateBarrierDto) {
    return this.ok(
      'Barrier created successfully',
      await this.barriersService.create(dto),
    );
  }

  @Get('summary')
  async summary(@Query() query: QueryBarriersDto) {
    return this.ok(
      'Barrier summary fetched successfully',
      await this.barriersService.summary(query),
    );
  }

  /** Assign/replace entry & exit barriers for a facility / transit park / terminal. */
  @Put('sites/:siteType/:siteId')
  async assignSiteBarriers(
    @Param('siteType') siteType: string,
    @Param('siteId', ParseUUIDPipe) siteId: string,
    @Body() dto: AssignSiteBarriersDto,
  ) {
    const normalized = this.normalizeSiteType(siteType);
    return this.ok(
      'Site barriers updated successfully',
      await this.barriersService.assignSiteBarriers(normalized, siteId, dto),
    );
  }

  @Get('sites/:siteType/:siteId')
  async findSiteBarriers(
    @Param('siteType') siteType: string,
    @Param('siteId', ParseUUIDPipe) siteId: string,
  ) {
    const normalized = this.normalizeSiteType(siteType);
    return this.ok(
      'Site barriers fetched successfully',
      await this.barriersService.findBarriersForSite(normalized, siteId),
    );
  }

  @Get()
  async findAll(@Query() query: QueryBarriersDto) {
    return this.ok(
      'Barriers fetched successfully',
      await this.barriersService.findAll(query),
    );
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Barrier fetched successfully',
      await this.barriersService.findOne(id),
    );
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBarrierDto,
  ) {
    return this.ok(
      'Barrier updated successfully',
      await this.barriersService.update(id, dto),
    );
  }

  @Patch(':id/disable')
  async disable(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Barrier disabled successfully',
      await this.barriersService.disable(id),
    );
  }

  @Patch(':id/enable')
  async enable(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Barrier enabled successfully',
      await this.barriersService.enable(id),
    );
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.barriersService.delete(id);
    return this.ok('Barrier deleted successfully', null);
  }

  @Post(':id/site-links')
  async addSiteLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateBarrierSiteLinkDto,
  ) {
    return this.ok(
      'Barrier linked to site successfully',
      await this.barriersService.addSiteLink(id, dto),
    );
  }

  @Delete(':id/site-links/:linkId')
  async removeSiteLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ) {
    return this.ok(
      'Barrier site link removed successfully',
      await this.barriersService.removeSiteLink(id, linkId),
    );
  }
}
