import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export const typeormConfig: DataSourceOptions = {
  type: 'postgres',
  url:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/accessman',
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
};

export default new DataSource(typeormConfig);
