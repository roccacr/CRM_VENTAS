// ============================================================================
// Constantes canonicas del producto CRM TINK.
//
// Este archivo evita que valores de gobierno se repitan como literales sueltos
// dentro del runtime. Los SQL y documentos pueden mencionar el nombre fisico de
// la base; el codigo ejecutable debe importar esta constante.
// ============================================================================

/**
 * Nombre fisico aprobado de la base nueva del CRM.
 *
 * Es parte de la ley de producto: `DB_NAME` nunca debe apuntar a
 * `crmdatabase-api` ni a otra base compartida por error de configuracion. La
 * base vieja, cuando se habilite, vive aislada en `src/integrations/legacy-crm`.
 */
export const APPROVED_DATABASE_NAME = "CRM_THINK_V2";
