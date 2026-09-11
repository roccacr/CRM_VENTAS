import { ConflictException } from "@nestjs/common";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import { throwIfPrismaUniqueViolation } from "../../src/kapso-integrations/throw-prisma-unique-conflict";

describe("throwIfPrismaUniqueViolation", () => {
    it("maps Prisma P2002 to ConflictException", () => {
        const error = new PrismaClientKnownRequestError("Unique constraint failed", {
            clientVersion: "6.19.3",
            code: "P2002",
        });

        expect(() => throwIfPrismaUniqueViolation(error, "Kapso cronjob id already exists")).toThrow(ConflictException);
    });

    it("does not throw for a different Prisma error code", () => {
        const error = new PrismaClientKnownRequestError("Record not found", {
            clientVersion: "6.19.3",
            code: "P2025",
        });

        expect(() => throwIfPrismaUniqueViolation(error, "duplicate")).not.toThrow();
    });

    it("does not throw for a generic Error", () => {
        expect(() => throwIfPrismaUniqueViolation(new Error("db unavailable"), "duplicate")).not.toThrow();
    });
});
