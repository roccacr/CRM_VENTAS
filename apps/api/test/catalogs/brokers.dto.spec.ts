import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";

import { CreateBrokerDto, UpdateBrokerDto } from "../../src/modules/crm/brokers/brokers.dto.js";

describe("Brokers request validation", () => {
    it.each([CreateBrokerDto, UpdateBrokerDto])("accepts the real 250-character limit and preserves shared validations", async (Dto) => {
        const payload = { moduleCode: "administration", name: "A".repeat(250), reason: "Approved change", externalReferences: [{ systemCode: "netsuite", externalId: "5" }] };
        expect(await validate(plainToInstance(Dto, payload))).toEqual([]);
        const oversized = await validate(plainToInstance(Dto, { ...payload, name: "A".repeat(251) }));
        expect(oversized.some((error) => error.property === "name")).toBe(true);
        const invalid = await validate(plainToInstance(Dto, { ...payload, moduleCode: "unknown", reason: "x", externalReferences: [{ systemCode: "", externalId: "5" }] }));
        expect(invalid.map((error) => error.property)).toEqual(expect.arrayContaining(["moduleCode", "reason", "externalReferences"]));
    });
});
