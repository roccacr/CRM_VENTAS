-- Home only: supports approval=0 and approval=1 with the same covering index.
-- Preflight: inspect information_schema.STATISTICS for this exact index first.
-- One-time additive MySQL 8 / InnoDB change; never run as part of a GET request.
-- No order values, approvals, states, audit entries or permissions are changed.
SET SESSION lock_wait_timeout = 5;
ALTER TABLE `crmdatabase-api`.`ordenventa`
  ADD INDEX idx_ov_formalization_summary
    (status_ov, caida_ov, chekJefeVenta, aprobacion__rdr_ov, aprobacion_forma_ov, id_ov),
  ALGORITHM=INPLACE, LOCK=NONE;

-- Verify both predicates with EXPLAIN; no FORCE INDEX is needed.
EXPLAIN SELECT id_ov FROM `crmdatabase-api`.`ordenventa`
 WHERE status_ov=1 AND caida_ov=0 AND chekJefeVenta=1
   AND aprobacion__rdr_ov=1 AND aprobacion_forma_ov=0 AND id_ov>0
 ORDER BY id_ov LIMIT 500;
EXPLAIN SELECT id_ov FROM `crmdatabase-api`.`ordenventa`
 WHERE status_ov=1 AND caida_ov=0 AND chekJefeVenta=1
   AND aprobacion__rdr_ov=1 AND aprobacion_forma_ov=1 AND id_ov>0
 ORDER BY id_ov LIMIT 500;

-- DBA rollback, only if needed: DROP INDEX idx_ov_formalization_summary
-- ON `crmdatabase-api`.`ordenventa` ALGORITHM=INPLACE LOCK=NONE;
