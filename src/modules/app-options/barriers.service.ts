import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  In,
  QueryFailedError,
  Repository,
} from 'typeorm';
import {
  Barrier,
  BarrierSiteLink,
  Facility,
  HandheldDevice,
  Terminal,
  TransitPark,
} from '../../database/entities';
import {
  AssignSiteBarriersDto,
  CreateBarrierDto,
  CreateBarrierSiteLinkDto,
  QueryBarriersDto,
  UpdateBarrierDto,
} from './dto/barriers.dto';

type SiteResolver = {
  type: 'FACILITY' | 'TRANSIT_PARK' | 'TERMINAL';
  id: string;
  name: string;
  park_type?: string | null;
};

@Injectable()
export class BarriersService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Barrier)
    private readonly barrierRepository: Repository<Barrier>,
    @InjectRepository(BarrierSiteLink)
    private readonly linkRepository: Repository<BarrierSiteLink>,
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>,
    @InjectRepository(TransitPark)
    private readonly transitParkRepository: Repository<TransitPark>,
    @InjectRepository(Terminal)
    private readonly terminalRepository: Repository<Terminal>,
    @InjectRepository(HandheldDevice)
    private readonly handheldRepository: Repository<HandheldDevice>,
  ) {}

  async create(dto: CreateBarrierDto) {
    const barrier = this.barrierRepository.create({
      barrier_id_number: dto.barrier_id_number.trim(),
      service_provider_name: dto.service_provider_name.trim(),
      operational_status: dto.operational_status ?? 'OFFLINE',
      status: dto.status ?? 'ACTIVE',
    });
    try {
      const saved = await this.barrierRepository.save(barrier);
      return this.findOne(saved.id);
    } catch (error) {
      this.rethrowConflict(error, 'Barrier ID number already exists');
    }
  }

  async findAll(query: QueryBarriersDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;

    // Prototype tabs: list one row per barrier↔site link.
    if (
      query.site_type ||
      query.site_id ||
      query.park_type ||
      query.transit_park_type ||
      query.terminal_type ||
      query.barrier_role
    ) {
      return this.findLinkedRows(query, page, limit);
    }

    const qb = this.barrierRepository
      .createQueryBuilder('barrier')
      .leftJoinAndSelect('barrier.site_links', 'link')
      .leftJoinAndSelect('barrier.handheld_devices', 'handheld')
      .orderBy('barrier.created_at', 'DESC');

    if (query.search?.trim()) {
      const search = `%${query.search.trim()}%`;
      qb.andWhere(
        new Brackets((where) => {
          where
            .where('barrier.barrier_id_number ILIKE :search', { search })
            .orWhere('barrier.service_provider_name ILIKE :search', { search });
        }),
      );
    }
    if (query.operational_status) {
      qb.andWhere('barrier.operational_status = :ops', {
        ops: query.operational_status,
      });
    }
    if (query.status) {
      qb.andWhere('barrier.status = :st', { st: query.status });
    }

    const total = await qb.clone().getCount();
    const rows = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const sites = await this.resolveSitesForLinks(
      rows.flatMap((b) => b.site_links ?? []),
    );

    return {
      data: rows.map((b) => this.mapBarrier(b, sites)),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async summary(query: QueryBarriersDto) {
    // Counts for prototype KPI cards; scoped by same filters as the list tabs.
    const buildLinkQuery = async () => {
      const qb = this.linkRepository
        .createQueryBuilder('link')
        .innerJoin('link.barrier', 'barrier')
        .where('1=1');

      await this.applyLinkSiteFilters(qb, query);

      if (query.operational_status) {
        qb.andWhere('barrier.operational_status = :ops', {
          ops: query.operational_status,
        });
      }
      if (query.status) {
        qb.andWhere('barrier.status = :st', { st: query.status });
      }
      return qb;
    };

    const qb = await buildLinkQuery();

    // Distinct barriers, not links: one barrier can be the entry gate of several sites.
    const rows = await qb
      .select('link.barrier_role', 'barrier_role')
      .addSelect(`COUNT(DISTINCT barrier.id)`, 'total')
      .addSelect(
        `COUNT(DISTINCT barrier.id) FILTER (WHERE barrier.status = 'ACTIVE')`,
        'active',
      )
      .addSelect(
        `COUNT(DISTINCT barrier.id) FILTER (WHERE barrier.status = 'INACTIVE')`,
        'inactive',
      )
      .groupBy('link.barrier_role')
      .getRawMany<{
        barrier_role: string;
        total: string;
        active: string;
        inactive: string;
      }>();

    const entry = rows.find((r) => r.barrier_role === 'ENTRY');
    const exit = rows.find((r) => r.barrier_role === 'EXIT');

    // Catalog-wide summary when no site filter (no links required).
    if (
      !query.site_type &&
      !query.site_id &&
      !query.park_type &&
      !query.transit_park_type &&
      !query.terminal_type
    ) {
      const catalog = await this.barrierRepository
        .createQueryBuilder('barrier')
        .select('COUNT(*)', 'total')
        .addSelect(
          `COUNT(*) FILTER (WHERE barrier.status = 'ACTIVE')`,
          'active',
        )
        .addSelect(
          `COUNT(*) FILTER (WHERE barrier.status = 'INACTIVE')`,
          'inactive',
        )
        .getRawOne<{ total: string; active: string; inactive: string }>();

      return {
        all: {
          active: Number(catalog?.active ?? 0),
          inactive: Number(catalog?.inactive ?? 0),
          total: Number(catalog?.total ?? 0),
        },
        entry: {
          active: Number(entry?.active ?? 0),
          inactive: Number(entry?.inactive ?? 0),
          total: Number(entry?.total ?? 0),
        },
        exit: {
          active: Number(exit?.active ?? 0),
          inactive: Number(exit?.inactive ?? 0),
          total: Number(exit?.total ?? 0),
        },
      };
    }

    const scoped = await (await buildLinkQuery())
      .select('COUNT(DISTINCT barrier.id)', 'total')
      .addSelect(
        `COUNT(DISTINCT barrier.id) FILTER (WHERE barrier.status = 'ACTIVE')`,
        'active',
      )
      .addSelect(
        `COUNT(DISTINCT barrier.id) FILTER (WHERE barrier.status = 'INACTIVE')`,
        'inactive',
      )
      .getRawOne<{ total: string; active: string; inactive: string }>();

    return {
      all: {
        active: Number(scoped?.active ?? 0),
        inactive: Number(scoped?.inactive ?? 0),
        total: Number(scoped?.total ?? 0),
      },
      entry: {
        active: Number(entry?.active ?? 0),
        inactive: Number(entry?.inactive ?? 0),
        total: Number(entry?.total ?? 0),
      },
      exit: {
        active: Number(exit?.active ?? 0),
        inactive: Number(exit?.inactive ?? 0),
        total: Number(exit?.total ?? 0),
      },
    };
  }

  async findOne(id: string) {
    const barrier = await this.barrierRepository.findOne({
      where: { id },
      relations: ['site_links', 'handheld_devices'],
    });
    if (!barrier) throw new NotFoundException('Barrier not found');
    const sites = await this.resolveSitesForLinks(barrier.site_links ?? []);
    return this.mapBarrier(barrier, sites);
  }

  async update(id: string, dto: UpdateBarrierDto) {
    const barrier = await this.requireBarrier(id);
    if (dto.barrier_id_number !== undefined) {
      barrier.barrier_id_number = dto.barrier_id_number.trim();
    }
    if (dto.service_provider_name !== undefined) {
      barrier.service_provider_name = dto.service_provider_name.trim();
    }
    if (dto.operational_status !== undefined) {
      barrier.operational_status = dto.operational_status;
    }
    if (dto.status !== undefined) {
      barrier.status = dto.status;
    }
    try {
      await this.barrierRepository.save(barrier);
      return this.findOne(id);
    } catch (error) {
      this.rethrowConflict(error, 'Barrier ID number already exists');
    }
  }

  async disable(id: string) {
    const barrier = await this.requireBarrier(id);
    barrier.status = 'INACTIVE';
    await this.barrierRepository.save(barrier);
    return this.findOne(id);
  }

  async enable(id: string) {
    const barrier = await this.requireBarrier(id);
    barrier.status = 'ACTIVE';
    await this.barrierRepository.save(barrier);
    return this.findOne(id);
  }

  async delete(id: string) {
    await this.requireBarrier(id);

    // Site links cascade, so deleting a linked barrier would silently strip it
    // from a facility/park/terminal entry or exit gate.
    const [linkCount, handheldCount] = await Promise.all([
      this.linkRepository.count({ where: { barrier_id: id } }),
      this.handheldRepository.count({ where: { barrier_id: id } }),
    ]);
    if (linkCount > 0) {
      throw new ConflictException(
        'This barrier is still linked to one or more locations. Unlink it or disable it instead.',
      );
    }
    if (handheldCount > 0) {
      throw new ConflictException(
        'This barrier still has handheld devices assigned. Reassign them or disable it instead.',
      );
    }

    await this.barrierRepository.delete(id);
  }

  async addSiteLink(barrierId: string, dto: CreateBarrierSiteLinkDto) {
    await this.requireBarrier(barrierId);
    await this.assertSiteExists(dto.site_type, dto.site_id);
    await this.assertSiteAllowsBarriers(dto.site_type, dto.site_id);

    const oppositeRole = dto.barrier_role === 'ENTRY' ? 'EXIT' : 'ENTRY';
    const conflicting = await this.linkRepository.findOne({
      where: {
        barrier_id: barrierId,
        site_type: dto.site_type,
        site_id: dto.site_id,
        barrier_role: oppositeRole,
      },
    });
    if (conflicting) {
      throw new BadRequestException(
        `A barrier cannot be both ENTRY and EXIT for the same ${dto.site_type.toLowerCase().replace(/_/g, ' ')}. It may still be used as ${oppositeRole} at a different site.`,
      );
    }

    const link = this.linkRepository.create({
      barrier_id: barrierId,
      site_type: dto.site_type,
      site_id: dto.site_id,
      barrier_role: dto.barrier_role,
    });
    try {
      await this.linkRepository.save(link);
      return this.findOne(barrierId);
    } catch (error) {
      this.rethrowConflict(
        error,
        'This barrier is already linked to that site with the same role',
      );
    }
  }

  async removeSiteLink(barrierId: string, linkId: string) {
    await this.requireBarrier(barrierId);
    const link = await this.linkRepository.findOne({
      where: { id: linkId, barrier_id: barrierId },
    });
    if (!link) throw new NotFoundException('Barrier site link not found');
    await this.linkRepository.delete(linkId);
    return this.findOne(barrierId);
  }

  /** Replace entry/exit barrier sets for a site (used by facility/park/terminal forms). */
  async assignSiteBarriers(
    siteType: 'FACILITY' | 'TRANSIT_PARK' | 'TERMINAL',
    siteId: string,
    dto: AssignSiteBarriersDto,
  ) {
    await this.assertSiteExists(siteType, siteId);
    await this.assertSiteAllowsBarriers(siteType, siteId);

    const entryIds = [...new Set(dto.entry_barrier_ids ?? [])];
    const exitIds = [...new Set(dto.exit_barrier_ids ?? [])];
    const allIds = [...new Set([...entryIds, ...exitIds])];

    if (allIds.length) {
      const found = await this.barrierRepository.count({
        where: { id: In(allIds) },
      });
      if (found !== allIds.length) {
        throw new BadRequestException(
          'One or more barrier IDs were not found',
        );
      }
    }

    // Same barrier cannot be ENTRY and EXIT on this site; it may still be EXIT
    // (or ENTRY) on a different facility / park / terminal.
    await this.assertNoSameSiteEntryExitOverlap(
      siteType,
      siteId,
      dto.entry_barrier_ids !== undefined ? entryIds : undefined,
      dto.exit_barrier_ids !== undefined ? exitIds : undefined,
    );

    await this.dataSource.transaction(async (manager) => {
      if (dto.entry_barrier_ids) {
        await manager.delete(BarrierSiteLink, {
          site_type: siteType,
          site_id: siteId,
          barrier_role: 'ENTRY',
        });
        if (entryIds.length) {
          await manager.save(
            BarrierSiteLink,
            entryIds.map((barrierId) => ({
              barrier_id: barrierId,
              site_type: siteType,
              site_id: siteId,
              barrier_role: 'ENTRY',
            })),
          );
        }
      }
      if (dto.exit_barrier_ids) {
        await manager.delete(BarrierSiteLink, {
          site_type: siteType,
          site_id: siteId,
          barrier_role: 'EXIT',
        });
        if (exitIds.length) {
          await manager.save(
            BarrierSiteLink,
            exitIds.map((barrierId) => ({
              barrier_id: barrierId,
              site_type: siteType,
              site_id: siteId,
              barrier_role: 'EXIT',
            })),
          );
        }
      }
    });

    return this.findBarriersForSite(siteType, siteId);
  }

  async findBarriersForSite(
    siteType: 'FACILITY' | 'TRANSIT_PARK' | 'TERMINAL',
    siteId: string,
  ) {
    await this.assertSiteExists(siteType, siteId);
    const links = await this.linkRepository.find({
      where: { site_type: siteType, site_id: siteId },
      relations: ['barrier', 'barrier.handheld_devices'],
      order: { barrier_role: 'ASC', created_at: 'ASC' },
    });
    const sites = await this.resolveSitesForLinks(links);
    return {
      site_type: siteType,
      site_id: siteId,
      site: sites.get(`${siteType}:${siteId}`) ?? null,
      entry_barriers: links
        .filter((l) => l.barrier_role === 'ENTRY' && l.barrier)
        .map((l) => this.mapBarrier(l.barrier, sites, l)),
      exit_barriers: links
        .filter((l) => l.barrier_role === 'EXIT' && l.barrier)
        .map((l) => this.mapBarrier(l.barrier, sites, l)),
      barriers: links
        .filter((l) => l.barrier)
        .map((l) => this.mapBarrier(l.barrier, sites, l)),
    };
  }

  /** Batched variant of findBarriersForSite for list endpoints. */
  async findBarriersForSites(
    siteType: 'FACILITY' | 'TRANSIT_PARK' | 'TERMINAL',
    siteIds: string[],
  ) {
    const result = new Map<
      string,
      { entry_barriers: unknown[]; exit_barriers: unknown[] }
    >();
    for (const id of siteIds) {
      result.set(id, { entry_barriers: [], exit_barriers: [] });
    }
    if (!siteIds.length) return result;

    const links = await this.linkRepository.find({
      where: { site_type: siteType, site_id: In(siteIds) },
      relations: ['barrier', 'barrier.handheld_devices'],
      order: { barrier_role: 'ASC', created_at: 'ASC' },
    });
    const sites = await this.resolveSitesForLinks(links);

    for (const link of links) {
      if (!link.barrier) continue;
      const bucket = result.get(link.site_id);
      if (!bucket) continue;
      const mapped = this.mapBarrier(link.barrier, sites, link);
      if (link.barrier_role === 'ENTRY') bucket.entry_barriers.push(mapped);
      else bucket.exit_barriers.push(mapped);
    }
    return result;
  }

  private async findLinkedRows(
    query: QueryBarriersDto,
    page: number,
    limit: number,
  ) {
    const qb = this.linkRepository
      .createQueryBuilder('link')
      .innerJoinAndSelect('link.barrier', 'barrier')
      .leftJoinAndSelect('barrier.handheld_devices', 'handheld')
      .orderBy('barrier.created_at', 'DESC');

    await this.applyLinkSiteFilters(qb, query);

    if (query.search?.trim()) {
      const search = `%${query.search.trim()}%`;
      if (query.site_type === 'FACILITY' || query.park_type) {
        qb.leftJoin(
          Facility,
          'facility',
          `facility.id = link.site_id AND link.site_type = 'FACILITY'`,
        );
        qb.andWhere(
          new Brackets((where) => {
            where
              .where('barrier.barrier_id_number ILIKE :search', { search })
              .orWhere('barrier.service_provider_name ILIKE :search', {
                search,
              })
              .orWhere('facility.name ILIKE :search', { search });
          }),
        );
      } else if (
        query.site_type === 'TRANSIT_PARK' ||
        query.transit_park_type
      ) {
        qb.leftJoin(
          TransitPark,
          'transitPark',
          `transitPark.id = link.site_id AND link.site_type = 'TRANSIT_PARK'`,
        );
        qb.andWhere(
          new Brackets((where) => {
            where
              .where('barrier.barrier_id_number ILIKE :search', { search })
              .orWhere('barrier.service_provider_name ILIKE :search', {
                search,
              })
              .orWhere('transitPark.name ILIKE :search', { search });
          }),
        );
      } else if (query.site_type === 'TERMINAL' || query.terminal_type) {
        qb.leftJoin(
          Terminal,
          'terminal',
          `terminal.id = link.site_id AND link.site_type = 'TERMINAL'`,
        );
        qb.andWhere(
          new Brackets((where) => {
            where
              .where('barrier.barrier_id_number ILIKE :search', { search })
              .orWhere('barrier.service_provider_name ILIKE :search', {
                search,
              })
              .orWhere('terminal.name ILIKE :search', { search });
          }),
        );
      } else {
        qb.andWhere(
          new Brackets((where) => {
            where
              .where('barrier.barrier_id_number ILIKE :search', { search })
              .orWhere('barrier.service_provider_name ILIKE :search', {
                search,
              });
          }),
        );
      }
    }
    if (query.barrier_role) {
      qb.andWhere('link.barrier_role = :role', { role: query.barrier_role });
    }
    if (query.operational_status) {
      qb.andWhere('barrier.operational_status = :ops', {
        ops: query.operational_status,
      });
    }
    if (query.status) {
      qb.andWhere('barrier.status = :st', { st: query.status });
    }

    const total = await qb.clone().getCount();
    const links = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
    const sites = await this.resolveSitesForLinks(links);

    return {
      data: links
        .filter((l) => l.barrier)
        .map((l) => this.mapBarrier(l.barrier, sites, l)),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  private async applyLinkSiteFilters(qb: any, query: QueryBarriersDto) {
    if (query.site_id) {
      qb.andWhere('link.site_id = :siteId', { siteId: query.site_id });
    }
    if (query.site_type) {
      qb.andWhere('link.site_type = :siteType', {
        siteType: query.site_type,
      });
    }
    if (query.park_type) {
      qb.andWhere(`link.site_type = 'FACILITY'`);
      qb.andWhere(
        `link.site_id IN (SELECT f.id FROM facilities f WHERE f.park_type = :parkType AND f.archived_at IS NULL)`,
        { parkType: query.park_type },
      );
    }
    if (query.transit_park_type) {
      qb.andWhere(`link.site_type = 'TRANSIT_PARK'`);
      qb.andWhere(
        `link.site_id IN (SELECT tp.id FROM transit_parks tp WHERE tp.transit_park_type = :transitParkType AND tp.archived_at IS NULL)`,
        { transitParkType: query.transit_park_type },
      );
    }
    if (query.terminal_type) {
      qb.andWhere(`link.site_type = 'TERMINAL'`);
      qb.andWhere(
        `link.site_id IN (SELECT t.id FROM terminals t WHERE t.terminal_type = :terminalType AND t.archived_at IS NULL)`,
        { terminalType: query.terminal_type },
      );
    } else if (query.site_type === 'TERMINAL') {
      // Non-port terminals do not have barriers — only return port-terminal links.
      qb.andWhere(
        `link.site_id IN (SELECT t.id FROM terminals t WHERE t.terminal_type = 'PORT_TERMINAL' AND t.archived_at IS NULL)`,
      );
    }
  }

  /**
   * A barrier may be ENTRY at site A and EXIT at site B, but never ENTRY and EXIT
   * on the same site. When only one side of the assignment is sent, compare against
   * the other role's existing links for that site.
   */
  private async assertNoSameSiteEntryExitOverlap(
    siteType: 'FACILITY' | 'TRANSIT_PARK' | 'TERMINAL',
    siteId: string,
    entryIds: string[] | undefined,
    exitIds: string[] | undefined,
  ) {
    let resolvedEntry = entryIds;
    let resolvedExit = exitIds;

    if (resolvedEntry === undefined || resolvedExit === undefined) {
      const existing = await this.linkRepository.find({
        where: { site_type: siteType, site_id: siteId },
        select: ['barrier_id', 'barrier_role'],
      });
      if (resolvedEntry === undefined) {
        resolvedEntry = existing
          .filter((l) => l.barrier_role === 'ENTRY')
          .map((l) => l.barrier_id);
      }
      if (resolvedExit === undefined) {
        resolvedExit = existing
          .filter((l) => l.barrier_role === 'EXIT')
          .map((l) => l.barrier_id);
      }
    }

    const overlap = resolvedEntry.filter((id) => resolvedExit!.includes(id));
    if (overlap.length) {
      throw new BadRequestException(
        'A barrier cannot be both an entry and exit gate for the same site. Choose different barriers for entry and exit; the same barrier may still be used as exit (or entry) on another facility, transit park, or terminal.',
      );
    }
  }

  private async assertSiteExists(siteType: string, siteId: string) {
    if (siteType === 'FACILITY') {
      const row = await this.facilityRepository.findOne({
        where: { id: siteId },
      });
      if (!row) throw new NotFoundException('Facility not found');
      return;
    }
    if (siteType === 'TRANSIT_PARK') {
      const row = await this.transitParkRepository.findOne({
        where: { id: siteId },
      });
      if (!row) throw new NotFoundException('Transit park not found');
      return;
    }
    if (siteType === 'TERMINAL') {
      const row = await this.terminalRepository.findOne({
        where: { id: siteId },
      });
      if (!row) throw new NotFoundException('Terminal not found');
      return;
    }
    throw new BadRequestException('Invalid site_type');
  }

  /** Non-port terminals do not have entry/exit barriers. */
  private async assertSiteAllowsBarriers(siteType: string, siteId: string) {
    if (siteType !== 'TERMINAL') return;
    const terminal = await this.terminalRepository.findOne({
      where: { id: siteId },
    });
    if (!terminal) throw new NotFoundException('Terminal not found');
    if (terminal.terminal_type === 'NON_PORT_TERMINAL') {
      throw new BadRequestException(
        'Non-port terminals do not have barriers. Only port terminals can be linked to entry/exit barriers.',
      );
    }
  }

  private async resolveSitesForLinks(
    links: BarrierSiteLink[],
  ): Promise<Map<string, SiteResolver>> {
    const map = new Map<string, SiteResolver>();
    const facilityIds = [
      ...new Set(
        links
          .filter((l) => l.site_type === 'FACILITY')
          .map((l) => l.site_id),
      ),
    ];
    const parkIds = [
      ...new Set(
        links
          .filter((l) => l.site_type === 'TRANSIT_PARK')
          .map((l) => l.site_id),
      ),
    ];
    const terminalIds = [
      ...new Set(
        links
          .filter((l) => l.site_type === 'TERMINAL')
          .map((l) => l.site_id),
      ),
    ];

    if (facilityIds.length) {
      const rows = await this.facilityRepository.find({
        where: { id: In(facilityIds) },
      });
      for (const r of rows) {
        map.set(`FACILITY:${r.id}`, {
          type: 'FACILITY',
          id: r.id,
          name: r.name,
          park_type: r.park_type,
        });
      }
    }
    if (parkIds.length) {
      const rows = await this.transitParkRepository.find({
        where: { id: In(parkIds) },
      });
      for (const r of rows) {
        map.set(`TRANSIT_PARK:${r.id}`, {
          type: 'TRANSIT_PARK',
          id: r.id,
          name: r.name,
          park_type: r.transit_park_type,
        });
      }
    }
    if (terminalIds.length) {
      const rows = await this.terminalRepository.find({
        where: { id: In(terminalIds) },
      });
      for (const r of rows) {
        map.set(`TERMINAL:${r.id}`, {
          type: 'TERMINAL',
          id: r.id,
          name: r.name,
          park_type: r.terminal_type,
        });
      }
    }
    return map;
  }

  private mapBarrier(
    barrier: Barrier,
    sites: Map<string, SiteResolver>,
    focusLink?: BarrierSiteLink,
  ) {
    const linkedSites = (barrier.site_links ?? []).map((link) => {
      const site = sites.get(`${link.site_type}:${link.site_id}`) ?? null;
      return {
        link_id: link.id,
        site_type: link.site_type,
        site_id: link.site_id,
        barrier_role: link.barrier_role,
        site,
      };
    });

    const focusSite = focusLink
      ? sites.get(`${focusLink.site_type}:${focusLink.site_id}`) ?? null
      : null;

    return {
      id: barrier.id,
      barrier_id_number: barrier.barrier_id_number,
      service_provider_name: barrier.service_provider_name,
      operational_status: barrier.operational_status,
      status: barrier.status,
      barrier_type: focusLink?.barrier_role ?? null,
      linked_facility:
        focusLink?.site_type === 'FACILITY' ? focusSite : null,
      linked_site: focusLink
        ? {
            link_id: focusLink.id,
            site_type: focusLink.site_type,
            site_id: focusLink.site_id,
            barrier_role: focusLink.barrier_role,
            site: focusSite,
          }
        : null,
      linked_sites: linkedSites,
      linked_handhelds: (barrier.handheld_devices ?? []).map((h) => ({
        id: h.id,
        name: h.name,
        status: h.status,
      })),
      linked_handheld: (barrier.handheld_devices ?? [])[0]
        ? {
            id: barrier.handheld_devices[0].id,
            name: barrier.handheld_devices[0].name,
            status: barrier.handheld_devices[0].status,
          }
        : null,
      created_at: barrier.created_at,
      updated_at: barrier.updated_at,
    };
  }

  private async requireBarrier(id: string) {
    const barrier = await this.barrierRepository.findOne({ where: { id } });
    if (!barrier) throw new NotFoundException('Barrier not found');
    return barrier;
  }

  private rethrowConflict(error: unknown, message: string): never {
    if (
      error instanceof QueryFailedError &&
      (error as any).driverError?.code === '23505'
    ) {
      throw new ConflictException(message);
    }
    throw error;
  }
}
