import { expect, test } from "@playwright/test";

test.describe("API routing", () => {
    test("returns 404 for unknown API routes", async ({ request }) => {
        const response = await request.get("/api/v1/does-not-exist");

        expect(response.status()).toBe(404);
    });
});
