import { buildDatabaseUrlFromMysqlEnv } from '../src/database/database-url';

describe('buildDatabaseUrlFromMysqlEnv', () => {
  it('returns an existing DATABASE_URL without rebuilding it', () => {
    const url = buildDatabaseUrlFromMysqlEnv({
      DATABASE_URL: 'mysql://user:pass@host:3306/db',
    });

    expect(url).toBe('mysql://user:pass@host:3306/db');
  });

  it('builds a MySQL URL from existing MYSQL_* values', () => {
    const url = buildDatabaseUrlFromMysqlEnv({
      MYSQL_HOST: '127.0.0.1',
      MYSQL_PORT: '3306',
      MYSQL_USER: 'crm user',
      MYSQL_PASSWORD: 'p@ss word',
      MYSQL_DATABASE: 'crm-db',
    });

    expect(url).toBe('mysql://crm%20user:p%40ss%20word@127.0.0.1:3306/crm-db');
  });

  it('returns undefined when required MYSQL_* values are missing', () => {
    const url = buildDatabaseUrlFromMysqlEnv({
      MYSQL_HOST: '127.0.0.1',
      MYSQL_USER: 'crm',
    });

    expect(url).toBeUndefined();
  });
});
