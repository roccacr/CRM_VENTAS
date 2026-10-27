import { type Kysely, sql } from "kysely";

/** Native reason for an explicit stage update; never inferred from imported observations. */
export const leadStageReasonsMigration = {
    name: "202610230033_lead_stage_reasons",
    async up<DB>(db: Kysely<DB>): Promise<void> {
        const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db);
        if (destination.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Lead stage reasons require CRM_THINK_V2");
        await db.transaction().execute(async (tx) => {
            await sql`INSERT INTO conf_action_reason (code_action_reason,name_action_reason,detail_action_reason) VALUES ('stage_update','Actualización de etapa','Motivo nativo para documentar un avance o retorno de etapa. La pérdida exige un motivo específico.') ON DUPLICATE KEY UPDATE code_action_reason=code_action_reason`.execute(tx);
            for (const code of ["interested", "opportunity", "pre_reservation", "reservation", "contract", "follow_up"]) {
                await sql`INSERT INTO conf_action_reason_status (status_code_action_reason_status,reason_code_action_reason_status) VALUES (${code},'stage_update') ON DUPLICATE KEY UPDATE reason_code_action_reason_status=reason_code_action_reason_status`.execute(tx);
            }
        });
    },
};
