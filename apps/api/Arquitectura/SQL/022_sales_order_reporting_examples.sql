-- Consultas de referencia, solo lectura. Datos futuros de CRM_THINK_V2.
USE CRM_THINK_V2;

-- Conteo candidato para el banner. El permiso se verifica en el API, no en el SQL.
SELECT COUNT(*) AS pending_approval_count
FROM crm_sales_order o
JOIN crm_sales_order_approval d
 ON d.sales_order_id_sales_order_approval=o.id_sales_order
 AND d.type_code_sales_order_approval='developer' AND d.status_sales_order_approval='approved'
JOIN crm_sales_order_approval j
 ON j.sales_order_id_sales_order_approval=o.id_sales_order
 AND j.type_code_sales_order_approval='sales_management' AND j.status_sales_order_approval='approved'
JOIN crm_sales_order_approval f
 ON f.sales_order_id_sales_order_approval=o.id_sales_order
 AND f.type_code_sales_order_approval='formalization' AND f.status_sales_order_approval='not_approved'
WHERE o.status_sales_order='active' AND o.cancelled_sales_order='no'
 AND o.deleted_at_sales_order IS NULL;

-- Duracion de cada visita: NULL si no se conoce el inicio o no existe siguiente evento.
-- Filtrar por etapa DESPUES de LEAD para no saltar etapas intermedias.
WITH visits AS (
 SELECT sales_order_id_sales_order_state_event AS order_id,
 sequence_sales_order_state_event AS visit_number,
 to_state_code_sales_order_state_event AS state_code,
 actor_user_id_sales_order_state_event AS actor_id,
 effective_at_sales_order_state_event AS entered_at,
 recorded_at_sales_order_state_event AS observed_at,
 LEAD(effective_at_sales_order_state_event) OVER (
  PARTITION BY sales_order_id_sales_order_state_event
  ORDER BY sequence_sales_order_state_event
 ) AS left_at
 FROM audit_sales_order_state_event
)
SELECT *,TIMESTAMPDIFF(SECOND,entered_at,left_at) AS duration_seconds
FROM visits ORDER BY order_id,visit_number;

-- Tiempo hasta cierre: no sustituir una fecha inicial desconocida por importacion.
WITH journey AS (
 SELECT sales_order_id_sales_order_state_event AS order_id,
 MIN(CASE WHEN sequence_sales_order_state_event=1 THEN effective_at_sales_order_state_event END) AS first_known_entry,
 MIN(CASE WHEN to_state_code_sales_order_state_event='closed' THEN effective_at_sales_order_state_event END) AS first_closure
 FROM audit_sales_order_state_event GROUP BY sales_order_id_sales_order_state_event
)
SELECT *,TIMESTAMPDIFF(SECOND,first_known_entry,first_closure) AS time_to_first_closure_seconds
FROM journey;

-- Cierres por anio UTC: limites semiabiertos; no borrar historial al cambiar anio.
-- Definir con negocio si el indicador cuenta ordenes distintas o eventos de cierre.
SELECT COUNT(DISTINCT sales_order_id_sales_order_state_event) AS closed_orders
FROM audit_sales_order_state_event
WHERE to_state_code_sales_order_state_event='closed'
 AND effective_at_sales_order_state_event >= '2026-01-01 00:00:00'
 AND effective_at_sales_order_state_event < '2027-01-01 00:00:00';
