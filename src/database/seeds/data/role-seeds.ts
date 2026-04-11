export interface RoleSeedRow {
  name: string;
  description: string;
}

export const ROLE_SEEDS: RoleSeedRow[] = [
  { name: 'Super Admin', description: 'Full platform access' },
  { name: 'Admin', description: 'Company-level administrative access' },
  { name: 'Staff', description: 'Basic staff access' },
];

/** Maps role name → permission names */
export const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  'Super Admin': [
    'create_user',
    'manage_users',
    'manage_roles',
    'view_dashboard',
    'manage_companies',
  ],
  Admin: ['create_user', 'manage_users', 'view_dashboard', 'manage_companies'],
  Staff: ['view_dashboard'],
};
