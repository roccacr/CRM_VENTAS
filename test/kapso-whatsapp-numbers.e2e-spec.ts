import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { KapsoWhatsappNumbersService } from '../src/kapso-integrations/kapso-whatsapp-numbers.service';

const token = 'crm-e2e-token';

describe('Kapso WhatsApp numbers internal API', () => {
  let app: INestApplication;
  const service = {
    activate: jest.fn(),
    deactivate: jest.fn(),
    findAll: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue({ get: (key: string) => (key === 'CRM_API_INTERNAL_TOKEN' ? token : undefined) })
      .overrideProvider(KapsoWhatsappNumbersService)
      .useValue(service)
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  beforeEach(() => {
    service.activate.mockReset();
    service.deactivate.mockReset();
    service.findAll.mockReset();
    service.findAll.mockResolvedValue([]);
    service.activate.mockResolvedValue({ id: '1', isActive: true });
    service.deactivate.mockResolvedValue({ id: '1', isActive: false });
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists integrations with a valid Bearer token', async () => {
    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/api/v1/kapso/whatsapp-numbers')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({ data: [] });
    expect(service.findAll).toHaveBeenCalledWith();
  });

  it('rejects list requests without token', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/api/v1/kapso/whatsapp-numbers')
      .expect(401);

    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('rejects list requests with an invalid token', async () => {
    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/api/v1/kapso/whatsapp-numbers')
      .set('Authorization', 'Bearer wrong')
      .expect(401);

    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('activates an integration with a valid token', async () => {
    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .patch('/api/v1/kapso/whatsapp-numbers/1/activate')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({ id: '1', isActive: true });
    expect(service.activate).toHaveBeenCalledWith('1');
  });

  it('deactivates an integration with a valid token', async () => {
    const response = await request(app.getHttpServer() as Parameters<typeof request>[0])
      .patch('/api/v1/kapso/whatsapp-numbers/1/deactivate')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({ id: '1', isActive: false });
    expect(service.deactivate).toHaveBeenCalledWith('1');
  });
});
