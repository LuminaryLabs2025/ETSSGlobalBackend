import {
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
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SuperAdminGuard } from '../../common/guards';
import { TerminalsParksFacilitiesService } from './terminals-parks-facilities.service';
import {
  CreateFacilityDto,
  CreateTerminalDto,
  CreateTransitParkDto,
  QueryTerminalsParksFacilitiesDto,
  UpdateBookingStatusDto,
  UpdateFacilityDto,
  UpdateStatusDto,
  UpdateTerminalDto,
  UpdateTransitParkDto,
} from './dto/terminals-parks-facilities.dto';
import {
  DeleteResponseDto,
  FacilitiesSummaryResponseDto,
  FacilityListResponseDto,
  FacilityResponseDto,
  FacilityTimeslotListResponseDto,
  TerminalListResponseDto,
  TerminalResponseDto,
  TerminalsSummaryResponseDto,
  TransitParkListResponseDto,
  TransitParkResponseDto,
  TransitParksSummaryResponseDto,
} from './dto/terminals-parks-facilities-response.dto';

@ApiTags('terminals-transit-parks-facilities')
@ApiBearerAuth('access-token')
@Controller('api')
@UseGuards(AuthGuard('jwt'), SuperAdminGuard)
export class TerminalsParksFacilitiesController {
  constructor(
    private readonly terminalsParksFacilitiesService: TerminalsParksFacilitiesService,
  ) {}

  // Terminals
  @Post('terminals')
  @ApiOkResponse({ type: TerminalResponseDto })
  async createTerminal(@Body() dto: CreateTerminalDto) {
    return this.ok(
      'Terminal created successfully',
      await this.terminalsParksFacilitiesService.createTerminal(dto),
    );
  }

  @Get('terminals')
  @ApiOkResponse({ type: TerminalListResponseDto })
  async findTerminals(@Query() query: QueryTerminalsParksFacilitiesDto) {
    return this.ok(
      'Terminals fetched successfully',
      await this.terminalsParksFacilitiesService.findTerminals(query),
    );
  }

  @Get('terminals/summary')
  @ApiOkResponse({ type: TerminalsSummaryResponseDto })
  async terminalsSummary() {
    return this.ok(
      'Terminals summary fetched successfully',
      await this.terminalsParksFacilitiesService.terminalsSummary(),
    );
  }

