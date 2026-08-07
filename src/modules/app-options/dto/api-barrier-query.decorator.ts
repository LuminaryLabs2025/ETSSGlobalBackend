import { applyDecorators } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import {
  BARRIER_OPERATIONAL_STATUSES,
  BARRIER_ROLES,
  BARRIER_SITE_TYPES,
  BARRIER_STATUSES,
  FACILITY_PARK_TYPES_FOR_BARRIERS,
  TERMINAL_TYPES_FOR_BARRIERS,
  TRANSIT_PARK_TYPES_FOR_BARRIERS,
} from './barriers.dto';

/**
 * Explicit query-param docs for GET /api/barriers and GET /api/barriers/summary.
 * Ensures Swagger UI shows every filter (including category tabs) even when
 * class-validator DTO reflection alone is incomplete.
 */
export function ApiBarrierListQuery() {
  return applyDecorators(
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      example: 1,
      description: 'Page number (default 1)',
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      example: 20,
      description: 'Page size 1–100 (default 20)',
    }),
    ApiQuery({
      name: 'search',
      required: false,
      type: String,
      example: 'BR-049',
      description: 'Search barrier ID number, provider name, or linked site name',
    }),
    ApiQuery({
      name: 'site_type',
      required: false,
      enum: BARRIER_SITE_TYPES,
      description:
        'Filter by linked site kind. Switches list to one row per barrier↔site link. ' +
        'For TERMINAL, only PORT_TERMINAL links are returned (non-port terminals have no barriers).',
    }),
    ApiQuery({
      name: 'park_type',
      required: false,
      enum: FACILITY_PARK_TYPES_FOR_BARRIERS,
      description:
        'Facility category tab filter (implies site_type=FACILITY). ' +
        'BONDED_TERMINAL | TRUCK_PARK | FISH_VAN_PARK',
    }),
    ApiQuery({
      name: 'transit_park_type',
      required: false,
      enum: TRANSIT_PARK_TYPES_FOR_BARRIERS,
      description:
        'Transit-park category tab filter (implies site_type=TRANSIT_PARK). ' +
        'PREGATE | EPT',
    }),
    ApiQuery({
      name: 'terminal_type',
      required: false,
      enum: TERMINAL_TYPES_FOR_BARRIERS,
      description:
        'Terminal category filter (implies site_type=TERMINAL). ' +
        'Only PORT_TERMINAL — non-port terminals do not have barriers.',
    }),
    ApiQuery({
      name: 'site_id',
      required: false,
      type: String,
      format: 'uuid',
      description: 'Filter links to one facility / transit park / port terminal',
    }),
    ApiQuery({
      name: 'barrier_role',
      required: false,
      enum: BARRIER_ROLES,
      description: 'ENTRY or EXIT role on the linked site',
    }),
    ApiQuery({
      name: 'operational_status',
      required: false,
      enum: BARRIER_OPERATIONAL_STATUSES,
      description: 'Partner/live gate status: ONLINE or OFFLINE',
    }),
    ApiQuery({
      name: 'status',
      required: false,
      enum: BARRIER_STATUSES,
      description: 'Admin status: ACTIVE or INACTIVE',
    }),
  );
}
