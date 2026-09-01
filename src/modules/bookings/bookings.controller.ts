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
import { BookingsService } from './bookings.service';
import { QueryBookingsDto, QueryManifestDto } from './dto/bookings.dto';
import {
  ConfirmPaymentDto,
  CreateEptBookingDto,
  CreateFacilityBookingDto,
  CreateFishBookingDto,
} from './dto/create-booking.dto';
import {
  BookingListResponseDto,
  BookingResponseDto,
  BookingsSummaryResponseDto,
} from './dto/bookings-response.dto';

type CurrentUserPayload = {
  id: string;
  first_name: string;
  last_name: string;
};

@ApiTags('bookings')
@ApiBearerAuth('access-token')
@Controller('api/bookings')
@UseGuards(AuthGuard('jwt'), SuperAdminGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('summary')
  @ApiOkResponse({ type: BookingsSummaryResponseDto })
  async summary() {
    return this.ok(
      'Bookings summary fetched successfully',
      await this.bookingsService.bookingsSummary(),
    );
  }

  @Get('export')
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'CSV export of bookings (respects list query filters)',
    schema: { type: 'string', example: 'Booking ID,Journey Code,...' },
  })
  async exportCsv(@Query() query: QueryBookingsDto, @Res() res: Response) {
    const csv = await this.bookingsService.exportCsv(query);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=bookings-export-${Date.now()}.csv`,
    });
    res.send(csv);
  }

  @Get('manifest')
  @ApiOkResponse({ type: BookingListResponseDto })
  async manifest(@Query() query: QueryManifestDto) {
    return this.ok(
      "Today's manifest fetched successfully",
      await this.bookingsService.findManifest(query),
    );
  }

  @Get()
  @ApiOkResponse({ type: BookingListResponseDto })
  async findAll(@Query() query: QueryBookingsDto) {
    return this.ok(
      'Bookings fetched successfully',
      await this.bookingsService.findBookings(query),
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: BookingResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Booking fetched successfully',
      await this.bookingsService.findBooking(id),
    );
  }

  @Patch(':id/remove-from-manifest')
  @ApiOkResponse({ type: BookingResponseDto })
  async removeFromManifest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { first_name: string; last_name: string },
  ) {
    return this.ok(
      'Booking removed from manifest successfully',
      await this.bookingsService.removeFromManifest(id, user),
    );
  }

  @Patch(':id/add-to-manifest')
  @ApiOkResponse({ type: BookingResponseDto })
  async addToManifest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { first_name: string; last_name: string },
  ) {
    return this.ok(
      'Booking added to manifest successfully',
      await this.bookingsService.addToManifest(id, user),
    );
  }

  @Patch(':id/cancel')
  @ApiOkResponse({ type: BookingResponseDto })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: { first_name: string; last_name: string },
  ) {
    return this.ok(
      'Booking cancelled successfully',
      await this.bookingsService.cancelBooking(id, user),
    );
  }

  // ── SuperAdmin booking-creation flows ──

  @Post('bonded-terminal/preview')
  @ApiOkResponse({ description: 'Computed preview — nothing persisted' })
  async previewBondedTerminal(@Body() dto: CreateFacilityBookingDto) {
    return this.ok(
      'Bonded Terminal booking preview computed',
      await this.bookingsService.previewBondedTerminalBooking(dto),
    );
  }

  @Post('bonded-terminal')
  @ApiOkResponse({ type: BookingResponseDto })
  async createBondedTerminal(
    @Body() dto: CreateFacilityBookingDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ok(
      'Bonded Terminal booking created successfully',
      await this.bookingsService.createBondedTerminalBooking(
        dto,
        user,
        user?.id,
      ),
    );
  }

  @Post('truck-park/preview')
  @ApiOkResponse({ description: 'Computed preview — nothing persisted' })
  async previewTruckPark(@Body() dto: CreateFacilityBookingDto) {
    return this.ok(
      'Truck Park booking preview computed',
      await this.bookingsService.previewTruckParkBooking(dto),
    );
  }

  @Post('truck-park')
  @ApiOkResponse({ type: BookingResponseDto })
  async createTruckPark(
    @Body() dto: CreateFacilityBookingDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ok(
      'Truck Park booking created successfully',
      await this.bookingsService.createTruckParkBooking(dto, user, user?.id),
    );
  }

  @Post('fish/preview')
  @ApiOkResponse({ description: 'Computed preview — nothing persisted' })
  async previewFish(@Body() dto: CreateFishBookingDto) {
    return this.ok(
      'Fish booking preview computed',
      await this.bookingsService.previewFishBooking(dto),
    );
  }

  @Post('fish')
  @ApiOkResponse({ type: BookingResponseDto })
  async createFish(
    @Body() dto: CreateFishBookingDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ok(
      'Fish booking created successfully',
      await this.bookingsService.createFishBooking(dto, user, user?.id),
    );
  }

  @Post('ept/preview')
  @ApiOkResponse({ description: 'Computed preview — nothing persisted' })
  async previewEpt(@Body() dto: CreateEptBookingDto) {
    return this.ok(
      'EPT booking preview computed',
      await this.bookingsService.previewEptBooking(dto),
    );
  }

  @Post('ept')
  @ApiOkResponse({ type: BookingResponseDto })
  async createEpt(
    @Body() dto: CreateEptBookingDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ok(
      'EPT booking created successfully',
      await this.bookingsService.createEptBooking(dto, user, user?.id),
    );
  }

  @Patch(':id/confirm-payment')
  @ApiOkResponse({ type: BookingResponseDto })
  async confirmPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmPaymentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ok(
      'Payment confirmed successfully',
      await this.bookingsService.confirmPayment(id, dto, user),
    );
  }

  // ── FIFO / GTG scheduling (manually triggered) ──

  @Patch(':id/mark-matched')
  @ApiOkResponse({ type: BookingResponseDto })
  async markMatched(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ok(
      'Booking marked as matched',
      await this.bookingsService.markMatched(id, user),
    );
  }

  @Patch(':id/mark-in-facility')
  @ApiOkResponse({ type: BookingResponseDto })
  async markInFacility(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ok(
      'Booking marked in-facility',
      await this.bookingsService.markInFacility(id, user),
    );
  }

  @Patch(':id/mark-in-pregate')
  @ApiOkResponse({ type: BookingResponseDto })
  async markInPregate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('pregate_transit_park_id', ParseUUIDPipe)
    pregateTransitParkId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ok(
      'Booking marked in-pregate',
      await this.bookingsService.markInPregate(id, pregateTransitParkId, user),
    );
  }

  @Patch(':id/mark-gtg-facility')
  @ApiOkResponse({ type: BookingResponseDto })
  async markGtgFacility(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ok(
      'Booking cleared GTG-Facility',
      await this.bookingsService.markGtgFacility(id, user),
    );
  }

  @Patch(':id/mark-gtg-pregate')
  @ApiOkResponse({ type: BookingResponseDto })
  async markGtgPregate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ok(
      'Booking cleared GTG-Pregate',
      await this.bookingsService.markGtgPregate(id, user),
    );
  }

  @Get('queue/facility')
  @ApiOkResponse({ description: 'Ordered release queue for a facility or EPT' })
  async facilityQueue(
    @Query('facility_id') facilityId?: string,
    @Query('transit_park_id') transitParkId?: string,
  ) {
    return this.ok(
      'Facility queue fetched successfully',
      await this.bookingsService.facilityQueue({
        facility_id: facilityId,
        transit_park_id: transitParkId,
      }),
    );
  }

  @Get('queue/pregate')
  @ApiOkResponse({
    description: 'Ordered cross-pregate FIFO queue for a destination terminal',
  })
  async pregateQueue(@Query('terminal_id', ParseUUIDPipe) terminalId: string) {
    return this.ok(
      'Pregate queue fetched successfully',
      await this.bookingsService.pregateQueue(terminalId),
    );
  }

  private ok(message: string, data: unknown) {
    return { success: true, message, data };
  }
}
