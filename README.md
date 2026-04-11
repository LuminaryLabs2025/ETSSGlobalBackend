# Maritime ETSS — B2B SaaS Multi-Tenant Backend

Production-ready NestJS backend with multi-tenant architecture, RBAC, JWT authentication, and activity logging.

## Tech Stack

- **NestJS** — modular monolith architecture
- **PostgreSQL** — relational database
- **TypeORM** — ORM with migrations
- **JWT + Passport** — authentication
- **bcrypt** — password hashing

## Getting Started

### Prerequisites

- Node.js >= 18
- PostgreSQL >= 14

### Installation

```bash
npm install
```

### Environment

Copy `.env.example` to `.env` and update values:

```bash
cp .env.example .env
```

### Database Setup

Create the PostgreSQL database:

```sql
CREATE DATABASE maritime_etss;
```

### Run Seed

```bash
npm run seed
```

This creates:
- Super Admin user (`admin@etss.com` / `password123`)
- Default roles: Super Admin, Admin, Staff
- Default permissions: create_user, manage_users, manage_roles, view_dashboard, manage_companies
- Role-permission assignments

### Start Development

```bash
npm run start:dev
```

### Build & Production

```bash
npm run build
npm run start:prod
```

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with email/password |

### Users
| Method | Endpoint | Permission |
|--------|----------|------------|
| POST | `/api/users` | create_user |
| GET | `/api/users` | manage_users |
| GET | `/api/users/:id` | manage_users |
| PUT | `/api/users/:id` | manage_users |
| DELETE | `/api/users/:id` | Super Admin role |
| POST | `/api/users/:id/roles` | manage_roles |
| DELETE | `/api/users/:id/roles/:roleId` | manage_roles |

### Companies
| Method | Endpoint | Permission |
|--------|----------|------------|
| POST | `/api/companies` | manage_companies |
| GET | `/api/companies` | manage_companies |
| GET | `/api/companies/:id` | manage_companies |
| PUT | `/api/companies/:id` | manage_companies |
| DELETE | `/api/companies/:id` | manage_companies |

### Team Members
| Method | Endpoint | Permission |
|--------|----------|------------|
| POST | `/api/team-members` | create_user |
| GET | `/api/team-members` | manage_users |
| GET | `/api/team-members/:id` | manage_users |
| DELETE | `/api/team-members/:id` | manage_users |
| POST | `/api/team-members/:id/roles` | manage_roles |
| DELETE | `/api/team-members/:id/roles/:roleId` | manage_roles |

### Roles & Permissions
| Method | Endpoint | Access |
|--------|----------|--------|
| POST | `/api/roles-permissions/roles` | Super Admin |
| GET | `/api/roles-permissions/roles` | manage_roles |
| DELETE | `/api/roles-permissions/roles/:id` | Super Admin |
| POST | `/api/roles-permissions/permissions` | Super Admin |
| GET | `/api/roles-permissions/permissions` | manage_roles |
| DELETE | `/api/roles-permissions/permissions/:id` | Super Admin |
| POST | `/api/roles-permissions/assign` | Super Admin |

### Dashboard
| Method | Endpoint | Permission |
|--------|----------|------------|
| GET | `/api/dashboard` | view_dashboard |

### Activity Logs
| Method | Endpoint | Access |
|--------|----------|--------|
| GET | `/api/activity-logs` | Super Admin, Admin |
| GET | `/api/activity-logs/user/:userId` | Super Admin, Admin |

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | Start dev server with watch |
| `npm run build` | Build for production |
| `npm run start:prod` | Run production build |
| `npm run seed` | Run database seed |
| `npm run migration:generate` | Generate migration |
| `npm run migration:run` | Run pending migrations |
| `npm run migration:revert` | Revert last migration |

## Architecture

```
src/
├── common/
│   ├── decorators/       # @Roles(), @Permissions(), @CurrentUser()
│   ├── filters/          # Global exception filter
│   ├── guards/           # RolesGuard, PermissionsGuard
│   ├── interceptors/     # Activity logging interceptor
│   └── interfaces/       # JWT payload interface
├── config/               # Database & TypeORM config
├── database/
│   ├── entities/         # All TypeORM entities
│   ├── migrations/       # TypeORM migrations
│   └── seeds/            # Seed script
└── modules/
    ├── auth/             # JWT authentication
    ├── users/            # User CRUD + role assignment
    ├── companies/        # Company CRUD
    ├── team-members/     # Team member CRUD + role assignment
    ├── roles-permissions/ # RBAC management
    ├── dashboard/        # Dashboard statistics
    └── activity-log/     # Activity log viewing
```
