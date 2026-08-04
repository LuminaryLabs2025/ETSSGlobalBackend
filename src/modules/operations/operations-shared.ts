import {
  Brackets,
  ObjectLiteral,
  QueryFailedError,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  Driver,
  DriverFlag,
  Tep,
  TepActivityEvent,
  TepMatchedTruck,
  Truck,
  TruckPenalty,
} from '../../database/entities';

export type PaginatedResult<T> = {
  data: T[];
  meta: { total: number; page: number; limit: number; total_pages: number };
};

export function paginateQueryBuilder<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  page = 1,
  limit = 20,
): Promise<PaginatedResult<T>> {
  const safePage = page > 0 ? page : 1;
  const safeLimit = limit > 0 ? Math.min(limit, 100) : 20;
  return qb
    .clone()
    .getCount()
    .then((total) =>
      qb
        .skip((safePage - 1) * safeLimit)
        .take(safeLimit)
        .getMany()
        .then((data) => ({
          data,
          meta: {
            total,
            page: safePage,
            limit: safeLimit,
            total_pages: Math.ceil(total / safeLimit),
          },
        })),
    );
}

export function applySearch(
  qb: SelectQueryBuilder<any>,
  alias: string,
  columns: string[],
  search?: string,
) {
  if (!search?.trim()) return;
  const term = `%${search.trim()}%`;
  qb.andWhere(
    new Brackets((where) => {
      columns.forEach((col, i) => {
        const clause = `${alias}.${col} ILIKE :search`;
        if (i === 0) where.where(clause, { search: term });
        else where.orWhere(clause, { search: term });
      });
    }),
  );
}

export function applyTruckCategoryFilter(
  qb: SelectQueryBuilder<Truck>,
  category?: string,
) {
  const cat = category?.trim().toLowerCase();
  if (!cat || cat === 'all') {
    qb.andWhere('row.registration_status != :archived', {
      archived: 'ARCHIVED',
    });
    return;
  }
  const map: Record<string, string | string[]> = {
    verified: 'MSS_VERIFIED',
    unverified: ['UNVERIFIED', 'VERIFICATION_REQUESTED'],
    flagged: 'FLAGGED',
    disabled: 'DISABLED',
  };
  const value = map[cat];
  if (!value) return;
  if (Array.isArray(value)) {
    qb.andWhere('row.registration_status IN (:...statuses)', {
      statuses: value,
    });
  } else {
    qb.andWhere('row.registration_status = :status', { status: value });
  }
}

export function applyDriverCategoryFilter(
  qb: SelectQueryBuilder<Driver>,
  category?: string,
) {
  const cat = category?.trim().toLowerCase();
  if (!cat || cat === 'all') {
    qb.andWhere('row.verification_status != :archived', {
      archived: 'ARCHIVED',
    });
    return;
  }
  const map: Record<string, string | string[]> = {
    verified: 'VERIFIED',
    unverified: ['UNVERIFIED', 'VERIFICATION_IN_PROGRESS'],
    flagged: 'FLAGGED',
    disabled: 'DISABLED',
  };
  const value = map[cat];
  if (!value) return;
  if (Array.isArray(value)) {
    qb.andWhere('row.verification_status IN (:...statuses)', {
      statuses: value,
    });
  } else {
    qb.andWhere('row.verification_status = :status', { status: value });
  }
}

export function applyTepClassificationTab(
  qb: SelectQueryBuilder<Tep>,
  category?: string,
) {
  const cat = category?.trim().toLowerCase();
  if (!cat || cat === 'all') return;
  const map: Record<string, string> = {
    empty_tdo: 'EMPTY_TDO',
    import_tdo: 'IMPORT_TDO',
    export_tdo: 'EXPORT_TDO',
    gatepass_port: 'GATEPASS_PORT',
    gatepass_non_port: 'GATEPASS_NON_PORT',
  };
  const classification = map[cat];
  if (classification) {
    qb.andWhere('row.classification = :classification', { classification });
  }
}

export function mapTruckResponse(truck: Truck, penalty?: TruckPenalty | null) {
  const base: Record<string, unknown> = {
    id: truck.id,
    plate_number: truck.plate_number,
    truck_type_id: truck.truck_type_id,
    truck_type: truck.truck_type
      ? { id: truck.truck_type.id, name: truck.truck_type.name }
      : null,
    color: truck.color ?? '',
    chassis_number: truck.chassis_number ?? '',
    brand: truck.brand ?? '',
    model: truck.model ?? '',
    truck_length_id: truck.truck_length_id ?? null,
    truck_length: truck.truck_length
      ? {
          id: truck.truck_length.id,
          length_value: truck.truck_length.length_value,
        }
      : null,
    truck_capacity_id: truck.truck_capacity_id ?? null,
    truck_capacity: truck.truck_capacity
      ? {
          id: truck.truck_capacity.id,
          capacity_value: truck.truck_capacity.capacity_value,
        }
      : null,
    created_at: truck.created_at,
    registration_status: truck.registration_status,
    registered_by: {
      company_name: truck.registered_by_company_name ?? '',
      user_account: truck.registered_by_user_name ?? '',
    },
    visibility: truck.visibility,
  };
  if (truck.truck_status) base.truck_status = truck.truck_status;
  if (truck.mss_verification_number)
    base.mss_verification_number = truck.mss_verification_number;
  if (truck.verification_timestamp)
    base.verification_timestamp = truck.verification_timestamp;
  if (truck.rfid_tag_number) base.rfid_tag_number = truck.rfid_tag_number;
  if (penalty) {
    base.penalty = {
      penalty_id: penalty.penalty_code,
      penalty_type: penalty.penalty_type,
      amount: Number(penalty.amount),
      date_issued: penalty.date_issued,
      issued_by: penalty.issued_by,
      payment_status: penalty.payment_status,
      booked_by: {
        company_name: penalty.booked_by_company_name ?? '',
        user_account: penalty.booked_by_user_name ?? '',
      },
    };
  }
  if (truck.registration_status === 'DISABLED' && truck.disabled_by) {
    base.disable_info = {
      disabled_by: truck.disabled_by,
      disable_reason: truck.disable_reason ?? '',
      disable_timestamp: truck.disable_timestamp,
    };
  }
  return base;
}

