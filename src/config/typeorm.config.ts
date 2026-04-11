import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { parseDatabaseUrl } from './parse-database-url';

dotenv.config();

const parsed = process.env.DATABASE_URL
  ? parseDatabaseUrl(process.env.DATABASE_URL)
  : null;

export default new DataSource({
  type: 'postgres',
  host: parsed?.host ?? process.env.DB_HOST ?? 'localhost',
  port: parsed?.port ?? parseInt(process.env.DB_PORT || '5432', 10),
  username: parsed?.username ?? process.env.DB_USERNAME ?? 'postgres',
  password: parsed?.password ?? process.env.DB_PASSWORD ?? 'postgres',
  database: parsed?.database ?? process.env.DB_NAME ?? 'maritime_etss',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false,
});
