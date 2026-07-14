import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { Booking, BookingTimelineEntry } from '../../database/entities';
import {
  applySearch,
  paginateQueryBuilder,
  requireEntity,
  toCsv,
} from '../../common/utils/query-helpers';
import { QueryBookingsDto, QueryManifestDto } from './dto/bookings.dto';

type ActorUser = { first_name?: string; last_name?: string };

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(BookingTimelineEntry)
    private readonly timelineRepository: Repository<BookingTimelineEntry>,
  ) {}

  async findBookings(query: QueryBookingsDto) {
    const qb = this.bookingRepository.createQueryBuilder('row');
    this.applyBookingFilters(qb, query);

    const sortField = query.sort ?? 'created_at';
    const sortDir = (query.sort_dir ?? 'desc').toUpperCase() as 'ASC' | 'DESC';
    qb.orderBy(`row.${sortField}`, sortDir);

    const result = await paginateQueryBuilder(
      qb,
      query.page ?? 1,
      query.limit ?? 20,
    );
    const hydrated = await this.hydrateBookings(result.data);
    return {
      data: hydrated.map((b) => this.mapBookingResponse(b)),
      meta: result.meta,
    };
  }

  async findManifest(query: QueryManifestDto) {
    const tab = query.tab ?? 'in';
    const qb = this.bookingRepository.createQueryBuilder('row');

    if (tab === 'in') {
      qb.where('row.manifest_status = :ms', { ms: 'IN_MANIFEST' }).andWhere(
        'row.left_pregate_at IS NOT NULL',
      );
      if (query.date) {
        qb.andWhere('DATE(row.left_pregate_at) = :date', { date: query.date });
      }
      qb.orderBy('row.left_pregate_at', 'DESC');
    } else {
      qb.where('row.manifest_status = :ms', { ms: 'LEFT_MANIFEST' }).andWhere(
        'row.tow_requested_at IS NOT NULL',
      );
      if (query.date) {
        qb.andWhere('DATE(row.left_manifest_at) = :date', { date: query.date });
      }
      qb.orderBy('row.left_manifest_at', 'DESC');
    }

    applySearch(
      qb,
      'row',
      ['booking_id', 'truck_plate_number'],
      query.search,
    );

    const result = await paginateQueryBuilder(
      qb,
      query.page ?? 1,
      query.limit ?? 20,
    );
    const hydrated = await this.hydrateBookings(result.data);
    return {
      data: hydrated.map((b) => this.mapBookingResponse(b)),
      meta: result.meta,
    };
  }

  async bookingsSummary() {
    const stats = await this.bookingRepository
      .createQueryBuilder('row')
      .select('COUNT(*)', 'total')
      .addSelect(`COUNT(*) FILTER (WHERE row.status = 'LIVE')`, 'live')
      .addSelect(
        `COUNT(*) FILTER (WHERE row.status = 'COMPLETED')`,
        'completed',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.status = 'CANCELLED')`,
        'cancelled',
      )
      .addSelect(`COUNT(*) FILTER (WHERE row.status = 'EXPIRED')`, 'expired')
      .getRawOne<Record<string, string>>();

    return {
      total: Number(stats?.total ?? 0),
      live: Number(stats?.live ?? 0),
      completed: Number(stats?.completed ?? 0),
      cancelled: Number(stats?.cancelled ?? 0),
      expired: Number(stats?.expired ?? 0),
    };
  }

  async findBooking(id: string) {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: ['timeline', 'exceptions'],
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    this.sortRelations(booking);
    return this.mapBookingResponse(booking);
  }

  async removeFromManifest(id: string, user?: ActorUser) {
    const booking = await requireEntity(
      this.bookingRepository,
      id,
      'Booking not found',
    );
    if (booking.manifest_status !== 'IN_MANIFEST') {
      throw new BadRequestException(
        'Only IN-MANIFEST bookings can be removed from manifest',
      );
    }

    booking.manifest_status = null;
    await this.bookingRepository.save(booking);
    await this.appendTimeline(
      booking.id,
      'REMOVED_FROM_MANIFEST',
      this.actorName(user),
      'Removed from IN-MANIFEST by SuperAdmin.',
    );
    return this.findBooking(id);
  }

  async addToManifest(id: string, user?: ActorUser) {
    const booking = await requireEntity(
      this.bookingRepository,
      id,
      'Booking not found',
    );
    if (booking.manifest_status !== 'LEFT_MANIFEST') {
      throw new BadRequestException(
        'Only LEFT-MANIFEST bookings can be added back to manifest',
      );
    }

    booking.manifest_status = 'IN_MANIFEST';
    booking.left_manifest_at = null;
    booking.tow_requested_at = null;
    booking.tow_reason = null;
    booking.tow_requested_by = null;
    booking.tow_company = null;
    booking.tow_status = null;
    await this.bookingRepository.save(booking);
    await this.appendTimeline(
      booking.id,
      'ADDED_TO_MANIFEST',
      this.actorName(user),
      'Re-listed in IN-MANIFEST — removed from LEFT-MANIFEST.',
    );
    return this.findBooking(id);
  }

  async cancelBooking(id: string, user?: ActorUser) {
    const booking = await requireEntity(
      this.bookingRepository,
      id,
      'Booking not found',
    );
    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('Booking is already cancelled');
    }

    booking.status = 'CANCELLED';
    booking.manifest_status = null;
    await this.bookingRepository.save(booking);
    await this.appendTimeline(
      booking.id,
      'CANCELLED',
      this.actorName(user),
      'Booking cancelled by SuperAdmin.',
    );
    return this.findBooking(id);
  }

  async exportCsv(query: QueryBookingsDto): Promise<string> {
    const { data } = await this.findBookings({
      ...query,
      page: 1,
      limit: 10000,
    });
    const headers = [
      'Booking ID',
      'Journey Code',
      'Plate Number',
      'Driver',
      'Transporter',
      'Terminal',
      'Destination',
      'Transfer Type',
      'Category',
      'Status',
      'Manifest Status',
      'Created At',
      'Last Updated',
      'Completed At',
    ];
    const rows = data.map((b) => [
      String(b.booking_id),
      String(b.journey_code),
      String(b.truck_plate_number),
      String(b.driver_name),
      String(b.transporter_company),
      String(b.terminal_name),
      String(b.terminal_destination),
      String(b.transfer_type),
      String(b.booking_category),
      String(b.status),
      b.manifest_status ? String(b.manifest_status) : '',
      String(b.created_at),
      String(b.last_updated_at),
      b.completed_at ? String(b.completed_at) : '',
    ]);
    return toCsv([headers, ...rows]);
  }

  private applyBookingFilters(
    qb: SelectQueryBuilder<Booking>,
    query: QueryBookingsDto,
  ) {
    if (query.status) {
      qb.andWhere('row.status = :status', { status: query.status });
    }

    applySearch(
      qb,
      'row',
      [
        'booking_id',
        'journey_code',
        'truck_plate_number',
        'driver_name',
      ],
      query.search,
    );

    if (query.terminal_name?.trim() && query.terminal_name !== 'All') {
      qb.andWhere('row.terminal_name = :terminal', {
        terminal: query.terminal_name.trim(),
      });
    }
    if (query.transfer_type) {
      qb.andWhere('row.transfer_type = :transfer', {
        transfer: query.transfer_type,
      });
    }
    if (
      query.transporter_company?.trim() &&
      query.transporter_company !== 'All'
    ) {
      qb.andWhere('row.transporter_company = :transporter', {
        transporter: query.transporter_company.trim(),
      });
    }

    const dateField =
      query.date_field === 'completed' ? 'completed_at' : 'created_at';
    if (query.date_from) {
      qb.andWhere(`row.${dateField} >= :dateFrom`, {
        dateFrom: `${query.date_from}T00:00:00.000Z`,
      });
    }
    if (query.date_to) {
      qb.andWhere(`row.${dateField} <= :dateTo`, {
        dateTo: `${query.date_to}T23:59:59.999Z`,
      });
    }
  }

  private async hydrateBookings(bookings: Booking[]): Promise<Booking[]> {
    if (!bookings.length) return [];
    const ids = bookings.map((b) => b.id);
    const hydrated = await this.bookingRepository.find({
      where: { id: In(ids) },
      relations: ['timeline', 'exceptions'],
    });
    const byId = new Map(hydrated.map((b) => [b.id, b]));
    return bookings
      .map((b) => byId.get(b.id))
      .filter((b): b is Booking => Boolean(b))
      .map((b) => this.sortRelations(b));
  }

  private sortRelations(booking: Booking): Booking {
    booking.timeline = [...(booking.timeline ?? [])].sort(
      (a, b) => a.created_at.getTime() - b.created_at.getTime(),
    );
    booking.exceptions = [...(booking.exceptions ?? [])].sort(
      (a, b) => a.created_at.getTime() - b.created_at.getTime(),
    );
    return booking;
  }

  private async appendTimeline(
    bookingId: string,
    status: string,
    performedBy?: string,
    notes?: string,
  ) {
    const entry = this.timelineRepository.create({
      booking_id: bookingId,
      status,
      performed_by: performedBy ?? null,
      notes: notes ?? null,
    });
    return this.timelineRepository.save(entry);
  }

  private actorName(user?: ActorUser): string | undefined {
    if (!user?.first_name) return undefined;
    return `${user.first_name} ${user.last_name ?? ''}`.trim();
  }

  mapBookingResponse(booking: Booking) {
    const response: Record<string, unknown> = {
      id: booking.id,
      booking_id: booking.booking_id,
      journey_code: booking.journey_code,
      truck_plate_number: booking.truck_plate_number,
      truck_color: booking.truck_color,
      driver_name: booking.driver_name,
      driver_id: booking.driver_id,
      transporter_company: booking.transporter_company,
      terminal_name: booking.terminal_name,
      terminal_destination: booking.terminal_destination,
      transfer_type: booking.transfer_type,
      booking_category: booking.booking_category,
      status: booking.status,
      created_at: booking.created_at,
      last_updated_at: booking.last_updated_at,
      truck_booked_by: booking.truck_booked_by,
      truck_owned_by: booking.truck_owned_by,
      manifest_status: booking.manifest_status,
      timeline: (booking.timeline ?? []).map((entry) => ({
        id: entry.id,
        status: entry.status,
        timestamp: entry.created_at,
        ...(entry.performed_by ? { performed_by: entry.performed_by } : {}),
        ...(entry.notes ? { notes: entry.notes } : {}),
      })),
      exceptions: (booking.exceptions ?? []).map((ex) => ({
        id: ex.id,
        type: ex.type,
        description: ex.description,
        timestamp: ex.created_at,
      })),
    };

    if (booking.completed_at) {
      response.completed_at = booking.completed_at;
    }
    if (booking.left_pregate_at) {
      response.left_pregate_at = booking.left_pregate_at;
    }
    if (booking.left_manifest_at) {
      response.left_manifest_at = booking.left_manifest_at;
    }
    if (booking.tow_requested_at) {
      response.tow_truck_request = {
        requested_at: booking.tow_requested_at,
        reason: booking.tow_reason ?? '',
        requested_by: booking.tow_requested_by ?? '',
        ...(booking.tow_company ? { tow_company: booking.tow_company } : {}),
        status: booking.tow_status ?? 'PENDING',
      };
    }

    return response;
  }
}
