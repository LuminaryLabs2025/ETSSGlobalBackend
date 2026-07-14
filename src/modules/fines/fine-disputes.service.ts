import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FineDispute, FineDisputeEvent } from '../../database/entities';
import {
  applySearch,
  paginateQueryBuilder,
  requireEntity,
  toCsv,
} from '../../common/utils/query-helpers';
import { QueryFineDisputesDto, ResolveFineDisputeDto } from './dto/fines.dto';
import { applyListSort, mapFineDispute } from './fines-shared';

@Injectable()
export class FineDisputesService {
  constructor(
    @InjectRepository(FineDispute)
    private readonly disputeRepository: Repository<FineDispute>,
    @InjectRepository(FineDisputeEvent)
    private readonly eventRepository: Repository<FineDisputeEvent>,
  ) {}

  async findDisputes(query: QueryFineDisputesDto) {
    const qb = this.disputeRepository.createQueryBuilder('row');

    if (query.dispute_status?.trim() && query.dispute_status !== 'All') {
      qb.andWhere('row.dispute_status = :disputeStatus', {
        disputeStatus: query.dispute_status.trim(),
      });
    }
    if (
      query.resolution_outcome?.trim() &&
      query.resolution_outcome !== 'All'
    ) {
      qb.andWhere('row.resolution_outcome = :resolutionOutcome', {
        resolutionOutcome: query.resolution_outcome.trim(),
      });
    }

    applySearch(
      qb,
      'row',
      [
        'dispute_id',
        'issued_fine_id',
        'penalty_name',
        'penalty_code',
        'truck_plate_number',
        'driver_name',
        'transporter_company_name',
        'booking_reference',
      ],
      query.search,
    );

    applyListSort(
      qb,
      'row',
      query.sort,
      query.sort_dir,
      {
        penalty_name: 'penalty_name',
        fine_amount: 'fine_amount',
        date_disputed: 'date_disputed',
      },
      'date_disputed',
    );

    const result = await paginateQueryBuilder(
      qb,
      query.page ?? 1,
      query.limit ?? 20,
    );
    return {
      data: result.data.map(mapFineDispute),
      meta: result.meta,
    };
  }

  async disputesSummary() {
    const stats = await this.disputeRepository
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
      .addSelect(
        `COALESCE(SUM(row.fine_amount) FILTER (WHERE row.dispute_status NOT IN ('RESOLVED', 'REJECTED')), 0)`,
        'total_amount_in_dispute',
      )
      .addSelect(
        `COALESCE(SUM(row.fine_amount) FILTER (WHERE row.resolution_outcome = 'FINE_WAIVED'), 0)`,
        'waived_amount',
      )
      .addSelect(
        `COALESCE(SUM(row.fine_amount - COALESCE(row.adjusted_amount, 0)) FILTER (WHERE row.resolution_outcome = 'FINE_ADJUSTED'), 0)`,
        'adjusted_amount',
      )
      .getRawOne<Record<string, string>>();

    const waivedAmount = Number(stats?.waived_amount ?? 0);
    const adjustedAmount = Number(stats?.adjusted_amount ?? 0);

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
      total_amount_waived_adjusted: waivedAmount + adjustedAmount,
    };
  }

  async findDispute(id: string) {
    const dispute = await this.disputeRepository.findOne({
      where: { id },
      relations: ['resolution_history'],
    });
    if (!dispute) {
      throw new BadRequestException('Dispute not found');
    }
    return mapFineDispute(dispute);
  }

  async resolveDispute(
    id: string,
    dto: ResolveFineDisputeDto,
    actorName: string,
  ) {
    const dispute = await requireEntity(
      this.disputeRepository,
      id,
      'Dispute not found',
    );

    if (
      dispute.dispute_status === 'RESOLVED' ||
      dispute.dispute_status === 'REJECTED'
    ) {
      throw new BadRequestException('Dispute has already been closed');
    }

    if (dto.resolution_outcome === 'FINE_ADJUSTED') {
      if (dto.adjusted_amount === undefined || dto.adjusted_amount === null) {
        throw new BadRequestException(
          'adjusted_amount is required when resolution_outcome is FINE_ADJUSTED',
        );
      }
      const original = Number(dispute.fine_amount);
      if (dto.adjusted_amount >= original) {
        throw new BadRequestException(
          'adjusted_amount must be less than the original fine amount',
        );
      }
    }

    dispute.dispute_status = dto.dispute_status;
    dispute.managed_by = actorName;

    if (dto.resolution_outcome) {
      dispute.resolution_outcome = dto.resolution_outcome;
      dispute.resolution_date = new Date();
      if (dto.resolution_outcome === 'FINE_ADJUSTED') {
        dispute.adjusted_amount = String(dto.adjusted_amount);
      }
    }

    await this.disputeRepository.save(dispute);

    const action = dto.resolution_outcome ?? dto.dispute_status;
    const event = this.eventRepository.create({
      dispute_id: dispute.id,
      action,
      performed_by: actorName,
      notes: dto.notes ?? null,
    });
    await this.eventRepository.save(event);

    const updated = await this.disputeRepository.findOne({
      where: { id },
      relations: ['resolution_history'],
    });
    return mapFineDispute(updated!);
  }

  async exportCsv(query: QueryFineDisputesDto): Promise<string> {
    const { data } = await this.findDisputes({
      ...query,
      page: 1,
      limit: 10000,
    });
    const headers = [
      'Dispute ID',
      'Issued Fine ID',
      'Penalty Name',
      'Fine Amount',
      'Truck Plate',
      'Driver',
      'Dispute Status',
      'Resolution Outcome',
      'Date Disputed',
      'Transporter',
    ];
    const rows: (string | number | null | undefined)[][] = data.map(
      (d: Record<string, unknown>) => {
        const transporter = d.transporter as Record<string, unknown>;
        return [
          d.dispute_id as string,
          d.issued_fine_id as string,
          d.penalty_name as string,
          d.fine_amount as number,
          d.truck_plate_number as string,
          d.driver_name as string,
          d.dispute_status as string,
          (d.resolution_outcome as string) ?? '',
          d.date_disputed as string,
          transporter.company_name as string,
        ];
      },
    );
    return toCsv([headers, ...rows]);
  }
}
