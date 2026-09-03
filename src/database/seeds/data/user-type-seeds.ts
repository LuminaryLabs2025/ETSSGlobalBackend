import { UserTypeCategory } from '../../../common/enums';
import { UserTypeMetadata } from '../../entities/user-type.entity';

interface UserTypeSeed {
  name: string;
  slug: string;
  category: UserTypeCategory;
  metadata: UserTypeMetadata | null;
}

const opt = (label: string, value?: string) => ({
  label,
  value: value || label.toLowerCase().replace(/\s+/g, '_'),
});

// ── Shared option sets (reusable across multiple types) ──

const LINKED_AXIS_OPTIONS = [
  opt('Apapa Port', 'apapa_port'),
  opt('Apapa Non-Port', 'apapa_non_port'),
  opt('Tincan Port', 'tincan_port'),
  opt('Tincan Non-Port', 'tincan_non_port'),
];

const TRUCK_TYPE_OPTIONS = [
  opt('Flatbed', 'flatbed'),
  opt('Lowbed', 'lowbed'),
  opt('Reefer', 'reefer'),
  opt('Fish-Van', 'fish_van'),
  opt('Reefer Truck', 'reefer_truck'),
  opt('Special Truck', 'special_truck'),
];

const FACILITY_TYPE_OPTIONS = [
  opt('Facility', 'facility'),
  opt('Facility-Pregate', 'facility_pregate'),
];

const BOOKING_CATEGORY_OPTIONS = [
  opt('Empty Container', 'empty_container'),
  opt('Export Container', 'export_container'),
  opt('Export (Non-Containerized)', 'export_non_containerized'),
  opt('Import Container', 'import_container'),
  opt('Import (Non-Containerized)', 'import_non_containerized'),
  opt('FMCG (Non-Port)', 'fmcg_non_port'),
];

const SERVICE_ZONE_OPTIONS = [
  opt('Apapa Axis', 'apapa_axis'),
  opt('Tincan Axis', 'tincan_axis'),
];

// ── Park-type shared fields (Bonded Terminal, Truck Park, Fish-Van Park) ──

function parkFields(config: {
  nameLabel: string;
  capacityLabel: string;
  capacityType: 'number';
  parkTypeValue: string;
}): UserTypeMetadata {
  return {
    fields: [
      {
        name: 'park_name',
        label: config.nameLabel,
        type: 'string',
        required: true,
      },
      {
        name: 'npa_approved_capacity',
        label: config.capacityLabel,
        type: 'number',
        required: true,
      },
      {
        name: 'park_type',
        label: 'Park Type',
        type: 'string',
        required: true,
        autoPopulated: true,
        autoPopulatedValue: config.parkTypeValue,
      },
      {
        name: 'linked_axis',
        label: 'Linked Axis',
        type: 'multi-select',
        required: true,
        options: LINKED_AXIS_OPTIONS,
      },
      {
        name: 'park_booking_rate',
        label: 'Park Booking Rate (NGN)',
        type: 'number',
        required: true,
      },
      {
        name: 'linked_truck_types',
        label: 'Linked Truck Types',
        type: 'multi-select',
        required: true,
        options: TRUCK_TYPE_OPTIONS,
      },
      {
        name: 'npa_approved_trucks_per_hour',
        label: 'NPA Approved Trucks/Hour',
        type: 'number',
        required: true,
      },
      {
        name: 'facility_type',
        label: 'Facility Type',
        type: 'select',
        required: true,
        options: FACILITY_TYPE_OPTIONS,
      },
      {
        name: 'linked_booking_categories',
        label: 'Linked Booking Categories',
        type: 'multi-select',
        required: true,
        options: BOOKING_CATEGORY_OPTIONS,
      },
      {
        name: 'entry_barrier_id',
        label: 'Entry Barrier ID Number',
        type: 'string',
        required: true,
      },
      {
        name: 'exit_barrier_id',
        label: 'Exit Barrier ID Number',
        type: 'string',
        required: true,
      },
    ],
  };
}

