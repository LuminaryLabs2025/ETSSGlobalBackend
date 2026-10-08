import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { PaymentType, RevenueTransaction } from '../../database/entities';
import { paginateQueryBuilder, toCsv } from '../../common/utils/query-helpers';
import { resolveDateRange } from '../../common/utils/date-range';
import {
  PAYMENT_SOURCE_LABELS,
  PaymentSource,
  REVENUE_MODULE_CONFIG,
  RevenueModule,
  RevenueModuleConfig,
  REVENUE_RECIPIENTS,
  paymentTypeSplit,
} from './e-revenue.constants';
import { QueryFeeScheduleDto, QueryRevenueDto } from './dto/e-revenue.dto';

const SORT_COLUMNS: Record<string, string> = {
  transacted_at: 'r.transacted_at',
  amount_paid: 'r.amount_paid',
  payment_source: 'r.payment_source',
  status: 'r.status',
  payer_name: 'r.payer_company_name',
  transaction_id: 'r.transaction_id',
};

const EXPORT_ROW_LIMIT = 10_000;

const money = (value: string | number | null | undefined) =>
  Math.round(Number(value ?? 0) * 100) / 100;

@Injectable()
export class ERevenueService {
  constructor(
    @InjectRepository(RevenueTransaction)
    private readonly revenueRepository: Repository<RevenueTransaction>,
    @InjectRepository(PaymentType)
    private readonly paymentTypeRepository: Repository<PaymentType>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────
  // Header badge + dashboard cards
  // ─────────────────────────────────────────────────────────────────────

  /** All-time successful revenue — the "e-Revenue: NGN…" header badge. */
  async totalRevenue() {
    const raw = await this.revenueRepository
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.amount_paid), 0)', 'amount_paid')
      .addSelect('COALESCE(SUM(r.etss_share), 0)', 'etss_share')
      .addSelect('COUNT(*)', 'entries')
      .where("r.status = 'SUCCESSFUL'")
      .getRawOne<{
        amount_paid: string;
        etss_share: string;
        entries: string;
      }>();
    return {
      currency: 'NGN',
      total_amount_paid: money(raw?.amount_paid),
      total_etss_share: money(raw?.etss_share),
      entries: Number(raw?.entries ?? 0),
    };
  }

  async summary(module: RevenueModule, query: QueryRevenueDto) {
    const cfg = REVENUE_MODULE_CONFIG[module];
    const { qb, range } = this.baseQuery(module, query, { withStatus: false });
    const due = `r.${cfg.dueColumn}`;
    const rows = await qb
      .select('r.payment_source', 'source')
      .addSelect("COUNT(*) FILTER (WHERE r.status = 'SUCCESSFUL')", 'entries')
      .addSelect(
        "COALESCE(SUM(r.amount_paid) FILTER (WHERE r.status = 'SUCCESSFUL'), 0)",
        'amount_paid',
      )
      .addSelect(
        `COALESCE(SUM(${due}) FILTER (WHERE r.status = 'SUCCESSFUL'), 0)`,
        'amount_due',
      )
      .addSelect("COUNT(*) FILTER (WHERE r.status = 'PENDING')", 'pending')
      .addSelect("COUNT(*) FILTER (WHERE r.status = 'FAILED')", 'failed')
      .groupBy('r.payment_source')
      .getRawMany<{
        source: PaymentSource;
        entries: string;
        amount_paid: string;
        amount_due: string;
        pending: string;
        failed: string;
      }>();
    const bySource = new Map(rows.map((row) => [row.source, row]));
    const cards = cfg.sources
      .filter((s) => !query.payment_source || s === query.payment_source)
      .map((source) => {
        const row = bySource.get(source);
        return {
          source,
          label: PAYMENT_SOURCE_LABELS[source],
          amount_paid: money(row?.amount_paid),
          amount_due: money(row?.amount_due),
          entries: Number(row?.entries ?? 0),
        };
      });
    const sum = (key: 'amount_paid' | 'amount_due' | 'entries') =>
      cards.reduce((acc, c) => acc + c[key], 0);
    return {
      module,
      title: cfg.title,
      currency: 'NGN',
      date_range: this.rangeResponse(range),
      total_amount_paid: money(sum('amount_paid')),
      total_amount_due: money(sum('amount_due')),
      total_entries: sum('entries'),
      pending_count: rows.reduce((acc, r) => acc + Number(r.pending), 0),
      failed_count: rows.reduce((acc, r) => acc + Number(r.failed), 0),
      by_source: cards,
    };
  }

  /** Pie chart — successful revenue only, sorted largest slice first. */
  async breakdown(module: RevenueModule, query: QueryRevenueDto) {
    const cfg = REVENUE_MODULE_CONFIG[module];
    const { qb, range } = this.baseQuery(module, query, { withStatus: false });
    qb.andWhere("r.status = 'SUCCESSFUL'");
    const value = `COALESCE(SUM(r.${cfg.amountColumn}), 0)`;

    let slices: {
      key: string;
      label: string;
      value: number;
      entries: number;
    }[];
    if (cfg.breakdown.kind === 'source') {
      const rows = await qb
        .select('r.payment_source', 'key')
        .addSelect(value, 'value')
        .addSelect('COUNT(*)', 'entries')
        .groupBy('r.payment_source')
        .getRawMany<{ key: PaymentSource; value: string; entries: string }>();
      slices = rows.map((row) => ({
        key: row.key,
        label: PAYMENT_SOURCE_LABELS[row.key],
        value: money(row.value),
        entries: Number(row.entries),
      }));
    } else {
      const { idColumn, nameColumn } = cfg.breakdown;
      const rows = await qb
        .select(`r.${idColumn}`, 'key')
        .addSelect(`MAX(r.${nameColumn})`, 'label')
        .addSelect(value, 'value')
        .addSelect('COUNT(*)', 'entries')
        .groupBy(`r.${idColumn}`)
        .getRawMany<{
          key: string;
          label: string;
          value: string;
          entries: string;
        }>();
      slices = rows.map((row) => ({
        key: row.key,
        label: row.label,
        value: money(row.value),
        entries: Number(row.entries),
      }));
    }

    const total = money(slices.reduce((acc, s) => acc + s.value, 0));
    return {
      module,
      title: cfg.title,
      currency: 'NGN',
      date_range: this.rangeResponse(range),
      total,
      slices: slices
        .sort((a, b) => b.value - a.value)
        .map((s) => ({
          ...s,
          percentage: total ? Math.round((s.value / total) * 10_000) / 100 : 0,
        })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Transactions table, export, detail
  // ─────────────────────────────────────────────────────────────────────

  async transactions(module: RevenueModule, query: QueryRevenueDto) {
    const { qb } = this.baseQuery(module, query, { withStatus: true });
    this.applySort(qb, REVENUE_MODULE_CONFIG[module], query);
    const result = await paginateQueryBuilder(qb, query.page, query.limit);
    return {
      data: result.data.map((row) => this.mapTransaction(row, module)),
      meta: result.meta,
    };
  }

  async exportCsv(module: RevenueModule, query: QueryRevenueDto) {
    const cfg = REVENUE_MODULE_CONFIG[module];
    const { qb } = this.baseQuery(module, query, { withStatus: true });
    this.applySort(qb, cfg, query);
    const rows = await qb.take(EXPORT_ROW_LIMIT).getMany();

    // Per the wireframes, only the "All" view carries the Payment Source column.
    const withSource = !query.payment_source;
    const beneficiaryHeader: Partial<Record<RevenueModule, string>> = {
      facilities: 'Facility Selected',
      transit: 'Transit Park Selected',
      tow: 'Assigned Tow Truck Company',
    };
    const header = [
      'S/No.',
      'Transaction ID',
      'Payment Reference Number',
      ...(withSource ? ['Payment Source'] : []),
      'Payer Name/Account',
      ...(beneficiaryHeader[module] ? [beneficiaryHeader[module]] : []),
      ...(module === 'tow' ? ['Assigned Tow Truck'] : []),
      'Amount Paid (NGN)',
      'Payment Timestamp',
      'Payment Method',
      `Amount Due to ${cfg.title} (NGN)`,
      'Linked Booking ID or Service Reference',
      'Status',
    ];
    const body = rows.map((r, i) => [
      i + 1,
      r.transaction_id,
      r.payment_reference,
      ...(withSource
        ? [PAYMENT_SOURCE_LABELS[r.payment_source as PaymentSource]]
        : []),
      this.payerDisplay(r),
      ...(module === 'facilities' ? [r.facility_name] : []),
      ...(module === 'transit' ? [r.transit_park_name] : []),
      ...(module === 'tow' ? [r.tow_company_name, r.truck_plate_number] : []),
      money(r.amount_paid),
      (r.paid_at ?? r.transacted_at).toISOString(),
      r.payment_method,
      money(r[cfg.dueColumn]),
      r.service_reference,
      r.status,
    ]);
    return toCsv([header, ...body]);
  }

  async findTransaction(id: string) {
    const row = await this.revenueRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Revenue transaction not found');
    return {
      ...this.mapTransaction(row),
      invoice_id: row.invoice_id,
      payment_transaction_id: row.payment_transaction_id,
      fee_lines: row.fee_lines ?? [],
      gateway_response: row.gateway_response,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // Fee schedule — what each use case costs, who pays it and how it is
  // split. Edited via App Options → Payment Types (PUT /api/payment-types/:id).
  // ─────────────────────────────────────────────────────────────────────

  async feeSchedule(query: QueryFeeScheduleDto) {
    const qb = this.paymentTypeRepository
      .createQueryBuilder('pt')
      .leftJoinAndSelect('pt.charged_to_user_type', 'paidBy')
      .orderBy('pt.linked_form', 'ASC')
      .addOrderBy('pt.name', 'ASC');
    if (query.status) qb.where('pt.status = :status', { status: query.status });
    if (query.linked_form) {
      qb.andWhere('pt.linked_form = :linkedForm', {
        linkedForm: query.linked_form,
      });
    }
    const rows = await qb.getMany();
    return rows.map((pt) => {
      const amount = pt.amount === null ? null : Number(pt.amount);
      const split = paymentTypeSplit(pt);
      return {
        id: pt.id,
        name: pt.name,
        service_name: pt.service_name,
        linked_form: pt.linked_form,
        revenue_event_trigger: pt.revenue_event_trigger,
        paid_by: pt.charged_to_user_type
          ? {
              id: pt.charged_to_user_type.id,
              name: pt.charged_to_user_type.name,
            }
          : null,
        amount_type: pt.amount_type,
        amount,
        status: pt.status,
        recipients: REVENUE_RECIPIENTS.map(({ key, label }) => ({
          recipient: key,
          label,
          percentage: split[key],
          amount:
            amount === null ? null : Math.round(amount * split[key]) / 100,
        })),
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────

  private baseQuery(
    module: RevenueModule,
    query: QueryRevenueDto,
    opts: { withStatus: boolean },
  ): {
    qb: SelectQueryBuilder<RevenueTransaction>;
    range: { from?: Date; to?: Date };
  } {
    const cfg = REVENUE_MODULE_CONFIG[module];
    const qb = this.revenueRepository.createQueryBuilder('r');
    qb.where('r.payment_source IN (:...moduleSources)', {
      moduleSources: cfg.sources,
    });
    if (cfg.where) qb.andWhere(cfg.where);

    if (query.payment_source) {
      qb.andWhere('r.payment_source = :source', {
        source: query.payment_source,
      });
    }
    if (query.payment_method) {
      qb.andWhere('r.payment_method = :method', {
        method: query.payment_method,
      });
    }
    if (query.facility_id) {
      qb.andWhere('r.facility_id = :facilityId', {
        facilityId: query.facility_id,
      });
    }
    if (query.transit_park_id) {
      qb.andWhere('r.transit_park_id = :transitParkId', {
        transitParkId: query.transit_park_id,
      });
    }
    if (query.tow_company_id) {
      qb.andWhere('r.tow_company_id = :towCompanyId', {
        towCompanyId: query.tow_company_id,
      });
    }
    if (opts.withStatus) {
      if (query.status) {
        qb.andWhere('r.status = :status', { status: query.status });
      } else {
        qb.andWhere("r.status <> 'ABANDONED'");
      }
    }

    const range = resolveDateRange(query);
    if (range.from)
      qb.andWhere('r.transacted_at >= :from', { from: range.from });
    if (range.to) qb.andWhere('r.transacted_at <= :to', { to: range.to });

    const amountColumn = `r.${cfg.amountColumn}`;
    if (query.amount_min !== undefined) {
      qb.andWhere(`${amountColumn} >= :amountMin`, {
        amountMin: query.amount_min,
      });
    }
    if (query.amount_max !== undefined) {
      qb.andWhere(`${amountColumn} <= :amountMax`, {
        amountMax: query.amount_max,
      });
    }

    const search = query.search?.trim();
    if (search) {
      qb.andWhere(
        new Brackets((where) => {
          [
            'transaction_id',
            'payment_reference',
            'invoice_number',
            'service_reference',
            'payer_company_name',
            'payer_user_name',
            'truck_plate_number',
          ].forEach((col) =>
            where.orWhere(`r.${col} ILIKE :search`, { search: `%${search}%` }),
          );
        }),
      );
    }
    return { qb, range };
  }

  private applySort(
    qb: SelectQueryBuilder<RevenueTransaction>,
    cfg: RevenueModuleConfig,
    query: QueryRevenueDto,
  ) {
    const order = (query.sort_order ?? 'DESC').toUpperCase() as 'ASC' | 'DESC';
    const column =
      query.sort_by === 'amount_due'
        ? `r.${cfg.dueColumn}`
        : SORT_COLUMNS[query.sort_by ?? 'transacted_at'];
    qb.orderBy(column, order, 'NULLS LAST').addOrderBy(
      'r.transaction_id',
      'DESC',
    );
  }

  /** `module` sets amount_due to that tab's beneficiary share; the detail view omits it and shows every share. */
  private mapTransaction(r: RevenueTransaction, module?: RevenueModule) {
    const cfg = module ? REVENUE_MODULE_CONFIG[module] : null;
    return {
      id: r.id,
      transaction_id: r.transaction_id,
      payment_reference: r.payment_reference,
      invoice_number: r.invoice_number,
      payment_source: r.payment_source,
      payment_source_label:
        PAYMENT_SOURCE_LABELS[r.payment_source as PaymentSource],
      payer: {
        type: r.payer_type,
        company_id: r.payer_company_id,
        company_name: r.payer_company_name,
        user_id: r.payer_user_id,
        user_name: r.payer_user_name,
        email: r.payer_email,
      },
      payer_display: this.payerDisplay(r),
      amount_paid: money(r.amount_paid),
      ...(cfg ? { amount_due: money(r[cfg.dueColumn]) } : {}),
      currency: r.currency,
      payment_method: r.payment_method,
      channel: r.channel,
      status: r.status,
      paid_at: r.paid_at,
      transacted_at: r.transacted_at,
      linked_reference: {
        kind: r.payment_source,
        id: r.payable_id,
        reference: r.service_reference,
      },
      facility: r.facility_id
        ? { id: r.facility_id, name: r.facility_name }
        : null,
      transit_park: r.transit_park_id
        ? { id: r.transit_park_id, name: r.transit_park_name }
        : null,
      tow_company: r.tow_company_id
        ? { id: r.tow_company_id, name: r.tow_company_name }
        : null,
      truck_plate_number: r.truck_plate_number,
      terminal_name: r.terminal_name,
      shares: {
        etss: money(r.etss_share),
        npa: money(r.npa_share),
        facility: money(r.facility_share),
        transit_park: money(r.transit_park_share),
        tow_company: money(r.tow_company_share),
      },
      share_percentages: r.share_percentages,
    };
  }

  /** "Transporter: ABC Logistics / User: Femi Okunlola" as on the wireframes. */
  private payerDisplay(r: RevenueTransaction): string {
    const parts = [
      r.payer_company_name
        ? `${r.payer_type ?? 'Payer'}: ${r.payer_company_name}`
        : null,
      r.payer_user_name ? `User: ${r.payer_user_name}` : null,
    ].filter(Boolean);
    return parts.length ? parts.join(' / ') : (r.payer_email ?? '');
  }

  private rangeResponse(range: { from?: Date; to?: Date }) {
    return { from: range.from ?? null, to: range.to ?? null };
  }
}
