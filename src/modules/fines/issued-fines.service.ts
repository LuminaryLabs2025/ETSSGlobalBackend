import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IssuedFine } from '../../database/entities';
import {
  applySearch,
  paginateQueryBuilder,
  requireEntity,
  toCsv,
} from '../../common/utils/query-helpers';
import { QueryIssuedFinesDto } from './dto/fines.dto';
import { applyListSort, mapIssuedFine } from './fines-shared';

@Injectable()
export class IssuedFinesService {
  constructor(
    @InjectRepository(IssuedFine)
    private readonly issuedFineRepository: Repository<IssuedFine>,
  ) {}

  async findIssuedFines(query: QueryIssuedFinesDto) {
    const qb = this.issuedFineRepository.createQueryBuilder('row');
    applySearch(
      qb,
      'row',
      [
        'issued_fine_id',
        'penalty_name',
        'penalty_code',
        'truck_plate_number',
        'driver_name',
        'booking_reference',
        'transporter_company_name',
      ],
      query.search,
    );

    if (query.penalty_name?.trim() && query.penalty_name !== 'All') {
      qb.andWhere('row.penalty_name = :penaltyName', {
        penaltyName: query.penalty_name.trim(),
      });
    }
    if (query.terminal?.trim() && query.terminal !== 'All') {
      qb.andWhere('row.terminal_destination = :terminal', {
        terminal: query.terminal.trim(),
      });
    }

    applyListSort(
      qb,
      'row',
      query.sort,
      query.sort_dir,
      {
        penalty_name: 'penalty_name',
        fine_amount: 'fine_amount',
        date_issued: 'date_issued',
      },
      'date_issued',
    );

    const result = await paginateQueryBuilder(
      qb,
      query.page ?? 1,
      query.limit ?? 20,
    );
    return {
      data: result.data.map(mapIssuedFine),
      meta: result.meta,
    };
  }

  async issuedFinesSummary() {
    const stats = await this.issuedFineRepository
      .createQueryBuilder('row')
      .select('COUNT(*)', 'total')
      .addSelect(
        `COUNT(*) FILTER (WHERE row.status = 'ACCEPTED')`,
        'accepted',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.status = 'DISPUTED')`,
        'disputed',
      )
      .addSelect('COALESCE(SUM(row.fine_amount), 0)', 'total_amount')
      .addSelect(
        `COALESCE(SUM(row.fine_amount) FILTER (WHERE row.status = 'ACCEPTED'), 0)`,
        'accepted_amount',
      )
      .addSelect(
        `COALESCE(SUM(row.fine_amount) FILTER (WHERE row.status = 'DISPUTED'), 0)`,
        'disputed_amount',
      )
      .getRawOne<Record<string, string>>();

    return {
      total: Number(stats?.total ?? 0),
      accepted: Number(stats?.accepted ?? 0),
      disputed: Number(stats?.disputed ?? 0),
      total_amount: Number(stats?.total_amount ?? 0),
      accepted_amount: Number(stats?.accepted_amount ?? 0),
      disputed_amount: Number(stats?.disputed_amount ?? 0),
    };
  }

  async findIssuedFine(id: string) {
    const fine = await requireEntity(
      this.issuedFineRepository,
      id,
      'Issued fine not found',
    );
    return mapIssuedFine(fine);
  }

  async exportCsv(query: QueryIssuedFinesDto): Promise<string> {
    const { data } = await this.findIssuedFines({
      ...query,
      page: 1,
      limit: 10000,
    });
    const headers = [
      'Issued Fine ID',
      'Penalty Name',
      'Fine Amount',
      'Booking Reference',
      'Terminal',
      'Truck Plate',
      'Driver',
      'Transporter',
      'Date Issued',
      'Status',
    ];
    const rows: (string | number | null | undefined)[][] = data.map(
      (f: Record<string, unknown>) => {
        const booking = f.booking as Record<string, unknown>;
        const transporter = f.transporter as Record<string, unknown>;
        return [
          f.issued_fine_id as string,
          f.penalty_name as string,
          f.fine_amount as number,
          booking.booking_reference as string,
          booking.terminal_destination as string,
          f.truck_plate_number as string,
          f.driver_name as string,
          transporter.company_name as string,
          f.date_issued as string,
          f.status as string,
        ];
      },
    );
    return toCsv([headers, ...rows]);
  }
}
