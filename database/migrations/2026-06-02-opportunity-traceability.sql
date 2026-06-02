DROP PROCEDURE IF EXISTS sp_add_oportunidad_traceability_column;
DELIMITER $$

CREATE PROCEDURE sp_add_oportunidad_traceability_column(
    IN p_column_name VARCHAR(64),
    IN p_definition TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'oportunidades'
          AND COLUMN_NAME = p_column_name
    ) THEN
        SET @sql = CONCAT('ALTER TABLE oportunidades ', p_definition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END $$

DELIMITER ;

CALL sp_add_oportunidad_traceability_column(
    'fecha_inactivacion_oport',
    'ADD COLUMN fecha_inactivacion_oport TIMESTAMP NULL DEFAULT NULL AFTER motivo_inactivacion_oport'
);
CALL sp_add_oportunidad_traceability_column(
    'id_usuario_inactivo_oport',
    'ADD COLUMN id_usuario_inactivo_oport INT NULL DEFAULT NULL AFTER fecha_inactivacion_oport'
);
CALL sp_add_oportunidad_traceability_column(
    'tipo_actor_inactivacion_oport',
    'ADD COLUMN tipo_actor_inactivacion_oport VARCHAR(30) NULL DEFAULT NULL AFTER id_usuario_inactivo_oport'
);
CALL sp_add_oportunidad_traceability_column(
    'fuente_inactivacion_oport',
    'ADD COLUMN fuente_inactivacion_oport VARCHAR(60) NULL DEFAULT NULL AFTER tipo_actor_inactivacion_oport'
);
CALL sp_add_oportunidad_traceability_column(
    'detalle_inactivacion_oport',
    'ADD COLUMN detalle_inactivacion_oport TEXT NULL AFTER fuente_inactivacion_oport'
);
CALL sp_add_oportunidad_traceability_column(
    'fecha_reactivacion_oport',
    'ADD COLUMN fecha_reactivacion_oport TIMESTAMP NULL DEFAULT NULL AFTER detalle_inactivacion_oport'
);
CALL sp_add_oportunidad_traceability_column(
    'id_usuario_reactivo_oport',
    'ADD COLUMN id_usuario_reactivo_oport INT NULL DEFAULT NULL AFTER fecha_reactivacion_oport'
);
CALL sp_add_oportunidad_traceability_column(
    'tipo_actor_reactivacion_oport',
    'ADD COLUMN tipo_actor_reactivacion_oport VARCHAR(30) NULL DEFAULT NULL AFTER id_usuario_reactivo_oport'
);
CALL sp_add_oportunidad_traceability_column(
    'fuente_reactivacion_oport',
    'ADD COLUMN fuente_reactivacion_oport VARCHAR(60) NULL DEFAULT NULL AFTER tipo_actor_reactivacion_oport'
);
CALL sp_add_oportunidad_traceability_column(
    'detalle_reactivacion_oport',
    'ADD COLUMN detalle_reactivacion_oport TEXT NULL AFTER fuente_reactivacion_oport'
);
CALL sp_add_oportunidad_traceability_column(
    'duracion_ultima_inactividad_seg_oport',
    'ADD COLUMN duracion_ultima_inactividad_seg_oport BIGINT NULL DEFAULT NULL AFTER detalle_reactivacion_oport'
);

DROP PROCEDURE IF EXISTS sp_add_oportunidad_traceability_column;

CREATE TABLE IF NOT EXISTS oportunidades_historial_estado (
    id_historial_oport INT NOT NULL AUTO_INCREMENT,
    id_oportunidad_oport INT NOT NULL,
    id_oport INT NULL,
    id_lead_oport INT NULL,
    tranid_oport VARCHAR(100) NULL,
    estado_anterior_oport INT NOT NULL,
    estado_nuevo_oport INT NOT NULL,
    motivo_oport VARCHAR(100) NULL,
    detalle_oport TEXT NULL,
    id_usuario_actor_oport INT NULL,
    tipo_actor_oport VARCHAR(30) NOT NULL,
    fuente_oport VARCHAR(60) NOT NULL,
    fecha_evento_oport TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_inicio_inactividad_oport TIMESTAMP NULL DEFAULT NULL,
    fecha_fin_inactividad_oport TIMESTAMP NULL DEFAULT NULL,
    duracion_inactividad_seg_oport BIGINT NULL DEFAULT NULL,
    PRIMARY KEY (id_historial_oport),
    KEY idx_oportunidades_historial_oportunidad (id_oportunidad_oport, fecha_evento_oport),
    KEY idx_oportunidades_historial_lead (id_lead_oport, fecha_evento_oport)
);
