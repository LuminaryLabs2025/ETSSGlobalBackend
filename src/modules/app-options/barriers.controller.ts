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
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { SuperAdminGuard } from '../../common/guards';
import { BarriersService } from './barriers.service';
import {
  AssignSiteBarriersDto,
  CreateBarrierDto,
  CreateBarrierSiteLinkDto,
  QueryBarriersDto,
  UpdateBarrierDto,
} from './dto/barriers.dto';
import {
  BarrierDeleteResponseDto,
  BarrierListResponseDto,
  BarrierResponseDto,
  BarrierSummaryResponseDto,
  SiteBarriersResponseDto,
} from './dto/barriers-response.dto';

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
  @ApiOperation({ summary: 'Create a barrier in the catalog' })
  @ApiCreatedResponse({ type: BarrierResponseDto })
  async create(@Body() dto: CreateBarrierDto) {
    return this.ok(
      'Barrier created successfully',
      await this.barriersService.create(dto),
    );
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Barrier KPI summary',
    description:
      'Distinct barrier counts for all / entry / exit. Supports the same site filters as the list endpoint.',
  })
  @ApiOkResponse({ type: BarrierSummaryResponseDto })
  async summary(@Query() query: QueryBarriersDto) {
    return this.ok(
      'Barrier summary fetched successfully',
      await this.barriersService.summary(query),
    );
  }

  @Put('sites/:siteType/:siteId')
  @ApiOperation({
    summary: 'Assign entry & exit barriers for a site',
    description:
      'Replaces ENTRY and/or EXIT barrier sets for a facility, transit park, or terminal. ' +
      'siteType accepts FACILITY | TRANSIT_PARK | TERMINAL (kebab-case also allowed).',
  })
  @ApiParam({
    name: 'siteType',
    enum: ['FACILITY', 'TRANSIT_PARK', 'TERMINAL', 'facility', 'transit-park', 'terminal'],
  })
  @ApiParam({ name: 'siteId', format: 'uuid' })
  @ApiOkResponse({ type: SiteBarriersResponseDto })
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
  @ApiOperation({ summary: 'List entry & exit barriers for a site' })
  @ApiParam({
    name: 'siteType',
    enum: ['FACILITY', 'TRANSIT_PARK', 'TERMINAL', 'facility', 'transit-park', 'terminal'],
  })
  @ApiParam({ name: 'siteId', format: 'uuid' })
  @ApiOkResponse({ type: SiteBarriersResponseDto })
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
  @ApiOperation({
    summary: 'List barriers',
    description:
      'Catalog mode (default): one row per barrier. ' +
      'Link mode (when site_type / site_id / park_type / barrier_role is set): one row per barrier↔site link.',
  })
  @ApiOkResponse({ type: BarrierListResponseDto })
  async findAll(@Query() query: QueryBarriersDto) {
    return this.ok(
      'Barriers fetched successfully',
      await this.barriersService.findAll(query),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a barrier by id (includes linked_sites)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: BarrierResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Barrier fetched successfully',
      await this.barriersService.findOne(id),
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a barrier' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: BarrierResponseDto })
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
  @ApiOperation({
    summary: 'Disable a barrier (status → INACTIVE)',
    description: 'Preferred over delete when the barrier is still linked to locations.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: BarrierResponseDto })
  async disable(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Barrier disabled successfully',
      await this.barriersService.disable(id),
    );
  }

  @Patch(':id/enable')
  @ApiOperation({ summary: 'Enable a barrier (status → ACTIVE)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: BarrierResponseDto })
  async enable(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Barrier enabled successfully',
      await this.barriersService.enable(id),
    );
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a barrier',
    description:
      'Returns 409 if the barrier is still linked to a location or has handheld devices assigned. Unlink first, or use disable.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: BarrierDeleteResponseDto })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.barriersService.delete(id);
    return this.ok('Barrier deleted successfully', null);
  }

  @Post(':id/site-links')
  @ApiOperation({ summary: 'Link a barrier to a site as ENTRY or EXIT' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: BarrierResponseDto })
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
  @ApiOperation({ summary: 'Remove a barrier↔site link' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'linkId', format: 'uuid' })
  @ApiOkResponse({ type: BarrierResponseDto })
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
