import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { Request } from 'express';
import * as ExcelJS from 'exceljs';
import PDFDocument = require('pdfkit');
import { ActivityLog } from '../../database/entities/activity-log.entity';
import { QueryActivityLogsDto } from './dto/query-activity-logs.dto';
import { ActivityLogEntryStatus } from '../../common/enums';
import {
  extractEntityIdFromPath,
  httpMethodToAction,
  inferHttpActivityContext,
  parseApiSegments,
} from '../../common/utils/activity-log-mapping';

const EXPORT_MAX_ROWS = 50_000;

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepository: Repository<ActivityLog>,
  ) {}

  /** Called from HTTP interceptor after successful mutating requests. */
  async recordHttpSuccess(req: Request, responseData: any): Promise<void> {
    try {
      const method = req.method;
      const url = req.originalUrl || req.url || '';
      const pathOnly = url.split('?')[0];
      const ctx = inferHttpActivityContext(method, pathOnly);

      let userId: string | null = (req as any).user?.id ?? null;
      if (pathOnly.includes('/api/auth/login') && responseData?.user?.id) {
        userId = responseData.user.id;
      }

      let entityId: string | null =
        (typeof responseData?.id === 'string' ? responseData.id : null) ??
        extractEntityIdFromPath(pathOnly);

      const metadata: Record<string, any> = {
        method,
        url,
        body: this.sanitizeBody(req.body),
      };
      const seg = parseApiSegments(pathOnly);
      if (
        ctx.entitySlug === 'users' &&
        method === 'POST' &&
        seg.length === 1 &&
        responseData?.user_type?.name
      ) {
        metadata.created_user_type = responseData.user_type.name;
      }

      const log = this.activityLogRepository.create({
        user_id: userId,
        action: httpMethodToAction(method),
        entity: ctx.entitySlug,
        entity_id: entityId,
        feature_module: ctx.module,
        action_label: ctx.actionLabel,
        entry_status: ActivityLogEntryStatus.SUCCESS,
        metadata,
        ip_address: req.ip,
        user_agent: req.get('user-agent') ?? null,
        http_status_code: null,
        error_message: null,
      } as Partial<ActivityLog>);
      await this.activityLogRepository.save(log);
    } catch {
      /* never break the request */
    }
  }

  /** Called from global exception filter for failed mutating requests. */
  async recordHttpFailure(
    req: Request,
    httpStatus: number,
    message: string,
  ): Promise<void> {
    if (req.method === 'GET') return;
    try {
      const method = req.method;
      const url = req.originalUrl || req.url || '';
      const pathOnly = url.split('?')[0];
      const ctx = inferHttpActivityContext(method, pathOnly);
      const msg =
        typeof message === 'string'
          ? message.slice(0, 4000)
          : String(message).slice(0, 4000);

      const log = this.activityLogRepository.create({
        user_id: (req as any).user?.id ?? null,
        action: httpMethodToAction(method),
        entity: ctx.entitySlug,
        entity_id: extractEntityIdFromPath(pathOnly),
        feature_module: ctx.module,
        action_label: `${ctx.actionLabel} (failed)`,
        entry_status: ActivityLogEntryStatus.FAILED,
        metadata: {
          method,
          url,
          body: this.sanitizeBody(req.body),
        },
        ip_address: req.ip,
        user_agent: req.get('user-agent') ?? null,
        http_status_code: httpStatus,
        error_message: msg,
      } as Partial<ActivityLog>);
      await this.activityLogRepository.save(log);
    } catch {
      /* swallow */
    }
  }

  async findAll(query: QueryActivityLogsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.activityLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .leftJoinAndSelect('user.user_type', 'userType')
      .leftJoinAndSelect('user.company', 'company');
    this.applyFilters(qb, query);

    const allowedSort: Record<string, string> = {
      timestamp: 'log.timestamp',
      action: 'log.action',
      module: 'log.feature_module',
      entry_status: 'log.entry_status',
    };
    const col = allowedSort[query.sort_by ?? 'timestamp'] ?? 'log.timestamp';
    const order = query.sort_order === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(col, order);

    const total = await qb.clone().getCount();
    qb.skip((page - 1) * limit).take(limit);
    const rows = await qb.getMany();

    const data = rows.map((log, i) =>
      this.serializeListItem(log, (page - 1) * limit + i + 1),
    );

    return {
      data,
      meta: { total, page, limit, total_pages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const log = await this.activityLogRepository.findOne({
      where: { id },
      relations: ['user', 'user.user_type', 'user.company'],
    });
    if (!log) throw new NotFoundException('Activity log not found');
    return this.serializeDetail(log);
  }

  async getSummary() {
    const total = await this.activityLogRepository.count();

    const byUserTypeRaw = await this.activityLogRepository
      .createQueryBuilder('log')
      .leftJoin('log.user', 'u')
      .leftJoin('u.user_type', 'ut')
      .select(
        "COALESCE(ut.name, 'Unknown / system')",
        'user_type_name',
      )
      .addSelect('COUNT(log.id)', 'count')
      .groupBy("COALESCE(ut.name, 'Unknown / system')")
      .getRawMany();

    const byModuleRaw = await this.activityLogRepository
      .createQueryBuilder('log')
      .select("COALESCE(NULLIF(TRIM(log.module), ''), 'Unspecified')", 'module')
      .addSelect('COUNT(log.id)', 'count')
      .groupBy("COALESCE(NULLIF(TRIM(log.module), ''), 'Unspecified')")
      .getRawMany();

    const byStatusRaw = await this.activityLogRepository
      .createQueryBuilder('log')
      .select('log.entry_status', 'status')
      .addSelect('COUNT(log.id)', 'count')
      .groupBy('log.entry_status')
      .getRawMany();

    let successful = 0;
    let failed = 0;
    for (const row of byStatusRaw) {
      const c = parseInt(row.count, 10);
      if (row.status === ActivityLogEntryStatus.FAILED) failed += c;
      else successful += c;
    }

    return {
      total_activities: total,
      by_user_type: byUserTypeRaw.map((r) => ({
        user_type: r.user_type_name,
        count: parseInt(r.count, 10),
      })),
      by_module: byModuleRaw.map((r) => ({
        module: r.module,
        count: parseInt(r.count, 10),
      })),
      by_status: {
        successful,
        failed,
      },
    };
  }

  async export(
    query: QueryActivityLogsDto,
    format: 'csv' | 'xlsx' | 'pdf',
  ): Promise<{ body: Buffer | string; mime: string; ext: string }> {
    const qb = this.activityLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .leftJoinAndSelect('user.user_type', 'userType')
      .leftJoinAndSelect('user.company', 'company');
    this.applyFilters(qb, query);
    qb.orderBy('log.timestamp', 'DESC').take(EXPORT_MAX_ROWS);
    const rows = await qb.getMany();

    const serialOffset = 0;
    const items = rows.map((log, i) =>
      this.serializeListItem(log, serialOffset + i + 1),
    );

    if (format === 'csv') {
      const header = [
        'S/No',
        'Timestamp',
        'User Name',
        'User Email',
        'User Type',
        'Linked Company',
        'Action',
        'Module',
        'IP Address',
        'User Agent',
        'Status',
        'Entity ID',
      ];
      const lines = [
        header.join(','),
        ...items.map((r) =>
          [
            r.serial_no,
            r.timestamp,
            this.csvEscape(r.user_name || ''),
            this.csvEscape(r.user_email || ''),
            this.csvEscape(r.user_type_name || ''),
            this.csvEscape(r.linked_company_name || ''),
            this.csvEscape(r.action_performed || ''),
            this.csvEscape(r.module_feature || ''),
            this.csvEscape(r.ip_address || ''),
            this.csvEscape(r.user_agent || ''),
            r.status,
            this.csvEscape(r.entity_id || ''),
          ].join(','),
        ),
      ];
      return {
        body: lines.join('\n'),
        mime: 'text/csv; charset=utf-8',
        ext: 'csv',
      };
    }

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Activity Log');
      sheet.columns = [
        { header: 'S/No', key: 'serial_no', width: 8 },
        { header: 'Timestamp', key: 'timestamp', width: 24 },
        { header: 'User Name', key: 'user_name', width: 22 },
        { header: 'User Email', key: 'user_email', width: 28 },
        { header: 'User Type', key: 'user_type_name', width: 28 },
        { header: 'Linked Company', key: 'linked_company_name', width: 24 },
        { header: 'Action', key: 'action_performed', width: 28 },
        { header: 'Module', key: 'module_feature', width: 22 },
        { header: 'IP Address', key: 'ip_address', width: 18 },
        { header: 'User Agent', key: 'user_agent', width: 40 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Entity ID', key: 'entity_id', width: 38 },
      ];
      items.forEach((r) =>
        sheet.addRow({
          serial_no: r.serial_no,
          timestamp: r.timestamp,
          user_name: r.user_name,
          user_email: r.user_email,
          user_type_name: r.user_type_name,
          linked_company_name: r.linked_company_name,
          action_performed: r.action_performed,
          module_feature: r.module_feature,
          ip_address: r.ip_address,
          user_agent: r.user_agent,
          status: r.status,
          entity_id: r.entity_id,
        }),
      );
      const buf = await workbook.xlsx.writeBuffer();
      return {
        body: Buffer.from(buf),
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ext: 'xlsx',
      };
    }

    if (format === 'pdf') {
      const body = await this.buildPdfBuffer(items);
      return { body, mime: 'application/pdf', ext: 'pdf' };
    }

    throw new BadRequestException('Invalid export format');
  }

  /**
   * Expects `log` + `user` + `userType` + `company` already joined (e.g. leftJoinAndSelect).
   */
  private applyFilters(
    qb: SelectQueryBuilder<ActivityLog>,
    query: QueryActivityLogsDto,
  ): void {
    if (query.since) {
      qb.andWhere('log.timestamp > :since', { since: new Date(query.since) });
    }

    if (query.date_from) {
      qb.andWhere('log.timestamp >= :df', { df: new Date(query.date_from) });
    }
    if (query.date_to) {
      const end = new Date(query.date_to);
      end.setHours(23, 59, 59, 999);
      qb.andWhere('log.timestamp <= :dt', { dt: end });
    }

    if (query.status) {
      qb.andWhere('log.entry_status = :st', { st: query.status });
    }

    if (query.user_type_id) {
      qb.andWhere('userType.id = :utid', { utid: query.user_type_id });
    }

    if (query.company_id) {
      qb.andWhere('company.id = :cid', { cid: query.company_id });
    }

    if (query.module?.trim()) {
      qb.andWhere('log.feature_module ILIKE :mod', {
        mod: `%${query.module.trim()}%`,
      });
    }

    if (query.action_type?.trim()) {
      const atPat = `%${query.action_type.trim()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('log.action ILIKE :at', { at: atPat }).orWhere(
            'log.action_label ILIKE :at',
            { at: atPat },
          );
        }),
      );
    }

    if (query.user_name?.trim()) {
      const un = `%${query.user_name.trim()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('user.first_name ILIKE :un', { un })
            .orWhere('user.last_name ILIKE :un', { un })
            .orWhere(
              "CONCAT(user.first_name, ' ', user.last_name) ILIKE :un",
              { un },
            );
        }),
      );
    }

    if (query.user_email?.trim()) {
      qb.andWhere('user.email ILIKE :em', {
        em: `%${query.user_email.trim()}%`,
      });
    }

    if (query.search?.trim()) {
      const s = `%${query.search.trim()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('user.first_name ILIKE :s', { s })
            .orWhere('user.last_name ILIKE :s', { s })
            .orWhere('user.email ILIKE :s', { s })
            .orWhere('log.action ILIKE :s', { s })
            .orWhere('log.action_label ILIKE :s', { s })
            .orWhere('log.feature_module ILIKE :s', { s })
            .orWhere('CAST(log.metadata AS TEXT) ILIKE :s', { s });
        }),
      );
    }

    if (query.performed_by_user_id) {
      qb.andWhere('log.user_id = :pbuid', {
        pbuid: query.performed_by_user_id,
      });
    }
  }

  private serializeListItem(log: ActivityLog, serialNo: number) {
    const user = log.user;
    const ut = user?.user_type;
    const company = user?.company;
    const mod =
      log.feature_module ||
      (log.entity ? log.entity.replace(/-/g, ' ') : null) ||
      'Unspecified';
    const actionPerformed = log.action_label || log.action;

    return {
      serial_no: serialNo,
      id: log.id,
      timestamp: log.timestamp instanceof Date
        ? log.timestamp.toISOString()
        : log.timestamp,
      user_name: user ? `${user.first_name} ${user.last_name}`.trim() : null,
      user_email: user?.email ?? null,
      user_type_name: ut?.name ?? null,
      linked_company_name: company?.name ?? null,
      action_performed: actionPerformed,
      module_feature: mod,
      action: log.action,
      entity: log.entity,
      entity_id: log.entity_id,
      ip_address: log.ip_address ?? null,
      user_agent: log.user_agent ?? null,
      status:
        log.entry_status ?? ActivityLogEntryStatus.SUCCESS,
      http_status_code: log.http_status_code ?? null,
      error_message: log.error_message ?? null,
      metadata: log.metadata ?? null,
      user_id: log.user_id,
    };
  }

  private serializeDetail(log: ActivityLog) {
    const base = this.serializeListItem(log, 0);
    const affected =
      log.entity_id != null
        ? `${log.entity} (${log.entity_id})`
        : log.entity;
    const performedBy = base.user_name
      ? `${base.user_name}${base.user_id ? ` (ID: ${base.user_id})` : ''}`
      : log.user_id
        ? `User ID: ${log.user_id}`
        : 'Unknown / unauthenticated';

    const descriptionParts = [
      base.action_performed,
      affected !== log.entity ? `Target: ${affected}` : null,
      log.error_message ? `Error: ${log.error_message}` : null,
    ].filter(Boolean);

    return {
      ...base,
      full_activity_description: descriptionParts.join(' — '),
      affected_record: affected,
      performed_by: performedBy,
    };
  }

  private sanitizeBody(body: any): any {
    if (!body) return null;
    const sanitized = { ...body };
    delete sanitized.password;
    delete sanitized.token;
    return sanitized;
  }

  private csvEscape(value: string): string {
    if (!value) return '';
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private buildPdfBuffer(items: any[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(14).text('Activity log export', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(8);
      for (const r of items) {
        const line = [
          `#${r.serial_no}`,
          String(r.timestamp),
          r.user_name || '—',
          r.user_email || '—',
          r.user_type_name || '—',
          r.action_performed || '—',
          r.module_feature || '—',
          r.status,
          r.ip_address || '—',
        ].join(' | ');
        doc.text(line, { width: 750 });
      }
      doc.end();
    });
  }
}