// ── All user type definitions ──

export const USER_TYPE_SEEDS: UserTypeSeed[] = [
  // ────────────── SYSTEM TYPES ──────────────
  {
    name: 'Super Admin',
    slug: 'super-admin',
    category: UserTypeCategory.SYSTEM,
    metadata: null,
  },
  {
    name: 'Admin',
    slug: 'admin',
    category: UserTypeCategory.SYSTEM,
    metadata: null,
  },
  {
    name: 'Customer Service',
    slug: 'customer-service',
    category: UserTypeCategory.SYSTEM,
    metadata: null,
  },
  {
    name: 'Operations Verifier',
    slug: 'operations-verifier',
    category: UserTypeCategory.SYSTEM,
    metadata: null,
  },
  {
    name: 'Road Marshall',
    slug: 'road-marshall',
    category: UserTypeCategory.SYSTEM,
    metadata: null,
  },

  // ────────────── EXTERNAL TYPES ──────────────

  {
    name: 'Bonded Terminal',
    slug: 'bonded-terminal',
    category: UserTypeCategory.EXTERNAL,
    metadata: parkFields({
      nameLabel: 'Name of Bonded Terminal',
      capacityLabel: 'NPA Approved Daily Container Capacity',
      capacityType: 'number',
      parkTypeValue: 'Bonded Terminal',
    }),
  },

  {
    name: 'Truck Park',
    slug: 'truck-park',
    category: UserTypeCategory.EXTERNAL,
    metadata: parkFields({
      nameLabel: 'Name of Truck Park',
      capacityLabel: 'NPA Approved Number of Parking Bays',
      capacityType: 'number',
      parkTypeValue: 'Truck Park',
    }),
  },

  {
    name: 'Fish-Van Park',
    slug: 'fish-van-park',
    category: UserTypeCategory.EXTERNAL,
    metadata: parkFields({
      nameLabel: 'Name of Fish-Van Park',
      capacityLabel: 'NPA Approved Number of Parking Bays',
      capacityType: 'number',
      parkTypeValue: 'Fish-Van Park',
    }),
  },

  {
    name: 'Transit Park',
    slug: 'transit-park',
    category: UserTypeCategory.EXTERNAL,
    metadata: {
      fields: [
        {
          name: 'park_name',
          label: 'Name of Transit Park',
          type: 'string',
          required: true,
        },
        {
          name: 'npa_approved_parking_bays',
          label: 'NPA Approved Number of Parking Bays',
          type: 'number',
          required: true,
        },
        {
          name: 'park_type',
          label: 'Park Type',
          type: 'string',
          required: true,
          autoPopulated: true,
          autoPopulatedValue: 'Transit Park',
        },
        {
          name: 'transit_park_type',
          label: 'Transit Park Type',
          type: 'select',
          required: true,
          options: [
            opt('EPT', 'ept'),
            opt('PREGATE-MIXED', 'pregate_mixed'),
            opt('PREGATE-EMPTY', 'pregate_empty'),
          ],
        },
        {
          name: 'linked_axis',
          label: 'Linked Axis',
          type: 'multi-select',
          required: true,
          options: LINKED_AXIS_OPTIONS,
        },
        {
          name: 'park_booking_rate',
          label: 'Park Booking Rate (NGN)',
          type: 'number',
          required: true,
        },
        {
          name: 'npa_approved_trucks_per_hour',
          label: 'NPA Approved Trucks/Hour',
          type: 'number',
          required: true,
        },
        {
          name: 'linked_booking_categories',
          label: 'Linked Booking Categories',
          type: 'multi-select',
          required: true,
          options: BOOKING_CATEGORY_OPTIONS,
        },
        {
          name: 'entry_barrier_id',
          label: 'Entry Barrier ID Number',
          type: 'string',
          required: true,
        },
        {
          name: 'exit_barrier_id',
          label: 'Exit Barrier ID Number',
          type: 'string',
          required: true,
        },
      ],
    },
  },

  {
    name: 'Terminal Operator',
    slug: 'terminal-operator',
    category: UserTypeCategory.EXTERNAL,
    metadata: {
      fields: [
        {
          name: 'terminal_name',
          label: 'Name of Terminal',
          type: 'string',
          required: true,
        },
        {
          name: 'terminal_type',
          label: 'Terminal Type',
          type: 'select',
          required: true,
          options: [
            opt('Port Terminal', 'port_terminal'),
            opt('Non-Port Terminal', 'non_port_terminal'),
          ],
        },
        {
          name: 'npa_approved_daily_truck_capacity',
          label: 'NPA Approved Daily Truck Capacity',
          type: 'number',
          required: true,
        },
        {
          name: 'npa_approved_trucks_per_hour',
          label: 'NPA Approved Trucks/Hour',
          type: 'number',
          required: true,
        },
        {
          name: 'linked_shipping_lines',
          label: 'Linked Shipping Lines',
          type: 'multi-select',
          required: false,
          options: [],
          optionsSource: 'shipping_line_companies',
          placeholder: 'Multi-Selection from dropdown',
        },
        {
          name: 'linked_transit_parks',
          label: 'Linked Transit Parks',
          type: 'multi-select',
          required: true,
          options: [],
          optionsSource: 'transit_park_companies',
          placeholder: 'Multi-Selection from dropdown',
        },
        {
          name: 'linked_booking_categories',
          label: 'Linked Booking Categories',
          type: 'multi-select',
          required: true,
          options: BOOKING_CATEGORY_OPTIONS,
        },
        {
          name: 'entry_barrier_id',
          label: 'Entry Barrier ID Number',
          type: 'string',
          required: true,
          placeholder: 'Select from ENTRY TERMINAL GATES DATABASE',
        },
        {
          name: 'exit_barrier_id',
          label: 'Exit Barrier ID Number',
          type: 'string',
          required: true,
          placeholder: 'Select from EXIT TERMINAL GATES DATABASE',
        },
      ],
    },
  },

  {
    name: 'Shipping Line',
    slug: 'shipping-line',
    category: UserTypeCategory.EXTERNAL,
    metadata: {
      fields: [
        {
          name: 'shipping_line_name',
          label: 'Name of Shipping Line',
          type: 'string',
          required: true,
        },
        {
          name: 'linked_terminals',
          label: 'Linked Terminals',
          type: 'multi-select',
          required: true,
          options: [],
          optionsSource: 'port_terminal_companies',
          placeholder:
            'Multi-Selection from Dropdown of all PORT TERMINALS ONLY (populated after Port Terminal operators exist)',
        },
      ],
    },
  },

  {
    name: 'NPA (Regulatory Agency)',
    slug: 'npa',
    category: UserTypeCategory.EXTERNAL,
    metadata: {
      fields: [
        {
          name: 'agency_name',
          label: 'Name of Agency',
          type: 'string',
          required: true,
          autoPopulated: true,
          autoPopulatedValue: 'NIGERIAN PORTS AUTHORITY',
        },
        {
          name: 'npa_roles',
          label: 'Roles',
          type: 'multi-select',
          required: true,
          options: [
            opt('Management', 'management'),
            opt('Operations', 'operations'),
            opt('Safety', 'safety'),
            opt('Finance', 'finance'),
          ],
        },
      ],
    },
  },

  {
    name: 'Enforcement Verifier',
    slug: 'enforcement-verifier',
    category: UserTypeCategory.EXTERNAL,
    metadata: {
      fields: [
        {
          name: 'enforcement_agency',
          label: 'Enforcement Agency',
          type: 'select',
          required: true,
          options: [
            opt('LASTMA', 'lastma'),
            opt('Nigerian Police Force (NPF)', 'npf'),
            opt('NPA Security', 'npa_security'),
            opt('FRSC', 'frsc'),
          ],
        },
        {
          name: 'location_beat',
          label: 'Location / Beat',
          type: 'multi-select',
          required: true,
          options: [opt('Apapa', 'apapa'), opt('Tincan', 'tincan')],
        },
      ],
    },
  },

  {
    name: 'NPA (Gate Verification Officer)',
    slug: 'gate-verification-officer',
    category: UserTypeCategory.EXTERNAL,
    metadata: {
      fields: [
        {
          name: 'barrier_id_location',
          label: 'Barrier ID Location',
          type: 'select',
          required: true,
          options: [],
          optionsSource: 'barrier_locations',
          placeholder:
            'Select from dropdown of all CREATED BARRIER ID/Locations',
        },
        {
          name: 'barrier_location',
          label: 'Barrier Location',
          type: 'string',
          required: true,
          autoPopulated: true,
          placeholder: 'Auto-populated based on Barrier Location selected',
        },
        {
          name: 'entry_or_exit',
          label: 'Entry / Exit Barrier',
          type: 'select',
          required: true,
          options: [opt('Entry', 'entry'), opt('Exit', 'exit')],
        },
        {
          name: 'operator_name',
          label: "Operator's Name",
          type: 'string',
          required: true,
        },
      ],
    },
  },

  {
    name: 'Transporter',
    slug: 'transporter',
    category: UserTypeCategory.EXTERNAL,
    metadata: {
      fields: [
        {
          name: 'company_name',
          label: 'Name of Company',
          type: 'string',
          required: true,
        },
        {
          name: 'corporate_address',
          label: 'Corporate Address',
          type: 'text',
          required: true,
        },
      ],
    },
  },

  {
    name: 'Tow Truck Company',
    slug: 'tow-truck-company',
    category: UserTypeCategory.EXTERNAL,
    metadata: {
      fields: [
        {
          name: 'company_name',
          label: 'Name of Company',
          type: 'string',
          required: true,
        },
        {
          name: 'corporate_address',
          label: 'Corporate Address',
          type: 'text',
          required: true,
        },
      ],
    },
  },

  {
    name: 'Pregate',
    slug: 'pregate',
    category: UserTypeCategory.EXTERNAL,
    metadata: parkFields({
      nameLabel: 'Name of Pregate',
      capacityLabel: 'NPA Approved Number of Parking Bays',
      capacityType: 'number',
      parkTypeValue: 'Pregate',
    }),
  },

  {
    name: 'EPT',
    slug: 'ept',
    category: UserTypeCategory.EXTERNAL,
    metadata: {
      fields: [
        {
          name: 'park_name',
          label: 'Name of EPT',
          type: 'string',
          required: true,
        },
        {
          name: 'npa_approved_parking_bays',
          label: 'NPA Approved Number of Parking Bays',
          type: 'number',
          required: true,
        },
        {
          name: 'park_type',
          label: 'Park Type',
          type: 'string',
          required: true,
          autoPopulated: true,
          autoPopulatedValue: 'EPT',
        },
        {
          name: 'transit_park_type',
          label: 'Transit Park Type',
          type: 'select',
          required: true,
          options: [
            opt('EPT', 'ept'),
            opt('PREGATE-MIXED', 'pregate_mixed'),
            opt('PREGATE-EMPTY', 'pregate_empty'),
          ],
        },
        {
          name: 'linked_axis',
          label: 'Linked Axis',
          type: 'multi-select',
          required: true,
          options: LINKED_AXIS_OPTIONS,
        },
        {
          name: 'park_booking_rate',
          label: 'Park Booking Rate (NGN)',
          type: 'number',
          required: true,
        },
        {
          name: 'npa_approved_trucks_per_hour',
          label: 'NPA Approved Trucks/Hour',
          type: 'number',
          required: true,
        },
        {
          name: 'linked_booking_categories',
          label: 'Linked Booking Categories',
          type: 'multi-select',
          required: true,
          options: BOOKING_CATEGORY_OPTIONS,
        },
        {
          name: 'entry_barrier_id',
          label: 'Entry Barrier ID Number',
          type: 'string',
          required: true,
        },
        {
          name: 'exit_barrier_id',
          label: 'Exit Barrier ID Number',
          type: 'string',
          required: true,
        },
      ],
    },
  },
];
