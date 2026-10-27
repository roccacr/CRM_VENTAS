-- Verification examples, NOT a migration. SELECT-only business data.
-- These global counts are for an authorized diagnostic account. Runtime must apply mercadeo.leads.read scopes.
-- October 2026, Costa Rica: inclusive Oct 1 local midnight, exclusive Oct 27 local midnight.
SET @from_epoch = TIMESTAMPDIFF(SECOND, '1970-01-01 00:00:00', '2026-10-01 06:00:00');
SET @until_epoch = TIMESTAMPDIFF(SECOND, '1970-01-01 00:00:00', '2026-10-27 06:00:00');
START TRANSACTION READ ONLY;

-- Native first. UTC DATETIME storage; all created leads, regardless of active/inactive stage.
SELECT COUNT(*) AS leads
FROM CRM_THINK_V2.crm_lead l
WHERE l.created_at_lead >= DATE_ADD('1970-01-01 00:00:00', INTERVAL @from_epoch SECOND)
  AND l.created_at_lead < DATE_ADD('1970-01-01 00:00:00', INTERVAL @until_epoch SECOND);

-- Legacy second. Calendar ownership/creator never replaces the lead owner.
-- Each provider reference must resolve to exactly one legacy lead.
-- Completed > pending > none. Several events do not multiply a lead.
WITH visits AS (
  SELECT id_lead,
         MAX(LOWER(TRIM(accion_calendar)) = 'completado') AS completed,
         MAX(LOWER(TRIM(accion_calendar)) = 'pendiente') AS pending
  FROM `crmdatabase-api`.calendars
  WHERE LOWER(TRIM(tipo_calendar)) = 'cita'
  GROUP BY id_lead
), provider_refs AS (
  SELECT idinterno_lead, COUNT(*) AS n
  FROM `crmdatabase-api`.leads
  GROUP BY idinterno_lead
)
SELECT COUNT(*) AS leads,
       SUM(TRIM(l.segimineto_lead) = '07-LEAD-PERDIDO') AS lost,
       SUM(COALESCE(v.completed, 0) = 1 AND r.n = 1) AS completed,
       SUM(COALESCE(v.completed, 0) = 0 AND COALESCE(v.pending, 0) = 1 AND r.n = 1) AS scheduled,
       SUM(NOT(COALESCE(v.completed, 0) = 1 AND r.n = 1)
         AND NOT(COALESCE(v.pending, 0) = 1 AND r.n = 1)) AS noAppointment
FROM `crmdatabase-api`.leads l
LEFT JOIN provider_refs r ON r.idinterno_lead = l.idinterno_lead
LEFT JOIN visits v ON v.id_lead = l.idinterno_lead
WHERE l.creado_lead >= FROM_UNIXTIME(@from_epoch)
  AND l.creado_lead < FROM_UNIXTIME(@until_epoch);

-- Verify campaign reference semantics without one correlated scan per lead.
WITH lead_codes AS (
  SELECT TRIM(idcampana_lead) AS ref, COUNT(*) AS n
  FROM `crmdatabase-api`.leads
  GROUP BY TRIM(idcampana_lead)
), campaign_codes AS (
  SELECT CAST(id_NetsauiteCampana AS CHAR) AS ref
  FROM `crmdatabase-api`.campanas
  GROUP BY CAST(id_NetsauiteCampana AS CHAR)
)
SELECT SUM(l.n) AS total_leads,
       SUM(CASE WHEN c.ref IS NOT NULL THEN l.n ELSE 0 END) AS matched_provider_campaign
FROM lead_codes l LEFT JOIN campaign_codes c ON c.ref = l.ref;

-- Native and legacy copies of the SAME lead are deduplicated only through active,
-- unambiguous provider-scoped references in the API, never customer email/phone/name.
ROLLBACK;