export function mapDriverResponse(driver: Driver, flag?: DriverFlag | null) {
  const base: Record<string, unknown> = {
    id: driver.id,
    first_name: driver.first_name,
    last_name: driver.last_name,
    mobile_number: driver.mobile_number ?? '',
    license_number: driver.license_number,
    license_expiry_date: driver.license_expiry_date,
    date_of_birth: driver.date_of_birth ?? '',
    sex: driver.sex ?? 'MALE',
    created_at: driver.created_at,
    verification_status: driver.verification_status,
    registered_by: {
      company_name: driver.registered_by_company_name ?? '',
      user_account: driver.registered_by_user_name ?? '',
    },
    visibility: driver.visibility,
  };
  if (driver.verification_timestamp)
    base.verification_timestamp = driver.verification_timestamp;
  if (driver.operational_status)
    base.operational_status = driver.operational_status;
  if (flag) {
    base.flag = {
      flag_id: flag.flag_code,
      flag_type: flag.flag_type,
      flag_details: flag.flag_details ?? '',
      flagged_by: flag.flagged_by,
      flagged_at: flag.flagged_at,
      flag_status: flag.flag_status,
    };
  }
  if (driver.verification_status === 'DISABLED' && driver.disabled_by) {
    base.disable_info = {
      disabled_by: driver.disabled_by,
      disable_reason: driver.disable_reason ?? '',
      disable_timestamp: driver.disable_timestamp,
    };
  }
  return base;
}

export function mapTepResponse(
  tep: Tep,
  matchedTrucks?: TepMatchedTruck[],
  activityEvents?: TepActivityEvent[],
) {
  const base: Record<string, unknown> = {
    id: tep.id,
    reference_number: tep.reference_number,
    classification: tep.classification,
    source: tep.source,
    facility_name: tep.facility_name,
    company_name: tep.company_name ?? '',
    user_account: tep.user_account ?? '',
    match_status: tep.match_status,
    created_at: tep.created_at,
    status: tep.status,
    activity_log: (activityEvents ?? tep.activity_events ?? []).map((e) => ({
      event_type: e.event_type,
      performed_by: e.performed_by,
      timestamp: e.created_at,
      details: e.details ?? '',
    })),
  };
  if (tep.truck_plate_number) base.truck_plate_number = tep.truck_plate_number;
  if (tep.expiry_date) base.expiry_date = tep.expiry_date;
  const matches = matchedTrucks ?? tep.matched_trucks ?? [];
  if (matches.length) {
    base.matched_trucks = matches.map((m) => ({
      plate_number: m.plate_number,
      driver_name: m.driver_name ?? '',
      driver_id: m.driver_id ?? '',
      match_timestamp: m.match_timestamp,
    }));
  }
  return base;
}

export function mapDisputeResponse(penalty: TruckPenalty & { truck?: Truck }) {
  const truck = penalty.truck;
  return {
    id: penalty.id,
    dispute_id: penalty.penalty_code,
    issued_fine_id: penalty.penalty_code,
    penalty_code: penalty.penalty_type,
    penalty_name: penalty.penalty_type.replace(/_/g, ' '),
    fine_amount: Number(penalty.amount),
    truck_plate_number: truck?.plate_number ?? '',
    driver_name: '',
    transporter: {
      company_name:
        penalty.booked_by_company_name ??
        truck?.registered_by_company_name ??
        '',
      user_account:
        penalty.booked_by_user_name ?? truck?.registered_by_user_name ?? '',
      contact_person: penalty.booked_by_user_name ?? '',
      contact_number: '',
      email: '',
    },
    date_issued: penalty.date_issued,
    date_disputed: penalty.date_disputed,
    dispute_reason: penalty.dispute_reason ?? '',
    dispute_status: penalty.dispute_status,
    resolution_outcome: penalty.resolution_outcome ?? undefined,
    managed_by: penalty.managed_by ?? undefined,
    resolution_date: penalty.resolution_date ?? undefined,
    adjusted_amount: penalty.adjusted_amount
      ? Number(penalty.adjusted_amount)
      : undefined,
    resolution_history: [],
  };
}

export async function requireEntity<T extends { id: string }>(
  repository: Repository<T>,
  id: string,
  message: string,
): Promise<T> {
  const row = await repository.findOne({ where: { id } as any });
  if (!row) throw new NotFoundException(message);
  return row;
}

export async function saveWithConflict<T extends object>(
  repository: Repository<T>,
  entity: T,
  message?: string,
): Promise<T> {
  try {
    return await repository.save(entity);
  } catch (error) {
    if (
      message &&
      error instanceof QueryFailedError &&
      (error as unknown as { code?: string }).code === '23505'
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }
}

export async function nextSequentialCode(
  repository: Repository<any>,
  column: string,
  prefix: string,
): Promise<string> {
  const raw = await repository
    .createQueryBuilder('row')
    .select(
      `MAX(CAST(SUBSTRING(row.${column} FROM ${prefix.length + 2}) AS INTEGER))`,
      'max',
    )
    .where(`row.${column} ~ '^${prefix}-[0-9]+$'`)
    .getRawOne<{ max: string | null }>();
  const next = (raw?.max ? Number(raw.max) : 0) + 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

export function toCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? '');
          return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(','),
    )
    .join('\n');
}
