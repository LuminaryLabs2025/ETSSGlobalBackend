import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { validate as isUuid } from 'uuid';
import { Company } from '../../database/entities/company.entity';
import { TerminalGate } from '../../database/entities/app-options.entities';
import { UserStatus } from '../../common/enums';
import {
  UserType,
  UserTypeField,
  UserTypeFieldOption,
  UserTypeMetadata,
} from '../../database/entities/user-type.entity';

/** Slugs for organisations treated as “transit parks” for linked_transit_parks. */
const TRANSIT_PARK_COMPANY_SLUGS = ['transit-park', 'pregate', 'ept'] as const;

/** `optionsSource` keys whose values are company UUIDs (must exist + match source rules). */
const COMPANY_OPTIONS_SOURCES = new Set<string>([
  'shipping_line_companies',
  'port_terminal_companies',
  'transit_park_companies',
]);

@Injectable()
export class UserTypeFieldOptionsService {
  private readonly logger = new Logger(UserTypeFieldOptionsService.name);

  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(TerminalGate)
    private readonly terminalGateRepository: Repository<TerminalGate>,
  ) {}

  /**
   * Resolves every `optionsSource` key present on the given user types into
   * `{ label, value }[]` so GET user-types can return a single, consistent shape.
   */
  async buildOptionsMapForUserTypes(userTypes: UserType[]): Promise<
    Record<string, UserTypeFieldOption[]>
  > {
    const needed = new Set<string>();
    for (const ut of userTypes) {
      for (const field of ut.metadata?.fields ?? []) {
        if (field.optionsSource?.trim()) {
          needed.add(field.optionsSource.trim());
        }
      }
    }
    const map: Record<string, UserTypeFieldOption[]> = {};
    for (const key of needed) {
      map[key] = await this.resolveSource(key);
    }
    return map;
  }

  async resolveSource(sourceKey: string): Promise<UserTypeFieldOption[]> {
    switch (sourceKey) {
      case 'shipping_line_companies':
        return this.shippingLineCompanyOptions();
      case 'port_terminal_companies':
        return this.portTerminalCompanyOptions();
      case 'transit_park_companies':
        return this.transitParkCompanyOptions();
      case 'barrier_locations':
        return this.barrierLocationOptions();
      default:
        this.logger.warn(
          `Unknown user-type field optionsSource "${sourceKey}" — returning empty options`,
        );
        return [];
    }
  }

  hydrateMetadata(
    userType: UserType,
    optionsMap: Record<string, UserTypeFieldOption[]>,
  ): UserTypeMetadata | null {
    if (!userType.metadata?.fields?.length) {
      return userType.metadata;
    }
    const fields: UserTypeField[] = userType.metadata.fields.map((field) => {
      const next: UserTypeField = { ...field };
      if (field.optionsSource?.trim()) {
        const key = field.optionsSource.trim();
        next.options = [...(optionsMap[key] ?? [])];
      }
      return next;
    });
    return { fields };
  }

  toHydratedUserType(
    userType: UserType,
    optionsMap: Record<string, UserTypeFieldOption[]>,
  ): UserType {
    const hydratedMeta = this.hydrateMetadata(userType, optionsMap);
    return {
      id: userType.id,
      name: userType.name,
      slug: userType.slug,
      category: userType.category,
      metadata: hydratedMeta,
      is_active: userType.is_active,
      created_at: userType.created_at,
      updated_at: userType.updated_at,
    } as UserType;
  }

  private companiesToOptions(companies: Company[]): UserTypeFieldOption[] {
    return companies
      .map((c) => ({ label: c.name, value: c.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  private async shippingLineCompanyOptions(): Promise<UserTypeFieldOption[]> {
    const rows = await this.companyRepository.find({
      where: { is_active: true },
      relations: ['user_type'],
      order: { name: 'ASC' },
    });
    return this.companiesToOptions(
      rows.filter((c) => c.user_type?.slug === 'shipping-line'),
    );
  }

  /**
   * Port terminals: companies that have at least one **active** user of type
   * Terminal Operator whose profile marks `terminal_type` as port (snake or camel key).
   */
  private async portTerminalCompanyOptions(): Promise<UserTypeFieldOption[]> {
    const rows = await this.companyRepository
      .createQueryBuilder('c')
      .innerJoin('c.users', 'u')
      .innerJoin('u.user_type', 'ut')
      .where('c.is_active = true')
      .andWhere('u.status IN (:...okStatuses)', {
        okStatuses: [UserStatus.ACTIVE, UserStatus.AWAITING_ACTIVATION],
      })
      .andWhere('ut.slug = :slug', { slug: 'terminal-operator' })
      .andWhere(
        `(
          (u.extra_fields->>'terminal_type') = :port
          OR (u.extra_fields->>'terminalType') = :port
        )`,
        { port: 'port_terminal' },
      )
      .select(['c.id', 'c.name'])
      .distinct(true)
      .orderBy('c.name', 'ASC')
      .getMany();

    return this.companiesToOptions(rows);
  }

  private async transitParkCompanyOptions(): Promise<UserTypeFieldOption[]> {
    const rows = await this.companyRepository.find({
      where: { is_active: true },
      relations: ['user_type'],
      order: { name: 'ASC' },
    });
    const allowed = new Set<string>(TRANSIT_PARK_COMPANY_SLUGS);
    return this.companiesToOptions(
      rows.filter((c) => allowed.has(c.user_type?.slug ?? '')),
    );
  }

  private async barrierLocationOptions(): Promise<UserTypeFieldOption[]> {
    const gates = await this.terminalGateRepository.find({
      order: { location: 'ASC' },
    });
    const options: UserTypeFieldOption[] = [];
    for (const g of gates) {
      options.push({
        label: `${g.location} — Entry: ${g.entry_barrier_name} (${g.entry_barrier_id})`,
        value: g.entry_barrier_id,
      });
      options.push({
        label: `${g.location} — Exit: ${g.exit_barrier_name} (${g.exit_barrier_id})`,
        value: g.exit_barrier_id,
      });
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * After shape/required validation, ensures reference data exists:
   * - `optionsSource` multi-select / select values must appear in the same lists as GET `/api/user-types`.
   * - Company-backed sources require UUIDs that exist in the resolved option set.
   * - `entry_barrier_id` / `exit_barrier_id` must exist on `terminal_gates` when those fields exist on the type.
   */
  async assertExtraFieldsReferencesValid(
    metadata: UserTypeMetadata | null,
    extraFields: Record<string, any>,
  ): Promise<void> {
    if (!metadata?.fields?.length) {
      return;
    }
    const errors: string[] = [];
    const optionsCache = new Map<string, UserTypeFieldOption[]>();

    for (const field of metadata.fields) {
      const raw = this.pickRawValue(extraFields, field.name);
      if (!field.optionsSource?.trim()) {
        continue;
      }
      const src = field.optionsSource.trim();
      let allowed = optionsCache.get(src);
      if (!allowed) {
        allowed = await this.resolveSource(src);
        optionsCache.set(src, allowed);
      }
      const allowedSet = new Set(allowed.map((o) => String(o.value)));
      const label = field.label || field.name;

      if (field.type === 'multi-select') {
        if (!Array.isArray(raw) || raw.length === 0) {
          continue;
        }
        for (const v of raw) {
          if (v === null || v === undefined || v === '') {
            continue;
          }
          const s = String(v);
          if (COMPANY_OPTIONS_SOURCES.has(src) && !isUuid(s)) {
            errors.push(`${label}: "${s}" is not a valid company id (UUID)`);
            continue;
          }
          if (!allowedSet.has(s)) {
            errors.push(
              `${label}: "${s}" is not allowed for ${src}. Use ids from GET /api/user-types for this user type.`,
            );
          }
        }
      } else if (field.type === 'select') {
        if (raw === null || raw === undefined || raw === '') {
          continue;
        }
        const s = String(raw);
        if (COMPANY_OPTIONS_SOURCES.has(src) && !isUuid(s)) {
          errors.push(`${label}: "${s}" is not a valid company id (UUID)`);
        } else if (!allowedSet.has(s)) {
          errors.push(
            `${label}: "${s}" is not allowed for ${src}. Use a value from GET /api/user-types for this user type.`,
          );
        }
      }
    }

    await this.assertBarrierGateIds(metadata, extraFields, errors);

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Validation failed for reference fields',
        errors,
      });
    }
  }

  private async assertBarrierGateIds(
    metadata: UserTypeMetadata,
    data: Record<string, any>,
    errors: string[],
  ): Promise<void> {
    const fieldNames = new Set(metadata.fields.map((f) => f.name));
    if (fieldNames.has('entry_barrier_id')) {
      const v = this.pickRawValue(data, 'entry_barrier_id');
      if (v !== null && v !== undefined && String(v).trim() !== '') {
        const cnt = await this.terminalGateRepository.count({
          where: { entry_barrier_id: String(v).trim() },
        });
        if (cnt === 0) {
          errors.push(
            `Entry barrier ID "${v}" was not found. Create the gate in terminal gates or pick an id from GET /api/user-types.`,
          );
        }
      }
    }
    if (fieldNames.has('exit_barrier_id')) {
      const v = this.pickRawValue(data, 'exit_barrier_id');
      if (v !== null && v !== undefined && String(v).trim() !== '') {
        const cnt = await this.terminalGateRepository.count({
          where: { exit_barrier_id: String(v).trim() },
        });
        if (cnt === 0) {
          errors.push(
            `Exit barrier ID "${v}" was not found. Create the gate in terminal gates or pick an id from GET /api/user-types.`,
          );
        }
      }
    }
  }

  private pickRawValue(data: Record<string, any>, key: string): any {
    if (!data) {
      return undefined;
    }
    if (this.hasOwnValue(data, key)) {
      return data[key];
    }
    const camel = this.snakeToCamel(key);
    if (camel !== key && this.hasOwnValue(data, camel)) {
      return data[camel];
    }
    const snake = this.camelToSnake(key);
    if (snake !== key && this.hasOwnValue(data, snake)) {
      return data[snake];
    }
    return undefined;
  }

  private hasOwnValue(data: Record<string, any>, key: string): boolean {
    return (
      Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined
    );
  }

  private snakeToCamel(s: string): string {
    return s.replace(/_([a-z])/gi, (_, c: string) => c.toUpperCase());
  }

  private camelToSnake(s: string): string {
    return s
      .replace(/([A-Z])/g, (g) => '_' + g.toLowerCase())
      .replace(/^_/, '');
  }
}
