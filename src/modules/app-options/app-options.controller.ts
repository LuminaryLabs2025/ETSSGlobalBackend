import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { SuperAdminGuard } from '../../common/guards';
import { AppOptionsService } from './app-options.service';
import {
  CreateBookingCategoryDto,
  CreateFacilityTimeslotDto,
  CreateFacilityTypeDto,
  CreateHandheldDeviceDto,
  CreateInfractionCategoryDto,
  CreateLocationDto,
  CreateParkTypeDto,
  CreatePaymentTypeDto,
  CreateRfidTagDto,
  CreateTepTypeDto,
  CreateTerminalGateDto,
  CreateTruckCapacityDto,
  CreateTruckLengthDto,
  CreateTruckTypeDto,
  QueryAppOptionsDto,
  UpdateBookingCategoryDto,
  UpdateFacilityTimeslotAssignmentDto,
  UpdateFacilityTimeslotDto,
  UpdateFacilityTypeDto,
  UpdateHandheldDeviceDto,
  UpdateInfractionCategoryDto,
  UpdateLocationDto,
  UpdateParkTypeDto,
  UpdatePaymentTypeDto,
  UpdateRfidTagDto,
  UpdateTepTypeDto,
  UpdateTerminalGateDto,
  UpdateTruckCapacityDto,
  UpdateTruckLengthDto,
  UpdateTruckTypeDto,
} from './dto/app-options.dto';

@ApiTags('app-options')
@ApiBearerAuth('access-token')
@Controller('api')
@UseGuards(AuthGuard('jwt'), SuperAdminGuard)
export class AppOptionsController {
  constructor(private readonly appOptionsService: AppOptionsService) {}

  // Truck types
  @Post('truck-types')
  async createTruckType(@Body() dto: CreateTruckTypeDto) {
    const data = await this.appOptionsService.createTruckType(dto);
    return this.ok('Truck type created successfully', data);
  }

  @Get('truck-types')
  async findTruckTypes(@Query() query: QueryAppOptionsDto) {
    return this.ok(
      'Truck types fetched successfully',
      await this.appOptionsService.findTruckTypes(query),
    );
  }

  @Get('truck-types/:id')
  async findTruckType(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok('Truck type fetched successfully', await this.appOptionsService.findTruckType(id));
  }

