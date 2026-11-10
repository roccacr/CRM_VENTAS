import { BadRequestException, ConflictException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";
import type { CampaignLegacyPayload, CampaignsLegacyAccess } from "../../../modules/crm/campaigns/campaigns-legacy.port.js";
import { isLegacyCrmWriteEnabled } from "../legacy-crm-access.js";
import { mapLegacyCampaign } from "./legacy-campaigns.mapper.js";

/**
 * Escritura de `campanas` dentro de la transaccion nativa.
 *
 * No abre el pool legado. El SQL cruza a `crmdatabase-api` por la misma
 * conexion del CRM nuevo: las dos bases confirman o revierten juntas. Los
 * nombres fisicos se usan tal cual, incluido `id_NetsauiteCampana`. Con la
 * compuerta apagada no se copia nada y la campaña queda solo en `crm_campaign`.
 * Desarrollo no escribe: la compuerta exige produccion, ademas del opt-in.
 */
@Injectable()
export class LegacyCampaignsWriter implements CampaignsLegacyAccess {
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
     * Apagado devuelve `null`: no es una campaña inexistente, es ausencia de copia.
     */
    async find(transaction: Transaction<CrmDatabase>, id: number) {
        if (!this.enabled()) return null;
        const result = await sql`SELECT id_Campana AS legacyId, id_NetsauiteCampana AS externalId, Nombre_Campana AS name, Estado_Campana AS status FROM \`crmdatabase-api\`.campanas WHERE id_Campana=${id} FOR UPDATE`.execute(transaction);
        return result.rows[0] ? mapLegacyCampaign(result.rows[0]) : null;
    }

    /**
     * Inserta y devuelve el id generado. No adopta una fila que ya exista con
     * el mismo nombre o el mismo id de NetSuite: hay que editar esa, no enlazarla
     * en silencio a una campaña nueva. El bloqueo cubre la comprobacion y el alta.
     */
    async create(transaction: Transaction<CrmDatabase>, payload: CampaignLegacyPayload): Promise<number | null> {
        if (!this.enabled()) return null;
        const externalId = this.externalId(payload);
        const duplicate = await sql`SELECT id_Campana FROM \`crmdatabase-api\`.campanas WHERE id_NetsauiteCampana=${externalId} OR Nombre_Campana=${payload.name} LIMIT 1 FOR UPDATE`.execute(transaction);
        if (duplicate.rows.length) throw new ConflictException("La campaña ya existe en legacy; edita el registro existente.");
        const result = await sql`INSERT INTO \`crmdatabase-api\`.campanas (id_NetsauiteCampana,Nombre_Campana,Estado_Campana) VALUES (${externalId},${payload.name},${payload.status === "active" ? 1 : 0})`.execute(transaction);
        const id = Number(result.insertId);
        if (!Number.isSafeInteger(id) || id <= 0) throw new ServiceUnavailableException("Legacy campaign identity unavailable.");
        return id;
    }

    /**
     * Copia solo nombre, id de NetSuite y estado. No borra la fila vieja. Si el
     * vinculo ya no existe, o si ese id de NetSuite pertenece a otra campaña,
     * la transaccion nativa no sigue con una copia a medias.
     */
    async update(transaction: Transaction<CrmDatabase>, id: number, payload: CampaignLegacyPayload): Promise<void> {
        if (!this.enabled()) return;
        if (!(await this.find(transaction, id))) throw new ConflictException("La campaña vinculada ya no existe en legacy.");
        const externalId = this.externalId(payload);
        const conflict = await sql`SELECT id_Campana FROM \`crmdatabase-api\`.campanas WHERE id_NetsauiteCampana=${externalId} AND id_Campana<>${id} LIMIT 1 FOR UPDATE`.execute(transaction);
        if (conflict.rows.length) throw new ConflictException("La referencia NetSuite pertenece a otra campaña legacy.");
        await sql`UPDATE \`crmdatabase-api\`.campanas SET Nombre_Campana=${payload.name},id_NetsauiteCampana=${externalId},Estado_Campana=${payload.status === "active" ? 1 : 0} WHERE id_Campana=${id}`.execute(transaction);
    }

    /**
     * Columna `id_NetsauiteCampana`, que es un INT con signo y admite nulo.
     * El nombre se conserva con la grafia de la tabla vieja.
     *
     * Sin id en la primera referencia NetSuite, se guarda nulo. Si hay valor,
     * tiene que ser la unica referencia de ese sistema y un entero dentro de
     * INT. Mas de una, o un texto que no sea entero, no se recorta ni se concatena.
     */
    private externalId(payload: CampaignLegacyPayload): number | null {
        const references = payload.externalReferences.filter((reference) => reference.systemCode === "netsuite");
        const value = references[0]?.externalId;
        if (value === undefined) return null;
        if (references.length !== 1 || !/^-?\d+$/.test(value)) throw new BadRequestException("Legacy requiere exactamente un identificador NetSuite entero.");
        const id = Number(value);
        if (!Number.isSafeInteger(id) || id < -2147483648 || id > 2147483647) throw new BadRequestException("Identificador NetSuite fuera del rango INT legacy.");
        return id;
    }
}
