import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Tep,
  TepActivityEvent,
  TepMatchedTruck,
  User,
} from '../../database/entities';
import {
  BulkCreateTepsDto,
  CreateTepDto,
  QueryTepsDto,
  ReasonDto,
  TEP_SOURCE_BY_CLASSIFICATION,
} from './dto/operations.dto';
import {
  applySearch,
  applyTepClassificationTab,
  mapTepResponse,
  paginateQueryBuilder,
  requireEntity,
  saveWithConflict,
  toCsv,
} from './operations-shared';

@Injectable()
export class TepsService {
  constructor(
    @InjectRepository(Tep)
    private readonly tepRepository: Repository<Tep>,
    @InjectRepository(TepMatchedTruck)
    private readonly matchedTruckRepository: Repository<TepMatchedTruck>,
    @InjectRepository(TepActivityEvent)
    private readonly activityRepository: Repository<TepActivityEvent>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findTeps(query: QueryTepsDto) {
    const qb = this.tepRepository.createQueryBuilder('row');
    applyTepClassificationTab(qb, query.category ?? query.classification);
    applySearch(
      qb,
      'row',
      [
        'reference_number',
        'truck_plate_number',
        'facility_name',
        'company_name',
      ],
      query.search,
    );

    if (query.classification?.trim() && query.classification !== 'All') {
      qb.andWhere('row.classification = :cls', {
        cls: query.classification.trim(),
      });
    }
    if (query.source?.trim() && query.source !== 'All') {
      qb.andWhere('row.source = :src', { src: query.source.trim() });
    }
    if (query.status?.trim() && query.status !== 'All') {
      qb.andWhere('row.status = :st', { st: query.status.trim() });
    }
    if (query.match_status?.trim() && query.match_status !== 'All') {
      qb.andWhere('row.match_status = :ms', {
        ms: query.match_status.trim(),
      });
    }

    qb.orderBy('row.created_at', 'DESC');
    const result = await paginateQueryBuilder(
      qb,
      query.page ?? 1,
      query.limit ?? 20,
    );
    const enriched = await Promise.all(
      result.data.map((t) => this.loadTepRelations(t)),
    );
    return {
      data: enriched.map((t) => mapTepResponse(t.tep, t.matches, t.events)),
      meta: result.meta,
    };
  }

  async tepsSummary() {
    const stats = await this.tepRepository
      .createQueryBuilder('row')
      .select('COUNT(*)', 'total')
      .addSelect(`COUNT(*) FILTER (WHERE row.status = 'ACTIVE')`, 'active')
      .addSelect(`COUNT(*) FILTER (WHERE row.status = 'EXPIRED')`, 'expired')
      .addSelect(`COUNT(*) FILTER (WHERE row.status = 'REVOKED')`, 'revoked')
      .addSelect(
        `COUNT(*) FILTER (WHERE row.match_status = 'MATCHED')`,
        'matched',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.match_status = 'UNMATCHED')`,
        'unmatched',
      )
      .getRawOne<Record<string, string>>();

    const byClass = await this.tepRepository
      .createQueryBuilder('row')
      .select('row.classification', 'classification')
      .addSelect('COUNT(*)', 'count')
      .groupBy('row.classification')
      .getRawMany<{ classification: string; count: string }>();

    const bySource = await this.tepRepository
      .createQueryBuilder('row')
      .select('row.source', 'source')
      .addSelect('COUNT(*)', 'count')
      .groupBy('row.source')
      .getRawMany<{ source: string; count: string }>();

    const classificationMap = Object.fromEntries(
      [
        'EMPTY_TDO',
        'IMPORT_TDO',
        'EXPORT_TDO',
        'GATEPASS_PORT',
        'GATEPASS_NON_PORT',
      ].map((k) => [
        k,
        Number(byClass.find((r) => r.classification === k)?.count ?? 0),
      ]),
    );
    const sourceMap = Object.fromEntries(
      ['SHIPPING_LINE', 'PORT_TERMINAL', 'NON_PORT_TERMINAL', 'EPT'].map(
        (k) => [k, Number(bySource.find((r) => r.source === k)?.count ?? 0)],
      ),
    );

    return {
      total: Number(stats?.total ?? 0),
      active: Number(stats?.active ?? 0),
      expired: Number(stats?.expired ?? 0),
      revoked: Number(stats?.revoked ?? 0),
      matched: Number(stats?.matched ?? 0),
      unmatched: Number(stats?.unmatched ?? 0),
      by_classification: classificationMap,
      by_source: sourceMap,
    };
  }

  async findTep(id: string) {
    const tep = await requireEntity(this.tepRepository, id, 'TEP not found');
    const { matches, events } = await this.loadTepRelations(tep);
    return mapTepResponse(tep, matches, events);
  }

  async createTep(dto: CreateTepDto, userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const source = TEP_SOURCE_BY_CLASSIFICATION[dto.classification];
    if (!source) {
      throw new BadRequestException('Invalid TEP classification');
    }
    const tep = this.tepRepository.create({
      ...dto,
      source,
      company_name: dto.company_name ?? null,
      user_account: user
        ? `${user.first_name} ${user.last_name}`
        : 'SuperAdmin',
      created_by: userId,
      expiry_date: dto.expiry_date ? new Date(dto.expiry_date) : null,
    });
    const saved = await saveWithConflict(
      this.tepRepository,
      tep,
      'A TEP with this reference number already exists',
    );
    await this.logActivity(
      saved.id,
      'CREATED',
      saved.user_account ?? 'System',
      'TEP created manually',
    );
    return this.findTep(saved.id);
  }

  async bulkCreateTeps(dto: BulkCreateTepsDto, userId: string) {
    const created: Record<string, unknown>[] = [];
    for (const item of dto.teps) {
      created.push(await this.createTep(item, userId));
    }
    return { created: created.length, teps: created };
  }

  async revokeTep(id: string, dto: ReasonDto, actorName: string) {
    const tep = await requireEntity(this.tepRepository, id, 'TEP not found');
    if (tep.status !== 'ACTIVE') {
      throw new BadRequestException('Only active TEPs can be revoked');
    }
    tep.status = 'REVOKED';
    tep.revoked_by = actorName;
    tep.revoke_reason = dto.reason;
    tep.revoked_at = new Date();
    await this.tepRepository.save(tep);
    await this.logActivity(id, 'REVOKED', actorName, dto.reason);
    return this.findTep(id);
  }

  async exportCsv(query: QueryTepsDto): Promise<string> {
    const { data } = await this.findTeps({ ...query, page: 1, limit: 10000 });
    const headers = [
      'Reference Number',
      'Classification',
      'Source',
      'Facility',
      'Company',
      'Status',
      'Match Status',
      'Truck Plate',
      'Created At',
      'Expiry Date',
    ];
    const rows = data.map((t: any) => [
      t.reference_number,
      t.classification,
      t.source,
      t.facility_name,
      t.company_name,
      t.status,
      t.match_status,
      t.truck_plate_number ?? '',
      t.created_at,
      t.expiry_date ?? '',
    ]);
    return toCsv([headers, ...rows]);
  }

  private async loadTepRelations(tep: Tep) {
    const [matches, events] = await Promise.all([
      this.matchedTruckRepository.find({
        where: { tep_id: tep.id },
        order: { match_timestamp: 'DESC' },
      }),
      this.activityRepository.find({
        where: { tep_id: tep.id },
        order: { created_at: 'ASC' },
      }),
    ]);
    return { tep, matches, events };
  }

  private async logActivity(
    tepId: string,
    eventType: string,
    performedBy: string,
    details?: string,
  ) {
    await this.activityRepository.save(
      this.activityRepository.create({
        tep_id: tepId,
        event_type: eventType,
        performed_by: performedBy,
        details: details ?? null,
      }),
    );
  }
}
