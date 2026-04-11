export interface PermissionSeedRow {
  name: string;
  description: string;
}

export const PERMISSION_SEEDS: PermissionSeedRow[] = [
  { name: 'create_user', description: 'Create new users' },
  { name: 'manage_users', description: 'View and manage users' },
  { name: 'manage_roles', description: 'Create and manage roles' },
  { name: 'view_dashboard', description: 'View dashboard statistics' },
  { name: 'manage_companies', description: 'Create and manage companies' },
];
