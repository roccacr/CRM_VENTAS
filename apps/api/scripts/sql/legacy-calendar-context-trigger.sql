-- Destino exclusivo: crmdatabase-api. El nombre de la base no acredita sandbox.
-- Pendiente de ejecucion por DBA: ER_BINLOG_CREATE_ROUTINE_NEED_SUPER en RDS.
-- No cambiar log_bin_trust_function_creators, privilegios ni configuracion RDS.
-- Tabla, indices y constraints ya aplicados segun el reporte del operador.
-- Statement exacto del plan del runner; no reemplaza ni elimina triggers existentes.
-- DELIMITER es una directiva del cliente MySQL, no una sentencia del servidor.
USE `crmdatabase-api`;

DELIMITER $$
CREATE TRIGGER trg_calendar_event_context_updated_utc BEFORE UPDATE ON crm_calendar_event_context FOR EACH ROW BEGIN IF BINARY NEW.module_code <> BINARY OLD.module_code OR NEW.calendar_id <> OLD.calendar_id OR BINARY NEW.public_id <> BINARY OLD.public_id THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Calendar context origin is immutable'; END IF; SET NEW.updated_at = UTC_TIMESTAMP(3); END$$
DELIMITER ;
