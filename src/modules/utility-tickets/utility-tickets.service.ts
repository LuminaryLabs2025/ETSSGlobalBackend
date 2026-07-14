import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import {
  UtilityTicket,
  UtilityTicketHistory,
  User,
} from '../../database/entities';
import {
  applySearch,
  paginateQueryBuilder,
  requireEntity,
  saveWithConflict,
  toCsv,
} from '../../common/utils/query-helpers';
import {
  CreateUtilityTicketDto,
  QueryUtilityTicketsDto,
  UpdateUtilityTicketDto,
} from './dto/utility-tickets.dto';

const SHORT_DESCRIPTION_LENGTH = 80;

@Injectable()
export class UtilityTicketsService {
  constructor(
    @InjectRepository(UtilityTicket)
    private readonly ticketRepository: Repository<UtilityTicket>,
    @InjectRepository(UtilityTicketHistory)
    private readonly historyRepository: Repository<UtilityTicketHistory>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async summary() {
    const stats = await this.ticketRepository
      .createQueryBuilder('row')
      .select('COUNT(*)', 'total')
      .addSelect(
        `COUNT(*) FILTER (WHERE row.status = 'PENDING')`,
        'pending',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.status = 'IN_PROGRESS')`,
        'in_progress',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.status = 'RESOLVED')`,
        'resolved',
      )
      .addSelect(`COUNT(*) FILTER (WHERE row.status = 'CLOSED')`, 'closed')
      .addSelect(
        `COUNT(*) FILTER (WHERE row.terminal_type = 'PORT')`,
        'port_terminals',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE row.terminal_type = 'NON_PORT')`,
        'non_port_terminals',
      )
      .getRawOne<Record<string, string>>();

    return {
      total: Number(stats?.total ?? 0),
      pending: Number(stats?.pending ?? 0),
      in_progress: Number(stats?.in_progress ?? 0),
      resolved: Number(stats?.resolved ?? 0),
      closed: Number(stats?.closed ?? 0),
      port_terminals: Number(stats?.port_terminals ?? 0),
      non_port_terminals: Number(stats?.non_port_terminals ?? 0),
    };
  }

  async findTickets(query: QueryUtilityTicketsDto) {
    const qb = this.ticketRepository.createQueryBuilder('row');
    this.applyTicketFilters(qb, query);

    const sortField = query.sort ?? 'date_raised';
    const sortDir = query.sort_dir ?? 'DESC';
    qb.orderBy(`row.${sortField}`, sortDir);

    const result = await paginateQueryBuilder(
      qb,
      query.page ?? 1,
      query.limit ?? 20,
    );
    return {
      data: result.data.map((ticket) => this.mapTicketResponse(ticket)),
      meta: result.meta,
    };
  }

  async findTicket(id: string) {
    const ticket = await this.ticketRepository.findOne({
      where: { id },
      relations: ['request_history', 'assigned_personnel'],
    });
    if (!ticket) {
      throw new NotFoundException('Utility ticket not found');
    }
    this.sortRelations(ticket);
    return this.mapTicketResponse(ticket);
  }

  async generateTicket(dto: CreateUtilityTicketDto, userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const raisedByName = user
      ? `${user.first_name} ${user.last_name}`
      : 'SuperAdmin';

    const ticketId = await this.nextTicketId();
    const fullDescription = dto.description.trim();
    const ticket = this.ticketRepository.create({
      ticket_id: ticketId,
      terminal_id: dto.terminal_id ?? null,
      terminal_name: dto.terminal_name.trim(),
      terminal_code: dto.terminal_code?.trim() ?? null,
      terminal_type: dto.terminal_type,
      terminal_location: dto.terminal_location?.trim() ?? null,
      request_type: dto.request_type,
      description: this.truncateDescription(fullDescription),
      full_description: fullDescription,
      status: 'PENDING',
      booking_priority: dto.terminal_type === 'PORT' ? 'PRIORITY' : 'STANDARD',
      delivery_company_name: dto.delivery_company_name.trim(),
      truck_plate_number: dto.truck_plate_number?.trim() ?? null,
      raised_by_user_id: userId,
      raised_by_user_name: raisedByName,
      super_admin_approved: false,
      e_ticket_available: false,
    });

    const saved = await saveWithConflict(
      this.ticketRepository,
      ticket,
      'A utility ticket with this ticket ID already exists',
    );

    await this.appendHistory(
      saved.id,
      'PENDING',
      raisedByName,
      'Utility ticket generated.',
    );

    return this.findTicket(saved.id);
  }

  async updateTicket(
    id: string,
    dto: UpdateUtilityTicketDto,
    userId: string,
  ) {
    const ticket = await requireEntity(
      this.ticketRepository,
      id,
      'Utility ticket not found',
    );

    if (ticket.super_admin_approved) {
      throw new BadRequestException('Cannot edit an approved utility ticket');
    }
    if (ticket.status === 'CLOSED') {
      throw new BadRequestException('Cannot edit a closed utility ticket');
    }

    const actor = await this.resolveActor(userId);
    const previousStatus = ticket.status;

    if (dto.request_type !== undefined) {
      ticket.request_type = dto.request_type;
    }
    if (dto.delivery_company_name !== undefined) {
      ticket.delivery_company_name = dto.delivery_company_name.trim();
    }
    if (dto.truck_plate_number !== undefined) {
      ticket.truck_plate_number = dto.truck_plate_number.trim() || null;
    }
    if (dto.full_description !== undefined) {
      const full = dto.full_description.trim();
      ticket.full_description = full;
      ticket.description = this.truncateDescription(full);
    }
    if (dto.status !== undefined) {
      ticket.status = dto.status;
    }

    await this.ticketRepository.save(ticket);

    if (dto.status !== undefined && dto.status !== previousStatus) {
      await this.appendHistory(
        ticket.id,
        dto.status,
        actor.name,
        `Status updated to ${dto.status}.`,
      );
    } else {
      await this.appendHistory(
        ticket.id,
        ticket.status,
        actor.name,
        'Ticket details updated.',
      );
    }

    return this.findTicket(id);
  }

  async approveTicket(id: string, userId: string) {
    const ticket = await requireEntity(
      this.ticketRepository,
      id,
      'Utility ticket not found',
    );

    if (ticket.super_admin_approved) {
      throw new BadRequestException('Utility ticket is already approved');
    }
    if (ticket.status === 'CLOSED') {
      throw new BadRequestException('Cannot approve a closed utility ticket');
    }

    const actor = await this.resolveActor(userId);
    const wasPending = ticket.status === 'PENDING';

    ticket.super_admin_approved = true;
    ticket.approved_by = actor.name;
    ticket.approved_at = new Date();
    ticket.e_ticket_available = true;
    if (wasPending) {
      ticket.status = 'IN_PROGRESS';
    }

    await this.ticketRepository.save(ticket);
    await this.appendHistory(
      ticket.id,
      ticket.status,
      actor.name,
      wasPending
        ? 'Approved by SuperAdmin — status set to IN_PROGRESS.'
        : 'Approved by SuperAdmin.',
    );

    return this.findTicket(id);
  }

  async cancelTicket(id: string, userId: string) {
    const ticket = await requireEntity(
      this.ticketRepository,
      id,
      'Utility ticket not found',
    );

    if (ticket.status === 'CLOSED') {
      throw new BadRequestException('Utility ticket is already closed');
    }

    const actor = await this.resolveActor(userId);
    ticket.status = 'CLOSED';
    await this.ticketRepository.save(ticket);
    await this.appendHistory(
      ticket.id,
      'CLOSED',
      actor.name,
      'Ticket cancelled by SuperAdmin.',
    );

    return this.findTicket(id);
  }

  async getETicket(id: string) {
    const ticket = await requireEntity(
      this.ticketRepository,
      id,
      'Utility ticket not found',
    );

    if (!ticket.e_ticket_available) {
      throw new BadRequestException(
        'E-ticket is not available for this utility ticket',
      );
    }

    const hydrated = await this.ticketRepository.findOne({
      where: { id },
      relations: ['request_history', 'assigned_personnel'],
    });
    if (!hydrated) {
      throw new NotFoundException('Utility ticket not found');
    }
    this.sortRelations(hydrated);
    return this.mapTicketResponse(hydrated);
  }

  async exportCsv(query: QueryUtilityTicketsDto): Promise<string> {
    const { data } = await this.findTickets({
      ...query,
      page: 1,
      limit: 10000,
    });
    const headers = [
      'Ticket ID',
      'Terminal Name',
      'Terminal Type',
      'Terminal Code',
      'Request Type',
      'Status',
      'Booking Priority',
      'Delivery Company',
      'Truck Plate',
      'Raised By',
      'Date Raised',
      'Last Updated',
      'Super Admin Approved',
    ];
    const rows: (string | number | null | undefined)[][] = data.map(
      (t: Record<string, unknown>) => {
        const terminal = t.terminal as Record<string, unknown>;
        const raisedBy = t.raised_by as Record<string, unknown>;
        return [
          t.ticket_id as string,
          terminal.name as string,
          terminal.type as string,
          terminal.code as string,
          t.request_type as string,
          t.status as string,
          t.booking_priority as string,
          t.delivery_company_name as string,
          (t.truck_plate_number as string) ?? '',
          raisedBy.user_name as string,
          t.date_raised as string,
          t.last_updated_at as string,
          t.super_admin_approved ? 'Yes' : 'No',
        ];
      },
    );
    return toCsv([headers, ...rows]);
  }

  private applyTicketFilters(
    qb: SelectQueryBuilder<UtilityTicket>,
    query: QueryUtilityTicketsDto,
  ) {
    applySearch(qb, 'row', ['terminal_name', 'ticket_id'], query.search);

    if (query.terminal_type) {
      qb.andWhere('row.terminal_type = :terminalType', {
        terminalType: query.terminal_type,
      });
    }
    if (query.status) {
      qb.andWhere('row.status = :status', { status: query.status });
    }
    if (query.raised_by?.trim()) {
      qb.andWhere('row.raised_by_user_name ILIKE :raisedBy', {
        raisedBy: `%${query.raised_by.trim()}%`,
      });
    }
    if (query.date_from) {
      qb.andWhere('row.date_raised >= :dateFrom', {
        dateFrom: `${query.date_from}T00:00:00.000Z`,
      });
    }
    if (query.date_to) {
      qb.andWhere('row.date_raised <= :dateTo', {
        dateTo: `${query.date_to}T23:59:59.999Z`,
      });
    }
  }

  /** UT-YYYY-###### — sequential per calendar year. */
  private async nextTicketId(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `UT-${year}-`;
    const raw = await this.ticketRepository
      .createQueryBuilder('row')
      .select(
        `MAX(CAST(SUBSTRING(row.ticket_id FROM ${prefix.length + 1}) AS INTEGER))`,
        'max',
      )
      .where(`row.ticket_id ~ :pattern`, { pattern: `^UT-${year}-[0-9]+$` })
      .getRawOne<{ max: string | null }>();
    const next = (raw?.max ? Number(raw.max) : 0) + 1;
    return `${prefix}${String(next).padStart(6, '0')}`;
  }

  private truncateDescription(text: string): string {
    if (text.length <= SHORT_DESCRIPTION_LENGTH) return text;
    return text.slice(0, SHORT_DESCRIPTION_LENGTH);
  }

  private async appendHistory(
    ticketId: string,
    status: string,
    performedBy: string,
    notes?: string,
  ) {
    const entry = this.historyRepository.create({
      ticket_id: ticketId,
      status,
      performed_by: performedBy,
      notes: notes ?? null,
    });
    return this.historyRepository.save(entry);
  }

  private async resolveActor(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    return {
      name: user ? `${user.first_name} ${user.last_name}` : 'SuperAdmin',
    };
  }

  private sortRelations(ticket: UtilityTicket): UtilityTicket {
    ticket.request_history = [...(ticket.request_history ?? [])].sort(
      (a, b) => a.created_at.getTime() - b.created_at.getTime(),
    );
    ticket.assigned_personnel = [...(ticket.assigned_personnel ?? [])].sort(
      (a, b) => a.assigned_at.getTime() - b.assigned_at.getTime(),
    );
    return ticket;
  }

  mapTicketResponse(ticket: UtilityTicket) {
    const response: Record<string, unknown> = {
      id: ticket.id,
      ticket_id: ticket.ticket_id,
      terminal: {
        id: ticket.terminal_id ?? '',
        name: ticket.terminal_name,
        code: ticket.terminal_code ?? '',
        type: ticket.terminal_type,
        location: ticket.terminal_location ?? '',
      },
      request_type: ticket.request_type,
      description: ticket.description,
      full_description: ticket.full_description,
      status: ticket.status,
      booking_priority: ticket.booking_priority,
      delivery_company_name: ticket.delivery_company_name,
      date_raised: ticket.date_raised,
      last_updated_at: ticket.last_updated_at,
      raised_by: {
        user_id: ticket.raised_by_user_id ?? '',
        user_name: ticket.raised_by_user_name,
      },
      super_admin_approved: ticket.super_admin_approved,
      request_history: (ticket.request_history ?? []).map((entry) => ({
        id: entry.id,
        status: entry.status,
        timestamp: entry.created_at,
        performed_by: entry.performed_by,
        ...(entry.notes ? { notes: entry.notes } : {}),
      })),
      e_ticket_available: ticket.e_ticket_available,
    };

    if (ticket.truck_plate_number) {
      response.truck_plate_number = ticket.truck_plate_number;
    }
    if (ticket.approved_by) {
      response.approved_by = ticket.approved_by;
    }
    if (ticket.approved_at) {
      response.approved_at = ticket.approved_at;
    }
    if (ticket.assigned_personnel?.length) {
      response.assigned_personnel = ticket.assigned_personnel.map((person) => ({
        id: person.id,
        name: person.name,
        role: person.role,
        assigned_at: person.assigned_at,
      }));
    }

    return response;
  }
}
