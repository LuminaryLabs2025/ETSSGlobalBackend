import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import {
  Booking,
  BookingCategory,
  BookingTimelineEntry,
  Company,
  Driver,
  Facility,
  FacilityTimeslot,
  PaymentType,
  Tep,
  Terminal,
  TransitPark,
  Truck,
} from '../../database/entities';
import {
  applySearch,
  nextSequentialCode,
  paginateQueryBuilder,
  requireEntity,
  toCsv,
} from '../../common/utils/query-helpers';
import { QueryBookingsDto, QueryManifestDto } from './dto/bookings.dto';
import {
  ConfirmPaymentDto,
  CreateEptBookingDto,
  CreateFacilityBookingDto,
  CreateFishBookingDto,
} from './dto/create-booking.dto';
import {
  BookingTypeCode,
  computePriority,
  deriveLegacyCategory,
  deriveLegacyTransferType,
} from './bookings-priority.util';

type ActorUser = { first_name?: string; last_name?: string };

const RELATIONS = [
  'timeline',
  'exceptions',
  'facility',
  'transit_park',
  'pregate_transit_park',
  'terminal',
  'booking_category_ref',
  'expected_arrival_time_slot',
];

const LINKED_FORM_BY_TYPE: Record<BookingTypeCode, string> = {
  BONDED_TERMINAL: 'BOOK_BONDED_TERMINAL',
  TRUCK_PARK: 'BOOK_TRUCK_PARK',
  FISH_VAN_PARK: 'BOOK_FISH',
  EPT: 'BOOK_EPT',
};

const INELIGIBLE_TRUCK_STATUSES = [
  'ON_TRIP',
  'IN_FACILITY',
  'MATCHED',
  'GTG_FACILITY',
  'IN_PREGATE',
  'GTG_PREGATE',
  'IN_TERMINAL',
];

const INELIGIBLE_DRIVER_STATUSES = [
  'ON_TRIP',
  'IN_FACILITY',
  'IN_PREGATE',
  'IN_TERMINAL',
  'OFF_DUTY',
  'SUSPENDED',
];

