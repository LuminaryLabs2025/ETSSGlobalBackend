import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
  BookingListResponseDto,
  BookingResponseDto,
  BookingsSummaryResponseDto,
} from './dto/bookings-response.dto';

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

  private ok(message: string, data: unknown) {
    return { success: true, message, data };
  }
}
