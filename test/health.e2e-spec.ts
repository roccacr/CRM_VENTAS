import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { HealthStatus } from '../src/health/health.service';

describe('Health endpoint', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns service status', async () => {
    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/api/v1/health')
      .expect(200);
    const body = response.body as HealthStatus;

    expect(body).toMatchObject({
      status: 'ok',
      service: 'api-kapso-git',
    });
    expect(body.timestamp).toEqual(expect.any(String));
  });
});
