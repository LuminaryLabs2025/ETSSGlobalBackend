import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  Company,
  Truck,
  TruckCapacity,
  TruckLength,
  TruckPenalty,
  TruckType,
  User,
} from '../../database/entities';
import {
  BulkCreateTrucksDto,
  CreateTruckDto,
  QueryTrucksDto,
  ReasonDto,
} from './dto/operations.dto';
import {
  applySearch,
  applyTruckCategoryFilter,
  mapTruckResponse,
  paginateQueryBuilder,
  requireEntity,
  saveWithConflict,
  toCsv,
} from './operations-shared';

@Injectable()
export class TrucksService {
  constructor(
    @InjectRepository(Truck)
    private readonly truckRepository: Repository<Truck>,
    @InjectRepository(TruckType)
    private readonly truckTypeRepository: Repository<TruckType>,
    @InjectRepository(TruckLength)
    private readonly truckLengthRepository: Repository<TruckLength>,
    @InjectRepository(TruckCapacity)
    private readonly truckCapacityRepository: Repository<TruckCapacity>,
    @InjectRepository(TruckPenalty)
    private readonly penaltyRepository: Repository<TruckPenalty>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findTrucks(query: QueryTrucksDto) {
    const qb = this.truckRepository
      .createQueryBuilder('row')
      .leftJoinAndSelect('row.truck_type', 'truckType')
      .leftJoinAndSelect('row.truck_length', 'truckLength')
      .leftJoinAndSelect('row.truck_capacity', 'truckCapacity');
    applyTruckCategoryFilter(qb, query.category);
    applySearch(
      qb,
      'row',
      [
        'plate_number',
        'chassis_number',
        'registered_by_company_name',
        'mss_verification_number',
        'brand',
      ],
      query.search,
    );

    if (
      query.registration_status?.trim() &&
      query.registration_status !== 'All'
    ) {
      qb.andWhere('row.registration_status = :rs', {
        rs: query.registration_status.trim(),
      });
    }
    if (query.truck_status?.trim() && query.truck_status !== 'All') {
      qb.andWhere('row.truck_status = :ts', { ts: query.truck_status.trim() });
    }
    if (query.truck_type_id) {
      qb.andWhere('row.truck_type_id = :truckTypeId', {
        truckTypeId: query.truck_type_id,
      });
    }
    if (query.visibility?.trim() && query.visibility !== 'All') {
      qb.andWhere('row.visibility = :vis', { vis: query.visibility.trim() });
    }

    if (query.penalty_type?.trim() && query.penalty_type !== 'All') {
      qb.innerJoin(
        'truck_penalties',
        'pen',
        'pen.truck_id = row.id AND pen.penalty_type = :pt',
        { pt: query.penalty_type.trim() },
      );
    }
    if (query.payment_status?.trim() && query.payment_status !== 'All') {
      qb.innerJoin(
        'truck_penalties',
        'pen2',
        'pen2.truck_id = row.id AND pen2.payment_status = :ps',
        { ps: query.payment_status.trim() },
      );
    }

    qb.orderBy('row.created_at', 'DESC');
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const result = await paginateQueryBuilder(qb, page, limit);
    const penalties = await this.activePenaltiesForTrucks(
      result.data.map((t) => t.id),
    );
    return {
      data: result.data.map((t) => mapTruckResponse(t, penalties.get(t.id))),
      meta: result.meta,
    };
  }

  async trucksSummary() {
    const stats = await this.truckRepository
      .createQueryBuilder('row')
      .select('COUNT(*)', 'total')
      .addSelect(
        `COUNT(*) FILTER (WHERE row.registration_status = 'MSS_VERIFIED')`,
        'mss_verified',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.registration_status = 'UNVERIFIED')`,
        'unverified',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.registration_status = 'VERIFICATION_REQUESTED')`,
        'verification_requested',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.registration_status = 'FLAGGED')`,
        'flagged',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.registration_status = 'DISABLED')`,
        'disabled',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.registration_status = 'ARCHIVED')`,
        'archived',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.truck_status = 'AVAILABLE')`,
        'available',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.truck_status = 'ON_TRIP')`,
        'on_trip',
      )
      .where('row.registration_status != :archived', { archived: 'ARCHIVED' })
      .getRawOne<Record<string, string>>();

    return {
      total: Number(stats?.total ?? 0),
      mss_verified: Number(stats?.mss_verified ?? 0),
      unverified: Number(stats?.unverified ?? 0),
      verification_requested: Number(stats?.verification_requested ?? 0),
      flagged: Number(stats?.flagged ?? 0),
      disabled: Number(stats?.disabled ?? 0),
      archived: Number(stats?.archived ?? 0),
      available: Number(stats?.available ?? 0),
      on_trip: Number(stats?.on_trip ?? 0),
    };
  }

  async findTruck(id: string) {
    const truck = await this.requireTruck(id);
    const penalty = await this.activePenaltyForTruck(id);
    return mapTruckResponse(truck, penalty);
  }

  async createTruck(dto: CreateTruckDto, userId: string) {
    const company = await requireEntity(
      this.companyRepository,
      dto.transporter_company_id,
      'Transporter company not found',
    );
    await requireEntity(
      this.truckTypeRepository,
      dto.truck_type_id,
      'Truck type not found',
    );
    await this.assertLengthBelongsToType(dto.truck_length_id, dto.truck_type_id);
    await this.assertCapacityBelongsToType(
      dto.truck_capacity_id,
      dto.truck_type_id,
    );

    const user = await this.userRepository.findOne({ where: { id: userId } });
    const truck = this.truckRepository.create({
      plate_number: dto.plate_number,
      truck_type_id: dto.truck_type_id,
      color: dto.color ?? null,
      chassis_number: dto.chassis_number ?? null,
      brand: dto.brand ?? null,
      model: dto.model ?? null,
      truck_length_id: dto.truck_length_id ?? null,
      truck_capacity_id: dto.truck_capacity_id ?? null,
      registration_status: 'UNVERIFIED',
      visibility: dto.visibility ?? 'PRIVATE',
      transporter_company_id: company.id,
      registered_by_company_name: company.name,
      registered_by_user_name: user
        ? `${user.first_name} ${user.last_name}`
        : 'SuperAdmin',
      created_by: userId,
    });
    const saved = await saveWithConflict(
      this.truckRepository,
      truck,
      'A truck with this plate number already exists',
    );
    return mapTruckResponse(await this.requireTruck(saved.id));
  }

  async bulkCreateTrucks(dto: BulkCreateTrucksDto, userId: string) {
    const created: Record<string, unknown>[] = [];
    for (const item of dto.trucks) {
      created.push(
        await this.createTruck(
          { ...item, transporter_company_id: dto.transporter_company_id },
          userId,
        ),
      );
    }
    return { created: created.length, trucks: created };
  }

  async disableTruck(id: string, dto: ReasonDto, actorName: string) {
    const truck = await this.requireTruck(id);
    truck.registration_status = 'DISABLED';
    truck.disabled_by = actorName;
    truck.disable_reason = dto.reason;
    truck.disable_timestamp = new Date();
    truck.truck_status = null;
    const saved = await this.truckRepository.save(truck);
    return mapTruckResponse(await this.requireTruck(saved.id));
  }

  async archiveTruck(id: string) {
    const truck = await this.requireTruck(id);
    truck.registration_status = 'ARCHIVED';
    const saved = await this.truckRepository.save(truck);
    return mapTruckResponse(await this.requireTruck(saved.id));
  }

  async requestVerification(id: string) {
    const truck = await this.requireTruck(id);
    if (truck.registration_status !== 'UNVERIFIED') {
      throw new BadRequestException(
        'Only unverified trucks can request MSS verification',
      );
    }
    truck.registration_status = 'VERIFICATION_REQUESTED';
    const saved = await this.truckRepository.save(truck);
    return mapTruckResponse(await this.requireTruck(saved.id));
  }

  async overridePenalty(id: string, dto: ReasonDto, actorName: string) {
    const truck = await this.requireTruck(id);
    const penalty = await this.activePenaltyForTruck(id);
    if (!penalty) {
      throw new BadRequestException('No active penalty found for this truck');
    }
    penalty.payment_status = 'OVERRIDDEN';
    penalty.overridden_by = actorName;
    penalty.override_reason = dto.reason;
    await this.penaltyRepository.save(penalty);
    truck.registration_status = 'MSS_VERIFIED';
    const saved = await this.truckRepository.save(truck);
    return mapTruckResponse(await this.requireTruck(saved.id), penalty);
  }

  async reEnableTruck(id: string, dto: ReasonDto) {
    const truck = await this.requireTruck(id);
    if (truck.registration_status !== 'DISABLED') {
      throw new BadRequestException('Only disabled trucks can be re-enabled');
    }
    truck.registration_status = truck.mss_verification_number
      ? 'MSS_VERIFIED'
      : 'UNVERIFIED';
    truck.disabled_by = null;
    truck.disable_reason = null;
    truck.disable_timestamp = null;
    truck.truck_status = 'AVAILABLE';
    const saved = await this.truckRepository.save(truck);
    return mapTruckResponse(await this.requireTruck(saved.id));
  }

  async exportCsv(query: QueryTrucksDto): Promise<string> {
    const { data } = await this.findTrucks({ ...query, page: 1, limit: 10000 });
    const headers = [
      'Plate Number',
      'Truck Type',
      'Truck Length',
      'Truck Capacity',
      'Registration Status',
      'Truck Status',
      'Visibility',
      'MSS Verification Number',
      'Transporter',
      'Registered By',
      'Created At',
    ];
    const rows = data.map((t: any) => [
      t.plate_number,
      t.truck_type?.name ?? '',
      t.truck_length?.length_value ?? '',
      t.truck_capacity?.capacity_value ?? '',
      t.registration_status,
      t.truck_status ?? '',
      t.visibility,
      t.mss_verification_number ?? '',
      t.registered_by.company_name,
      t.registered_by.user_account,
      t.created_at,
    ]);
    return toCsv([headers, ...rows]);
  }

  private async assertLengthBelongsToType(
    lengthId: string | undefined,
    truckTypeId: string,
  ) {
    if (!lengthId) return;
    const length = await requireEntity(
      this.truckLengthRepository,
      lengthId,
      'Truck length not found',
    );
    if (length.truck_type_id !== truckTypeId) {
      throw new BadRequestException(
        'Truck length does not belong to the selected truck type',
      );
    }
  }

  private async assertCapacityBelongsToType(
    capacityId: string | undefined,
    truckTypeId: string,
  ) {
    if (!capacityId) return;
    const capacity = await requireEntity(
      this.truckCapacityRepository,
      capacityId,
      'Truck capacity not found',
    );
    if (capacity.truck_type_id !== truckTypeId) {
      throw new BadRequestException(
        'Truck capacity does not belong to the selected truck type',
      );
    }
  }

  private async requireTruck(id: string) {
    const truck = await this.truckRepository.findOne({
      where: { id },
      relations: ['truck_type', 'truck_length', 'truck_capacity'],
    });
    if (!truck) {
      throw new NotFoundException('Truck not found');
    }
    return truck;
  }

  private async activePenaltyForTruck(truckId: string) {
    return this.penaltyRepository.findOne({
      where: {
        truck_id: truckId,
        payment_status: In(['UNPAID', 'DISPUTED']),
      },
      order: { date_issued: 'DESC' },
    });
  }

  private async activePenaltiesForTrucks(truckIds: string[]) {
    const map = new Map<string, TruckPenalty>();
    if (!truckIds.length) return map;
    const penalties = await this.penaltyRepository.find({
      where: {
        truck_id: In(truckIds),
        payment_status: In(['UNPAID', 'DISPUTED']),
      },
      order: { date_issued: 'DESC' },
    });
    for (const p of penalties) {
      if (!map.has(p.truck_id)) map.set(p.truck_id, p);
    }
    return map;
  }
}
