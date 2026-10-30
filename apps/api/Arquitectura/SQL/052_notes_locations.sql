-- Display references only: canonical record link and invitation ACL stay unchanged.
CREATE TABLE crm_note_location (
 note_id_note_location BIGINT UNSIGNED NOT NULL COMMENT 'Nota nativa unica, sin duplicar contenido ni autor',
 module_code_note_location VARCHAR(40) NOT NULL COMMENT 'Modulo del Home adicional; no concede permisos',
 view_code_note_location VARCHAR(100) NOT NULL COMMENT 'Codigo registrado de Home autorizado, nunca una URL',
 created_by_user_id_note_location BIGINT UNSIGNED NOT NULL COMMENT 'Autor que agrego la ubicacion adicional',
 created_at_note_location DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Fecha UTC de registro de la referencia visual',
 PRIMARY KEY (note_id_note_location,module_code_note_location,view_code_note_location),
 KEY ix_note_location_view (module_code_note_location,view_code_note_location,note_id_note_location),
 CONSTRAINT fk_note_location_note FOREIGN KEY (note_id_note_location) REFERENCES crm_note(id_note),
 CONSTRAINT fk_note_location_author FOREIGN KEY (created_by_user_id_note_location) REFERENCES sec_user(id_user),
 CONSTRAINT ck_note_location_home CHECK (
  (module_code_note_location='ventas' AND view_code_note_location='sales-home') OR
  (module_code_note_location='mercadeo' AND view_code_note_location='marketing-home') OR
  (module_code_note_location='formalizacion' AND view_code_note_location='formalization-home') OR
  (module_code_note_location='contabilidad' AND view_code_note_location='accounting-home') OR
  (module_code_note_location='administration' AND view_code_note_location='admin-home')
 )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ubicaciones visuales adicionales de una nota con ACL independiente';
