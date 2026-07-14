import { DataSource } from 'typeorm';
import {
  Booking,
  BookingException,
  BookingTimelineEntry,
  DttrTerminalRequest,
  FineDispute,
  FineDisputeEvent,
  IssuedFine,
  PenaltyDefinition,
  UtilityAssignedPersonnel,
  UtilityTicket,
  UtilityTicketHistory,
} from '../../entities';
import {
  BOOKING_SEEDS,
  DTTR_SEEDS,
  FINE_DISPUTE_SEEDS,
  ISSUED_FINE_SEEDS,
  PENALTY_DEFINITION_SEEDS,
  UTILITY_TICKET_SEEDS,
} from '../data/sprint3-seeds';

export async function runSprint3Seed(dataSource: DataSource): Promise<void> {
  console.log('  → Sprint 3 (fines, DTTR, bookings, utility tickets)');

  const penaltyRepo = dataSource.getRepository(PenaltyDefinition);
  for (const seed of PENALTY_DEFINITION_SEEDS) {
    const exists = await penaltyRepo.findOne({
      where: { penalty_code: seed.penalty_code },
    });
    if (!exists) {
      await penaltyRepo.save(penaltyRepo.create(seed));
      console.log(`    ✅ Penalty ${seed.penalty_code}`);
    }
  }

  const issuedRepo = dataSource.getRepository(IssuedFine);
  for (const seed of ISSUED_FINE_SEEDS) {
    const exists = await issuedRepo.findOne({
      where: { issued_fine_id: seed.issued_fine_id },
    });
    if (!exists) {
      await issuedRepo.save(
        issuedRepo.create({
          ...seed,
          booking_date: new Date(seed.booking_date),
          date_issued: new Date(seed.date_issued),
        }),
      );
      console.log(`    ✅ Issued fine ${seed.issued_fine_id}`);
    }
  }

  const disputeRepo = dataSource.getRepository(FineDispute);
  const eventRepo = dataSource.getRepository(FineDisputeEvent);
  for (const seed of FINE_DISPUTE_SEEDS) {
    let dispute = await disputeRepo.findOne({
      where: { dispute_id: seed.dispute_id },
    });
    if (!dispute) {
      const { events, ...rest } = seed;
      dispute = await disputeRepo.save(
        disputeRepo.create({
          ...rest,
          booking_date: new Date(rest.booking_date),
          date_issued: new Date(rest.date_issued),
          date_disputed: new Date(rest.date_disputed),
          resolution_date: rest.resolution_date
            ? new Date(rest.resolution_date)
            : null,
        }),
      );
      for (const event of events) {
        await eventRepo.save(
          eventRepo.create({
            dispute_id: dispute.id,
            action: event.action,
            performed_by: event.performed_by,
            notes: event.notes,
            created_at: new Date(event.created_at),
          }),
        );
      }
      console.log(`    ✅ Dispute ${seed.dispute_id}`);
    }
  }

  const dttrRepo = dataSource.getRepository(DttrTerminalRequest);
  for (const seed of DTTR_SEEDS) {
    const exists = await dttrRepo.findOne({
      where: { terminal_code: seed.terminal_code },
    });
    if (!exists) {
      await dttrRepo.save(
        dttrRepo.create({
          ...seed,
          last_updated_at: new Date(seed.last_updated_at),
        }),
      );
      console.log(`    ✅ DTTR ${seed.terminal_code}`);
    }
  }

  const bookingRepo = dataSource.getRepository(Booking);
  const timelineRepo = dataSource.getRepository(BookingTimelineEntry);
  const exceptionRepo = dataSource.getRepository(BookingException);
  for (const seed of BOOKING_SEEDS) {
    let booking = await bookingRepo.findOne({
      where: { booking_id: seed.booking_id },
    });
    if (!booking) {
      const { timeline, exceptions, ...rest } = seed;
      booking = await bookingRepo.save(
        bookingRepo.create({
          ...rest,
          created_at: new Date(rest.created_at),
          last_updated_at: new Date(rest.last_updated_at),
          completed_at: rest.completed_at ? new Date(rest.completed_at) : null,
          left_pregate_at: rest.left_pregate_at
            ? new Date(rest.left_pregate_at)
            : null,
          left_manifest_at: rest.left_manifest_at
            ? new Date(rest.left_manifest_at)
            : null,
          tow_requested_at: rest.tow_requested_at
            ? new Date(rest.tow_requested_at)
            : null,
        }),
      );
      for (const entry of timeline) {
        const timelineEntry = entry as {
          status: string;
          performed_by?: string;
          notes?: string;
          created_at: string;
        };
        await timelineRepo.save(
          timelineRepo.create({
            booking_id: booking.id,
            status: timelineEntry.status,
            performed_by: timelineEntry.performed_by ?? null,
            notes: timelineEntry.notes ?? null,
            created_at: new Date(timelineEntry.created_at),
          }),
        );
      }
      for (const exception of exceptions ?? []) {
        await exceptionRepo.save(
          exceptionRepo.create({
            booking_id: booking.id,
            type: exception.type,
            description: exception.description,
            created_at: new Date(exception.created_at),
          }),
        );
      }
      console.log(`    ✅ Booking ${seed.booking_id}`);
    }
  }

  const ticketRepo = dataSource.getRepository(UtilityTicket);
  const historyRepo = dataSource.getRepository(UtilityTicketHistory);
  const personnelRepo = dataSource.getRepository(UtilityAssignedPersonnel);
  for (const seed of UTILITY_TICKET_SEEDS) {
    let ticket = await ticketRepo.findOne({
      where: { ticket_id: seed.ticket_id },
    });
    if (!ticket) {
      const { history, personnel, ...rest } = seed;
      ticket = await ticketRepo.save(
        ticketRepo.create({
          ...rest,
          date_raised: new Date(rest.date_raised),
          approved_at: rest.approved_at ? new Date(rest.approved_at) : null,
          super_admin_approved: rest.super_admin_approved ?? false,
          e_ticket_available: rest.e_ticket_available ?? false,
        }),
      );
      for (const entry of history) {
        await historyRepo.save(
          historyRepo.create({
            ticket_id: ticket.id,
            status: entry.status,
            performed_by: entry.performed_by,
            notes: entry.notes,
            created_at: new Date(entry.created_at),
          }),
        );
      }
      for (const person of personnel ?? []) {
        await personnelRepo.save(
          personnelRepo.create({
            ticket_id: ticket.id,
            name: person.name,
            role: person.role,
            assigned_at: new Date(person.assigned_at),
          }),
        );
      }
      console.log(`    ✅ Utility ticket ${seed.ticket_id}`);
    }
  }
}
