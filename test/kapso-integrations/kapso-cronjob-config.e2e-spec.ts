import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import request from "supertest";

import { KapsoCronjobConfigService } from "../../src/kapso-integrations/kapso-cronjob-config.service";
import { createConfigServiceMock } from "../common/auth/mocks";
import { createE2eApp } from "../common/nest/create-e2e-app";
import { httpServer } from "../common/nest/http";

const token = "crm-e2e-token";

describe("Kapso cronjob config internal API", () => {
    let app: INestApplication;
    const service = {
        createConfig: jest.fn(),
        createProjectConfig: jest.fn(),
        deleteProjectConfig: jest.fn(),
        listConfigs: jest.fn(),
        updateConfig: jest.fn(),
        updateProjectConfig: jest.fn(),
    };

    beforeAll(async () => {
        app = await createE2eApp({
            configure: (builder) =>
                builder
                    .overrideProvider(ConfigService)
                    .useValue(createConfigServiceMock({ CRM_API_INTERNAL_TOKEN: token }))
                    .overrideProvider(KapsoCronjobConfigService)
                    .useValue(service),
        });
    });

    beforeEach(() => {
        service.createConfig.mockReset();
        service.createProjectConfig.mockReset();
        service.deleteProjectConfig.mockReset();
        service.listConfigs.mockReset();
        service.updateConfig.mockReset();
        service.updateProjectConfig.mockReset();
        service.listConfigs.mockResolvedValue([]);
        service.createConfig.mockResolvedValue({ id: "30" });
        service.createProjectConfig.mockResolvedValue({ id: "50" });
        service.updateConfig.mockResolvedValue({ id: "30", isActive: false });
        service.updateProjectConfig.mockResolvedValue({ id: "50", isActive: false });
        service.deleteProjectConfig.mockResolvedValue({ deleted: true });
    });

    afterAll(async () => {
        await app.close();
    });

    it("lists cronjob configs with a valid token", async () => {
        const response = await request(httpServer(app)).get("/api/v1/kapso/cronjob-configs").set("Authorization", `Bearer ${token}`).expect(200);

        expect(response.body).toEqual({ data: [] });
        expect(service.listConfigs).toHaveBeenCalled();
    });

    it("creates a cronjob config with a valid token", async () => {
        const payload = {
            cronjobId: "kapso-sync-chats-rdg",
            isActive: true,
        };
        const response = await request(httpServer(app)).post("/api/v1/kapso/cronjob-configs").set("Authorization", `Bearer ${token}`).send(payload).expect(201);

        expect(response.body).toEqual({ id: "30" });
        expect(service.createConfig).toHaveBeenCalledWith(payload);
    });

    it("updates a cronjob config with a valid token", async () => {
        const payload = {
            cronjobId: "kapso-sync-chats-rdg",
            isActive: false,
        };
        const response = await request(httpServer(app)).patch("/api/v1/kapso/cronjob-configs/30").set("Authorization", `Bearer ${token}`).send(payload).expect(200);

        expect(response.body).toEqual({ id: "30", isActive: false });
        expect(service.updateConfig).toHaveBeenCalledWith("30", payload);
    });

    it("does not expose deleting a general cronjob config", async () => {
        await request(httpServer(app)).delete("/api/v1/kapso/cronjob-configs/30").set("Authorization", `Bearer ${token}`).expect(404);
    });

    it("creates a project config for a cronjob with a valid token", async () => {
        const payload = {
            idnetsuiteAdmin: 653055,
            idproyectoLead: 38,
            isActive: true,
            kapsoIntegracionNumeroWhatsappId: "1",
        };
        const response = await request(httpServer(app)).post("/api/v1/kapso/cronjob-configs/30/projects").set("Authorization", `Bearer ${token}`).send(payload).expect(201);

        expect(response.body).toEqual({ id: "50" });
        expect(service.createProjectConfig).toHaveBeenCalledWith("30", payload);
    });

    it("updates a project config with a valid token", async () => {
        const payload = {
            idnetsuiteAdmin: null,
            idproyectoLead: 38,
            isActive: false,
            kapsoIntegracionNumeroWhatsappId: "1",
        };
        const response = await request(httpServer(app)).patch("/api/v1/kapso/cronjob-project-configs/50").set("Authorization", `Bearer ${token}`).send(payload).expect(200);

        expect(response.body).toEqual({ id: "50", isActive: false });
        expect(service.updateProjectConfig).toHaveBeenCalledWith("50", payload);
    });

    it("deletes a project config with a valid token", async () => {
        const response = await request(httpServer(app)).delete("/api/v1/kapso/cronjob-project-configs/50").set("Authorization", `Bearer ${token}`).expect(200);

        expect(response.body).toEqual({ deleted: true });
        expect(service.deleteProjectConfig).toHaveBeenCalledWith("50");
    });

    it("rejects cronjob config creation without token", async () => {
        await request(httpServer(app))
            .post("/api/v1/kapso/cronjob-configs")
            .send({
                cronjobId: "kapso-sync-chats-rdg",
                isActive: true,
            })
            .expect(401);
        expect(service.createConfig).not.toHaveBeenCalled();
    });
});
