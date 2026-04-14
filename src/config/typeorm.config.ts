import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { parseDatabaseUrl } from './parse-database-url';
import { resolvePostgresSsl } from './postgres-ssl';

dotenv.config();

const parsed = process.env.DATABASE_URL
  ? parseDatabaseUrl(process.env.DATABASE_URL)
  : null;
const ssl = resolvePostgresSsl({
  databaseUrl: process.env.DATABASE_URL,
  databaseSslEnv: process.env.DATABASE_SSL,
});

export default new DataSource({
  type: 'postgres',
  host: parsed?.host ?? process.env.DB_HOST ?? 'localhost',
  port: parsed?.port ?? parseInt(process.env.DB_PORT || '5432', 10),
  username: parsed?.username ?? process.env.DB_USERNAME ?? 'postgres',
  password: parsed?.password ?? process.env.DB_PASSWORD ?? 'postgres',
  database: parsed?.database ?? process.env.DB_NAME ?? 'maritime_etss',
  ssl,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false,
});
