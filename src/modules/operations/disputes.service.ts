import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Truck, TruckPenalty } from '../../database/entities';
import { QueryDisputesDto, ResolveDisputeDto } from './dto/operations.dto';
import {
  applySearch,
  mapDisputeResponse,
  paginateQueryBuilder,
  requireEntity,
  toCsv,
} from './operations-shared';

@Injectable()
export class DisputesService {
  constructor(
    @InjectRepository(TruckPenalty)
    private readonly penaltyRepository: Repository<TruckPenalty>,
    @InjectRepository(Truck)
    private readonly truckRepository: Repository<Truck>,
  ) {}

  async findDisputes(query: QueryDisputesDto) {
    const qb = this.penaltyRepository
      .createQueryBuilder('row')
      .leftJoinAndSelect('row.truck', 'truck')
      .where('row.payment_status = :disputed', { disputed: 'DISPUTED' });

    if (query.dispute_status?.trim() && query.dispute_status !== 'All') {
      qb.andWhere('row.dispute_status = :ds', {
        ds: query.dispute_status.trim(),
      });
    }
    if (
      query.resolution_outcome?.trim() &&
      query.resolution_outcome !== 'All'
    ) {
      qb.andWhere('row.resolution_outcome = :ro', {
        ro: query.resolution_outcome.trim(),
      });
    }
    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        '(row.penalty_code ILIKE :term OR truck.plate_number ILIKE :term OR row.booked_by_company_name ILIKE :term)',
        { term },
      );
    }

    qb.orderBy('row.date_disputed', 'DESC');
    const result = await paginateQueryBuilder(
      qb,
      query.page ?? 1,
      query.limit ?? 20,
    );
    return {
      data: result.data.map((p) => mapDisputeResponse(p)),
      meta: result.meta,
    };
  }

  async disputesSummary() {
    const stats = await this.penaltyRepository
      .createQueryBuilder('row')
      .select('COUNT(*)', 'total')
      .addSelect(
        `COUNT(*) FILTER (WHERE row.dispute_status = 'PENDING_REVIEW')`,
        'pending_review',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.dispute_status = 'UNDER_NPA_REVIEW')`,
        'under_npa_review',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.dispute_status = 'RESOLVED')`,
        'resolved',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.dispute_status = 'REJECTED')`,
        'rejected',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.resolution_outcome = 'FINE_UPHELD')`,
        'fine_upheld',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.resolution_outcome = 'FINE_WAIVED')`,
        'fine_waived',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.resolution_outcome = 'FINE_ADJUSTED')`,
        'fine_adjusted',
      )
      .addSelect('COALESCE(SUM(row.amount), 0)', 'total_amount_in_dispute')
      .addSelect(
        'COALESCE(SUM(row.adjusted_amount), 0)',
        'total_amount_waived_adjusted',
      )
      .where('row.payment_status = :disputed', { disputed: 'DISPUTED' })
      .getRawOne<Record<string, string>>();

    return {
      total: Number(stats?.total ?? 0),
      pending_review: Number(stats?.pending_review ?? 0),
      under_npa_review: Number(stats?.under_npa_review ?? 0),
      resolved: Number(stats?.resolved ?? 0),
      rejected: Number(stats?.rejected ?? 0),
      fine_upheld: Number(stats?.fine_upheld ?? 0),
      fine_waived: Number(stats?.fine_waived ?? 0),
      fine_adjusted: Number(stats?.fine_adjusted ?? 0),
      total_amount_in_dispute: Number(stats?.total_amount_in_dispute ?? 0),
      total_amount_waived_adjusted: Number(
        stats?.total_amount_waived_adjusted ?? 0,
      ),
    };
  }

  async findDispute(id: string) {
    const penalty = await this.penaltyRepository.findOne({
      where: { id },
      relations: ['truck'],
    });
    if (!penalty || penalty.payment_status !== 'DISPUTED') {
      throw new BadRequestException('Dispute not found');
    }
    return mapDisputeResponse(penalty);
  }

  async resolveDispute(id: string, dto: ResolveDisputeDto, actorName: string) {
    const penalty = await requireEntity(
      this.penaltyRepository,
      id,
      'Dispute not found',
    );
    if (penalty.payment_status !== 'DISPUTED') {
      throw new BadRequestException('Penalty is not in disputed status');
    }
    penalty.dispute_status = dto.dispute_status;
    penalty.managed_by = actorName;
    if (dto.resolution_outcome) {
      penalty.resolution_outcome = dto.resolution_outcome;
      penalty.resolution_date = new Date();
      if (dto.resolution_outcome === 'FINE_WAIVED') {
        penalty.payment_status = 'OVERRIDDEN';
      } else if (dto.resolution_outcome === 'FINE_ADJUSTED') {
        penalty.adjusted_amount = String(dto.adjusted_amount ?? 0);
        penalty.payment_status = 'PAID';
      } else if (dto.resolution_outcome === 'FINE_UPHELD') {
        penalty.payment_status = 'UNPAID';
      }
    }
    await this.penaltyRepository.save(penalty);

    if (penalty.truck_id) {
      const truck = await this.truckRepository.findOne({
        where: { id: penalty.truck_id },
      });
      if (
        truck &&
        truck.registration_status === 'FLAGGED' &&
        dto.resolution_outcome === 'FINE_WAIVED'
      ) {
        truck.registration_status = 'MSS_VERIFIED';
        await this.truckRepository.save(truck);
      }
    }

    const updated = await this.penaltyRepository.findOne({
      where: { id },
      relations: ['truck'],
    });
    return mapDisputeResponse(updated!);
  }

  async exportCsv(query: QueryDisputesDto): Promise<string> {
    const { data } = await this.findDisputes({
      ...query,
      page: 1,
      limit: 10000,
    });
    const headers = [
      'Dispute ID',
      'Truck Plate',
      'Penalty Type',
      'Amount',
      'Dispute Status',
      'Resolution Outcome',
      'Date Disputed',
      'Transporter',
    ];
    const rows = data.map((d: any) => [
      d.dispute_id,
      d.truck_plate_number,
      d.penalty_name,
      d.fine_amount,
      d.dispute_status ?? '',
      d.resolution_outcome ?? '',
      d.date_disputed ?? '',
      d.transporter.company_name,
    ]);
    return toCsv([headers, ...rows]);
  }
}
