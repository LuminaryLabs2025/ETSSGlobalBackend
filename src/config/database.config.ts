import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { parseDatabaseUrl } from './parse-database-url';
import { resolvePostgresSsl } from './postgres-ssl';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const databaseUrl = configService.get<string>('DATABASE_URL');
  const parsed = databaseUrl ? parseDatabaseUrl(databaseUrl) : null;

  const ssl = resolvePostgresSsl({
    databaseUrl,
    databaseSslEnv: configService.get<string>('DATABASE_SSL'),
  });

  return {
    type: 'postgres',
    host: parsed?.host ?? configService.get<string>('DB_HOST', 'localhost'),
    port: parsed?.port ?? configService.get<number>('DB_PORT', 5432),
    username:
      parsed?.username ?? configService.get<string>('DB_USERNAME', 'postgres'),
    password:
      parsed?.password ?? configService.get<string>('DB_PASSWORD', 'postgres'),
    database:
      parsed?.database ?? configService.get<string>('DB_NAME', 'maritime_etss'),
    ssl,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    synchronize: configService.get<string>('NODE_ENV') === 'development',
    logging: configService.get<string>('NODE_ENV') === 'development',
  };
};
