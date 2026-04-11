export interface JwtPayload {
  sub: string;
  email: string;
  is_super_admin: boolean;
  company_id?: string;
  roles: string[];
  permissions: string[];
}
