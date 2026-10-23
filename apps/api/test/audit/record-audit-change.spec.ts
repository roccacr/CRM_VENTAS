import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { prepareRecordAuditChange } from "../../src/modules/crm/audit/record-audit-change.js";

describe("record audit safe changes", () => {
    it("preserves array ordering, escapes pointers and distinguishes absence from null", () => {
        const result = prepareRecordAuditChange({ before: { list: ["b", "a"], "a~/b": {} }, after: { list: ["a", "b"], "a~/b": { value: null } }, allowedFields: ["list", "a~/b"] });
        expect(result.before?.list).toEqual(["b", "a"]);
        expect(result.changes).toContainEqual({ path: "/a~0~1b/value", beforeExists: false, afterExists: true, before: null, after: null });
        expect(result.changes.some((change) => change.path.startsWith("/list"))).toBe(true);
    });

    it("sorts object keys, detaches input and compares equivalent objects", () => {
        const before = { value: { z: 1, a: 2 } };
        const result = prepareRecordAuditChange({ before, after: { value: { a: 2, z: 1 } }, allowedFields: ["value"] });
        expect(result.changes).toEqual([]);
        expect(JSON.stringify(result.before)).toBe('{"value":{"a":2,"z":1}}');
        before.value.a = 9;
        expect(result.before?.value).toEqual({ a: 2, z: 1 });
    });

    it.each([undefined, new Date(), () => 1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 1n, new Map(), Array(2)])("rejects non JSON value %s", (value) => {
        expect(() => prepareRecordAuditChange({ before: null, after: { value }, allowedFields: ["value"] })).toThrow(BadRequestException);
    });

    it.each(["password", "passwordHash", "accessToken", "refresh_token", "clientSecret", "__proto__", "constructor", "prototype"])("rejects recursive forbidden key %s", (key) => {
        expect(() => prepareRecordAuditChange({ before: null, after: { value: [JSON.parse(`{"${key}":"hidden"}`)] }, allowedFields: ["value"] })).toThrow(BadRequestException);
    });

    it("rejects unlisted fields, cycles, excessive depth and total UTF8 bytes", () => {
        const cycle: Record<string, unknown> = {};
        cycle.self = cycle;
        for (const after of [{ other: 1 }, { value: cycle }, { value: "x".repeat(256 * 1024) }]) expect(() => prepareRecordAuditChange({ before: null, after, allowedFields: ["value"] })).toThrow(BadRequestException);
        let value: unknown = 0;
        for (let depth = 0; depth < 17; depth++) value = { child: value };
        expect(() => prepareRecordAuditChange({ before: null, after: { value }, allowedFields: ["value"] })).toThrow(BadRequestException);
        expect(() => prepareRecordAuditChange({ before: { value: "x".repeat(140000) }, after: { value: "x".repeat(140000) }, allowedFields: ["value"] })).toThrow(BadRequestException);
    });

    it("accepts depth 16 and rejects oversized serialized output", () => {
        let value: unknown = "leaf";
        for (let depth = 0; depth < 15; depth++) value = { child: value };
        expect(() => prepareRecordAuditChange({ before: null, after: { value }, allowedFields: ["value"] })).not.toThrow();
        const overhead = Buffer.byteLength('null{"value":""}', "utf8");
        const text = "x".repeat(256 * 1024 - overhead);
        expect(() => prepareRecordAuditChange({ before: null, after: { value: text }, allowedFields: ["value"] })).toThrow(BadRequestException);
        expect(() => prepareRecordAuditChange({ before: null, after: { value: `${text}x` }, allowedFields: ["value"] })).toThrow(BadRequestException);
        expect(() => prepareRecordAuditChange({ before: null, after: { value: "\u00e9".repeat(140000) }, allowedFields: ["value"] })).toThrow(BadRequestException);
    });

    it("limits the final payload including values repeated in changes", () => {
        const value = "x".repeat(140000);
        expect(Buffer.byteLength(JSON.stringify({ before: null, after: { value } }))).toBeLessThan(256 * 1024);
        expect(() => prepareRecordAuditChange({ before: null, after: { value }, allowedFields: ["value"] })).toThrow(BadRequestException);
        const overhead = Buffer.byteLength(JSON.stringify({ before: { value: "" }, after: { value: "" }, changes: [] }));
        const text = "x".repeat(Math.floor((256 * 1024 - overhead) / 2));
        expect(() => prepareRecordAuditChange({ before: { value: text }, after: { value: text }, allowedFields: ["value"] })).not.toThrow();
        expect(() => prepareRecordAuditChange({ before: { value: `${text}x` }, after: { value: `${text}x` }, allowedFields: ["value"] })).toThrow(BadRequestException);
    });

    it("rejects accessor, symbol and custom prototype properties without invoking getters", () => {
        let invoked = false;
        const accessor = Object.defineProperty({}, "code", {
            enumerable: true,
            get: () => {
                invoked = true;
                return "unsafe";
            },
        });
        for (const value of [accessor, { [Symbol("hidden")]: 1 }, Object.create({ code: "inherited" })]) {
            expect(() => prepareRecordAuditChange({ before: null, after: { value }, allowedFields: ["value"] })).toThrow(BadRequestException);
        }
        expect(invoked).toBe(false);
    });

    it("supports null snapshots, deletions, repeated references and finite fractions", () => {
        const shared = { code: "same" };
        const result = prepareRecordAuditChange({ before: { value: null }, after: null, allowedFields: ["value"] });
        expect(result.changes).toEqual([{ path: "/value", beforeExists: true, afterExists: false, before: null, after: null }]);
        expect(prepareRecordAuditChange({ before: null, after: { value: [shared, shared, 1.25] }, allowedFields: ["value"] }).after?.value).toEqual([shared, shared, 1.25]);
    });
});
