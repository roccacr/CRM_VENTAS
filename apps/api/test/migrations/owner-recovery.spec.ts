import { describe, expect, it } from "vitest";

import { selectOwnerRecoveryRows } from "../../scripts/restore-owner-from-backup.js";

describe("owner-only recovery selection", () => {
    const snapshot = {
        sec_user: [
            { id_user: 1, normalized_email_user: "rzuniga@roccacr.com" },
            { id_user: 2, normalized_email_user: "other@example.com" },
        ],
        sec_auth_identity: [{ user_id_auth_identity: 1 }, { user_id_auth_identity: 2 }],
        sec_role: [
            { id_role: 1, code_role: "owner", status_role: "active" },
            { id_role: 2, code_role: "ventas", status_role: "active" },
        ],
        sec_permission: [
            { id_permission: 1, status_permission: "active" },
            { id_permission: 2, status_permission: "inactive" },
        ],
        sec_org_unit: [{ id_org_unit: 1, status_org_unit: "active" }],
    };

    it("selects only Roberto, his identities, Owner and active security configuration", () => {
        const rows = selectOwnerRecoveryRows(snapshot);
        expect(rows.sec_user).toHaveLength(1);
        expect(rows.sec_auth_identity).toEqual([{ user_id_auth_identity: 1 }]);
        expect(rows.sec_role).toHaveLength(1);
        expect(rows.sec_permission).toHaveLength(1);
        expect(Object.keys(rows).sort()).toEqual(["sec_auth_identity", "sec_org_unit", "sec_permission", "sec_role", "sec_user"]);
    });

    it("fails closed if Roberto or Owner is missing or ambiguous", () => {
        expect(() => selectOwnerRecoveryRows({ ...snapshot, sec_user: [] })).toThrow();
        expect(() => selectOwnerRecoveryRows({ ...snapshot, sec_user: [...snapshot.sec_user, ...snapshot.sec_user] })).toThrow();
        expect(() => selectOwnerRecoveryRows({ ...snapshot, sec_role: [] })).toThrow();
        expect(() => selectOwnerRecoveryRows({ ...snapshot, sec_auth_identity: [] })).toThrow();
    });
});
