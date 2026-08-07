import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BARRIER_OPERATIONAL_STATUSES,
  BARRIER_ROLES,
  BARRIER_SITE_TYPES,
  BARRIER_STATUSES,
} from './barriers.dto';

export class BarrierSiteSummaryDto {
  @ApiProperty({ enum: BARRIER_SITE_TYPES })
  type: string;

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'EMOG Bonded Terminal' })
  name: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Park/terminal subtype when applicable',
  })
  park_type?: string | null;
}

export class BarrierLinkedSiteDto {
  @ApiProperty({ format: 'uuid' })
  link_id: string;

  @ApiProperty({ enum: BARRIER_SITE_TYPES })
  site_type: string;

  @ApiProperty({ format: 'uuid' })
  site_id: string;

  @ApiProperty({ enum: BARRIER_ROLES })
  barrier_role: string;

  @ApiProperty({ type: () => BarrierSiteSummaryDto, nullable: true })
  site: BarrierSiteSummaryDto | null;
}

export class BarrierHandheldDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'HH-APAPA-01' })
  name: string;

  @ApiProperty({ example: 'ACTIVE' })
  status: string;
}

/** Shared barrier shape for catalog + site embeddings (no response envelopes). */
export class BarrierDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'BR-049' })
  barrier_id_number: string;

  @ApiProperty({ example: 'Access Control Co.' })
  service_provider_name: string;

  @ApiProperty({ enum: BARRIER_OPERATIONAL_STATUSES })
  operational_status: string;

  @ApiProperty({ enum: BARRIER_STATUSES })
  status: string;

  @ApiPropertyOptional({
    enum: BARRIER_ROLES,
    nullable: true,
    description: 'Present on site-scoped list rows (ENTRY/EXIT for that site)',
  })
  barrier_type?: string | null;

  @ApiPropertyOptional({
    type: () => BarrierSiteSummaryDto,
    nullable: true,
    description: 'Facility site when the focused link is a facility',
  })
  linked_facility?: BarrierSiteSummaryDto | null;

  @ApiPropertyOptional({
    type: () => BarrierLinkedSiteDto,
    nullable: true,
    description: 'Focused site link when listing by site filters',
  })
  linked_site?: BarrierLinkedSiteDto | null;

  @ApiProperty({ type: () => [BarrierLinkedSiteDto] })
  linked_sites: BarrierLinkedSiteDto[];

  @ApiProperty({ type: () => [BarrierHandheldDto] })
  linked_handhelds: BarrierHandheldDto[];

  @ApiProperty({ type: () => BarrierHandheldDto, nullable: true })
  linked_handheld: BarrierHandheldDto | null;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;
}
