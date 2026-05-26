-- Agrega columna dedicada para rastrear desde cuándo una oportunidad quedó menos probable.
-- Este script NO se ejecuta automáticamente desde la aplicación.
-- Backfill intencionalmente omitido: oportunidades viejas quedan NULL hasta decisión de negocio.

ALTER TABLE oportunidades
    ADD COLUMN fecha_menos_probable_oport TIMESTAMP NULL DEFAULT NULL
    AFTER update_fecha_oport,
    ADD COLUMN motivo_inactivacion_oport VARCHAR(100) NULL DEFAULT NULL
    AFTER fecha_menos_probable_oport;

-- Rollback manual si fuera necesario:
-- ALTER TABLE oportunidades
--     DROP COLUMN motivo_inactivacion_oport,
--     DROP COLUMN fecha_menos_probable_oport;
