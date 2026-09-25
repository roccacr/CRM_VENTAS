import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";

import { CompleteLocalResetDto, LocalLoginDto, RequestLocalResetDto } from "../../src/modules/crm/identity/dto/local-auth.dto.js";

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
