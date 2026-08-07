import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BarrierDto, BarrierSiteSummaryDto } from './barrier.dto';
import { BARRIER_SITE_TYPES } from './barriers.dto';

export class BarrierPaginationMetaDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total_pages: number;
}

/**
 * Paginated list body. Kept as a dedicated export (not nested under another
 * `data` field class graph via inheritance) to avoid NestJS Swagger's false
 * circular dependency on property key "data".
 */
export class BarrierListDataDto {
  @ApiProperty({ type: () => [BarrierDto] })
  data: BarrierDto[];

  @ApiProperty({ type: () => BarrierPaginationMetaDto })
  meta: BarrierPaginationMetaDto;
}

export class BarrierResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ type: () => BarrierDto })
  data: BarrierDto;
}

export class BarrierListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ type: () => BarrierListDataDto })
  data: BarrierListDataDto;
}

export class BarrierSummaryBucketDto {
  @ApiProperty({ example: 12 })
  active: number;

  @ApiProperty({ example: 1 })
  inactive: number;

  @ApiProperty({ example: 13 })
  total: number;
}

export class BarrierSummaryPayloadDto {
  @ApiProperty({ type: () => BarrierSummaryBucketDto })
  all: BarrierSummaryBucketDto;

  @ApiProperty({ type: () => BarrierSummaryBucketDto })
  entry: BarrierSummaryBucketDto;

  @ApiProperty({ type: () => BarrierSummaryBucketDto })
  exit: BarrierSummaryBucketDto;
}

export class BarrierSummaryResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ type: () => BarrierSummaryPayloadDto })
  data: BarrierSummaryPayloadDto;
}

export class SiteBarriersDto {
  @ApiProperty({ enum: BARRIER_SITE_TYPES })
  site_type: string;

  @ApiProperty({ format: 'uuid' })
  site_id: string;

  @ApiProperty({ type: () => BarrierSiteSummaryDto, nullable: true })
  site: BarrierSiteSummaryDto | null;

  @ApiProperty({ type: () => [BarrierDto] })
  entry_barriers: BarrierDto[];

  @ApiProperty({ type: () => [BarrierDto] })
  exit_barriers: BarrierDto[];

  @ApiProperty({ type: () => [BarrierDto] })
  barriers: BarrierDto[];
}

export class SiteBarriersResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty({ type: () => SiteBarriersDto })
  data: SiteBarriersDto;
}

export class BarrierDeleteResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Barrier deleted successfully' })
  message: string;

  @ApiPropertyOptional({
    nullable: true,
    type: Object,
    example: null,
    description: 'Always null on successful delete',
  })
  data?: Record<string, never> | null;
}

// Re-export shared shape so existing imports from barriers-response keep working.
export { BarrierDto, BarrierSiteSummaryDto } from './barrier.dto';
