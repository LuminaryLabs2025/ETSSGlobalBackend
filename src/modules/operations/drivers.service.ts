import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Company, Driver, DriverFlag, User } from '../../database/entities';
import {
  CreateDriverDto,
  QueryDriversDto,
  ReasonDto,
} from './dto/operations.dto';
import {
  applyDriverCategoryFilter,
  applySearch,
  mapDriverResponse,
  paginateQueryBuilder,
  requireEntity,
  saveWithConflict,
  toCsv,
} from './operations-shared';

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(DriverFlag)
    private readonly flagRepository: Repository<DriverFlag>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findDrivers(query: QueryDriversDto) {
    const qb = this.driverRepository.createQueryBuilder('row');
    applyDriverCategoryFilter(qb, query.category);
    applySearch(
      qb,
      'row',
      [
        'first_name',
        'last_name',
        'license_number',
        'mobile_number',
        'registered_by_company_name',
      ],
      query.search,
    );

    if (
      query.verification_status?.trim() &&
      query.verification_status !== 'All'
    ) {
      qb.andWhere('row.verification_status = :vs', {
        vs: query.verification_status.trim(),
      });
    }
    if (
      query.operational_status?.trim() &&
      query.operational_status !== 'All'
    ) {
      qb.andWhere('row.operational_status = :os', {
        os: query.operational_status.trim(),
      });
    }
    if (query.visibility?.trim() && query.visibility !== 'All') {
      qb.andWhere('row.visibility = :vis', { vis: query.visibility.trim() });
    }
    if (query.flag_type?.trim() && query.flag_type !== 'All') {
      qb.innerJoin(
        'driver_flags',
        'flg',
        'flg.driver_id = row.id AND flg.flag_type = :ft',
        { ft: query.flag_type.trim() },
      );
    }
    if (query.flag_status?.trim() && query.flag_status !== 'All') {
      qb.innerJoin(
        'driver_flags',
        'flg2',
        'flg2.driver_id = row.id AND flg2.flag_status = :fs',
        { fs: query.flag_status.trim() },
      );
    }

    qb.orderBy('row.created_at', 'DESC');
    const result = await paginateQueryBuilder(
      qb,
      query.page ?? 1,
      query.limit ?? 20,
    );
    const flags = await this.activeFlagsForDrivers(
      result.data.map((d) => d.id),
    );
    return {
      data: result.data.map((d) => mapDriverResponse(d, flags.get(d.id))),
      meta: result.meta,
    };
  }

  async driversSummary() {
    const stats = await this.driverRepository
      .createQueryBuilder('row')
      .select('COUNT(*)', 'total')
      .addSelect(
        `COUNT(*) FILTER (WHERE row.verification_status = 'VERIFIED')`,
        'verified',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.verification_status = 'UNVERIFIED')`,
        'unverified',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.verification_status = 'VERIFICATION_IN_PROGRESS')`,
        'verification_in_progress',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.verification_status = 'FLAGGED')`,
        'flagged',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.verification_status = 'DISABLED')`,
        'disabled',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.verification_status = 'ARCHIVED')`,
        'archived',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.operational_status = 'AVAILABLE')`,
        'available',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.operational_status = 'ON_TRIP')`,
        'on_trip',
      )
      .where('row.verification_status != :archived', { archived: 'ARCHIVED' })
      .getRawOne<Record<string, string>>();

    return {
      total: Number(stats?.total ?? 0),
      verified: Number(stats?.verified ?? 0),
      unverified: Number(stats?.unverified ?? 0),
      verification_in_progress: Number(stats?.verification_in_progress ?? 0),
      flagged: Number(stats?.flagged ?? 0),
      disabled: Number(stats?.disabled ?? 0),
      archived: Number(stats?.archived ?? 0),
      available: Number(stats?.available ?? 0),
      on_trip: Number(stats?.on_trip ?? 0),
    };
  }

  async findDriver(id: string) {
    const driver = await requireEntity(
      this.driverRepository,
      id,
      'Driver not found',
    );
    const flag = await this.activeFlagForDriver(id);
    return mapDriverResponse(driver, flag);
  }

  async createDriver(dto: CreateDriverDto, userId: string) {
    const company = await requireEntity(
      this.companyRepository,
      dto.transporter_company_id,
      'Transporter company not found',
    );
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const driver = this.driverRepository.create({
      ...dto,
      verification_status: 'UNVERIFIED',
      visibility: dto.visibility ?? 'PRIVATE',
      transporter_company_id: company.id,
      registered_by_company_name: company.name,
      registered_by_user_name: user
        ? `${user.first_name} ${user.last_name}`
        : 'SuperAdmin',
      created_by: userId,
    });
    const saved = await saveWithConflict(
      this.driverRepository,
      driver,
      'A driver with this license number already exists',
    );
    return mapDriverResponse(saved);
  }

  async disableDriver(id: string, dto: ReasonDto, actorName: string) {
    const driver = await requireEntity(
      this.driverRepository,
      id,
      'Driver not found',
    );
    driver.verification_status = 'DISABLED';
    driver.disabled_by = actorName;
    driver.disable_reason = dto.reason;
    driver.disable_timestamp = new Date();
    driver.operational_status = null;
    const saved = await this.driverRepository.save(driver);
    return mapDriverResponse(saved);
  }

  async archiveDriver(id: string) {
    const driver = await requireEntity(
      this.driverRepository,
      id,
      'Driver not found',
    );
    driver.verification_status = 'ARCHIVED';
    const saved = await this.driverRepository.save(driver);
    return mapDriverResponse(saved);
  }

  async startVerification(id: string) {
    const driver = await requireEntity(
      this.driverRepository,
      id,
      'Driver not found',
    );
    if (driver.verification_status !== 'UNVERIFIED') {
      throw new BadRequestException(
        'Only unverified drivers can start verification',
      );
    }
    driver.verification_status = 'VERIFICATION_IN_PROGRESS';
    const saved = await this.driverRepository.save(driver);
    return mapDriverResponse(saved);
  }

  async clearFlag(id: string, dto: ReasonDto, actorName: string) {
    const driver = await requireEntity(
      this.driverRepository,
      id,
      'Driver not found',
    );
    const flag = await this.activeFlagForDriver(id);
    if (!flag) {
      throw new BadRequestException('No active flag found for this driver');
    }
    flag.flag_status = 'CLEARED';
    flag.cleared_by = actorName;
    flag.clear_reason = dto.reason;
    flag.cleared_at = new Date();
    await this.flagRepository.save(flag);
    driver.verification_status = 'VERIFIED';
    const saved = await this.driverRepository.save(driver);
    return mapDriverResponse(saved, flag);
  }

  async enableDriver(id: string) {
    const driver = await requireEntity(
      this.driverRepository,
      id,
      'Driver not found',
    );
    if (driver.verification_status !== 'DISABLED') {
      throw new BadRequestException('Only disabled drivers can be enabled');
    }
    driver.verification_status = driver.verification_timestamp
      ? 'VERIFIED'
      : 'UNVERIFIED';
    driver.disabled_by = null;
    driver.disable_reason = null;
    driver.disable_timestamp = null;
    driver.operational_status = 'AVAILABLE';
    const saved = await this.driverRepository.save(driver);
    return mapDriverResponse(saved);
  }

  async exportCsv(query: QueryDriversDto): Promise<string> {
    const { data } = await this.findDrivers({
      ...query,
      page: 1,
      limit: 10000,
    });
    const headers = [
      'First Name',
      'Last Name',
      'License Number',
      'License Expiry',
      'Verification Status',
      'Operational Status',
      'Visibility',
      'Transporter',
      'Registered By',
      'Created At',
    ];
    const rows = data.map((d: any) => [
      d.first_name,
      d.last_name,
      d.license_number,
      d.license_expiry_date,
      d.verification_status,
      d.operational_status ?? '',
      d.visibility,
      d.registered_by.company_name,
      d.registered_by.user_account,
      d.created_at,
    ]);
    return toCsv([headers, ...rows]);
  }

  private async activeFlagForDriver(driverId: string) {
    return this.flagRepository.findOne({
      where: {
        driver_id: driverId,
        flag_status: In(['ACTIVE', 'UNDER_REVIEW']),
      },
      order: { flagged_at: 'DESC' },
    });
  }

  private async activeFlagsForDrivers(driverIds: string[]) {
    const map = new Map<string, DriverFlag>();
    if (!driverIds.length) return map;
    const flags = await this.flagRepository.find({
      where: {
        driver_id: In(driverIds),
        flag_status: In(['ACTIVE', 'UNDER_REVIEW']),
      },
      order: { flagged_at: 'DESC' },
    });
    for (const f of flags) {
      if (!map.has(f.driver_id)) map.set(f.driver_id, f);
    }
    return map;
  }
}