interface ResolvedBookingInput {
  booking_type: BookingTypeCode;
  facility: Facility | null;
  transit_park: TransitPark | null;
  terminal: Terminal;
  truck: Truck;
  driver: Driver;
  transporter_company: Company;
  booking_category: BookingCategory | null;
  export_type: string | null;
  ept_operation_type: string | null;
  gate_pass_number: string | null;
  tep: Tep | null;
  expected_arrival_date: string;
  expected_arrival_time_slot: FacilityTimeslot | null;
  expected_arrival_time: string | null;
}

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(BookingTimelineEntry)
    private readonly timelineRepository: Repository<BookingTimelineEntry>,
    @InjectRepository(Truck)
    private readonly truckRepository: Repository<Truck>,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>,
    @InjectRepository(TransitPark)
    private readonly transitParkRepository: Repository<TransitPark>,
    @InjectRepository(Terminal)
    private readonly terminalRepository: Repository<Terminal>,
    @InjectRepository(BookingCategory)
    private readonly bookingCategoryRepository: Repository<BookingCategory>,
    @InjectRepository(FacilityTimeslot)
    private readonly facilityTimeslotRepository: Repository<FacilityTimeslot>,
    @InjectRepository(Tep)
    private readonly tepRepository: Repository<Tep>,
    @InjectRepository(PaymentType)
    private readonly paymentTypeRepository: Repository<PaymentType>,
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
    const trucksByPlate = await this.loadTrucksByPlate(
      hydrated.map((b) => b.truck_plate_number),
    );
    return {
      data: hydrated.map((b) =>
        this.mapBookingResponse(b, trucksByPlate.get(b.truck_plate_number)),
      ),
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

    applySearch(qb, 'row', ['booking_id', 'truck_plate_number'], query.search);

    const result = await paginateQueryBuilder(
      qb,
      query.page ?? 1,
      query.limit ?? 20,
    );
    const hydrated = await this.hydrateBookings(result.data);
    const trucksByPlate = await this.loadTrucksByPlate(
      hydrated.map((b) => b.truck_plate_number),
    );
    return {
      data: hydrated.map((b) =>
        this.mapBookingResponse(b, trucksByPlate.get(b.truck_plate_number)),
      ),
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
      .addSelect(
        `COUNT(*) FILTER (WHERE ${this.flaggedExistsSql('row')})`,
        'flagged',
      )
      .getRawOne<Record<string, string>>();

    return {
      total: Number(stats?.total ?? 0),
      live: Number(stats?.live ?? 0),
      completed: Number(stats?.completed ?? 0),
      cancelled: Number(stats?.cancelled ?? 0),
      expired: Number(stats?.expired ?? 0),
      flagged: Number(stats?.flagged ?? 0),
    };
  }

  async findBooking(id: string) {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: RELATIONS,
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    this.sortRelations(booking);
    const trucksByPlate = await this.loadTrucksByPlate([
      booking.truck_plate_number,
    ]);
    return this.mapBookingResponse(
      booking,
      trucksByPlate.get(booking.truck_plate_number),
    );
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
      'Truck Plate',
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

  // ─────────────────────────────────────────────────────────────────────
  // SuperAdmin booking-creation flows
  // ─────────────────────────────────────────────────────────────────────

  async previewBondedTerminalBooking(dto: CreateFacilityBookingDto) {
    const resolved = await this.resolveFacilityInput(
      dto,
      'BONDED_TERMINAL',
      'Bonded Terminal',
    );
    return this.toPreviewResponse(resolved);
  }

  async createBondedTerminalBooking(
    dto: CreateFacilityBookingDto,
    user?: ActorUser,
    userId?: string,
  ) {
    const resolved = await this.resolveFacilityInput(
      dto,
      'BONDED_TERMINAL',
      'Bonded Terminal',
    );
    return this.persistBooking(resolved, user, userId);
  }

  async previewTruckParkBooking(dto: CreateFacilityBookingDto) {
    const resolved = await this.resolveFacilityInput(
      dto,
      'TRUCK_PARK',
      'Truck Park',
    );
    return this.toPreviewResponse(resolved);
  }

  async createTruckParkBooking(
    dto: CreateFacilityBookingDto,
    user?: ActorUser,
    userId?: string,
  ) {
    const resolved = await this.resolveFacilityInput(
      dto,
      'TRUCK_PARK',
      'Truck Park',
    );
    return this.persistBooking(resolved, user, userId);
  }

  async previewFishBooking(dto: CreateFishBookingDto) {
    const resolved = await this.resolveFishInput(dto);
    return this.toPreviewResponse(resolved);
  }

  async createFishBooking(
    dto: CreateFishBookingDto,
    user?: ActorUser,
    userId?: string,
  ) {
    const resolved = await this.resolveFishInput(dto);
    return this.persistBooking(resolved, user, userId);
  }

  async previewEptBooking(dto: CreateEptBookingDto) {
    const resolved = await this.resolveEptInput(dto);
    return this.toPreviewResponse(resolved);
  }

  async createEptBooking(
    dto: CreateEptBookingDto,
    user?: ActorUser,
    userId?: string,
  ) {
    const resolved = await this.resolveEptInput(dto);
    return this.persistBooking(resolved, user, userId);
  }

  private async resolveFacilityInput(
    dto: CreateFacilityBookingDto,
    parkType: 'BONDED_TERMINAL' | 'TRUCK_PARK',
    label: string,
  ): Promise<ResolvedBookingInput> {
    const facility = await requireEntity(
      this.facilityRepository,
      dto.facility_id,
      `${label} facility not found`,
    );
    if (facility.park_type !== parkType) {
      throw new BadRequestException(`Selected facility is not a ${label}`);
    }
    const transporter_company = await requireEntity(
      this.companyRepository,
      dto.transporter_company_id,
      'Transporter company not found',
    );
    const truck = await this.resolveEligibleTruck(dto.truck_id);
    const driver = await this.resolveEligibleDriver(dto.driver_id);
    const terminal = await requireEntity(
      this.terminalRepository,
      dto.terminal_id,
      'Terminal not found',
    );
    const booking_category = await requireEntity(
      this.bookingCategoryRepository,
      dto.booking_category_id,
      'Booking category not found',
    );
    const expected_arrival_time_slot = await requireEntity(
      this.facilityTimeslotRepository,
      dto.expected_arrival_time_slot_id,
      'Timeslot not found',
    );

    return {
      booking_type: parkType,
      facility,
      transit_park: null,
      terminal,
      truck,
      driver,
      transporter_company,
      booking_category,
      export_type: null,
      ept_operation_type: null,
      gate_pass_number: null,
      tep: null,
      expected_arrival_date: dto.expected_arrival_date,
      expected_arrival_time_slot,
      expected_arrival_time: null,
    };
  }

  private async resolveFishInput(
    dto: CreateFishBookingDto,
  ): Promise<ResolvedBookingInput> {
    const facility = await requireEntity(
      this.facilityRepository,
      dto.facility_id,
      'Fish-Van Park facility not found',
    );
    if (facility.park_type !== 'FISH_VAN_PARK') {
      throw new BadRequestException('Selected facility is not a Fish-Van Park');
    }
    const transporter_company = await requireEntity(
      this.companyRepository,
      dto.transporter_company_id,
      'Transporter company not found',
    );
    const truck = await this.resolveEligibleTruck(dto.truck_id);
    const driver = await this.resolveEligibleDriver(dto.driver_id);
    const terminal = await requireEntity(
      this.terminalRepository,
      dto.terminal_id,
      'Terminal not found',
    );
    const booking_category = await this.bookingCategoryRepository
      .createQueryBuilder('row')
      .where('lower(row.name) = :name', { name: 'fish' })
      .getOne();
    if (!booking_category) {
      throw new BadRequestException(
        'Fish booking category is not configured — run the latest migration/seed',
      );
    }
    const expected_arrival_time_slot = dto.expected_arrival_time_slot_id
      ? await requireEntity(
          this.facilityTimeslotRepository,
          dto.expected_arrival_time_slot_id,
          'Timeslot not found',
        )
      : null;
    const tep = dto.gate_pass_number
      ? await this.tepRepository.findOne({
          where: { reference_number: dto.gate_pass_number },
        })
      : null;

    return {
      booking_type: 'FISH_VAN_PARK',
      facility,
      transit_park: null,
      terminal,
      truck,
      driver,
      transporter_company,
      booking_category,
      export_type: null,
      ept_operation_type: null,
      gate_pass_number: dto.gate_pass_number ?? null,
      tep,
      expected_arrival_date: dto.expected_arrival_date,
      expected_arrival_time_slot,
      expected_arrival_time: null,
    };
  }

  private async resolveEptInput(
    dto: CreateEptBookingDto,
  ): Promise<ResolvedBookingInput> {
    const transporter_company = await requireEntity(
      this.companyRepository,
      dto.transporter_company_id,
      'Transporter company not found',
    );
    const truck = await this.resolveEligibleTruck(dto.truck_id);
    const driver = await this.resolveEligibleDriver(dto.driver_id);
    const transit_park = await requireEntity(
      this.transitParkRepository,
      dto.transit_park_id,
      'EPT not found',
    );
    if (transit_park.transit_park_type !== 'EPT') {
      throw new BadRequestException('Selected transit park is not an EPT');
    }
    const terminal = await requireEntity(
      this.terminalRepository,
      dto.terminal_id,
      'Terminal not found',
    );
    if (terminal.terminal_type !== 'PORT_TERMINAL') {
      throw new BadRequestException(
        'EPT bookings require a Port Terminal destination',
      );
    }
    const tep = await this.tepRepository.findOne({
      where: { reference_number: dto.gate_pass_number },
    });

    return {
      booking_type: 'EPT',
      facility: null,
      transit_park,
      terminal,
      truck,
      driver,
      transporter_company,
      booking_category: null,
      export_type: dto.export_type,
      ept_operation_type: dto.ept_operation_type,
      gate_pass_number: dto.gate_pass_number,
      tep,
      expected_arrival_date: dto.expected_arrival_date,
      expected_arrival_time_slot: null,
      expected_arrival_time: dto.expected_arrival_time,
    };
  }

  private async resolveEligibleTruck(id: string): Promise<Truck> {
    const truck = await requireEntity(
      this.truckRepository,
      id,
      'Truck not found',
    );
    if (
      ['DISABLED', 'ARCHIVED', 'FLAGGED'].includes(truck.registration_status)
    ) {
      throw new BadRequestException(
        'Selected truck is disabled, archived, or flagged for an unpaid penalty',
      );
    }
    if (
      truck.truck_status &&
      INELIGIBLE_TRUCK_STATUSES.includes(truck.truck_status)
    ) {
      throw new BadRequestException(
        'Selected truck is not currently available',
      );
    }
    return truck;
  }

  private async resolveEligibleDriver(id: string): Promise<Driver> {
    const driver = await requireEntity(
      this.driverRepository,
      id,
      'Driver not found',
    );
    if (
      ['DISABLED', 'ARCHIVED', 'FLAGGED'].includes(driver.verification_status)
    ) {
      throw new BadRequestException(
        'Selected driver is disabled, archived, or flagged',
      );
    }
    if (
      driver.operational_status &&
      INELIGIBLE_DRIVER_STATUSES.includes(driver.operational_status)
    ) {
      throw new BadRequestException(
        'Selected driver is not currently available',
      );
    }
    return driver;
  }

  private async computeFee(bookingType: BookingTypeCode) {
    const linkedForm = LINKED_FORM_BY_TYPE[bookingType];
    const rows = await this.paymentTypeRepository.find({
      where: { linked_form: linkedForm, status: 'ACTIVE' },
    });
    const lines = rows.map((row) => ({
      name: row.name,
      amount: row.amount_type === 'FIXED' ? Number(row.amount ?? 0) : 0,
    }));
    const total = lines.reduce((sum, line) => sum + line.amount, 0);
    return { fee_configured: rows.length > 0, total, lines };
  }

  private async nextBookingId(): Promise<string> {
    const year = new Date().getFullYear();
    return nextSequentialCode(
      this.bookingRepository,
      'booking_id',
      `BKG-${year}`,
      6,
    );
  }

  private async nextJourneyCode(siteCode?: string | null): Promise<string> {
    const shortCode = (siteCode ?? 'GEN').split('-')[0] || 'GEN';
    return nextSequentialCode(
      this.bookingRepository,
      'journey_code',
      `JRN-${shortCode}`,
      4,
    );
  }

  private async persistBooking(
    resolved: ResolvedBookingInput,
    user?: ActorUser,
    userId?: string,
  ) {
    const priority = computePriority({
      booking_type: resolved.booking_type,
      booking_category_name: resolved.booking_category?.name ?? null,
      terminal_type: resolved.terminal.terminal_type,
    });
    const legacyCategory = deriveLegacyCategory(
      resolved.booking_type,
      resolved.booking_category?.name ?? null,
    );
    const legacyTransfer = deriveLegacyTransferType(
      resolved.booking_type,
      resolved.booking_category?.name ?? null,
      resolved.ept_operation_type,
    );
    const fee = await this.computeFee(resolved.booking_type);
    const siteCode =
      resolved.facility?.facility_code ??
      resolved.transit_park?.transit_park_code ??
      resolved.terminal.terminal_code;
    const booking_id = await this.nextBookingId();
    const journey_code = await this.nextJourneyCode(siteCode);

    const entity = this.bookingRepository.create({
      booking_id,
      journey_code,
      truck_plate_number: resolved.truck.plate_number,
      truck_color: resolved.truck.color,
      driver_name:
        `${resolved.driver.first_name} ${resolved.driver.last_name}`.trim(),
      driver_id: resolved.driver.id,
      transporter_company: resolved.transporter_company.name,
      terminal_name:
        resolved.facility?.name ??
        resolved.transit_park?.name ??
        resolved.terminal.name,
      terminal_destination: resolved.terminal.name,
      transfer_type: legacyTransfer,
      booking_category: legacyCategory,
      status: 'LIVE',
      truck_booked_by: resolved.transporter_company.name,
      truck_owned_by: resolved.transporter_company.name,
      booking_type: resolved.booking_type,
      facility_id: resolved.facility?.id ?? null,
      transit_park_id: resolved.transit_park?.id ?? null,
      terminal_id: resolved.terminal.id,
      truck_id: resolved.truck.id,
      driver_ref_id: resolved.driver.id,
      transporter_company_id: resolved.transporter_company.id,
      booking_category_id: resolved.booking_category?.id ?? null,
      export_type: resolved.export_type,
      ept_operation_type: resolved.ept_operation_type,
      gate_pass_number: resolved.gate_pass_number,
      tep_id: resolved.tep?.id ?? null,
      expected_arrival_date: resolved.expected_arrival_date,
      expected_arrival_time_slot_id:
        resolved.expected_arrival_time_slot?.id ?? null,
      expected_arrival_time: resolved.expected_arrival_time,
      priority_level: priority.priority_level,
      priority_rank: priority.priority_rank,
      payment_status: 'PENDING',
      booking_fee: fee.total ? String(fee.total) : null,
      created_by: userId ?? null,
    });

    const saved = await this.bookingRepository.save(entity);
    await this.appendTimeline(
      saved.id,
      'CREATED',
      this.actorName(user),
      `Booking created by SuperAdmin on behalf of ${resolved.transporter_company.name}.`,
    );
    return this.findBooking(saved.id);
  }

  private async toPreviewResponse(resolved: ResolvedBookingInput) {
    const priority = computePriority({
      booking_type: resolved.booking_type,
      booking_category_name: resolved.booking_category?.name ?? null,
      terminal_type: resolved.terminal.terminal_type,
    });
    const fee = await this.computeFee(resolved.booking_type);
    return {
      booking_type: resolved.booking_type,
      facility: this.siteRef(resolved.facility, 'facility_code', 'park_type'),
      transit_park: this.siteRef(
        resolved.transit_park,
        'transit_park_code',
        'transit_park_type',
      ),
      terminal: this.siteRef(
        resolved.terminal,
        'terminal_code',
        'terminal_type',
      ),
      truck: {
        id: resolved.truck.id,
        plate_number: resolved.truck.plate_number,
      },
      driver: {
        id: resolved.driver.id,
        name: `${resolved.driver.first_name} ${resolved.driver.last_name}`.trim(),
      },
      transporter_company: {
        id: resolved.transporter_company.id,
        name: resolved.transporter_company.name,
      },
      booking_category_ref: resolved.booking_category
        ? {
            id: resolved.booking_category.id,
            name: resolved.booking_category.name,
          }
        : undefined,
      export_type: resolved.export_type,
      ept_operation_type: resolved.ept_operation_type,
      gate_pass_number: resolved.gate_pass_number,
      gate_pass_matched: Boolean(resolved.tep),
      expected_arrival_date: resolved.expected_arrival_date,
      expected_arrival_time: resolved.expected_arrival_time,
      expected_arrival_time_slot: resolved.expected_arrival_time_slot
        ? {
            id: resolved.expected_arrival_time_slot.id,
            name: resolved.expected_arrival_time_slot.name,
            start_time: resolved.expected_arrival_time_slot.start_time,
            end_time: resolved.expected_arrival_time_slot.end_time,
          }
        : undefined,
      priority_level: priority.priority_level,
      priority_rank: priority.priority_rank,
      fee,
    };
  }

  private siteRef(
    entity: { id: string; name: string } | null,
    codeKey: string,
    typeKey: string,
  ) {
    if (!entity) return undefined;
    const record = entity as unknown as Record<string, unknown>;
    return {
      id: entity.id,
      name: entity.name,
      code: record[codeKey] as string | undefined,
      location: record.location as string | undefined,
      type: record[typeKey] as string | undefined,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Payment (manual, no gateway integration exists in this backend yet)
  // ─────────────────────────────────────────────────────────────────────

  async confirmPayment(id: string, dto: ConfirmPaymentDto, user?: ActorUser) {
    const booking = await requireEntity(
      this.bookingRepository,
      id,
      'Booking not found',
    );
    if (booking.payment_status === 'PAID') {
      throw new BadRequestException(
        'Payment already confirmed for this booking',
      );
    }
    booking.payment_status = 'PAID';
    booking.payment_method = dto.payment_method;
    booking.paid_at = new Date();
    booking.confirmed_at = booking.confirmed_at ?? new Date();
    booking.terms_accepted_at = booking.terms_accepted_at ?? new Date();
    await this.bookingRepository.save(booking);
    await this.appendTimeline(
      booking.id,
      'PAYMENT_CONFIRMED',
      this.actorName(user),
      `Payment confirmed via ${dto.payment_method}.`,
    );
    return this.findBooking(id);
  }

  // ─────────────────────────────────────────────────────────────────────
  // FIFO / GTG scheduling — ordering + status fields, manually triggered.
  // ─────────────────────────────────────────────────────────────────────

  async markMatched(id: string, user?: ActorUser) {
    const booking = await requireEntity(
      this.bookingRepository,
      id,
      'Booking not found',
    );
    if (booking.status !== 'LIVE') {
      throw new BadRequestException('Only LIVE bookings can be matched');
    }
    if (!booking.in_facility_at) {
      throw new BadRequestException(
        'Booking must be in-facility before it can be matched',
      );
    }
    if (booking.matched_at) {
      throw new BadRequestException('Booking is already matched');
    }
    booking.matched_at = new Date();
    await this.bookingRepository.save(booking);
    if (booking.truck_id) {
      await this.truckRepository.update(
        { id: booking.truck_id },
        { truck_status: 'MATCHED' },
      );
    }
    await this.appendTimeline(
      booking.id,
      'MATCHED',
      this.actorName(user),
      'Truck matched to a TEP/slot.',
    );
    return this.findBooking(id);
  }

  async markInFacility(id: string, user?: ActorUser) {
    const booking = await requireEntity(
      this.bookingRepository,
      id,
      'Booking not found',
    );
    if (booking.status !== 'LIVE') {
      throw new BadRequestException('Only LIVE bookings can enter a facility');
    }
    if (booking.in_facility_at) {
      throw new BadRequestException('Booking is already marked in-facility');
    }
    booking.in_facility_at = new Date();
    await this.bookingRepository.save(booking);
    if (booking.truck_id) {
      await this.truckRepository.update(
        { id: booking.truck_id },
        { truck_status: 'IN_FACILITY' },
      );
    }
    if (booking.driver_ref_id) {
      await this.driverRepository.update(
        { id: booking.driver_ref_id },
        { operational_status: 'IN_FACILITY' },
      );
    }
    await this.appendTimeline(
      booking.id,
      'IN_FACILITY',
      this.actorName(user),
      'Truck checked in at the facility.',
    );
    return this.findBooking(id);
  }

  async markInPregate(id: string, user?: ActorUser) {
    const booking = await requireEntity(
      this.bookingRepository,
      id,
      'Booking not found',
    );
    if (booking.status !== 'LIVE') {
      throw new BadRequestException('Only LIVE bookings can enter a pregate');
    }
    if (booking.in_pregate_at) {
      throw new BadRequestException('Booking is already marked in-pregate');
    }
    booking.in_pregate_at = new Date();
    await this.bookingRepository.save(booking);
    if (booking.truck_id) {
      await this.truckRepository.update(
        { id: booking.truck_id },
        { truck_status: 'IN_PREGATE' },
      );
    }
    await this.appendTimeline(
      booking.id,
      'IN_PREGATE',
      this.actorName(user),
      'Truck entered a Pregate.',
    );
    return this.findBooking(id);
  }

  private async facilityQueueRows(params: {
    facility_id?: string;
    transit_park_id?: string;
  }): Promise<Booking[]> {
    if (!params.facility_id && !params.transit_park_id) {
      throw new BadRequestException(
        'facility_id or transit_park_id is required',
      );
    }
    const qb = this.bookingRepository
      .createQueryBuilder('row')
      .where('row.status = :status', { status: 'LIVE' })
      .andWhere('row.matched_at IS NOT NULL')
      .andWhere('row.gtg_facility_at IS NULL');
    if (params.facility_id) {
      qb.andWhere('row.facility_id = :fid', { fid: params.facility_id });
    }
    if (params.transit_park_id) {
      qb.andWhere('row.transit_park_id = :tid', {
        tid: params.transit_park_id,
      });
    }
    qb.orderBy('row.priority_rank', 'ASC')
      .addOrderBy('row.in_facility_at', 'ASC')
      .addOrderBy('row.matched_at', 'ASC')
      .addOrderBy('row.created_at', 'ASC');
    return qb.getMany();
  }

  async facilityQueue(params: {
    facility_id?: string;
    transit_park_id?: string;
    page?: number;
    limit?: number;
  }) {
    const rows = await this.facilityQueueRows(params);
    return this.paginateQueueRows(rows, params.page, params.limit);
  }

  private async pregateQueueRows(terminalId: string): Promise<Booking[]> {
    const qb = this.bookingRepository
      .createQueryBuilder('row')
      .where('row.status = :status', { status: 'LIVE' })
      .andWhere('row.in_pregate_at IS NOT NULL')
      .andWhere('row.gtg_pregate_at IS NULL')
      .andWhere('row.terminal_id = :tid', { tid: terminalId })
      .orderBy('row.priority_rank', 'ASC')
      .addOrderBy('row.in_pregate_at', 'ASC');
    return qb.getMany();
  }

  async pregateQueue(params: {
    terminal_id: string;
    page?: number;
    limit?: number;
  }) {
    const rows = await this.pregateQueueRows(params.terminal_id);
    return this.paginateQueueRows(rows, params.page, params.limit);
  }

  private paginateQueueRows(rows: Booking[], page = 1, limit = 20) {
    const total = rows.length;
    const start = (page - 1) * limit;
    const pageRows = rows.slice(start, start + limit);
    return {
      data: pageRows.map((booking, index) => ({
        ...this.mapBookingResponse(booking),
        id: booking.id,
        queue_position: start + index + 1,
      })),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async markGtgFacility(id: string, user?: ActorUser) {
    const booking = await requireEntity(
      this.bookingRepository,
      id,
      'Booking not found',
    );
    if (!booking.facility_id && !booking.transit_park_id) {
      throw new BadRequestException(
        'Booking has no facility/EPT to release from',
      );
    }
    if (!booking.matched_at) {
      throw new BadRequestException(
        'Booking must be matched before GTG-Facility',
      );
    }
    if (booking.gtg_facility_at) {
      throw new BadRequestException('Booking is already GTG-Facility');
    }
    const queue = await this.facilityQueueRows(
      booking.facility_id
        ? { facility_id: booking.facility_id }
        : { transit_park_id: booking.transit_park_id ?? undefined },
    );
    if (!queue.length || queue[0].id !== booking.id) {
      throw new BadRequestException(
        'Another truck has priority for this facility — release it first',
      );
    }
    booking.gtg_facility_at = new Date();
    await this.bookingRepository.save(booking);
    if (booking.truck_id) {
      await this.truckRepository.update(
        { id: booking.truck_id },
        { truck_status: 'GTG_FACILITY' },
      );
    }
    await this.appendTimeline(
      booking.id,
      'GTG_FACILITY',
      this.actorName(user),
      'Truck cleared to exit the facility.',
    );
    return this.findBooking(id);
  }

  async markGtgPregate(id: string, user?: ActorUser) {
    const booking = await requireEntity(
      this.bookingRepository,
      id,
      'Booking not found',
    );
    if (!booking.in_pregate_at) {
      throw new BadRequestException(
        'Booking must be marked in-pregate before GTG-Pregate',
      );
    }
    if (booking.gtg_pregate_at) {
      throw new BadRequestException('Booking is already GTG-Pregate');
    }
    if (!booking.terminal_id) {
      throw new BadRequestException(
        'Booking has no destination terminal to queue against',
      );
    }
    const queue = await this.pregateQueueRows(booking.terminal_id);
    if (!queue.length || queue[0].id !== booking.id) {
      throw new BadRequestException(
        'Another truck (possibly at a different Pregate) has priority for this terminal — release it first',
      );
    }
    booking.gtg_pregate_at = new Date();
    await this.bookingRepository.save(booking);
    if (booking.truck_id) {
      await this.truckRepository.update(
        { id: booking.truck_id },
        { truck_status: 'GTG_PREGATE' },
      );
    }
    await this.appendTimeline(
      booking.id,
      'GTG_PREGATE',
      this.actorName(user),
      'Truck cleared to exit the Pregate towards the terminal.',
    );
    return this.findBooking(id);
  }

  // ─────────────────────────────────────────────────────────────────────

  private applyBookingFilters(
    qb: SelectQueryBuilder<Booking>,
    query: QueryBookingsDto,
  ) {
    if (query.status) {
      qb.andWhere('row.status = :status', { status: query.status });
    }

    if (query.booking_id?.trim()) {
      qb.andWhere('row.booking_id ILIKE :bookingId', {
        bookingId: query.booking_id.trim(),
      });
    }
    if (query.journey_code?.trim()) {
      qb.andWhere('row.journey_code ILIKE :journeyCode', {
        journeyCode: query.journey_code.trim(),
      });
    }
    if (query.truck_plate_number?.trim()) {
      qb.andWhere('row.truck_plate_number ILIKE :plate', {
        plate: query.truck_plate_number.trim(),
      });
    }
    if (query.driver_name?.trim()) {
      qb.andWhere('row.driver_name ILIKE :driverName', {
        driverName: `%${query.driver_name.trim()}%`,
      });
    }

    if (query.flagged === true) {
      qb.andWhere(this.flaggedExistsSql('row'));
    }

    applySearch(
      qb,
      'row',
      ['booking_id', 'journey_code', 'truck_plate_number', 'driver_name'],
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

  /** Matches frontend `isFlaggedBooking` intent (exceptions + flagged trucks). */
  private flaggedExistsSql(alias: string): string {
    return `(
      EXISTS (
        SELECT 1 FROM booking_exceptions be
        WHERE be.booking_id = ${alias}.id
      )
      OR EXISTS (
        SELECT 1 FROM trucks t
        WHERE t.plate_number = ${alias}.truck_plate_number
          AND t.registration_status = 'FLAGGED'
      )
    )`;
  }

  private async hydrateBookings(bookings: Booking[]): Promise<Booking[]> {
    if (!bookings.length) return [];
    const ids = bookings.map((b) => b.id);
    const hydrated = await this.bookingRepository.find({
      where: { id: In(ids) },
      relations: RELATIONS,
    });
    const byId = new Map(hydrated.map((b) => [b.id, b]));
    return bookings
      .map((b) => byId.get(b.id))
      .filter((b): b is Booking => Boolean(b))
      .map((b) => this.sortRelations(b));
  }

  private async loadTrucksByPlate(
    plates: string[],
  ): Promise<Map<string, Truck>> {
    const unique = [...new Set(plates.filter(Boolean))];
    if (!unique.length) return new Map();
    const trucks = await this.truckRepository.find({
      where: { plate_number: In(unique) },
      relations: ['truck_type'],
    });
    return new Map(trucks.map((t) => [t.plate_number, t]));
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

  mapBookingResponse(booking: Booking, truck?: Truck) {
    const timeline = booking.timeline ?? [];
    const latestId = timeline.length ? timeline[timeline.length - 1].id : null;

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
      priority_level: booking.priority_level,
      priority_rank: booking.priority_rank,
      payment_status: booking.payment_status,
      timeline: timeline.map((entry) => ({
        id: entry.id,
        status: entry.status,
        timestamp: entry.created_at,
        is_latest: entry.id === latestId,
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

    if (truck) {
      response.truck = {
        truck_type: truck.truck_type?.name ?? undefined,
        brand: truck.brand ?? undefined,
        model: truck.model ?? undefined,
        mss_verification_number: truck.mss_verification_number ?? undefined,
        truck_status: truck.truck_status ?? undefined,
      };
      if (truck.truck_status) {
        response.current_truck_status = truck.truck_status;
      } else if (truck.registration_status === 'FLAGGED') {
        response.current_truck_status = 'FLAGGED';
      }
    }

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

    if (booking.booking_type) {
      response.booking_type = booking.booking_type;
    }
    if (booking.facility) {
      response.facility = this.siteRef(
        booking.facility,
        'facility_code',
        'park_type',
      );
    }
    if (booking.transit_park) {
      response.transit_park = this.siteRef(
        booking.transit_park,
        'transit_park_code',
        'transit_park_type',
      );
    }
    if (booking.pregate_transit_park) {
      response.pregate_transit_park = this.siteRef(
        booking.pregate_transit_park,
        'transit_park_code',
        'transit_park_type',
      );
    }
    if (booking.terminal) {
      response.terminal = this.siteRef(
        booking.terminal,
        'terminal_code',
        'terminal_type',
      );
    }
    if (booking.booking_category_ref) {
      response.booking_category_ref = {
        id: booking.booking_category_ref.id,
        name: booking.booking_category_ref.name,
      };
    }
    if (booking.expected_arrival_time_slot) {
      response.expected_arrival_time_slot = {
        id: booking.expected_arrival_time_slot.id,
        name: booking.expected_arrival_time_slot.name,
        start_time: booking.expected_arrival_time_slot.start_time,
        end_time: booking.expected_arrival_time_slot.end_time,
      };
    }
    if (booking.expected_arrival_date) {
      response.expected_arrival_date = booking.expected_arrival_date;
    }
    if (booking.expected_arrival_time) {
      response.expected_arrival_time = booking.expected_arrival_time;
    }
    if (booking.export_type) {
      response.export_type = booking.export_type;
    }
    if (booking.ept_operation_type) {
      response.ept_operation_type = booking.ept_operation_type;
    }
    if (booking.gate_pass_number) {
      response.gate_pass_number = booking.gate_pass_number;
    }
    if (booking.matched_at) response.matched_at = booking.matched_at;
    if (booking.in_facility_at)
      response.in_facility_at = booking.in_facility_at;
    if (booking.in_pregate_at) response.in_pregate_at = booking.in_pregate_at;
    if (booking.gtg_facility_at)
      response.gtg_facility_at = booking.gtg_facility_at;
    if (booking.gtg_pregate_at)
      response.gtg_pregate_at = booking.gtg_pregate_at;
    if (booking.payment_method)
      response.payment_method = booking.payment_method;
    if (booking.booking_fee) response.booking_fee = Number(booking.booking_fee);
    if (booking.paid_at) response.paid_at = booking.paid_at;
    if (booking.confirmed_at) response.confirmed_at = booking.confirmed_at;
    if (booking.terms_accepted_at)
      response.terms_accepted_at = booking.terms_accepted_at;

    return response;
  }
}
