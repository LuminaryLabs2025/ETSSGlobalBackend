import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PenaltyDefinition } from '../../database/entities';
import {
  applySearch,
  nextSequentialCode,
  paginateQueryBuilder,
  requireEntity,
  saveWithConflict,
  toCsv,
} from '../../common/utils/query-helpers';
import {
  CreatePenaltyDto,
  QueryPenaltiesDto,
  UpdatePenaltyDto,
} from './dto/fines.dto';
import { applyListSort, mapPenalty } from './fines-shared';

@Injectable()
export class PenaltiesService {
  constructor(
    @InjectRepository(PenaltyDefinition)
    private readonly penaltyRepository: Repository<PenaltyDefinition>,
  ) {}

  async findPenalties(query: QueryPenaltiesDto) {
    const qb = this.penaltyRepository.createQueryBuilder('row');
    applySearch(
      qb,
      'row',
      ['name', 'penalty_code', 'description'],
      query.search,
    );

    if (query.status?.trim() && query.status !== 'All') {
      qb.andWhere('row.status = :status', { status: query.status.trim() });
    }

    applyListSort(
      qb,
      'row',
      query.sort,
      query.sort_dir,
      { name: 'name', fine_amount: 'fine_amount', created_at: 'created_at' },
      'created_at',
    );

    const result = await paginateQueryBuilder(
      qb,
      query.page ?? 1,
      query.limit ?? 20,
    );
    return {
      data: result.data.map(mapPenalty),
      meta: result.meta,
    };
  }

  async penaltiesSummary() {
    const stats = await this.penaltyRepository
      .createQueryBuilder('row')
      .select('COUNT(*)', 'total')
      .addSelect(
        `COUNT(*) FILTER (WHERE row.status = 'ACTIVE')`,
        'active',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.status = 'INACTIVE')`,
        'inactive',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.status = 'ARCHIVED')`,
        'archived',
      )
      .addSelect('COALESCE(AVG(row.fine_amount), 0)', 'avg_fine_amount')
      .getRawOne<Record<string, string>>();

    return {
      total: Number(stats?.total ?? 0),
      active: Number(stats?.active ?? 0),
      inactive: Number(stats?.inactive ?? 0),
      archived: Number(stats?.archived ?? 0),
      avg_fine_amount: Number(stats?.avg_fine_amount ?? 0),
    };
  }

  async findPenalty(id: string) {
    const penalty = await requireEntity(
      this.penaltyRepository,
      id,
      'Penalty not found',
    );
    return mapPenalty(penalty);
  }

  async createPenalty(dto: CreatePenaltyDto, actorName: string) {
    const penaltyCode = await nextSequentialCode(
      this.penaltyRepository,
      'penalty_code',
      'PEN',
      3,
    );
    const penalty = this.penaltyRepository.create({
      penalty_code: penaltyCode,
      name: dto.name,
      description: dto.description,
      fine_amount: String(dto.fine_amount),
      status: dto.status ?? 'ACTIVE',
      created_by: actorName,
    });
    const saved = await saveWithConflict(
      this.penaltyRepository,
      penalty,
      'A penalty with this name already exists',
    );
    return mapPenalty(saved);
  }

  async updatePenalty(id: string, dto: UpdatePenaltyDto, actorName: string) {
    const penalty = await requireEntity(
      this.penaltyRepository,
      id,
      'Penalty not found',
    );
    if (penalty.status === 'ARCHIVED') {
      throw new BadRequestException('Archived penalties cannot be updated');
    }
    if (dto.name !== undefined) penalty.name = dto.name;
    if (dto.description !== undefined) penalty.description = dto.description;
    if (dto.fine_amount !== undefined) {
      penalty.fine_amount = String(dto.fine_amount);
    }
    if (dto.status !== undefined) penalty.status = dto.status;
    penalty.updated_by = actorName;
    const saved = await saveWithConflict(
      this.penaltyRepository,
      penalty,
      'A penalty with this name already exists',
    );
    return mapPenalty(saved);
  }

  async archivePenalty(id: string, actorName: string) {
    const penalty = await requireEntity(
      this.penaltyRepository,
      id,
      'Penalty not found',
    );
    if (penalty.status === 'ARCHIVED') {
      throw new BadRequestException('Penalty is already archived');
    }
    penalty.status = 'ARCHIVED';
    penalty.updated_by = actorName;
    const saved = await this.penaltyRepository.save(penalty);
    return mapPenalty(saved);
  }

  async exportCsv(query: QueryPenaltiesDto): Promise<string> {
    const { data } = await this.findPenalties({
      ...query,
      page: 1,
      limit: 10000,
    });
    const headers = [
      'Penalty Code',
      'Name',
      'Description',
      'Fine Amount',
      'Status',
      'Created By',
      'Created At',
    ];
    const rows: (string | number | null | undefined)[][] = data.map(
      (p: Record<string, unknown>) => [
        p.penalty_code as string,
        p.name as string,
        p.description as string,
        p.fine_amount as number,
        p.status as string,
        p.created_by as string,
        p.created_at as string,
      ],
    );
    return toCsv([headers, ...rows]);
  }
}
