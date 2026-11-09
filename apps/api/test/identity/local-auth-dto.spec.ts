import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";

import { CompleteLocalResetDto, LocalLoginDto, RequestLocalResetDto } from "../../src/modules/crm/identity/dto/local-auth.dto.js";
import { CreateSystemUserDto } from "../../src/modules/crm/identity/dto/system-users.dto.js";

/**
 * Retorna las constraints de validacion para un campo especifico.
 */
const getFieldConstraints = async (dto: object, property: string): Promise<Record<string, string>> => {
    const errors = await validate(dto);
    return errors.find((error) => error.property === property)?.constraints ?? {};
};

/**
 * Valida reglas de entrada locales sin levantar HTTP.
 */
describe("local auth DTOs", () => {
    it.each([null, "", "short", "x".repeat(129)])("rejects invalid initial passwords without exposing their values (%#)", async (password) => {
        expect(Object.keys(await getFieldConstraints(plainToInstance(CreateSystemUserDto, { password }), "password")).length).toBeGreaterThan(0);
    });
    it("normaliza correos y limita su longitud maxima", async () => {
        const dto = plainToInstance(RequestLocalResetDto, {
            email: "  USUARIO@ROCCACR.COM  ",
        });

        expect(dto.email).toBe("usuario@roccacr.com");
        await expect(validate(dto)).resolves.toHaveLength(0);

        const tooLongEmail = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(58)}.com`;
        const invalidDto = plainToInstance(RequestLocalResetDto, {
            email: tooLongEmail,
        });

        await expect(getFieldConstraints(invalidDto, "email")).resolves.toHaveProperty("maxLength");
    });

    it("rechaza passwords locales excesivamente largos", async () => {
        const login = plainToInstance(LocalLoginDto, {
            email: "usuario@roccacr.com",
            password: "x".repeat(129),
        });
        const reset = plainToInstance(CompleteLocalResetDto, {
            resetToken: "t".repeat(32),
            newPassword: "x".repeat(129),
        });

        await expect(getFieldConstraints(login, "password")).resolves.toHaveProperty("maxLength");
        await expect(getFieldConstraints(reset, "newPassword")).resolves.toHaveProperty("maxLength");
    });

    it("rechaza tokens de reset excesivamente largos", async () => {
        const reset = plainToInstance(CompleteLocalResetDto, {
            resetToken: "t".repeat(257),
            newPassword: "password-seguro-local",
        });

        await expect(getFieldConstraints(reset, "resetToken")).resolves.toHaveProperty("maxLength");
    });
});

describe("emails con caracteres invisibles", () => {
    const INVISIBLE = ["\u200b", "\u200d", "\u202e", "\u00ad", "\u0000", "\u0007"];
    const emailErrors = async (dto: object) => (await validate(dto)).filter((error) => error.property === "email");

    it.each(INVISIBLE)("login y reset rechazan %j al final, al inicio y en medio del correo", async (char) => {
        for (const email of [`user@example.com${char}`, `${char}user@example.com`, `us${char}er@example.com`]) {
            expect(await emailErrors(plainToInstance(LocalLoginDto, { email, password: "x".repeat(12) }))).not.toHaveLength(0);
            expect(await emailErrors(plainToInstance(RequestLocalResetDto, { email }))).not.toHaveLength(0);
        }
    });

    it("el BOM (U+FEFF) en los bordes lo elimina trim(); en medio se rechaza", async () => {
        const edge = plainToInstance(LocalLoginDto, { email: "\ufeffuser@example.com\ufeff", password: "x".repeat(12) });
        expect(edge.email).toBe("user@example.com");
        expect(await emailErrors(edge)).toHaveLength(0);
        expect(await emailErrors(plainToInstance(LocalLoginDto, { email: "us\ufeffer@example.com", password: "x".repeat(12) }))).not.toHaveLength(0);
    });

    it("el alta de usuarios del sistema tambien los rechaza", async () => {
        const dto = plainToInstance(CreateSystemUserDto, { email: "user@example.com\u200b" });
        expect(await emailErrors(dto)).not.toHaveLength(0);
    });

    it("sigue aceptando un correo normal con mayusculas y espacios externos", async () => {
        const login = plainToInstance(LocalLoginDto, { email: "  User@Example.COM ", password: "x".repeat(12) });
        expect(await emailErrors(login)).toHaveLength(0);
        expect(login.email).toBe("user@example.com");
        expect(await emailErrors(plainToInstance(CreateSystemUserDto, { email: "user@example.com" }))).toHaveLength(0);
    });
});
