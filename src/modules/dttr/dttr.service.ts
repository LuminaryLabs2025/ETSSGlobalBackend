import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DttrEditAudit,
  DttrSubmission,
  DttrTerminalRequest,
} from '../../database/entities';
import {
  applySearch,
  paginateQueryBuilder,
  requireEntity,
} from '../../common/utils/query-helpers';
import {
  ConfigureModeDto,
  DttrBreakdownDto,
  QueryDttrDto,
  SuperAdminEditDttrDto,
} from './dto/dttr.dto';

const BREAKDOWN_FIELDS = [
  'exports',
  'imports',
  'empties',
  'gatepass',
] as const;

type BreakdownField = (typeof BREAKDOWN_FIELDS)[number];

@Injectable()
export class DttrService {
  constructor(
    @InjectRepository(DttrTerminalRequest)
    private readonly terminalRequestRepository: Repository<DttrTerminalRequest>,
    @InjectRepository(DttrSubmission)
    private readonly submissionRepository: Repository<DttrSubmission>,
    @InjectRepository(DttrEditAudit)
    private readonly editAuditRepository: Repository<DttrEditAudit>,
  ) {}

  async summary() {
    const rows = await this.terminalRequestRepository.find();
    let total_capacity = 0;
    let total_requested_today = 0;
    let manual_terminals = 0;
    let automated_terminals = 0;
    let at_capacity = 0;
    let under_capacity = 0;

    for (const row of rows) {
      const total = this.breakdownSum(this.requestedBreakdown(row));
      total_capacity += row.approved_daily_capacity;
      total_requested_today += total;
      if (row.request_mode === 'MANUAL') manual_terminals++;
      else automated_terminals++;
      if (total >= row.approved_daily_capacity) at_capacity++;
      else under_capacity++;
    }

    return {
      total_terminals: rows.length,
      total_capacity,
      total_requested_today,
      manual_terminals,
      automated_terminals,
      at_capacity,
      under_capacity,
    };
  }

  async findEditAudits() {
    const rows = await this.editAuditRepository.find({
      order: { edited_at: 'DESC' },
    });
    return rows.map((row) => this.mapEditAudit(row));
  }

