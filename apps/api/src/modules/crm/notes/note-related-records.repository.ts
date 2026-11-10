import { createHash } from "node:crypto";

import { ConflictException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { sql } from "kysely";

import { DatabaseService } from "../../../database/database.service.js";
import { type NoteRelatedReference, relatedReferenceSchema } from "./note-related-records.contract.js";
import type { NoteRecord } from "./notes.contract.js";

type Executor = DatabaseService["db"];
export interface StoredNoteRelatedRecord {
    linkId: number;
    primary: boolean;
    reference: NoteRelatedReference;
}
interface RelatedRow {
    noteId: number;
    linkId: number;
    primary: number;
    key: string;
    kind: string;
    target: string;
    nativeId: string | null;
    externalId: string | null;
    system: string | null;
}

/** La identidad de negocio no depende del espacio donde se creó la nota. */
export const noteRelatedRecordKey = (reference: NoteRelatedReference): string =>
    createHash("sha256")
        .update(JSON.stringify(["note-related-record", reference.kind, reference.source, reference.id]))
        .digest("hex");

function decodeRelatedRow(row: RelatedRow): StoredNoteRelatedRecord {
    const native = row.target === "native";
    const identity = native ? { source: "native", id: row.nativeId } : { source: "legacy", id: row.externalId };
    const reference = relatedReferenceSchema.safeParse({ kind: row.kind, ...identity });
    const supportedTarget = native || (row.target === "external" && row.system === "legacy_crm");
    if (!reference.success || !supportedTarget) throw new ConflictException("Vinculo de nota no valido.");
    if (!row.primary && row.key !== noteRelatedRecordKey(reference.data)) throw new ConflictException("Vinculo de nota no valido.");
    return { linkId: row.linkId, primary: row.primary === 1, reference: reference.data };
}

/** El lote de referencias no trae títulos de negocio. Quien llama autoriza los resúmenes aparte. */
export async function readNoteRelatedRecords(executor: Executor, notes: readonly Pick<NoteRecord, "internalId">[]): Promise<Map<number, StoredNoteRelatedRecord[]>> {
    const result = new Map<number, StoredNoteRelatedRecord[]>();
    if (!notes.length) return result;
    const rows = await sql<RelatedRow>`SELECT l.note_id_note_link AS noteId,l.id_note_link AS linkId,l.is_primary_note_link AS ${sql.ref("primary")},l.target_key_note_link AS ${sql.ref("key")},l.entity_type_note_link AS kind,l.target_kind_note_link AS target,CASE WHEN l.entity_type_note_link='lead' THEN linked_lead.public_id_lead ELSE orders.public_id_sales_order END AS nativeId,l.external_id_note_link AS externalId,s.code_external_system AS ${sql.ref("system")}
        FROM crm_note_link l LEFT JOIN crm_lead linked_lead ON linked_lead.id_lead=l.lead_id_note_link LEFT JOIN crm_sales_order orders ON orders.id_sales_order=l.sales_order_id_note_link LEFT JOIN int_external_system s ON s.id_external_system=l.external_system_id_note_link
        WHERE l.note_id_note_link IN (${sql.join(notes.map((note) => note.internalId))}) AND l.entity_type_note_link IN ('lead','sales_order') ORDER BY l.is_primary_note_link DESC,l.id_note_link`.execute(executor);
    for (const row of rows.rows) {
        const stored = decodeRelatedRow(row);
        result.set(row.noteId, [...(result.get(row.noteId) ?? []), stored]);
    }
    return result;
}

/** Un editor restringido no borra el principal ni las relaciones secundarias que no puede ver. */
export async function persistNoteRelatedRecords(executor: Executor, note: Pick<NoteRecord, "internalId">, references: readonly NoteRelatedReference[], preservedLinkIds: readonly number[] = []): Promise<void> {
    const stored = (await readNoteRelatedRecords(executor, [note])).get(note.internalId) ?? [];
    const preserve = preservedLinkIds.length ? sql`AND id_note_link NOT IN (${sql.join(preservedLinkIds)})` : sql``;
    await sql`DELETE FROM crm_note_link WHERE note_id_note_link=${note.internalId} AND is_primary_note_link=0 AND entity_type_note_link IN ('lead','sales_order') ${preserve}`.execute(executor);
    const retained = stored.filter((row) => row.primary || preservedLinkIds.includes(row.linkId));
    const keys = new Set(retained.map((row) => noteRelatedRecordKey(row.reference)));
    for (const reference of references) {
        const key = noteRelatedRecordKey(reference);
        if (keys.has(key)) continue;
        await insertReference(executor, note.internalId, reference);
        keys.add(key);
    }
}

async function insertReference(executor: Executor, noteId: number, reference: NoteRelatedReference): Promise<void> {
    let leadId: number | null = null;
    let orderId: number | null = null;
    let systemId: number | null = null;
    if (reference.source === "legacy") {
        const system = (await sql<{ id: number }>`SELECT id_external_system AS id FROM int_external_system WHERE code_external_system='legacy_crm' AND status_external_system='active' FOR SHARE`.execute(executor)).rows[0];
        if (!system) throw new ServiceUnavailableException("Origen del registro no disponible.");
        systemId = system.id;
    } else {
        const nativeId = await lockNativeReference(executor, reference);
        if (reference.kind === "lead") leadId = nativeId;
        else orderId = nativeId;
    }
    await sql`INSERT INTO crm_note_link (note_id_note_link,target_key_note_link,target_kind_note_link,entity_type_note_link,lead_id_note_link,sales_order_id_note_link,external_system_id_note_link,external_id_note_link,is_primary_note_link)
        VALUES (${noteId},${noteRelatedRecordKey(reference)},${reference.source === "native" ? "native" : "external"},${reference.kind},${leadId},${orderId},${systemId},${reference.source === "legacy" ? reference.id : null},0)`.execute(executor);
}

async function lockNativeReference(executor: Executor, reference: NoteRelatedReference): Promise<number> {
    const query = reference.kind === "lead" ? sql<{ id: number }>`SELECT id_lead AS id FROM crm_lead WHERE public_id_lead=${reference.id} AND status_lead='active' AND deleted_at_lead IS NULL FOR SHARE` : sql<{ id: number }>`SELECT id_sales_order AS id FROM crm_sales_order WHERE public_id_sales_order=${reference.id} AND status_sales_order='active' AND cancelled_sales_order='no' AND deleted_at_sales_order IS NULL FOR SHARE`;
    const row = (await query.execute(executor)).rows[0];
    if (!row) throw new NotFoundException("Registro disponible no encontrado.");
    return row.id;
}

/** Un lote por página de lista. No hay SQL por ficha. La escritura reutiliza la transacción auditada de quien llama. */
@Injectable()
export class NoteRelatedRecordsRepository {
    /** Usa el pool nativo que ya existe. No abre otro. */
    constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
    /** Devuelve referencias calificadas por origen para notas ya autorizadas. */
    referencesForNotes(notes: readonly Pick<NoteRecord, "internalId">[], executor: Executor = this.database.db) {
        return readNoteRelatedRecords(executor, notes);
    }
}
