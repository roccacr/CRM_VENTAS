import { INestApplication } from "@nestjs/common";
import request from "supertest";

import { GLOBAL_API_PREFIX, SERVICE_NAME } from "../../src/config/http.constants";
import { HealthStatus } from "../../src/health/health.service";
import { createE2eApp } from "../common/nest/create-e2e-app";
import { httpServer } from "../common/nest/http";

describe("Health endpoint", () => {
    let app: INestApplication;

    beforeAll(async () => {
        app = await createE2eApp();
    });

    afterAll(async () => {
        await app.close();
    });

    it("returns service status", async () => {
        const response = await request(httpServer(app)).get(`/${GLOBAL_API_PREFIX}/health`).expect(200);
        const body = response.body as HealthStatus;

        expect(body).toMatchObject({
            status: "ok",
            service: SERVICE_NAME,
        });
        expect(body.timestamp).toEqual(expect.any(String));
    });
});
