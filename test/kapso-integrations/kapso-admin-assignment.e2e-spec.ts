import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import request from "supertest";

import { KapsoAdminAssignmentService } from "../../src/kapso-integrations/kapso-admin-assignment.service";
import { createConfigServiceMock } from "../common/auth/mocks";
import { createE2eApp } from "../common/nest/create-e2e-app";
import { httpServer } from "../common/nest/http";

const token = "crm-e2e-token";

describe("Kapso admin assignment internal API", () => {
    let app: INestApplication;
    const service = {
        createAssignment: jest.fn(),
        deleteAssignment: jest.fn(),
        listAdminIntegrations: jest.fn(),
        listAdminOptions: jest.fn(),
        listPhoneNumberOptions: jest.fn(),
        updateAssignment: jest.fn(),
    };

    beforeAll(async () => {
        app = await createE2eApp({
            configure: (builder) =>
                builder
                    .overrideProvider(ConfigService)
                    .useValue(createConfigServiceMock({ CRM_API_INTERNAL_TOKEN: token }))
                    .overrideProvider(KapsoAdminAssignmentService)
                    .useValue(service),
        });
    });

    beforeEach(() => {
        service.createAssignment.mockReset();
        service.deleteAssignment.mockReset();
        service.listAdminIntegrations.mockReset();
        service.listAdminOptions.mockReset();
        service.listPhoneNumberOptions.mockReset();
        service.updateAssignment.mockReset();
        service.listAdminIntegrations.mockResolvedValue([]);
        service.listAdminOptions.mockResolvedValue([]);
        service.listPhoneNumberOptions.mockResolvedValue([]);
        service.createAssignment.mockResolvedValue({ id: "10" });
        service.updateAssignment.mockResolvedValue({ id: "10", idnetsuiteAdmin: 252150002 });
        service.deleteAssignment.mockResolvedValue({ deleted: true });
    });

    afterAll(async () => {
        await app.close();
    });

    it("lists assignment view with a valid token", async () => {
        const response = await request(httpServer(app)).get("/api/v1/kapso/admin-integrations").set("Authorization", `Bearer ${token}`).expect(200);

        expect(response.body).toEqual({ data: [] });
        expect(service.listAdminIntegrations).toHaveBeenCalledWith("", false);
    });

    it("lists admin options with search and inactive flag", async () => {
        await request(httpServer(app)).get("/api/v1/kapso/admins/options?search=angelica&includeInactive=1").set("Authorization", `Bearer ${token}`).expect(200);

        expect(service.listAdminOptions).toHaveBeenCalledWith("angelica", true);
    });

    it("creates an assignment with a valid token", async () => {
        const response = await request(httpServer(app)).post("/api/v1/kapso/admin-integrations").set("Authorization", `Bearer ${token}`).send({ idnetsuiteAdmin: 252150001, kapsoIntegracionNumeroWhatsappId: "1" }).expect(201);

        expect(response.body).toEqual({ id: "10" });
        expect(service.createAssignment).toHaveBeenCalledWith("1", 252150001);
    });

    it("updates an assignment with a valid token", async () => {
        const response = await request(httpServer(app)).patch("/api/v1/kapso/admin-integrations/10").set("Authorization", `Bearer ${token}`).send({ idnetsuiteAdmin: 252150002 }).expect(200);

        expect(response.body).toEqual({ id: "10", idnetsuiteAdmin: 252150002 });
        expect(service.updateAssignment).toHaveBeenCalledWith("10", 252150002);
    });

    it("deletes an assignment with a valid token", async () => {
        const response = await request(httpServer(app)).delete("/api/v1/kapso/admin-integrations/10").set("Authorization", `Bearer ${token}`).expect(200);

        expect(response.body).toEqual({ deleted: true });
        expect(service.deleteAssignment).toHaveBeenCalledWith("10");
    });

    it("rejects assignment view requests without token", async () => {
        await request(httpServer(app)).get("/api/v1/kapso/admin-integrations").expect(401);
        expect(service.listAdminIntegrations).not.toHaveBeenCalled();
    });

    it("allows browser preflight from the local CRM frontend", async () => {
        await request(httpServer(app)).options("/api/v1/kapso/admin-integrations").set("Origin", "http://localhost:5173").set("Access-Control-Request-Method", "GET").set("Access-Control-Request-Headers", "authorization,x-crm-api-token,content-type").expect(204).expect("access-control-allow-origin", "http://localhost:5173");
    });
});
