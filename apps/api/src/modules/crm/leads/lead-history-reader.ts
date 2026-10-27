import { BadRequestException, NotFoundException } from "@nestjs/common";
import { sql } from "kysely";
import { isValid } from "ulid";
import { z } from "zod";

import type { DatabaseService } from "../../../database/database.service.js";
import { historyEntrySchema } from "./lead-history.contract.js";

const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), cursor: z.string().max(256).optional() }).strict();
const cursorSchema = z.object({ recordId: z.string(), before: z.number().int().positive() }).strict();

/** Bounded cursor tied to one record; a cursor for another lead is never reusable. */
export function readHistoryQuery(recordId: string, value: unknown) {
    if (!isValid(recordId)) throw new BadRequestException("Invalid history record");
    const parsed = querySchema.safeParse(value);
    if (!parsed.success) throw new BadRequestException("Invalid history query");
    let before: number | undefined;
    if (parsed.data.cursor) {
        try {
            const cursor = cursorSchema.parse(JSON.parse(Buffer.from(parsed.data.cursor, "base64url").toString("utf8")));
            if (cursor.recordId !== recordId) throw new Error("scope");
            before = cursor.before;
        } catch {
            throw new BadRequestException("Invalid history cursor");
        }
    }
    return { limit: parsed.data.limit, before };
}

/** Only approved display fields leave the archive; raw source and actor identifiers stay internal. */
export function displayHistoryEntry(value: unknown) {
    const decoded: unknown = typeof value === "string" ? JSON.parse(value) : value;
    const parsed = z.object({ historyEntry: historyEntrySchema }).safeParse(decoded);
    return parsed.success ? parsed.data.historyEntry : null;
}

/** Native-only read model; works after the legacy adapter and its connection are removed. */
export class LeadHistoryReader {
    /** No legacy dependency is required to read preserved history. */
    constructor(private readonly database: Pick<DatabaseService, "db">) {}

    /** Read one authorized record in descending evidence sequence with a bounded cursor. */
    async timeline(recordId: string, rawQuery: unknown = {}) {
        const query = readHistoryQuery(recordId, rawQuery);
        const record = await this.database.db.selectFrom("audit_record").select(["id_record as publicId", "entity_type_record as entity"]).where("id_record", "=", recordId).where("entity_type_record", "in", ["lead", "lead_history_unresolved"]).executeTakeFirst();
        if (!record) throw new NotFoundException("Lead history unavailable");
        // DATETIME stores UTC without a zone. Format in SQL so mysql2's local timezone cannot shift it.
        let read = this.database.db
            .selectFrom("audit_record_event")
            .select(["id_record_event as publicId", "sequence_record_event as sequence", sql<string>`DATE_FORMAT(recorded_at_record_event,'%Y-%m-%dT%H:%i:%s.%fZ')`.as("recordedAt"), "after_record_event as snapshot", "actor_snapshot_record_event as actor", "snapshot_scope_record_event as coverage"])
            .where("record_id_record_event", "=", recordId);
        if (query.before !== undefined) read = read.where("sequence_record_event", "<", query.before);
        const rows = await read
            .orderBy("sequence_record_event", "desc")
            .limit(query.limit + 1)
            .execute();
        const page = rows.slice(0, query.limit);
        const items = page.map((row) => {
            const actor: unknown = typeof row.actor === "string" ? JSON.parse(row.actor) : row.actor;
            const person = z.object({ name: z.string().optional(), nameObserved: z.string().nullable().optional() }).safeParse(actor);
            return { publicId: row.publicId, sequence: row.sequence, recordedAt: new Date(row.recordedAt).toISOString(), coverage: row.coverage, entry: displayHistoryEntry(row.snapshot), actorName: person.success ? (person.data.name ?? person.data.nameObserved ?? null) : null, actorNameCoverage: row.coverage === "observation" ? "current_directory" : "at_event" };
        });
        const last = page.at(-1);
        return { record, items, pagination: { limit: query.limit, hasNext: rows.length > query.limit, nextCursor: rows.length > query.limit && last ? Buffer.from(JSON.stringify({ recordId, before: last.sequence })).toString("base64url") : null } };
    }
}
