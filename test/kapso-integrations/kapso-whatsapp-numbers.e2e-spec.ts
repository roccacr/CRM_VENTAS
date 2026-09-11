import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import request from "supertest";

import { KapsoWhatsappNumbersService } from "../../src/kapso-integrations/kapso-whatsapp-numbers.service";
import { createConfigServiceMock } from "../common/auth/mocks";
import { createE2eApp } from "../common/nest/create-e2e-app";
import { httpServer } from "../common/nest/http";

const token = "crm-e2e-token";

describe("Kapso WhatsApp numbers internal API", () => {
    let app: INestApplication;
    const service = {
        activate: jest.fn(),
        deactivate: jest.fn(),
        findAll: jest.fn(),
        syncOneFromKapso: jest.fn(),
        syncFromKapso: jest.fn(),
    };

    beforeAll(async () => {
        app = await createE2eApp({
            rawBody: true,
            configure: (builder) =>
                builder
                    .overrideProvider(ConfigService)
                    .useValue(createConfigServiceMock({ CRM_API_INTERNAL_TOKEN: token }))
                    .overrideProvider(KapsoWhatsappNumbersService)
                    .useValue(service),
        });
    });

    beforeEach(() => {
        service.activate.mockReset();
        service.deactivate.mockReset();
        service.findAll.mockReset();
        service.syncOneFromKapso.mockReset();
        service.syncFromKapso.mockReset();
        service.findAll.mockResolvedValue([]);
        service.activate.mockResolvedValue({ id: "1", isActive: true });
        service.deactivate.mockResolvedValue({ id: "1", isActive: false });
        service.syncFromKapso.mockResolvedValue({ synced: 1 });
        service.syncOneFromKapso.mockResolvedValue({ synced: 1 });
    });

    afterAll(async () => {
        await app.close();
    });

    it("lists integrations with a valid Bearer token", async () => {
        const response = await request(httpServer(app)).get("/api/v1/kapso/whatsapp-numbers").set("Authorization", `Bearer ${token}`).expect(200);

        expect(response.body).toEqual({ data: [] });
        expect(service.findAll).toHaveBeenCalledWith();
    });

    it("rejects list requests without token", async () => {
        await request(httpServer(app)).get("/api/v1/kapso/whatsapp-numbers").expect(401);
        expect(service.findAll).not.toHaveBeenCalled();
    });

    it("rejects list requests with an invalid token", async () => {
        await request(httpServer(app)).get("/api/v1/kapso/whatsapp-numbers").set("Authorization", "Bearer wrong").expect(401);

        expect(service.findAll).not.toHaveBeenCalled();
    });

    it("activates an integration with a valid token", async () => {
        const response = await request(httpServer(app)).patch("/api/v1/kapso/whatsapp-numbers/1/activate").set("Authorization", `Bearer ${token}`).expect(200);

        expect(response.body).toEqual({ id: "1", isActive: true });
        expect(service.activate).toHaveBeenCalledWith("1");
    });

    it("syncs integrations with a valid token", async () => {
        const response = await request(httpServer(app)).post("/api/v1/kapso/whatsapp-numbers/sync").set("Authorization", `Bearer ${token}`).expect(200);

        expect(response.body).toEqual({ synced: 1 });
        expect(service.syncFromKapso).toHaveBeenCalledWith();
    });

    it("syncs one integration with a valid token", async () => {
        const response = await request(httpServer(app)).post("/api/v1/kapso/whatsapp-numbers/1/sync").set("Authorization", `Bearer ${token}`).expect(200);

        expect(response.body).toEqual({ synced: 1 });
        expect(service.syncOneFromKapso).toHaveBeenCalledWith("1");
    });

    it("rejects sync requests without token before calling service", async () => {
        await request(httpServer(app)).post("/api/v1/kapso/whatsapp-numbers/sync").expect(401);
        expect(service.syncFromKapso).not.toHaveBeenCalled();
    });

    it("deactivates an integration with a valid token", async () => {
        const response = await request(httpServer(app)).patch("/api/v1/kapso/whatsapp-numbers/1/deactivate").set("Authorization", `Bearer ${token}`).expect(200);

        expect(response.body).toEqual({ id: "1", isActive: false });
        expect(service.deactivate).toHaveBeenCalledWith("1");
    });
});
