/**
 * Nombre fisico de la base nueva. El runtime importa esta constante; no repite
 * el literal en SQL ejecutable ni en validadores.
 *
 * `DB_NAME` tiene que ser exactamente este valor. Un entorno mal apuntado no
 * puede abrir `crmdatabase-api` ni otra base compartida desde el proceso nuevo.
 * La base vieja, cuando se habilita, vive aparte en `src/integrations/legacy-crm`.
 */
export const APPROVED_DATABASE_NAME = "CRM_THINK_V2";