  async findAll(query: QueryDttrDto) {
    const qb = this.terminalRequestRepository.createQueryBuilder('row');
    applySearch(qb, 'row', ['terminal_name', 'terminal_code'], query.search);

    if (query.request_mode) {
      qb.andWhere('row.request_mode = :mode', { mode: query.request_mode });
    }

    if (query.date) {
      qb.andWhere('DATE(row.last_updated_at) = :date', { date: query.date });
    }

    const sort = query.sort ?? 'terminal_name';
    const sortDir = query.sort_dir ?? 'ASC';
    if (sort === 'total_requested') {
      qb.orderBy(
        '(row.req_exports + row.req_imports + row.req_empties + row.req_gatepass)',
        sortDir,
      );
    } else {
      qb.orderBy(`row.${sort}`, sortDir);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const result = await paginateQueryBuilder(qb, page, limit);
    return {
      data: result.data.map((row) => this.mapTerminalRequest(row)),
      meta: result.meta,
    };
  }

  async findOne(id: string) {
    const row = await requireEntity(
      this.terminalRequestRepository,
      id,
      'DTTR terminal request not found',
    );
    return this.mapTerminalRequest(row);
  }

  async submit(
    id: string,
    dto: DttrBreakdownDto,
    actor: { id: string; first_name: string; last_name: string },
  ) {
    const row = await requireEntity(
      this.terminalRequestRepository,
      id,
      'DTTR terminal request not found',
    );
    const total = this.breakdownSum(dto);
    this.assertWithinCapacity(total, row.approved_daily_capacity);

    row.req_exports = dto.exports;
    row.req_imports = dto.imports;
    row.req_empties = dto.empties;
    row.req_gatepass = dto.gatepass;
    row.last_updated_at = new Date();
    await this.terminalRequestRepository.save(row);

    const submission = this.submissionRepository.create({
      terminal_request_id: row.id,
      terminal_name: row.terminal_name,
      req_exports: dto.exports,
      req_imports: dto.imports,
      req_empties: dto.empties,
      req_gatepass: dto.gatepass,
      total_requested: total,
      approved_capacity: row.approved_daily_capacity,
      request_mode: row.request_mode,
      submitted_by: `${actor.first_name} ${actor.last_name}`,
      submitted_by_id: actor.id,
    });
    await this.submissionRepository.save(submission);
    return this.mapTerminalRequest(row);
  }

  async findSubmissions(id: string) {
    await requireEntity(
      this.terminalRequestRepository,
      id,
      'DTTR terminal request not found',
    );
    const rows = await this.submissionRepository.find({
      where: { terminal_request_id: id },
      order: { submitted_at: 'DESC' },
    });
    return rows.map((row) => this.mapSubmission(row));
  }

  async superAdminEdit(
    id: string,
    dto: SuperAdminEditDttrDto,
    actor: { id: string; first_name: string; last_name: string },
  ) {
    if (!dto.justification?.trim()) {
      throw new BadRequestException('Justification is required');
    }
    if (!dto.approval_reference?.trim() && !dto.approval_document_name?.trim()) {
      throw new BadRequestException(
        'Either approval_reference or approval_document_name is required',
      );
    }

    const row = await requireEntity(
      this.terminalRequestRepository,
      id,
      'DTTR terminal request not found',
    );
    const total = this.breakdownSum(dto.breakdown);
    this.assertWithinCapacity(total, row.approved_daily_capacity);

    const previous = this.requestedBreakdown(row);
    const next = dto.breakdown;
    const edited_fields: BreakdownField[] = [];
    const previous_values: Record<string, number> = {};
    const new_values: Record<string, number> = {};

    for (const field of BREAKDOWN_FIELDS) {
      if (previous[field] !== next[field]) {
        edited_fields.push(field);
        previous_values[field] = previous[field];
        new_values[field] = next[field];
      }
    }

    row.req_exports = next.exports;
    row.req_imports = next.imports;
    row.req_empties = next.empties;
    row.req_gatepass = next.gatepass;
    row.last_updated_at = new Date();
    await this.terminalRequestRepository.save(row);

    if (edited_fields.length > 0) {
      const audit = this.editAuditRepository.create({
        terminal_request_id: row.id,
        terminal_name: row.terminal_name,
        edited_fields,
        performed_by: `${actor.first_name} ${actor.last_name}`,
        performed_by_id: actor.id,
        justification: dto.justification.trim(),
        approval_reference: dto.approval_reference?.trim() || null,
        approval_document_name: dto.approval_document_name?.trim() || null,
        previous_values,
        new_values,
      });
      await this.editAuditRepository.save(audit);
    }

    return this.mapTerminalRequest(row);
  }

  async configureMode(id: string, dto: ConfigureModeDto) {
    const row = await requireEntity(
      this.terminalRequestRepository,
      id,
      'DTTR terminal request not found',
    );
    const wasManual = row.request_mode === 'MANUAL';

    if (dto.request_mode === 'AUTOMATED') {
      if (!dto.automated_template) {
        throw new BadRequestException(
          'automated_template is required when request_mode is AUTOMATED',
        );
      }
      const templateTotal = this.breakdownSum(dto.automated_template);
      this.assertWithinCapacity(templateTotal, row.approved_daily_capacity);

      row.auto_exports = dto.automated_template.exports;
      row.auto_imports = dto.automated_template.imports;
      row.auto_empties = dto.automated_template.empties;
      row.auto_gatepass = dto.automated_template.gatepass;
      row.request_mode = 'AUTOMATED';

      if (wasManual) {
        row.req_exports = dto.automated_template.exports;
        row.req_imports = dto.automated_template.imports;
        row.req_empties = dto.automated_template.empties;
        row.req_gatepass = dto.automated_template.gatepass;
      }
    } else {
      row.request_mode = 'MANUAL';
      row.auto_exports = null;
      row.auto_imports = null;
      row.auto_empties = null;
      row.auto_gatepass = null;
    }

    row.last_updated_at = new Date();
    await this.terminalRequestRepository.save(row);
    return this.mapTerminalRequest(row);
  }

  private breakdownSum(b: DttrBreakdownDto | Record<BreakdownField, number>) {
    return b.exports + b.imports + b.empties + b.gatepass;
  }

  private requestedBreakdown(row: DttrTerminalRequest): Record<BreakdownField, number> {
    return {
      exports: row.req_exports,
      imports: row.req_imports,
      empties: row.req_empties,
      gatepass: row.req_gatepass,
    };
  }

  private assertWithinCapacity(total: number, capacity: number) {
    if (total > capacity) {
      throw new BadRequestException(
        `Total requested (${total}) exceeds approved daily capacity (${capacity})`,
      );
    }
  }

  private mapTerminalRequest(row: DttrTerminalRequest) {
    const result: {
      id: string;
      terminal_name: string;
      terminal_code: string;
      approved_daily_capacity: number;
      requested: Record<BreakdownField, number>;
      last_updated_at: Date;
      request_mode: string;
      automated_template?: Record<BreakdownField, number>;
    } = {
      id: row.id,
      terminal_name: row.terminal_name,
      terminal_code: row.terminal_code,
      approved_daily_capacity: row.approved_daily_capacity,
      requested: this.requestedBreakdown(row),
      last_updated_at: row.last_updated_at,
      request_mode: row.request_mode,
    };

    if (row.request_mode === 'AUTOMATED') {
      result.automated_template = {
        exports: row.auto_exports ?? 0,
        imports: row.auto_imports ?? 0,
        empties: row.auto_empties ?? 0,
        gatepass: row.auto_gatepass ?? 0,
      };
    }

    return result;
  }

  private mapSubmission(row: DttrSubmission) {
    return {
      id: row.id,
      terminal_id: row.terminal_request_id,
      terminal_name: row.terminal_name,
      submitted_at: row.submitted_at,
      submitted_by: row.submitted_by,
      submitted_by_id: row.submitted_by_id,
      breakdown: {
        exports: row.req_exports,
        imports: row.req_imports,
        empties: row.req_empties,
        gatepass: row.req_gatepass,
      },
      total_requested: row.total_requested,
      approved_capacity: row.approved_capacity,
      request_mode: row.request_mode,
    };
  }

  private mapEditAudit(row: DttrEditAudit) {
    return {
      id: row.id,
      terminal_id: row.terminal_request_id,
      terminal_name: row.terminal_name,
      edited_fields: row.edited_fields,
      performed_by: row.performed_by,
      performed_by_id: row.performed_by_id,
      justification: row.justification,
      approval_reference: row.approval_reference,
      approval_document_name: row.approval_document_name,
      previous_values: row.previous_values,
      new_values: row.new_values,
      edited_at: row.edited_at,
    };
  }
}
