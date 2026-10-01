import { type Kysely, sql } from "kysely";

interface InformationSchemaCount {
    found_count: number;
}

interface SchemaIndexDefinition {
    definition: string;
    index: string;
    table: string;
}

const DIRECTORY_INDEXES: readonly SchemaIndexDefinition[] = [
    {
        table: "sec_user",
        index: "ix_sec_user_directory_status_name",
        definition: "ALTER TABLE sec_user ADD KEY ix_sec_user_directory_status_name (status_user, display_name_user, id_user)",
    },
    {
        table: "sec_user",
        index: "ix_sec_user_directory_status_activity",
        definition: "ALTER TABLE sec_user ADD KEY ix_sec_user_directory_status_activity (status_user, last_login_at_user, id_user)",
    },
    {
        table: "sec_auth_identity",
        index: "ix_sec_auth_identity_user_provider_status",
        definition: "ALTER TABLE sec_auth_identity ADD KEY ix_sec_auth_identity_user_provider_status (user_id_auth_identity, provider_code_auth_identity, status_auth_identity)",
    },
    {
        table: "int_user_external_identity",
        index: "ix_int_user_external_identity_user_system_status",
        definition: "ALTER TABLE int_user_external_identity ADD KEY ix_int_user_external_identity_user_system_status (user_id_user_external_identity, external_system_id_user_external_identity, status_user_external_identity)",
    },
    {
        table: "sec_user",
        index: "ft_sec_user_directory_search",
        definition: "ALTER TABLE sec_user ADD FULLTEXT KEY ft_sec_user_directory_search (display_name_user, email_user, normalized_email_user)",
    },
];

const hasIndex = async (db: Kysely<unknown>, tableName: string, indexName: string): Promise<boolean> => {
    const result = await sql<InformationSchemaCount>`
        SELECT COUNT(*) AS found_count
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ${tableName}
          AND INDEX_NAME = ${indexName}
    `.execute(db);

    return (result.rows[0]?.found_count ?? 0) > 0;
};

const addIndexIfMissing = async (db: Kysely<unknown>, indexDefinition: SchemaIndexDefinition): Promise<void> => {
    if (await hasIndex(db, indexDefinition.table, indexDefinition.index)) {
        return;
    }

    await sql.raw(indexDefinition.definition).execute(db);
};

/**
 * Indices para que el directorio de usuarios filtre en MySQL y no en memoria.
 */
export const identityUserDirectoryMigration = {
    name: "202609300005_identity_user_directory",
    async up(db: Kysely<unknown>): Promise<void> {
        for (const indexDefinition of DIRECTORY_INDEXES) {
            await addIndexIfMissing(db, indexDefinition);
        }
    },
};
