import { createCorsOptions, parseCorsOrigins } from "../../src/config/cors-options";

describe("CORS options", () => {
    it("allows the local Vite CRM frontend by default", () => {
        expect(parseCorsOrigins()).toEqual(expect.arrayContaining(["http://localhost:5173", "http://127.0.0.1:5173"]));
    });

    it("adds configured production origins without duplicates", () => {
        expect(parseCorsOrigins("https://crm.example.com, http://localhost:5173")).toEqual(["http://localhost:5173", "http://127.0.0.1:5173", "https://crm.example.com"]);
    });

    it("allows CRM token headers used by the frontend", () => {
        expect(createCorsOptions().allowedHeaders).toEqual(expect.arrayContaining(["Authorization", "Content-Type", "x-crm-api-token"]));
    });

    it("ignores blank and whitespace-only origin entries", () => {
        expect(parseCorsOrigins("https://crm.example.com,  ,   ")).toEqual(["http://localhost:5173", "http://127.0.0.1:5173", "https://crm.example.com"]);
        expect(parseCorsOrigins("   ")).toEqual(["http://localhost:5173", "http://127.0.0.1:5173"]);
    });

    it("does not enable credentialed CORS because CRM authenticates with headers", () => {
        expect(createCorsOptions().credentials).toBe(false);
    });
});