  @Put('truck-types/:id')
  async updateTruckType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTruckTypeDto,
  ) {
    return this.ok('Truck type updated successfully', await this.appOptionsService.updateTruckType(id, dto));
  }

  @Delete('truck-types/:id')
  async deleteTruckType(@Param('id', ParseUUIDPipe) id: string) {
    await this.appOptionsService.deleteTruckType(id);
    return this.ok('Truck type deleted successfully', null);
  }

  // Truck capacities
  @Post('truck-capacities')
  async createTruckCapacity(@Body() dto: CreateTruckCapacityDto) {
    return this.ok(
      'Truck capacity created successfully',
      await this.appOptionsService.createTruckCapacity(dto),
    );
  }

  @Get('truck-capacities')
  async findTruckCapacities(@Query() query: QueryAppOptionsDto) {
    return this.ok(
      'Truck capacities fetched successfully',
      await this.appOptionsService.findTruckCapacities(query),
    );
  }

  @Get('truck-capacities/:id')
  async findTruckCapacity(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Truck capacity fetched successfully',
      await this.appOptionsService.findTruckCapacity(id),
    );
  }

  @Put('truck-capacities/:id')
  async updateTruckCapacity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTruckCapacityDto,
  ) {
    return this.ok(
      'Truck capacity updated successfully',
      await this.appOptionsService.updateTruckCapacity(id, dto),
    );
  }

  @Delete('truck-capacities/:id')
  async deleteTruckCapacity(@Param('id', ParseUUIDPipe) id: string) {
    await this.appOptionsService.deleteTruckCapacity(id);
    return this.ok('Truck capacity deleted successfully', null);
  }

  // Truck lengths
  @Post('truck-lengths')
  async createTruckLength(@Body() dto: CreateTruckLengthDto) {
    return this.ok(
      'Truck length created successfully',
      await this.appOptionsService.createTruckLength(dto),
    );
  }

  @Get('truck-lengths')
  async findTruckLengths(@Query() query: QueryAppOptionsDto) {
    return this.ok(
      'Truck lengths fetched successfully',
      await this.appOptionsService.findTruckLengths(query),
    );
  }

  @Get('truck-lengths/:id')
  async findTruckLength(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Truck length fetched successfully',
      await this.appOptionsService.findTruckLength(id),
    );
  }

  @Put('truck-lengths/:id')
  async updateTruckLength(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTruckLengthDto,
  ) {
    return this.ok(
      'Truck length updated successfully',
      await this.appOptionsService.updateTruckLength(id, dto),
    );
  }

  @Delete('truck-lengths/:id')
  async deleteTruckLength(@Param('id', ParseUUIDPipe) id: string) {
    await this.appOptionsService.deleteTruckLength(id);
    return this.ok('Truck length deleted successfully', null);
  }

  // Booking categories
  @Post('booking-categories')
  async createBookingCategory(@Body() dto: CreateBookingCategoryDto) {
    return this.ok(
      'Booking category created successfully',
      await this.appOptionsService.createBookingCategory(dto),
    );
  }

  @Get('booking-categories')
  async findBookingCategories(@Query() query: QueryAppOptionsDto) {
    return this.ok(
      'Booking categories fetched successfully',
      await this.appOptionsService.findBookingCategories(query),
    );
  }

  @Get('booking-categories/:id')
  async findBookingCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Booking category fetched successfully',
      await this.appOptionsService.findBookingCategory(id),
    );
  }

  @Put('booking-categories/:id')
  async updateBookingCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookingCategoryDto,
  ) {
    return this.ok(
      'Booking category updated successfully',
      await this.appOptionsService.updateBookingCategory(id, dto),
    );
  }

  @Delete('booking-categories/:id')
  async deleteBookingCategory(@Param('id', ParseUUIDPipe) id: string) {
    await this.appOptionsService.deleteBookingCategory(id);
    return this.ok('Booking category deleted successfully', null);
  }

  // TEP types
  @Post('tep-types')
  async createTepType(@Body() dto: CreateTepTypeDto) {
    return this.ok('TEP type created successfully', await this.appOptionsService.createTepType(dto));
  }

  @Get('tep-types')
  async findTepTypes(@Query() query: QueryAppOptionsDto) {
    return this.ok(
      'TEP types fetched successfully',
      await this.appOptionsService.findTepTypes(query),
    );
  }

  @Get('tep-types/:id')
  async findTepType(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok('TEP type fetched successfully', await this.appOptionsService.findTepType(id));
  }

  @Put('tep-types/:id')
  async updateTepType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTepTypeDto,
  ) {
    return this.ok('TEP type updated successfully', await this.appOptionsService.updateTepType(id, dto));
  }

  @Delete('tep-types/:id')
  async deleteTepType(@Param('id', ParseUUIDPipe) id: string) {
    await this.appOptionsService.deleteTepType(id);
    return this.ok('TEP type deleted successfully', null);
  }

  // Park types
  @Post('park-types')
  async createParkType(@Body() dto: CreateParkTypeDto) {
    return this.ok('Park type created successfully', await this.appOptionsService.createParkType(dto));
  }

  @Get('park-types')
  async findParkTypes(@Query() query: QueryAppOptionsDto) {
    return this.ok(
      'Park types fetched successfully',
      await this.appOptionsService.findParkTypes(query),
    );
  }

  @Get('park-types/:id')
  async findParkType(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok('Park type fetched successfully', await this.appOptionsService.findParkType(id));
  }

  @Put('park-types/:id')
  async updateParkType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateParkTypeDto,
  ) {
    return this.ok('Park type updated successfully', await this.appOptionsService.updateParkType(id, dto));
  }

  @Delete('park-types/:id')
  async deleteParkType(@Param('id', ParseUUIDPipe) id: string) {
    await this.appOptionsService.deleteParkType(id);
    return this.ok('Park type deleted successfully', null);
  }

  // Facility types
  @Post('facility-types')
  async createFacilityType(@Body() dto: CreateFacilityTypeDto) {
    return this.ok(
      'Facility type created successfully',
      await this.appOptionsService.createFacilityType(dto),
    );
  }

  @Get('facility-types')
  async findFacilityTypes(@Query() query: QueryAppOptionsDto) {
    return this.ok(
      'Facility types fetched successfully',
      await this.appOptionsService.findFacilityTypes(query),
    );
  }

  @Get('facility-types/:id')
  async findFacilityType(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Facility type fetched successfully',
      await this.appOptionsService.findFacilityType(id),
    );
  }

  @Put('facility-types/:id')
  async updateFacilityType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFacilityTypeDto,
  ) {
    return this.ok(
      'Facility type updated successfully',
      await this.appOptionsService.updateFacilityType(id, dto),
    );
  }

  @Delete('facility-types/:id')
  async deleteFacilityType(@Param('id', ParseUUIDPipe) id: string) {
    await this.appOptionsService.deleteFacilityType(id);
    return this.ok('Facility type deleted successfully', null);
  }

  // Facility timeslots
  @Post('facility-timeslots')
  async createFacilityTimeslot(@Body() dto: CreateFacilityTimeslotDto) {
    return this.ok(
      'Facility timeslot created successfully',
      await this.appOptionsService.createFacilityTimeslot(dto),
    );
  }

  @Get('facility-timeslots')
  async findFacilityTimeslots(@Query() query: QueryAppOptionsDto) {
    return this.ok(
      'Facility timeslots fetched successfully',
      await this.appOptionsService.findFacilityTimeslots(query),
    );
  }

  @Get('facility-timeslots/:id')
  async findFacilityTimeslot(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Facility timeslot fetched successfully',
      await this.appOptionsService.findFacilityTimeslot(id),
    );
  }

  @Put('facility-timeslots/:id')
  async updateFacilityTimeslot(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFacilityTimeslotDto,
  ) {
    return this.ok(
      'Facility timeslot updated successfully',
      await this.appOptionsService.updateFacilityTimeslot(id, dto),
    );
  }

  @Delete('facility-timeslots/:id')
  async deleteFacilityTimeslot(@Param('id', ParseUUIDPipe) id: string) {
    await this.appOptionsService.deleteFacilityTimeslot(id);
    return this.ok('Facility timeslot deleted successfully', null);
  }

  // Locations + assignment toggles
  @Post('locations')
  async createLocation(@Body() dto: CreateLocationDto) {
    return this.ok('Location created successfully', await this.appOptionsService.createLocation(dto));
  }

  @Get('locations')
  async findLocations(@Query() query: QueryAppOptionsDto) {
    return this.ok(
      'Locations fetched successfully',
      await this.appOptionsService.findLocations(query),
    );
  }

  @Get('locations/:id')
  async findLocation(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok('Location fetched successfully', await this.appOptionsService.findLocation(id));
  }

  @Put('locations/:id')
  async updateLocation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.ok('Location updated successfully', await this.appOptionsService.updateLocation(id, dto));
  }

  @Delete('locations/:id')
  async deleteLocation(@Param('id', ParseUUIDPipe) id: string) {
    await this.appOptionsService.deleteLocation(id);
    return this.ok('Location deleted successfully', null);
  }

  @Get('locations/:id/facility-timeslot-assignments')
  async listFacilityTimeslotAssignments(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryAppOptionsDto,
  ) {
    return this.ok(
      'Facility timeslot assignments fetched successfully',
      await this.appOptionsService.listFacilityTimeslotAssignments(id, query),
    );
  }

  @Patch('facility-timeslot-assignments/:id')
  async updateFacilityTimeslotAssignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFacilityTimeslotAssignmentDto,
  ) {
    return this.ok(
      'Facility timeslot assignment updated successfully',
      await this.appOptionsService.updateFacilityTimeslotAssignment(id, dto),
    );
  }

  // Payments
  @Post('payment-types')
  async createPaymentType(@Body() dto: CreatePaymentTypeDto) {
    return this.ok('Payment type created successfully', await this.appOptionsService.createPaymentType(dto));
  }

  @Get('payment-types')
  async findPaymentTypes(@Query() query: QueryAppOptionsDto) {
    return this.ok(
      'Payment types fetched successfully',
      await this.appOptionsService.findPaymentTypes(query),
    );
  }

  @Get('payment-types/:id')
  async findPaymentType(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok('Payment type fetched successfully', await this.appOptionsService.findPaymentType(id));
  }

  @Put('payment-types/:id')
  async updatePaymentType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentTypeDto,
  ) {
    return this.ok('Payment type updated successfully', await this.appOptionsService.updatePaymentType(id, dto));
  }

  @Delete('payment-types/:id')
  async deletePaymentType(@Param('id', ParseUUIDPipe) id: string) {
    await this.appOptionsService.deletePaymentType(id);
    return this.ok('Payment type deleted successfully', null);
  }

  // Infractions
  @Post('infraction-categories')
  async createInfractionCategory(@Body() dto: CreateInfractionCategoryDto) {
    return this.ok(
      'Infraction category created successfully',
      await this.appOptionsService.createInfractionCategory(dto),
    );
  }

  @Get('infraction-categories')
  async findInfractionCategories(@Query() query: QueryAppOptionsDto) {
    return this.ok(
      'Infraction categories fetched successfully',
      await this.appOptionsService.findInfractionCategories(query),
    );
  }

  @Get('infraction-categories/:id')
  async findInfractionCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Infraction category fetched successfully',
      await this.appOptionsService.findInfractionCategory(id),
    );
  }

  @Put('infraction-categories/:id')
  async updateInfractionCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInfractionCategoryDto,
  ) {
    return this.ok(
      'Infraction category updated successfully',
      await this.appOptionsService.updateInfractionCategory(id, dto),
    );
  }

  @Delete('infraction-categories/:id')
  async deleteInfractionCategory(@Param('id', ParseUUIDPipe) id: string) {
    await this.appOptionsService.deleteInfractionCategory(id);
    return this.ok('Infraction category deleted successfully', null);
  }

  // Terminal gates (DEPRECATED — use /api/barriers)
  /** @deprecated Prefer POST /api/barriers */
  @Post('terminal-gates')
  async createTerminalGate(@Body() dto: CreateTerminalGateDto) {
    return this.ok(
      'Terminal gate created successfully (deprecated: use POST /api/barriers)',
      await this.appOptionsService.createTerminalGate(dto),
    );
  }

  /** @deprecated Prefer GET /api/barriers */
  @Get('terminal-gates')
  async findTerminalGates(@Query() query: QueryAppOptionsDto) {
    return this.ok(
      'Terminal gates fetched successfully (deprecated: use GET /api/barriers)',
      await this.appOptionsService.findTerminalGates(query),
    );
  }

  /** @deprecated Prefer GET /api/barriers/:id */
  @Get('terminal-gates/:id')
  async findTerminalGate(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Terminal gate fetched successfully (deprecated: use GET /api/barriers/:id)',
      await this.appOptionsService.findTerminalGate(id),
    );
  }

  /** @deprecated Prefer PUT /api/barriers/:id */
  @Put('terminal-gates/:id')
  async updateTerminalGate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTerminalGateDto,
  ) {
    return this.ok(
      'Terminal gate updated successfully (deprecated: use PUT /api/barriers/:id)',
      await this.appOptionsService.updateTerminalGate(id, dto),
    );
  }

  /** @deprecated Prefer DELETE /api/barriers/:id */
  @Delete('terminal-gates/:id')
  async deleteTerminalGate(@Param('id', ParseUUIDPipe) id: string) {
    await this.appOptionsService.deleteTerminalGate(id);
    return this.ok(
      'Terminal gate deleted successfully (deprecated: use DELETE /api/barriers/:id)',
      null,
    );
  }

  // Handheld devices
  @Post('handheld-devices')
  async createHandheldDevice(@Body() dto: CreateHandheldDeviceDto) {
    return this.ok(
      'Handheld device created successfully',
      await this.appOptionsService.createHandheldDevice(dto),
    );
  }

  @Get('handheld-devices')
  async findHandheldDevices(@Query() query: QueryAppOptionsDto) {
    return this.ok(
      'Handheld devices fetched successfully',
      await this.appOptionsService.findHandheldDevices(query),
    );
  }

  @Get('handheld-devices/:id')
  async findHandheldDevice(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Handheld device fetched successfully',
      await this.appOptionsService.findHandheldDevice(id),
    );
  }

  @Put('handheld-devices/:id')
  async updateHandheldDevice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHandheldDeviceDto,
  ) {
    return this.ok(
      'Handheld device updated successfully',
      await this.appOptionsService.updateHandheldDevice(id, dto),
    );
  }

  @Delete('handheld-devices/:id')
  async deleteHandheldDevice(@Param('id', ParseUUIDPipe) id: string) {
    await this.appOptionsService.deleteHandheldDevice(id);
    return this.ok('Handheld device deleted successfully', null);
  }

  // RFID
  @Post('rfid-tags')
  async createRfidTag(@Body() dto: CreateRfidTagDto) {
    return this.ok('RFID tag created successfully', await this.appOptionsService.createRfidTag(dto));
  }

  @Post('rfid-tags/bulk-upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async bulkUploadRfidTags(@UploadedFile() file: any) {
    return this.ok(
      'RFID tags uploaded successfully',
      await this.appOptionsService.bulkUploadRfidTags(file),
    );
  }

  @Get('rfid-tags')
  async findRfidTags(@Query() query: QueryAppOptionsDto) {
    return this.ok(
      'RFID tags fetched successfully',
      await this.appOptionsService.findRfidTags(query),
    );
  }

  @Get('rfid-tags/:id')
  async findRfidTag(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok('RFID tag fetched successfully', await this.appOptionsService.findRfidTag(id));
  }

  @Put('rfid-tags/:id')
  async updateRfidTag(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRfidTagDto,
  ) {
    return this.ok('RFID tag updated successfully', await this.appOptionsService.updateRfidTag(id, dto));
  }

  @Delete('rfid-tags/:id')
  async deleteRfidTag(@Param('id', ParseUUIDPipe) id: string) {
    await this.appOptionsService.deleteRfidTag(id);
    return this.ok('RFID tag deleted successfully', null);
  }

  private ok(message: string, data: unknown) {
    return { success: true, message, data };
  }
}
