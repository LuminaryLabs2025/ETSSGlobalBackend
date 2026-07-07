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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  async createTerminal(@Body() dto: CreateTerminalDto) {
    return this.ok(
      'Terminal created successfully',
      await this.terminalsParksFacilitiesService.createTerminal(dto),
    );
  }

  @Get('terminals')
  async findTerminals(@Query() query: QueryTerminalsParksFacilitiesDto) {
    return this.ok(
      'Terminals fetched successfully',
      await this.terminalsParksFacilitiesService.findTerminals(query),
    );
  }

  @Get('terminals/summary')
  async terminalsSummary() {
    return this.ok(
      'Terminals summary fetched successfully',
      await this.terminalsParksFacilitiesService.terminalsSummary(),
    );
  }

  @Get('terminals/:id')
  async findTerminal(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Terminal fetched successfully',
      await this.terminalsParksFacilitiesService.findTerminal(id),
    );
  }

  @Put('terminals/:id')
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
  async updateTerminalStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.ok(
      'Terminal status updated successfully',
      await this.terminalsParksFacilitiesService.updateTerminalStatus(id, dto),
    );
  }

  @Patch('terminals/:id/booking-status')
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
  async archiveTerminal(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Terminal archived successfully',
      await this.terminalsParksFacilitiesService.archiveTerminal(id),
    );
  }

  @Patch('terminals/:id/unarchive')
  async unarchiveTerminal(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Terminal unarchived successfully',
      await this.terminalsParksFacilitiesService.unarchiveTerminal(id),
    );
  }

  @Delete('terminals/:id')
  async deleteTerminal(@Param('id', ParseUUIDPipe) id: string) {
    await this.terminalsParksFacilitiesService.deleteTerminal(id);
    return this.ok('Terminal deleted successfully', null);
  }

  // Transit parks
  @Post('transit-parks')
  async createTransitPark(@Body() dto: CreateTransitParkDto) {
    return this.ok(
      'Transit park created successfully',
      await this.terminalsParksFacilitiesService.createTransitPark(dto),
    );
  }

  @Get('transit-parks')
  async findTransitParks(@Query() query: QueryTerminalsParksFacilitiesDto) {
    return this.ok(
      'Transit parks fetched successfully',
      await this.terminalsParksFacilitiesService.findTransitParks(query),
    );
  }

  @Get('transit-parks/summary')
  async transitParksSummary() {
    return this.ok(
      'Transit parks summary fetched successfully',
      await this.terminalsParksFacilitiesService.transitParksSummary(),
    );
  }

  @Get('transit-parks/:id')
  async findTransitPark(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Transit park fetched successfully',
      await this.terminalsParksFacilitiesService.findTransitPark(id),
    );
  }

  @Put('transit-parks/:id')
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

  @Patch('transit-parks/:id/archive')
  async archiveTransitPark(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Transit park archived successfully',
      await this.terminalsParksFacilitiesService.archiveTransitPark(id),
    );
  }

  @Patch('transit-parks/:id/unarchive')
  async unarchiveTransitPark(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Transit park unarchived successfully',
      await this.terminalsParksFacilitiesService.unarchiveTransitPark(id),
    );
  }

  @Delete('transit-parks/:id')
  async deleteTransitPark(@Param('id', ParseUUIDPipe) id: string) {
    await this.terminalsParksFacilitiesService.deleteTransitPark(id);
    return this.ok('Transit park deleted successfully', null);
  }

  // Facilities
  @Post('facilities')
  async createFacility(@Body() dto: CreateFacilityDto) {
    return this.ok(
      'Facility created successfully',
      await this.terminalsParksFacilitiesService.createFacility(dto),
    );
  }

  @Get('facilities')
  async findFacilities(@Query() query: QueryTerminalsParksFacilitiesDto) {
    return this.ok(
      'Facilities fetched successfully',
      await this.terminalsParksFacilitiesService.findFacilities(query),
    );
  }

  @Get('facilities/summary')
  async facilitiesSummary() {
    return this.ok(
      'Facilities summary fetched successfully',
      await this.terminalsParksFacilitiesService.facilitiesSummary(),
    );
  }

  @Get('facilities/:id')
  async findFacility(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Facility fetched successfully',
      await this.terminalsParksFacilitiesService.findFacility(id),
    );
  }

  @Get('facilities/:id/timeslots')
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
  async updateFacilityStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.ok(
      'Facility status updated successfully',
      await this.terminalsParksFacilitiesService.updateFacilityStatus(id, dto),
    );
  }

  @Patch('facilities/:id/archive')
  async archiveFacility(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Facility archived successfully',
      await this.terminalsParksFacilitiesService.archiveFacility(id),
    );
  }

  @Patch('facilities/:id/unarchive')
  async unarchiveFacility(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Facility unarchived successfully',
      await this.terminalsParksFacilitiesService.unarchiveFacility(id),
    );
  }

  @Delete('facilities/:id')
  async deleteFacility(@Param('id', ParseUUIDPipe) id: string) {
    await this.terminalsParksFacilitiesService.deleteFacility(id);
    return this.ok('Facility deleted successfully', null);
  }

  private ok(message: string, data: unknown) {
    return { success: true, message, data };
  }
}