  @Get('terminals/:id')
  @ApiOkResponse({ type: TerminalResponseDto })
  async findTerminal(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Terminal fetched successfully',
      await this.terminalsParksFacilitiesService.findTerminal(id),
    );
  }

  @Put('terminals/:id')
  @ApiOkResponse({ type: TerminalResponseDto })
  async updateTerminal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTerminalDto,
  ) {
    return this.ok(
      'Terminal updated successfully',
      await this.terminalsParksFacilitiesService.updateTerminal(id, dto),
    );
  }

  @Patch('terminals/:id/status')
  @ApiOkResponse({ type: TerminalResponseDto })
  async updateTerminalStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.ok(
      'Terminal status updated successfully',
      await this.terminalsParksFacilitiesService.updateTerminalStatus(id, dto),
    );
  }

  @Patch('terminals/:id/enable')
  @ApiOkResponse({ type: TerminalResponseDto })
  async enableTerminal(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Terminal enabled successfully',
      await this.terminalsParksFacilitiesService.updateTerminalStatus(id, {
        status: 'ACTIVE',
      }),
    );
  }

  @Patch('terminals/:id/disable')
  @ApiOkResponse({ type: TerminalResponseDto })
  async disableTerminal(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Terminal disabled successfully',
      await this.terminalsParksFacilitiesService.updateTerminalStatus(id, {
        status: 'INACTIVE',
      }),
    );
  }

  @Patch('terminals/:id/booking-status')
  @ApiOkResponse({ type: TerminalResponseDto })
  async updateTerminalBookingStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.ok(
      'Terminal booking status updated successfully',
      await this.terminalsParksFacilitiesService.updateTerminalBookingStatus(
        id,
        dto,
      ),
    );
  }

  @Patch('terminals/:id/archive')
  @ApiOkResponse({ type: TerminalResponseDto })
  async archiveTerminal(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Terminal archived successfully',
      await this.terminalsParksFacilitiesService.archiveTerminal(id),
    );
  }

  @Patch('terminals/:id/unarchive')
  @ApiOkResponse({ type: TerminalResponseDto })
  async unarchiveTerminal(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Terminal unarchived successfully',
      await this.terminalsParksFacilitiesService.unarchiveTerminal(id),
    );
  }

  @Delete('terminals/:id')
  @ApiOkResponse({ type: DeleteResponseDto })
  async deleteTerminal(@Param('id', ParseUUIDPipe) id: string) {
    await this.terminalsParksFacilitiesService.deleteTerminal(id);
    return this.ok('Terminal deleted successfully', null);
  }

  // Transit parks
  @Post('transit-parks')
  @ApiOkResponse({ type: TransitParkResponseDto })
  async createTransitPark(@Body() dto: CreateTransitParkDto) {
    return this.ok(
      'Transit park created successfully',
      await this.terminalsParksFacilitiesService.createTransitPark(dto),
    );
  }

  @Get('transit-parks')
  @ApiOkResponse({ type: TransitParkListResponseDto })
  async findTransitParks(@Query() query: QueryTerminalsParksFacilitiesDto) {
    return this.ok(
      'Transit parks fetched successfully',
      await this.terminalsParksFacilitiesService.findTransitParks(query),
    );
  }

  @Get('transit-parks/summary')
  @ApiOkResponse({ type: TransitParksSummaryResponseDto })
  async transitParksSummary() {
    return this.ok(
      'Transit parks summary fetched successfully',
      await this.terminalsParksFacilitiesService.transitParksSummary(),
    );
  }

  @Get('transit-parks/:id')
  @ApiOkResponse({ type: TransitParkResponseDto })
  async findTransitPark(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Transit park fetched successfully',
      await this.terminalsParksFacilitiesService.findTransitPark(id),
    );
  }

  @Put('transit-parks/:id')
  @ApiOkResponse({ type: TransitParkResponseDto })
  async updateTransitPark(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTransitParkDto,
  ) {
    return this.ok(
      'Transit park updated successfully',
      await this.terminalsParksFacilitiesService.updateTransitPark(id, dto),
    );
  }

  @Patch('transit-parks/:id/status')
  @ApiOkResponse({ type: TransitParkResponseDto })
  async updateTransitParkStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.ok(
      'Transit park status updated successfully',
      await this.terminalsParksFacilitiesService.updateTransitParkStatus(
        id,
        dto,
      ),
    );
  }

  @Patch('transit-parks/:id/enable')
  @ApiOkResponse({ type: TransitParkResponseDto })
  async enableTransitPark(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Transit park enabled successfully',
      await this.terminalsParksFacilitiesService.updateTransitParkStatus(id, {
        status: 'ACTIVE',
      }),
    );
  }

  @Patch('transit-parks/:id/disable')
  @ApiOkResponse({ type: TransitParkResponseDto })
  async disableTransitPark(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Transit park disabled successfully',
      await this.terminalsParksFacilitiesService.updateTransitParkStatus(id, {
        status: 'INACTIVE',
      }),
    );
  }

  @Patch('transit-parks/:id/archive')
  @ApiOkResponse({ type: TransitParkResponseDto })
  async archiveTransitPark(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Transit park archived successfully',
      await this.terminalsParksFacilitiesService.archiveTransitPark(id),
    );
  }

  @Patch('transit-parks/:id/unarchive')
  @ApiOkResponse({ type: TransitParkResponseDto })
  async unarchiveTransitPark(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Transit park unarchived successfully',
      await this.terminalsParksFacilitiesService.unarchiveTransitPark(id),
    );
  }

  @Delete('transit-parks/:id')
  @ApiOkResponse({ type: DeleteResponseDto })
  async deleteTransitPark(@Param('id', ParseUUIDPipe) id: string) {
    await this.terminalsParksFacilitiesService.deleteTransitPark(id);
    return this.ok('Transit park deleted successfully', null);
  }

  // Facilities
  @Post('facilities')
  @ApiOkResponse({ type: FacilityResponseDto })
  async createFacility(@Body() dto: CreateFacilityDto) {
    return this.ok(
      'Facility created successfully',
      await this.terminalsParksFacilitiesService.createFacility(dto),
    );
  }

  @Get('facilities')
  @ApiOkResponse({ type: FacilityListResponseDto })
  async findFacilities(@Query() query: QueryTerminalsParksFacilitiesDto) {
    return this.ok(
      'Facilities fetched successfully',
      await this.terminalsParksFacilitiesService.findFacilities(query),
    );
  }

  @Get('facilities/summary')
  @ApiOkResponse({ type: FacilitiesSummaryResponseDto })
  async facilitiesSummary() {
    return this.ok(
      'Facilities summary fetched successfully',
      await this.terminalsParksFacilitiesService.facilitiesSummary(),
    );
  }

  @Get('facilities/:id')
  @ApiOkResponse({ type: FacilityResponseDto })
  async findFacility(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Facility fetched successfully',
      await this.terminalsParksFacilitiesService.findFacility(id),
    );
  }

  @Get('facilities/:id/timeslots')
  @ApiOkResponse({ type: FacilityTimeslotListResponseDto })
  async listFacilityTimeslots(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryTerminalsParksFacilitiesDto,
  ) {
    return this.ok(
      'Facility timeslots fetched successfully',
      await this.terminalsParksFacilitiesService.listFacilityTimeslots(
        id,
        query,
      ),
    );
  }

  @Put('facilities/:id')
  @ApiOkResponse({ type: FacilityResponseDto })
  async updateFacility(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFacilityDto,
  ) {
    return this.ok(
      'Facility updated successfully',
      await this.terminalsParksFacilitiesService.updateFacility(id, dto),
    );
  }

  @Patch('facilities/:id/status')
  @ApiOkResponse({ type: FacilityResponseDto })
  async updateFacilityStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.ok(
      'Facility status updated successfully',
      await this.terminalsParksFacilitiesService.updateFacilityStatus(id, dto),
    );
  }

  @Patch('facilities/:id/enable')
  @ApiOkResponse({ type: FacilityResponseDto })
  async enableFacility(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Facility enabled successfully',
      await this.terminalsParksFacilitiesService.updateFacilityStatus(id, {
        status: 'ACTIVE',
      }),
    );
  }

  @Patch('facilities/:id/disable')
  @ApiOkResponse({ type: FacilityResponseDto })
  async disableFacility(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Facility disabled successfully',
      await this.terminalsParksFacilitiesService.updateFacilityStatus(id, {
        status: 'INACTIVE',
      }),
    );
  }

  @Patch('facilities/:id/archive')
  @ApiOkResponse({ type: FacilityResponseDto })
  async archiveFacility(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Facility archived successfully',
      await this.terminalsParksFacilitiesService.archiveFacility(id),
    );
  }

  @Patch('facilities/:id/unarchive')
  @ApiOkResponse({ type: FacilityResponseDto })
  async unarchiveFacility(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Facility unarchived successfully',
      await this.terminalsParksFacilitiesService.unarchiveFacility(id),
    );
  }

  @Delete('facilities/:id')
  @ApiOkResponse({ type: DeleteResponseDto })
  async deleteFacility(@Param('id', ParseUUIDPipe) id: string) {
    await this.terminalsParksFacilitiesService.deleteFacility(id);
    return this.ok('Facility deleted successfully', null);
  }

  private ok(message: string, data: unknown) {
    return { success: true, message, data };
  }
}
