import { buildMysqlPoolConfig } from '../src/database/mysql-pool-config';

describe('buildMysqlPoolConfig', () => {
  it('prefers raw MYSQL_* values so passwords are not changed by URL encoding', () => {
    const config = buildMysqlPoolConfig({
      DATABASE_URL: 'mysql://bad:bad@bad:3306/bad',
      MYSQL_DATABASE: 'crm-db',
      MYSQL_HOST: '127.0.0.1',
      MYSQL_PASSWORD: 'pa%ss#raw',
      MYSQL_PORT: '3306',
      MYSQL_USER: 'crm',
    });

    expect(config).toMatchObject({
      database: 'crm-db',
      host: '127.0.0.1',
      password: 'pa%ss#raw',
      port: 3306,
      user: 'crm',
    });
  });

  it('falls back to DATABASE_URL when MYSQL_* values are not complete', () => {
    const config = buildMysqlPoolConfig({
      DATABASE_URL: 'mysql://crm:p%40ss@127.0.0.1:3307/crm-db',
    });

    expect(config).toMatchObject({
      database: 'crm-db',
      host: '127.0.0.1',
      password: 'p@ss',
      port: 3307,
      user: 'crm',
    });
  });
});
