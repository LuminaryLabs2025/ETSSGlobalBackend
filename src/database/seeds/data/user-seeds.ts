/**
 * Bootstrap system user (Super Admin). Override via env in production.
 */
export const SUPER_ADMIN_SEED = {
  email: process.env.SEED_SUPER_ADMIN_EMAIL || 'admin@etss.com',
  password: process.env.SEED_SUPER_ADMIN_PASSWORD || 'password123',
  first_name: process.env.SEED_SUPER_ADMIN_FIRST_NAME || 'Super',
  last_name: process.env.SEED_SUPER_ADMIN_LAST_NAME || 'Admin',
  user_type_slug: 'super-admin',
  role_name: 'Super Admin',
} as const;
