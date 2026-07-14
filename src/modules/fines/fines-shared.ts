import {
  FineDispute,
  FineDisputeEvent,
  IssuedFine,
  PenaltyDefinition,
} from '../../database/entities';

function mapBooking(row: {
  booking_reference: string;
  terminal_destination: string;
  booking_date: Date;
  booking_category: string;
  truck_booking_status: string;
}) {
  return {
    booking_reference: row.booking_reference,
    terminal_destination: row.terminal_destination,
    booking_date: row.booking_date,
    category: row.booking_category,
    truck_booking_status: row.truck_booking_status,
  };
}

function mapTransporter(row: {
  transporter_company_name: string;
  transporter_user_account: string | null;
  transporter_contact_person: string | null;
  transporter_contact_number: string | null;
  transporter_email: string | null;
}) {
  return {
    company_name: row.transporter_company_name,
    user_account: row.transporter_user_account ?? '',
    contact_person: row.transporter_contact_person ?? '',
    contact_number: row.transporter_contact_number ?? '',
    email: row.transporter_email ?? '',
  };
}

function mapDisputeEvent(event: FineDisputeEvent) {
  return {
    action: event.action,
    performed_by: event.performed_by,
    timestamp: event.created_at,
    notes: event.notes ?? undefined,
  };
}

export function mapPenalty(penalty: PenaltyDefinition) {
  const base: Record<string, unknown> = {
    id: penalty.id,
    penalty_code: penalty.penalty_code,
    name: penalty.name,
    description: penalty.description,
    fine_amount: Number(penalty.fine_amount),
    status: penalty.status,
    created_by: penalty.created_by ?? '',
    created_at: penalty.created_at,
  };
  if (penalty.updated_by) base.updated_by = penalty.updated_by;
  if (penalty.updated_at) base.updated_at = penalty.updated_at;
  return base;
}

export function mapIssuedFine(fine: IssuedFine) {
  return {
    id: fine.id,
    issued_fine_id: fine.issued_fine_id,
    penalty_code: fine.penalty_code,
    penalty_name: fine.penalty_name,
    fine_amount: Number(fine.fine_amount),
    booking: mapBooking(fine),
    truck_plate_number: fine.truck_plate_number,
    driver_name: fine.driver_name,
    transporter: mapTransporter(fine),
    date_issued: fine.date_issued,
    issued_by: fine.issued_by,
    status: fine.status,
  };
}

export function mapFineDispute(dispute: FineDispute) {
  const history = [...(dispute.resolution_history ?? [])].sort(
    (a, b) => a.created_at.getTime() - b.created_at.getTime(),
  );
  return {
    id: dispute.id,
    dispute_id: dispute.dispute_id,
    issued_fine_id: dispute.issued_fine_id,
    penalty_code: dispute.penalty_code,
    penalty_name: dispute.penalty_name,
    fine_amount: Number(dispute.fine_amount),
    booking: mapBooking(dispute),
    truck_plate_number: dispute.truck_plate_number,
    driver_name: dispute.driver_name,
    transporter: mapTransporter(dispute),
    date_issued: dispute.date_issued,
    date_disputed: dispute.date_disputed,
    dispute_reason: dispute.dispute_reason,
    dispute_status: dispute.dispute_status,
    resolution_outcome: dispute.resolution_outcome ?? undefined,
    managed_by: dispute.managed_by ?? undefined,
    resolution_date: dispute.resolution_date ?? undefined,
    adjusted_amount: dispute.adjusted_amount
      ? Number(dispute.adjusted_amount)
      : undefined,
    resolution_history: history.map(mapDisputeEvent),
  };
}

export function applyListSort(
  qb: { orderBy: (sort: string, dir: 'ASC' | 'DESC') => void },
  alias: string,
  sort: string | undefined,
  sortDir: string | undefined,
  allowed: Record<string, string>,
  defaultColumn: string,
) {
  const column = allowed[sort ?? ''] ?? defaultColumn;
  const direction: 'ASC' | 'DESC' = sortDir === 'ASC' ? 'ASC' : 'DESC';
  qb.orderBy(`${alias}.${column}`, direction);
}
