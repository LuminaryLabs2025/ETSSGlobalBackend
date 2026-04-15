import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  DeepPartial,
  In,
  QueryFailedError,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import * as ExcelJS from 'exceljs';
import {
  BookingCategory,
  FacilityTimeslot,
  FacilityTimeslotAssignment,
  FacilityType,
  FacilityTypeParkType,
  HandheldDevice,
  InfractionCategory,
  Location,
  ParkType,
  PaymentType,
  RfidTag,
  TepType,
  TepTypeBookingCategory,
  TepTypeTruckType,
  TerminalGate,
  TruckCapacity,
  TruckLength,
  TruckType,
} from '../../database/entities';
import { User } from '../../database/entities/user.entity';
import { UserType } from '../../database/entities/user-type.entity';
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

@Injectable()
export class AppOptionsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(TruckType)
    private readonly truckTypeRepository: Repository<TruckType>,
    @InjectRepository(TruckCapacity)
    private readonly truckCapacityRepository: Repository<TruckCapacity>,
    @InjectRepository(TruckLength)
    private readonly truckLengthRepository: Repository<TruckLength>,
    @InjectRepository(BookingCategory)
    private readonly bookingCategoryRepository: Repository<BookingCategory>,
    @InjectRepository(TepType)
    private readonly tepTypeRepository: Repository<TepType>,
    @InjectRepository(TepTypeBookingCategory)
    private readonly tepTypeBookingCategoryRepository: Repository<TepTypeBookingCategory>,
    @InjectRepository(TepTypeTruckType)
    private readonly tepTypeTruckTypeRepository: Repository<TepTypeTruckType>,
    @InjectRepository(ParkType)
    private readonly parkTypeRepository: Repository<ParkType>,
    @InjectRepository(FacilityType)
    private readonly facilityTypeRepository: Repository<FacilityType>,
    @InjectRepository(FacilityTypeParkType)
    private readonly facilityTypeParkTypeRepository: Repository<FacilityTypeParkType>,
    @InjectRepository(FacilityTimeslot)
    private readonly facilityTimeslotRepository: Repository<FacilityTimeslot>,
    @InjectRepository(FacilityTimeslotAssignment)
    private readonly facilityTimeslotAssignmentRepository: Repository<FacilityTimeslotAssignment>,
    @InjectRepository(PaymentType)
    private readonly paymentTypeRepository: Repository<PaymentType>,
    @InjectRepository(UserType)
    private readonly userTypeRepository: Repository<UserType>,
    @InjectRepository(InfractionCategory)
    private readonly infractionCategoryRepository: Repository<InfractionCategory>,
    @InjectRepository(TerminalGate)
    private readonly terminalGateRepository: Repository<TerminalGate>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    @InjectRepository(HandheldDevice)
    private readonly handheldDeviceRepository: Repository<HandheldDevice>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RfidTag)
    private readonly rfidTagRepository: Repository<RfidTag>,
  ) {}

  // Trucks
  async createTruckType(dto: CreateTruckTypeDto) {
    return this.createEntity(
      this.truckTypeRepository,
      dto,
      'Truck type already exists',
    );
  }

  async findTruckTypes(query: QueryAppOptionsDto) {
    const qb = this.truckTypeRepository.createQueryBuilder('row');
    this.applyCommonFilters(qb, query, ['row.name', 'row.description']);
    qb.orderBy('row.name', 'ASC');
    return this.paginateQueryBuilder(qb, query);
  }

  async findTruckType(id: string) {
    return this.requireEntity(this.truckTypeRepository, id, 'Truck type not found');
  }

  async updateTruckType(id: string, dto: UpdateTruckTypeDto) {
    return this.updateEntity(
      this.truckTypeRepository,
      id,
      dto,
      'Truck type not found',
      'Truck type already exists',
    );
  }

  async deleteTruckType(id: string) {
    return this.deleteEntity(this.truckTypeRepository, id, 'Truck type not found');
  }

  async createTruckCapacity(dto: CreateTruckCapacityDto) {
    await this.requireEntity(
      this.truckTypeRepository,
      dto.truck_type_id,
      'Linked truck type not found',
    );
    return this.createEntity(
      this.truckCapacityRepository,
      dto,
      'Truck capacity already exists for this truck type',
    );
  }

  async findTruckCapacities(query: QueryAppOptionsDto) {
    const qb = this.truckCapacityRepository
      .createQueryBuilder('row')
      .leftJoinAndSelect('row.truck_type', 'truckType');
    this.applyCommonFilters(qb, query, ['row.capacity_value', 'truckType.name']);
    qb.orderBy('row.capacity_value', 'ASC');
    return this.paginateQueryBuilder(qb, query);
  }

  async findTruckCapacity(id: string) {
    const item = await this.truckCapacityRepository.findOne({
      where: { id },
      relations: ['truck_type'],
    });
    if (!item) throw new NotFoundException('Truck capacity not found');
    return item;
  }

  async updateTruckCapacity(id: string, dto: UpdateTruckCapacityDto) {
    if (dto.truck_type_id) {
      await this.requireEntity(
        this.truckTypeRepository,
        dto.truck_type_id,
        'Linked truck type not found',
      );
    }
    return this.updateEntity(
      this.truckCapacityRepository,
      id,
      dto,
      'Truck capacity not found',
      'Truck capacity already exists for this truck type',
    );
  }

  async deleteTruckCapacity(id: string) {
    return this.deleteEntity(
      this.truckCapacityRepository,
      id,
      'Truck capacity not found',
    );
  }

  async createTruckLength(dto: CreateTruckLengthDto) {
    await this.requireEntity(
      this.truckTypeRepository,
      dto.truck_type_id,
      'Linked truck type not found',
    );
    return this.createEntity(
      this.truckLengthRepository,
      dto,
      'Truck length already exists for this truck type',
    );
  }

  async findTruckLengths(query: QueryAppOptionsDto) {
    const qb = this.truckLengthRepository
      .createQueryBuilder('row')
      .leftJoinAndSelect('row.truck_type', 'truckType');
    this.applyCommonFilters(qb, query, ['row.length_value', 'truckType.name']);
    qb.orderBy('row.length_value', 'ASC');
    return this.paginateQueryBuilder(qb, query);
  }

  async findTruckLength(id: string) {
    const item = await this.truckLengthRepository.findOne({
      where: { id },
      relations: ['truck_type'],
    });
    if (!item) throw new NotFoundException('Truck length not found');
    return item;
  }

  async updateTruckLength(id: string, dto: UpdateTruckLengthDto) {
    if (dto.truck_type_id) {
      await this.requireEntity(
        this.truckTypeRepository,
        dto.truck_type_id,
        'Linked truck type not found',
      );
    }
    return this.updateEntity(
      this.truckLengthRepository,
      id,
      dto,
      'Truck length not found',
      'Truck length already exists for this truck type',
    );
  }

  async deleteTruckLength(id: string) {
    return this.deleteEntity(this.truckLengthRepository, id, 'Truck length not found');
  }

  // Booking categories
  async createBookingCategory(dto: CreateBookingCategoryDto) {
    return this.createEntity(
      this.bookingCategoryRepository,
      dto,
      'Booking category already exists',
    );
  }

  async findBookingCategories(query: QueryAppOptionsDto) {
    const qb = this.bookingCategoryRepository.createQueryBuilder('row');
    this.applyCommonFilters(qb, query, ['row.name']);
    qb.orderBy('row.name', 'ASC');
    return this.paginateQueryBuilder(qb, query);
  }

  async findBookingCategory(id: string) {
    return this.requireEntity(
      this.bookingCategoryRepository,
      id,
      'Booking category not found',
    );
  }

  async updateBookingCategory(id: string, dto: UpdateBookingCategoryDto) {
    return this.updateEntity(
      this.bookingCategoryRepository,
      id,
      dto,
      'Booking category not found',
      'Booking category already exists',
    );
  }

  async deleteBookingCategory(id: string) {
    return this.deleteEntity(
      this.bookingCategoryRepository,
      id,
      'Booking category not found',
    );
  }

  // TEP types
  async createTepType(dto: CreateTepTypeDto) {
    await this.ensureIdsExist(
      this.bookingCategoryRepository,
      dto.booking_category_ids,
      'One or more booking categories were not found',
    );
    await this.ensureIdsExist(
      this.truckTypeRepository,
      dto.truck_type_ids,
      'One or more truck types were not found',
    );

    return this.dataSource.transaction(async (manager) => {
      const created = await manager.save(TepType, {
        name: dto.name,
        status: dto.status ?? 'ACTIVE',
      });

      await manager.save(
        TepTypeBookingCategory,
        dto.booking_category_ids.map((bookingCategoryId) => ({
          tep_type_id: created.id,
          booking_category_id: bookingCategoryId,
        })),
      );
      await manager.save(
        TepTypeTruckType,
        dto.truck_type_ids.map((truckTypeId) => ({
          tep_type_id: created.id,
          truck_type_id: truckTypeId,
        })),
      );
      return this.findTepTypeWithRelations(manager, created.id);
    });
  }

  async findTepTypes(query: QueryAppOptionsDto) {
    const qb = this.tepTypeRepository.createQueryBuilder('row');
    this.applyCommonFilters(qb, query, ['row.name']);
    qb.orderBy('row.name', 'ASC');
    const { data, meta } = await this.paginateQueryBuilder(qb, query);
    const detailed = await Promise.all(
      data.map((row: TepType) =>
        this.findTepTypeWithRelations(this.dataSource.manager, row.id),
      ),
    );
    return { data: detailed, meta };
  }

  async findTepType(id: string) {
    const tepType = await this.findTepTypeWithRelations(this.dataSource.manager, id);
    if (!tepType) throw new NotFoundException('TEP type not found');
    return tepType;
  }

  async updateTepType(id: string, dto: UpdateTepTypeDto) {
    await this.requireEntity(this.tepTypeRepository, id, 'TEP type not found');
    if (dto.booking_category_ids) {
      await this.ensureIdsExist(
        this.bookingCategoryRepository,
        dto.booking_category_ids,
        'One or more booking categories were not found',
      );
    }
    if (dto.truck_type_ids) {
      await this.ensureIdsExist(
        this.truckTypeRepository,
        dto.truck_type_ids,
        'One or more truck types were not found',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.update(TepType, { id }, this.cleanUndefined(dto));

      if (dto.booking_category_ids) {
        await manager.delete(TepTypeBookingCategory, { tep_type_id: id });
        await manager.save(
          TepTypeBookingCategory,
          dto.booking_category_ids.map((bookingCategoryId) => ({
            tep_type_id: id,
            booking_category_id: bookingCategoryId,
          })),
        );
      }
      if (dto.truck_type_ids) {
        await manager.delete(TepTypeTruckType, { tep_type_id: id });
        await manager.save(
          TepTypeTruckType,
          dto.truck_type_ids.map((truckTypeId) => ({
            tep_type_id: id,
            truck_type_id: truckTypeId,
          })),
        );
      }
      return this.findTepTypeWithRelations(manager, id);
    });
  }

  async deleteTepType(id: string) {
    return this.deleteEntity(this.tepTypeRepository, id, 'TEP type not found');
  }

  // Park types
  async createParkType(dto: CreateParkTypeDto) {
    return this.createEntity(this.parkTypeRepository, dto, 'Park type already exists');
  }

  async findParkTypes(query: QueryAppOptionsDto) {
    const qb = this.parkTypeRepository.createQueryBuilder('row');
    this.applyCommonFilters(qb, query, ['row.name']);
    qb.orderBy('row.name', 'ASC');
    return this.paginateQueryBuilder(qb, query);
  }

  async findParkType(id: string) {
    return this.requireEntity(this.parkTypeRepository, id, 'Park type not found');
  }

  async updateParkType(id: string, dto: UpdateParkTypeDto) {
    return this.updateEntity(
      this.parkTypeRepository,
      id,
      dto,
      'Park type not found',
      'Park type already exists',
    );
  }

  async deleteParkType(id: string) {
    return this.deleteEntity(this.parkTypeRepository, id, 'Park type not found');
  }

  // Facility types
  async createFacilityType(dto: CreateFacilityTypeDto) {
    await this.ensureIdsExist(
      this.parkTypeRepository,
      dto.park_type_ids,
      'One or more park types were not found',
    );

    return this.dataSource.transaction(async (manager) => {
      const created = await manager.save(FacilityType, {
        name: dto.name,
        status: dto.status ?? 'ACTIVE',
      });
      await manager.save(
        FacilityTypeParkType,
        dto.park_type_ids.map((parkTypeId) => ({
          facility_type_id: created.id,
          park_type_id: parkTypeId,
        })),
      );
      return this.findFacilityTypeWithRelations(manager, created.id);
    });
  }

  async findFacilityTypes(query: QueryAppOptionsDto) {
    const qb = this.facilityTypeRepository.createQueryBuilder('row');
    this.applyCommonFilters(qb, query, ['row.name']);
    qb.orderBy('row.name', 'ASC');
    const { data, meta } = await this.paginateQueryBuilder(qb, query);
    const detailed = await Promise.all(
      data.map((row: FacilityType) =>
        this.findFacilityTypeWithRelations(this.dataSource.manager, row.id),
      ),
    );
    return { data: detailed, meta };
  }

  async findFacilityType(id: string) {
    const item = await this.findFacilityTypeWithRelations(this.dataSource.manager, id);
    if (!item) throw new NotFoundException('Facility type not found');
    return item;
  }

  async updateFacilityType(id: string, dto: UpdateFacilityTypeDto) {
    await this.requireEntity(this.facilityTypeRepository, id, 'Facility type not found');
    if (dto.park_type_ids) {
      await this.ensureIdsExist(
        this.parkTypeRepository,
        dto.park_type_ids,
        'One or more park types were not found',
      );
    }
    return this.dataSource.transaction(async (manager) => {
      await manager.update(FacilityType, { id }, this.cleanUndefined(dto));
      if (dto.park_type_ids) {
        await manager.delete(FacilityTypeParkType, { facility_type_id: id });
        await manager.save(
          FacilityTypeParkType,
          dto.park_type_ids.map((parkTypeId) => ({
            facility_type_id: id,
            park_type_id: parkTypeId,
          })),
        );
      }
      return this.findFacilityTypeWithRelations(manager, id);
    });
  }

  async deleteFacilityType(id: string) {
    return this.deleteEntity(this.facilityTypeRepository, id, 'Facility type not found');
  }

  // Facility timeslots and assignments
  async createFacilityTimeslot(dto: CreateFacilityTimeslotDto) {
    return this.createEntity(
      this.facilityTimeslotRepository,
      dto,
      'Facility timeslot already exists',
    );
  }

  async findFacilityTimeslots(query: QueryAppOptionsDto) {
    const qb = this.facilityTimeslotRepository.createQueryBuilder('row');
    this.applyCommonFilters(qb, query, ['row.name']);
    qb.orderBy('row.start_time', 'ASC');
    return this.paginateQueryBuilder(qb, query);
  }

  async findFacilityTimeslot(id: string) {
    return this.requireEntity(
      this.facilityTimeslotRepository,
      id,
      'Facility timeslot not found',
    );
  }

  async updateFacilityTimeslot(id: string, dto: UpdateFacilityTimeslotDto) {
    return this.updateEntity(
      this.facilityTimeslotRepository,
      id,
      dto,
      'Facility timeslot not found',
      'Facility timeslot already exists',
    );
  }

  async deleteFacilityTimeslot(id: string) {
    return this.deleteEntity(
      this.facilityTimeslotRepository,
      id,
      'Facility timeslot not found',
    );
  }

  async createLocation(dto: CreateLocationDto) {
    const location = await this.createEntity(
      this.locationRepository,
      dto,
      'Location already exists',
    );

    if (location.type === 'FACILITY') {
      await this.assignAllTimeslotsToFacility(location.id);
    }
    return this.findLocation(location.id);
  }

  async findLocations(query: QueryAppOptionsDto) {
    const qb = this.locationRepository.createQueryBuilder('row');
    this.applyCommonFilters(qb, query, ['row.name', 'row.type']);
    if (query.type?.trim()) {
      qb.andWhere('row.type = :type', { type: query.type.trim() });
    }
    qb.orderBy('row.name', 'ASC');
    return this.paginateQueryBuilder(qb, query);
  }

  async findLocation(id: string) {
    return this.requireEntity(this.locationRepository, id, 'Location not found');
  }

  async updateLocation(id: string, dto: UpdateLocationDto) {
    const before = await this.requireEntity(
      this.locationRepository,
      id,
      'Location not found',
    );
    const updated = await this.updateEntity(
      this.locationRepository,
      id,
      dto,
      'Location not found',
      'Location already exists',
    );
    const nextType = dto.type ?? before.type;
    if (nextType === 'FACILITY') {
      await this.assignAllTimeslotsToFacility(id);
    }
    return updated;
  }

  async deleteLocation(id: string) {
    return this.deleteEntity(this.locationRepository, id, 'Location not found');
  }

  async listFacilityTimeslotAssignments(
    facilityId: string,
    query: QueryAppOptionsDto,
  ) {
    await this.requireEntity(this.locationRepository, facilityId, 'Location not found');
    const qb = this.facilityTimeslotAssignmentRepository
      .createQueryBuilder('row')
      .leftJoinAndSelect('row.timeslot', 'timeslot')
      .where('row.facility_id = :facilityId', { facilityId });

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

  async updateFacilityTimeslotAssignment(
    id: string,
    dto: UpdateFacilityTimeslotAssignmentDto,
  ) {
    return this.updateEntity(
      this.facilityTimeslotAssignmentRepository,
      id,
      dto,
      'Facility timeslot assignment not found',
      undefined,
    );
  }

  // Payments
  async createPaymentType(dto: CreatePaymentTypeDto) {
    await this.requireEntity(
      this.userTypeRepository,
      dto.charged_to_user_type_id,
      'Charged-to user type not found',
    );
    this.validatePaymentAmount(dto.amount_type, dto.amount);

    const payload = {
      ...dto,
      amount: dto.amount_type === 'DYNAMIC' ? null : dto.amount,
      status: dto.status ?? 'ACTIVE',
    };
    return this.createEntity(
      this.paymentTypeRepository,
      payload,
      'Payment type already exists',
    );
  }

  async findPaymentTypes(query: QueryAppOptionsDto) {
    const qb = this.paymentTypeRepository
      .createQueryBuilder('row')
      .leftJoinAndSelect('row.charged_to_user_type', 'chargedToUserType');
    this.applyCommonFilters(qb, query, [
      'row.name',
      'row.service_name',
      'row.linked_form',
      'row.revenue_event_trigger',
      'chargedToUserType.name',
    ]);
    qb.orderBy('row.name', 'ASC');
    return this.paginateQueryBuilder(qb, query);
  }

  async findPaymentType(id: string) {
    const item = await this.paymentTypeRepository.findOne({
      where: { id },
      relations: ['charged_to_user_type'],
    });
    if (!item) throw new NotFoundException('Payment type not found');
    return item;
  }

  async updatePaymentType(id: string, dto: UpdatePaymentTypeDto) {
    if (dto.charged_to_user_type_id) {
      await this.requireEntity(
        this.userTypeRepository,
        dto.charged_to_user_type_id,
        'Charged-to user type not found',
      );
    }
    const current = await this.requireEntity(
      this.paymentTypeRepository,
      id,
      'Payment type not found',
    );
    const nextType = dto.amount_type ?? current.amount_type;
    const nextAmount = dto.amount ?? (current.amount ? Number(current.amount) : undefined);
    this.validatePaymentAmount(nextType, nextAmount);

    const payload: Record<string, unknown> = this.cleanUndefined(dto);
    if (nextType === 'DYNAMIC') payload.amount = null;

    return this.updateEntity(
      this.paymentTypeRepository,
      id,
      payload,
      'Payment type not found',
      'Payment type already exists',
    );
  }

  async deletePaymentType(id: string) {
    return this.deleteEntity(this.paymentTypeRepository, id, 'Payment type not found');
  }

  // Infractions
  async createInfractionCategory(dto: CreateInfractionCategoryDto) {
    return this.createEntity(
      this.infractionCategoryRepository,
      dto,
      'Infraction category already exists',
    );
  }

  async findInfractionCategories(query: QueryAppOptionsDto) {
    const qb = this.infractionCategoryRepository.createQueryBuilder('row');
    this.applyCommonFilters(qb, query, ['row.name']);
    qb.orderBy('row.name', 'ASC');
    return this.paginateQueryBuilder(qb, query);
  }

  async findInfractionCategory(id: string) {
    return this.requireEntity(
      this.infractionCategoryRepository,
      id,
      'Infraction category not found',
    );
  }

  async updateInfractionCategory(id: string, dto: UpdateInfractionCategoryDto) {
    return this.updateEntity(
      this.infractionCategoryRepository,
      id,
      dto,
      'Infraction category not found',
      'Infraction category already exists',
    );
  }

  async deleteInfractionCategory(id: string) {
    return this.deleteEntity(
      this.infractionCategoryRepository,
      id,
      'Infraction category not found',
    );
  }

  // Terminal gates
  async createTerminalGate(dto: CreateTerminalGateDto) {
    return this.createEntity(
      this.terminalGateRepository,
      dto,
      'Entry or exit barrier already exists',
    );
  }

  async findTerminalGates(query: QueryAppOptionsDto) {
    const qb = this.terminalGateRepository.createQueryBuilder('row');
    this.applyCommonFilters(qb, query, [
      'row.location',
      'row.entry_barrier_name',
      'row.entry_barrier_id',
      'row.exit_barrier_name',
      'row.exit_barrier_id',
    ]);
    qb.orderBy('row.location', 'ASC');
    return this.paginateQueryBuilder(qb, query);
  }

  async findTerminalGate(id: string) {
    return this.requireEntity(this.terminalGateRepository, id, 'Terminal gate not found');
  }

  async updateTerminalGate(id: string, dto: UpdateTerminalGateDto) {
    return this.updateEntity(
      this.terminalGateRepository,
      id,
      dto,
      'Terminal gate not found',
      'Entry or exit barrier already exists',
    );
  }

  async deleteTerminalGate(id: string) {
    return this.deleteEntity(this.terminalGateRepository, id, 'Terminal gate not found');
  }

  // Handheld devices
  async createHandheldDevice(dto: CreateHandheldDeviceDto) {
    await this.requireEntity(this.locationRepository, dto.location_id, 'Location not found');
    if (dto.user_id) {
      await this.requireEntity(this.userRepository, dto.user_id, 'Linked user not found');
    }
    return this.createEntity(
      this.handheldDeviceRepository,
      dto,
      'Handheld device already exists',
    );
  }

  async findHandheldDevices(query: QueryAppOptionsDto) {
    const qb = this.handheldDeviceRepository
      .createQueryBuilder('row')
      .leftJoinAndSelect('row.location', 'location')
      .leftJoinAndSelect('row.user', 'user');
    this.applyCommonFilters(qb, query, [
      'row.name',
      'row.status',
      'location.name',
      'user.first_name',
      'user.last_name',
      'user.email',
    ]);
    qb.orderBy('row.name', 'ASC');
    return this.paginateQueryBuilder(qb, query);
  }

  async findHandheldDevice(id: string) {
    const item = await this.handheldDeviceRepository.findOne({
      where: { id },
      relations: ['location', 'user'],
    });
    if (!item) throw new NotFoundException('Handheld device not found');
    return item;
  }

  async updateHandheldDevice(id: string, dto: UpdateHandheldDeviceDto) {
    if (dto.location_id) {
      await this.requireEntity(this.locationRepository, dto.location_id, 'Location not found');
    }
    if (dto.user_id) {
      await this.requireEntity(this.userRepository, dto.user_id, 'Linked user not found');
    }
    return this.updateEntity(
      this.handheldDeviceRepository,
      id,
      dto,
      'Handheld device not found',
      'Handheld device already exists',
    );
  }

  async deleteHandheldDevice(id: string) {
    return this.deleteEntity(
      this.handheldDeviceRepository,
      id,
      'Handheld device not found',
    );
  }

  // RFID tags
  async createRfidTag(dto: CreateRfidTagDto) {
    const tag = this.rfidTagRepository.create({
      ...dto,
      status: dto.status ?? 'ACTIVE',
      etss_tag_number: await this.nextEtssTagNumber(),
    });
    return this.saveWithConflictMessage(
      this.rfidTagRepository,
      tag,
      'RFID tag number already exists',
    );
  }

  async findRfidTags(query: QueryAppOptionsDto) {
    const qb = this.rfidTagRepository.createQueryBuilder('row');
    this.applyCommonFilters(qb, query, [
      'row.rfid_tag_number',
      'row.etss_tag_number',
      'row.transporter_name',
    ]);
    qb.orderBy('row.created_at', 'DESC');
    return this.paginateQueryBuilder(qb, query);
  }

  async findRfidTag(id: string) {
    return this.requireEntity(this.rfidTagRepository, id, 'RFID tag not found');
  }

  async updateRfidTag(id: string, dto: UpdateRfidTagDto) {
    return this.updateEntity(
      this.rfidTagRepository,
      id,
      dto,
      'RFID tag not found',
      undefined,
    );
  }

  async deleteRfidTag(id: string) {
    return this.deleteEntity(this.rfidTagRepository, id, 'RFID tag not found');
  }

  async bulkUploadRfidTags(file: any) {
    if (!file) {
      throw new BadRequestException('File upload is required');
    }

    const values = await this.extractRfidNumbersFromFile(file);
    if (!values.length) {
      throw new BadRequestException('No RFID tag numbers found in file');
    }

    const uniqueValues = Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
    let createdCount = 0;
    let skippedCount = 0;

    await this.dataSource.transaction(async (manager) => {
      for (const rfidTagNumber of uniqueValues) {
        const existing = await manager.findOne(RfidTag, {
          where: { rfid_tag_number: rfidTagNumber },
        });
        if (existing) {
          skippedCount += 1;
          continue;
        }
        const created = manager.create(RfidTag, {
          rfid_tag_number: rfidTagNumber,
          status: 'ACTIVE',
          etss_tag_number: await this.nextEtssTagNumber(manager),
        });
        await manager.save(RfidTag, created);
        createdCount += 1;
      }
    });

    return {
      total_input: uniqueValues.length,
      created_count: createdCount,
      skipped_count: skippedCount,
    };
  }

  // Helpers
  private applyCommonFilters(
    qb: SelectQueryBuilder<any>,
    query: QueryAppOptionsDto,
    searchColumns: string[],
  ) {
    if (query.status?.trim()) {
      qb.andWhere('row.status = :status', { status: query.status.trim() });
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
    query: QueryAppOptionsDto,
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

  private async findTepTypeWithRelations(manager: DataSource['manager'], id: string) {
    const tepType = await manager.findOne(TepType, { where: { id } });
    if (!tepType) return null;

    const bookingLinks = await manager.find(TepTypeBookingCategory, {
      where: { tep_type_id: id },
      relations: ['booking_category'],
    });
    const truckLinks = await manager.find(TepTypeTruckType, {
      where: { tep_type_id: id },
      relations: ['truck_type'],
    });

    return {
      ...tepType,
      booking_categories: bookingLinks.map((link) => link.booking_category),
      truck_types: truckLinks.map((link) => link.truck_type),
    };
  }

  private async findFacilityTypeWithRelations(
    manager: DataSource['manager'],
    id: string,
  ) {
    const facilityType = await manager.findOne(FacilityType, { where: { id } });
    if (!facilityType) return null;
    const links = await manager.find(FacilityTypeParkType, {
      where: { facility_type_id: id },
      relations: ['park_type'],
    });
    return {
      ...facilityType,
      park_types: links.map((link) => link.park_type),
    };
  }

  private async assignAllTimeslotsToFacility(locationId: string) {
    const timeslots = await this.facilityTimeslotRepository.find();
    if (!timeslots.length) return;

    await this.dataSource.transaction(async (manager) => {
      for (const timeslot of timeslots) {
        const existing = await manager.findOne(FacilityTimeslotAssignment, {
          where: { facility_id: locationId, timeslot_id: timeslot.id },
        });
        if (existing) continue;

        await manager.save(FacilityTimeslotAssignment, {
          facility_id: locationId,
          timeslot_id: timeslot.id,
          is_active: true,
        });
      }
    });
  }

  private validatePaymentAmount(amountType: string, amount?: number) {
    if (amountType === 'FIXED' && (amount == null || Number.isNaN(amount))) {
      throw new BadRequestException('Amount is required when amount_type is FIXED');
    }
  }

  private async nextEtssTagNumber(manager = this.dataSource.manager): Promise<string> {
    const raw = await manager
      .createQueryBuilder(RfidTag, 'tag')
      .select(`MAX(CAST(SUBSTRING(tag.etss_tag_number FROM 6) AS INTEGER))`, 'max')
      .where(`tag.etss_tag_number ~ '^ETSS-[0-9]+$'`)
      .getRawOne<{ max: string | null }>();

    const next = (raw?.max ? Number(raw.max) : 0) + 1;
    return `ETSS-${String(next).padStart(6, '0')}`;
  }

  private async extractRfidNumbersFromFile(
    file: any,
  ): Promise<string[]> {
    const fileName = file.originalname.toLowerCase();
    if (fileName.endsWith('.csv')) {
      const text = file.buffer.toString('utf-8');
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length <= 1) return [];
      return lines.slice(1).map((line) => line.split(',')[0] ?? '');
    }

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) return [];

      const values: string[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const first = row.getCell(1).text?.trim();
        if (first) values.push(first);
      });
      return values;
    }

    throw new BadRequestException('Only CSV and Excel files are supported');
  }

  private async ensureIdsExist<T extends { id: string }>(
    repository: Repository<T>,
    ids: string[],
    notFoundMessage: string,
  ) {
    const unique = Array.from(new Set(ids));
    const rows = await repository.find({
      where: { id: In(unique) } as any,
    });
    if (rows.length !== unique.length) {
      throw new BadRequestException(notFoundMessage);
    }
  }

  private async createEntity(
    repository: Repository<any>,
    payload: DeepPartial<any>,
    conflictMessage: string,
  ): Promise<any> {
    const entity = repository.create(payload);
    return this.saveWithConflictMessage(repository, entity, conflictMessage);
  }

  private async updateEntity(
    repository: Repository<any>,
    id: string,
    payload: any,
    notFoundMessage: string,
    conflictMessage?: string,
  ): Promise<any> {
    const entity = await repository.findOne({ where: { id } as any });
    if (!entity) throw new NotFoundException(notFoundMessage);
    Object.assign(entity, this.cleanUndefined(payload));
    return this.saveWithConflictMessage(repository, entity, conflictMessage);
  }

  private async deleteEntity(
    repository: Repository<any>,
    id: string,
    notFoundMessage: string,
  ) {
    const entity = await repository.findOne({ where: { id } as any });
    if (!entity) throw new NotFoundException(notFoundMessage);
    await repository.remove(entity);
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
