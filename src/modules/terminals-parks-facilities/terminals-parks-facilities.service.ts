import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  EntityManager,
  QueryFailedError,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import {
  Facility,
  FacilityTimeslot,
  FacilityTimeslotAssignment,
  Location,
  Terminal,
  TransitPark,
} from '../../database/entities';
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

const TERMINAL_CODE_PREFIXES: Record<string, string> = {
  PORT_TERMINAL: 'PT',
  NON_PORT_TERMINAL: 'NPT',
};

const TRANSIT_PARK_CODE_PREFIXES: Record<string, string> = {
  PREGATE: 'PRE',
  EPT: 'EPT',
};

const FACILITY_CODE_PREFIXES: Record<string, string> = {
  BONDED_TERMINAL: 'BDT',
  TRUCK_PARK: 'TRP',
  FISH_VAN_PARK: 'FVP',
};

@Injectable()
export class TerminalsParksFacilitiesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Terminal)
    private readonly terminalRepository: Repository<Terminal>,
    @InjectRepository(TransitPark)
    private readonly transitParkRepository: Repository<TransitPark>,
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    @InjectRepository(FacilityTimeslot)
    private readonly facilityTimeslotRepository: Repository<FacilityTimeslot>,
    @InjectRepository(FacilityTimeslotAssignment)
    private readonly facilityTimeslotAssignmentRepository: Repository<FacilityTimeslotAssignment>,
  ) {}

  // Terminals
  async createTerminal(dto: CreateTerminalDto) {
    const terminal = this.terminalRepository.create({
      ...dto,
      terminal_code: await this.nextCode(
        Terminal,
        'terminal_code',
        TERMINAL_CODE_PREFIXES[dto.terminal_type],
      ),
      status: dto.status ?? 'ACTIVE',
      booking_status: dto.booking_status ?? 'OPEN',
    });
    return this.saveWithConflictMessage(
      this.terminalRepository,
      terminal,
      'Terminal already exists',
    );
  }

  async findTerminals(query: QueryTerminalsParksFacilitiesDto) {
    const qb = this.terminalRepository.createQueryBuilder('row');
    this.applyCommonFilters(qb, query, [
      'row.name',
      'row.terminal_code',
      'row.address',
    ]);
    if (query.type?.trim()) {
      qb.andWhere('row.terminal_type = :type', { type: query.type.trim() });
    }
    if (query.booking_status?.trim()) {
      qb.andWhere('row.booking_status = :bookingStatus', {
        bookingStatus: query.booking_status.trim(),
      });
    }
    qb.orderBy('row.name', 'ASC');
    return this.paginateQueryBuilder(qb, query);
  }

  async terminalsSummary() {
    const rows = await this.terminalRepository
      .createQueryBuilder('row')
      .select('row.location', 'location')
      .addSelect('row.terminal_type', 'terminal_type')
      .addSelect('COUNT(*)', 'count')
      .where('row.archived_at IS NULL')
      .groupBy('row.location')
      .addGroupBy('row.terminal_type')
      .getRawMany<{ location: string; terminal_type: string; count: string }>();

    const count = (location: string, terminalType: string) =>
      Number(
        rows.find(
          (row) =>
            row.location === location && row.terminal_type === terminalType,
        )?.count ?? 0,
      );

    return {
      apapa_port_terminals: count('APAPA', 'PORT_TERMINAL'),
      apapa_non_port_terminals: count('APAPA', 'NON_PORT_TERMINAL'),
      tincan_port_terminals: count('TINCAN', 'PORT_TERMINAL'),
      tincan_non_port_terminals: count('TINCAN', 'NON_PORT_TERMINAL'),
    };
  }

  async findTerminal(id: string) {
    return this.requireEntity(
      this.terminalRepository,
      id,
      'Terminal not found',
    );
  }

  async updateTerminal(id: string, dto: UpdateTerminalDto) {
    const terminal = await this.requireEntity(
      this.terminalRepository,
      id,
      'Terminal not found',
    );
    // Terminal ID numbers are prefixed by type (PT/NPT), so a type change
    // requires a new code in the destination sequence.
    if (dto.terminal_type && dto.terminal_type !== terminal.terminal_type) {
      terminal.terminal_code = await this.nextCode(
        Terminal,
        'terminal_code',
        TERMINAL_CODE_PREFIXES[dto.terminal_type],
      );
    }
    Object.assign(terminal, this.cleanUndefined(dto));
    return this.saveWithConflictMessage(
      this.terminalRepository,
      terminal,
      'Terminal already exists',
    );
  }

  async updateTerminalStatus(id: string, dto: UpdateStatusDto) {
    const terminal = await this.requireEntity(
      this.terminalRepository,
      id,
      'Terminal not found',
    );
    terminal.status = dto.status;
    return this.terminalRepository.save(terminal);
  }

  async updateTerminalBookingStatus(id: string, dto: UpdateBookingStatusDto) {
    const terminal = await this.requireEntity(
      this.terminalRepository,
      id,
      'Terminal not found',
    );
    terminal.booking_status = dto.booking_status;
    return this.terminalRepository.save(terminal);
  }

  async archiveTerminal(id: string) {
    return this.setArchived(
      this.terminalRepository,
      id,
      'Terminal not found',
      true,
    );
  }

  async unarchiveTerminal(id: string) {
    return this.setArchived(
      this.terminalRepository,
      id,
      'Terminal not found',
      false,
    );
  }

  async deleteTerminal(id: string) {
    const terminal = await this.requireEntity(
      this.terminalRepository,
      id,
      'Terminal not found',
    );
    await this.terminalRepository.remove(terminal);
  }

  // Transit parks
  async createTransitPark(dto: CreateTransitParkDto) {
    const transitPark = this.transitParkRepository.create({
      ...dto,
      transit_park_code: await this.nextCode(
        TransitPark,
        'transit_park_code',
        TRANSIT_PARK_CODE_PREFIXES[dto.transit_park_type],
      ),
      status: dto.status ?? 'ACTIVE',
    });
    return this.saveWithConflictMessage(
      this.transitParkRepository,
      transitPark,
      'Transit park already exists',
    );
  }

  async findTransitParks(query: QueryTerminalsParksFacilitiesDto) {
    const qb = this.transitParkRepository.createQueryBuilder('row');
    this.applyCommonFilters(qb, query, [
      'row.name',
      'row.transit_park_code',
      'row.address',
    ]);
    if (query.type?.trim()) {
      qb.andWhere('row.transit_park_type = :type', { type: query.type.trim() });
    }
    qb.orderBy('row.name', 'ASC');
    return this.paginateQueryBuilder(qb, query);
  }

  async transitParksSummary() {
    const rows = await this.transitParkRepository
      .createQueryBuilder('row')
      .select('row.transit_park_type', 'transit_park_type')
      .addSelect('COUNT(*)', 'count')
      .where('row.archived_at IS NULL')
      .groupBy('row.transit_park_type')
      .getRawMany<{ transit_park_type: string; count: string }>();

    const count = (type: string) =>
      Number(rows.find((row) => row.transit_park_type === type)?.count ?? 0);

    return {
      pregates: count('PREGATE'),
      export_processing_terminals: count('EPT'),
    };
  }

  async findTransitPark(id: string) {
    return this.requireEntity(
      this.transitParkRepository,
      id,
      'Transit park not found',
    );
  }

  async updateTransitPark(id: string, dto: UpdateTransitParkDto) {
    const transitPark = await this.requireEntity(
      this.transitParkRepository,
      id,
      'Transit park not found',
    );
    if (
      dto.transit_park_type &&
      dto.transit_park_type !== transitPark.transit_park_type
    ) {
      transitPark.transit_park_code = await this.nextCode(
        TransitPark,
        'transit_park_code',
        TRANSIT_PARK_CODE_PREFIXES[dto.transit_park_type],
      );
    }
    Object.assign(transitPark, this.cleanUndefined(dto));
    return this.saveWithConflictMessage(
      this.transitParkRepository,
      transitPark,
      'Transit park already exists',
    );
  }

  async updateTransitParkStatus(id: string, dto: UpdateStatusDto) {
    const transitPark = await this.requireEntity(
      this.transitParkRepository,
      id,
      'Transit park not found',
    );
    transitPark.status = dto.status;
    return this.transitParkRepository.save(transitPark);
  }

  async archiveTransitPark(id: string) {
    return this.setArchived(
      this.transitParkRepository,
      id,
      'Transit park not found',
      true,
    );
  }

  async unarchiveTransitPark(id: string) {
    return this.setArchived(
      this.transitParkRepository,
      id,
      'Transit park not found',
      false,
    );
  }

  async deleteTransitPark(id: string) {
    const transitPark = await this.requireEntity(
      this.transitParkRepository,
      id,
      'Transit park not found',
    );
    await this.transitParkRepository.remove(transitPark);
  }

  // Facilities
  async createFacility(dto: CreateFacilityDto) {
    const facilityCode = await this.nextCode(
      Facility,
      'facility_code',
      FACILITY_CODE_PREFIXES[dto.park_type],
    );

    return this.dataSource.transaction(async (manager) => {
      const facility = manager.create(Facility, {
        ...dto,
        facility_code: facilityCode,
        status: dto.status ?? 'ACTIVE',
      });
      const created = await this.saveWithConflictMessage(
        manager.getRepository(Facility),
        facility,
        'Facility already exists',
      );

      // MVP 022: every new facility gets a FACILITY location profile with all
      // facility timeslots auto-assigned.
      const location = await this.saveWithConflictMessage(
        manager.getRepository(Location),
        manager.create(Location, {
          name: created.name,
          type: 'FACILITY',
          reference_id: created.id,
        }),
        'A facility location with this name already exists',
      );
      await this.assignAllTimeslotsToLocation(manager, location.id);

      return created;
    });
  }

  async findFacilities(query: QueryTerminalsParksFacilitiesDto) {
    const qb = this.facilityRepository.createQueryBuilder('row');
    this.applyCommonFilters(qb, query, [
      'row.name',
      'row.facility_code',
      'row.address',
    ]);
    const parkType = query.park_type?.trim() || query.type?.trim();
    if (parkType) {
      qb.andWhere('row.park_type = :parkType', { parkType });
    }
    if (query.facility_type?.trim()) {
      qb.andWhere('row.facility_type = :facilityType', {
        facilityType: query.facility_type.trim(),
      });
    }
    qb.orderBy('row.name', 'ASC');
    return this.paginateQueryBuilder(qb, query);
  }

  async facilitiesSummary() {
    const rows = await this.facilityRepository
      .createQueryBuilder('row')
      .select('row.park_type', 'park_type')
      .addSelect('COUNT(*)', 'count')
      .where('row.archived_at IS NULL')
      .groupBy('row.park_type')
      .getRawMany<{ park_type: string; count: string }>();

    const count = (type: string) =>
      Number(rows.find((row) => row.park_type === type)?.count ?? 0);

    return {
      bonded_terminals: count('BONDED_TERMINAL'),
      truck_parks: count('TRUCK_PARK'),
      fish_van_parks: count('FISH_VAN_PARK'),
    };
  }

  async findFacility(id: string) {
    return this.requireEntity(
      this.facilityRepository,
      id,
      'Facility not found',
    );
  }

  async updateFacility(id: string, dto: UpdateFacilityDto) {
    const facility = await this.requireEntity(
      this.facilityRepository,
      id,
      'Facility not found',
    );
    if (dto.park_type && dto.park_type !== facility.park_type) {
      facility.facility_code = await this.nextCode(
        Facility,
        'facility_code',
        FACILITY_CODE_PREFIXES[dto.park_type],
      );
    }
    const nameChanged = dto.name && dto.name !== facility.name;
    Object.assign(facility, this.cleanUndefined(dto));

    return this.dataSource.transaction(async (manager) => {
      const updated = await this.saveWithConflictMessage(
        manager.getRepository(Facility),
        facility,
        'Facility already exists',
      );
      if (nameChanged) {
        await manager.update(
          Location,
          { type: 'FACILITY', reference_id: id },
          { name: updated.name },
        );
      }
      return updated;
    });
  }

  async updateFacilityStatus(id: string, dto: UpdateStatusDto) {
    const facility = await this.requireEntity(
      this.facilityRepository,
      id,
      'Facility not found',
    );
    facility.status = dto.status;
    return this.facilityRepository.save(facility);
  }

  async archiveFacility(id: string) {
    return this.setArchived(
      this.facilityRepository,
      id,
      'Facility not found',
      true,
    );
  }

  async unarchiveFacility(id: string) {
    return this.setArchived(
      this.facilityRepository,
      id,
      'Facility not found',
      false,
    );
  }

  async deleteFacility(id: string) {
    await this.requireEntity(this.facilityRepository, id, 'Facility not found');
    await this.dataSource.transaction(async (manager) => {
      // Removing the location cascades its timeslot assignments.
      await manager.delete(Location, { type: 'FACILITY', reference_id: id });
      await manager.delete(Facility, { id });
    });
  }

  async listFacilityTimeslots(
    facilityId: string,
    query: QueryTerminalsParksFacilitiesDto,
  ) {
    await this.requireEntity(
      this.facilityRepository,
      facilityId,
      'Facility not found',
    );
    const location = await this.locationRepository.findOne({
      where: { type: 'FACILITY', reference_id: facilityId },
    });
    if (!location) {
      return {
        data: [],
        meta: { total: 0, page: 1, limit: query.limit ?? 20, total_pages: 0 },
      };
    }

    const qb = this.facilityTimeslotAssignmentRepository
      .createQueryBuilder('row')
      .leftJoinAndSelect('row.timeslot', 'timeslot')
      .where('row.facility_id = :locationId', { locationId: location.id });

    if (query.search?.trim()) {
      qb.andWhere('timeslot.name ILIKE :search', {
        search: `%${query.search.trim()}%`,
      });
    }
    if (query.status?.trim()) {
      qb.andWhere('row.is_active = :isActive', {
        isActive: query.status.trim().toUpperCase() === 'ACTIVE',
      });
    }
    qb.orderBy('timeslot.start_time', 'ASC');
    return this.paginateQueryBuilder(qb, query);
  }

  // Helpers
  private applyCommonFilters(
    qb: SelectQueryBuilder<any>,
    query: QueryTerminalsParksFacilitiesDto,
    searchColumns: string[],
  ) {
    if (!query.include_archived) {
      qb.andWhere('row.archived_at IS NULL');
    }
    if (query.status?.trim()) {
      qb.andWhere('row.status = :status', { status: query.status.trim() });
    }
    if (query.location?.trim()) {
      qb.andWhere('row.location = :location', {
        location: query.location.trim(),
      });
    }
    if (query.search?.trim()) {
      const search = `%${query.search.trim()}%`;
      qb.andWhere(
        new Brackets((where) => {
          searchColumns.forEach((column, index) => {
            if (index === 0) {
              where.where(`${column} ILIKE :search`, { search });
            } else {
              where.orWhere(`${column} ILIKE :search`, { search });
            }
          });
        }),
      );
    }
  }

  private async paginateQueryBuilder(
    qb: SelectQueryBuilder<any>,
    query: QueryTerminalsParksFacilitiesDto,
  ) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const total = await qb.clone().getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /** Next sequential code for a prefix, e.g. PT-001, NPT-014, BDT-002. */
  private async nextCode(
    entity: typeof Terminal | typeof TransitPark | typeof Facility,
    column: string,
    prefix: string,
  ): Promise<string> {
    const raw = await this.dataSource.manager
      .createQueryBuilder(entity, 'row')
      .select(
        `MAX(CAST(SUBSTRING(row.${column} FROM ${prefix.length + 2}) AS INTEGER))`,
        'max',
      )
      .where(`row.${column} ~ '^${prefix}-[0-9]+$'`)
      .getRawOne<{ max: string | null }>();

    const next = (raw?.max ? Number(raw.max) : 0) + 1;
    return `${prefix}-${String(next).padStart(3, '0')}`;
  }

  private async assignAllTimeslotsToLocation(
    manager: EntityManager,
    locationId: string,
  ) {
    const timeslots = await manager.find(FacilityTimeslot);
    if (!timeslots.length) return;

    await manager.save(
      FacilityTimeslotAssignment,
      timeslots.map((timeslot) => ({
        facility_id: locationId,
        timeslot_id: timeslot.id,
        is_active: true,
      })),
    );
  }

  private async setArchived(
    repository: Repository<any>,
    id: string,
    notFoundMessage: string,
    archived: boolean,
  ) {
    const entity = await this.requireEntity(repository, id, notFoundMessage);
    entity.archived_at = archived ? new Date() : null;
    return repository.save(entity);
  }

  private async requireEntity(
    repository: Repository<any>,
    id: string,
    notFoundMessage: string,
  ): Promise<any> {
    const row = await repository.findOne({ where: { id } as any });
    if (!row) throw new NotFoundException(notFoundMessage);
    return row;
  }

  private async saveWithConflictMessage<T extends object>(
    repository: Repository<T>,
    entity: T,
    conflictMessage?: string,
  ): Promise<T> {
    try {
      return await repository.save(entity);
    } catch (error) {
      if (
        conflictMessage &&
        error instanceof QueryFailedError &&
        (error as unknown as { code?: string }).code === '23505'
      ) {
        throw new ConflictException(conflictMessage);
      }
      throw error;
    }
  }

  private cleanUndefined<T extends object>(obj: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(obj).filter(([, value]) => value !== undefined),
    ) as Partial<T>;
  }
}
