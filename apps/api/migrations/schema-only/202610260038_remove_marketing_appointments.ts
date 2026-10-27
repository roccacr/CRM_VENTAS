import { type Kysely, sql } from "kysely";

/** Retires only the removed Marketing menu; calendar and appointment metrics remain. */
export const removeMarketingAppointmentsMigration = {
    name: "202610260038_remove_marketing_appointments",
    async up(db: Kysely<unknown>): Promise<void> {
        await db.transaction().execute(async (tx) => {
            const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(tx);
            if (destination.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Marketing permission removal requires CRM_THINK_V2");
            const permission = await sql<{ id: string }>`SELECT id_permission AS id FROM sec_permission WHERE code_permission='mercadeo.appointments.read' FOR UPDATE`.execute(tx);
            const existing = permission.rows[0];
            if (!existing) return;
            const id = existing.id;
            await sql`DELETE FROM sec_user_permission_override WHERE permission_id_user_permission_override=${id}`.execute(tx);
            await sql`DELETE FROM sec_role_permission WHERE permission_id_role_permission=${id}`.execute(tx);
            await sql`DELETE FROM sec_permission WHERE id_permission=${id} AND code_permission='mercadeo.appointments.read'`.execute(tx);
            // Inherited roles can affect any user; invalidate existing permission snapshots.
            await sql`UPDATE sec_user SET permission_version_user=permission_version_user+1`.execute(tx);
        });
    },
};
