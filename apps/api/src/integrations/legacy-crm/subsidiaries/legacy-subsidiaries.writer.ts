import { BadRequestException, ConflictException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";
import type { SubsidiariesLegacyAccess, SubsidiaryLegacyPayload } from "../../../modules/crm/subsidiaries/subsidiaries-legacy.port.js";
import { isLegacyCrmWriteEnabled } from "../legacy-crm-access.js";
import { mapLegacySubsidiary } from "./legacy-subsidiaries.mapper.js";

/**
 * Escritura de `subsidiarias` dentro de la transaccion nativa.
 *
 * No abre el pool legado. El SQL cruza a `crmdatabase-api` por la misma
 * conexion del CRM nuevo: las dos bases confirman o revierten juntas. Los
 * nombres fisicos se usan tal cual: `id_subsidaria` y `id_NetsuiteSub`. Con la
 * compuerta apagada no se copia nada y la subsidiaria queda solo en
 * `crm_subsidiary`. Desarrollo no escribe: la compuerta exige produccion,
 * ademas del opt-in.
 */
@Injectable()
export class LegacySubsidiariesWriter implements SubsidiariesLegacyAccess {
    /** Solo lee la compuerta. No guarda un pool ni un flag capturado al arrancar. */
    constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

    /**
     * Se vuelve a leer en cada operacion, tambien en la lectura que hace falta
     * para actualizar. Un cambio de configuracion no sigue autorizado por una
     * decision anterior.
     */
    enabled(): boolean {
        return isLegacyCrmWriteEnabled(this.config);
    }

    /**
     * Bloquea la fila vieja hasta que terminen el alta nativa y su auditoria.
     * Apagado devuelve `null`: no es una subsidiaria inexistente, es ausencia de copia.
     */
    async find(transaction: Transaction<CrmDatabase>, id: number) {
        if (!this.enabled()) return null;
        const result = await sql`SELECT id_subsidaria AS legacyId, id_NetsuiteSub AS externalId, Nombre_Subsidiaria AS name, Estado_Subsidiaria AS status FROM \`crmdatabase-api\`.subsidiarias WHERE id_subsidaria=${id} FOR UPDATE`.execute(transaction);
        return result.rows[0] ? mapLegacySubsidiary(result.rows[0]) : null;
    }

    /**
     * Inserta y devuelve el id generado. El nombre no puede pasar de 250
     * caracteres: es el ancho de la columna vieja, y se rechaza antes de que
     * MySQL lo recorte o devuelva el error crudo. No adopta una fila que ya
     * exista con el mismo nombre o el mismo id de NetSuite. El bloqueo cubre
     * la comprobacion y el alta.
     */
    async create(transaction: Transaction<CrmDatabase>, payload: SubsidiaryLegacyPayload): Promise<number | null> {
        if (!this.enabled()) return null;
        if (payload.name.length > 250) throw new BadRequestException("Legacy subsidiary name exceeds 250 characters.");
        const externalId = this.externalId(payload);
        const duplicate = await sql`SELECT id_subsidaria FROM \`crmdatabase-api\`.subsidiarias WHERE id_NetsuiteSub=${externalId} OR Nombre_Subsidiaria=${payload.name} LIMIT 1 FOR UPDATE`.execute(transaction);
        if (duplicate.rows.length) throw new ConflictException("La subsidiaria ya existe en legacy; edita el registro existente.");
        const result = await sql`INSERT INTO \`crmdatabase-api\`.subsidiarias (id_NetsuiteSub,Nombre_Subsidiaria,Estado_Subsidiaria) VALUES (${externalId},${payload.name},${payload.status === "active" ? 1 : 0})`.execute(transaction);
        const id = Number(result.insertId);
        if (!Number.isSafeInteger(id) || id <= 0) throw new ServiceUnavailableException("Legacy subsidiary identity unavailable.");
        return id;
    }

    /**
     * Copia solo nombre, id de NetSuite y estado. No borra la fila vieja y no
     * escribe un detalle: la tabla no tiene esa columna. Si el vinculo ya no
     * existe, o si ese id de NetSuite pertenece a otra subsidiaria, la
     * transaccion nativa no sigue con una copia a medias.
     */
    async update(transaction: Transaction<CrmDatabase>, id: number, payload: SubsidiaryLegacyPayload): Promise<void> {
        if (!this.enabled()) return;
        if (payload.name.length > 250) throw new BadRequestException("Legacy subsidiary name exceeds 250 characters.");
        if (!(await this.find(transaction, id))) throw new ConflictException("La subsidiaria vinculada ya no existe en legacy.");
        const externalId = this.externalId(payload);
        const conflict = await sql`SELECT id_subsidaria FROM \`crmdatabase-api\`.subsidiarias WHERE id_NetsuiteSub=${externalId} AND id_subsidaria<>${id} LIMIT 1 FOR UPDATE`.execute(transaction);
        if (conflict.rows.length) throw new ConflictException("La referencia NetSuite pertenece a otra subsidiaria legacy.");
        await sql`UPDATE \`crmdatabase-api\`.subsidiarias SET Nombre_Subsidiaria=${payload.name},id_NetsuiteSub=${externalId},Estado_Subsidiaria=${payload.status === "active" ? 1 : 0} WHERE id_subsidaria=${id}`.execute(transaction);
    }

    /**
     * Columna `id_NetsuiteSub`, que es un INT con signo y admite nulo.
     *
     * Sin id en la primera referencia NetSuite, se guarda nulo. Si hay valor,
     * tiene que ser la unica referencia de ese sistema y un entero dentro de
     * INT. Mas de una, o un texto que no sea entero, no se recorta ni se concatena.
     */
    private externalId(payload: SubsidiaryLegacyPayload): number | null {
        const references = payload.externalReferences.filter((reference) => reference.systemCode === "netsuite");
        const value = references[0]?.externalId;
        if (value === undefined) return null;
        if (references.length !== 1 || !/^-?\d+$/.test(value)) throw new BadRequestException("Legacy requiere exactamente un identificador NetSuite entero.");
        const id = Number(value);
        if (!Number.isSafeInteger(id) || id < -2147483648 || id > 2147483647) throw new BadRequestException("Identificador NetSuite fuera del rango INT legacy.");
        return id;
    }
}
