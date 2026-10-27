# 44 - Bitacora de Leads: origenes separados y JSON comun

## Corte contrastado contra codigo - 2026-10-27

`AuditReadController` mantiene timeline HTTP nativa con `RequirePermission({kind:
"audit"})`; `LeadHistoryReader` es su lector. Existe un lector legacy separado
en `integrations/legacy-crm/lead-history`, pero su presencia no convierte esta
ruta en federada. Captacion53 es un reporte agregado independiente y no exporta
la bitacora del lead. Ninguna lectura debe crear expedientes o copiar historia.

La historia de etapas de ordenes es otro agregado: [52](52-Etapas-Responsables-y-Tiempos.md)
documenta sus escritores nativo/legacy y auditoria central. Esas ampliaciones no
habilitan CRUD de Leads ni un importador de `bitacoras`.

El runner registra hoy hasta 038 (36 migraciones); 031-034 en el texto siguiente
es el inventario historico de esa revision. La afirmacion 033 pendiente se refiere
a los snapshots citados del 2026-10-23: no se consulto el ledger hoy. Tampoco se
repitieron limpieza, SELECT, pruebas de persistencia ni recuentos del incidente.
Se conservan auditorias historicas; el retiro del permiso Eventos y citas no las
borra. La evidencia de 038 esta en [53](53-Captacion-Leads-Reporte-Federado.md).

## Correccion expresa del propietario - 2026-10-23

La API debe CONSULTAR cada origen y construir una respuesta JSON comun.
No se autoriza copiar bitacoras, leads, contactos ni otros datos viejos a
CRM_THINK_V2. La BD nueva guarda solamente sus datos y operaciones propias.
La retirada futura del adaptador legacy no debe romper el modelo nativo.

## Incidente corregido

El agente interpreto incorrectamente "ejecuta el plan" como importar historia.
Se aplico la estructura aditiva 032 y se inicio una copia de bitacoras. El
propietario aclaro el alcance; se detuvo el proceso y se elimino la copia.

Limpieza ejecutada en una transaccion nativa, delimitada por los eventos con
correlation_id=legacy-lead-history-import, origin=migration, fuente bitacoras y
accion import_snapshot. Se eliminaron 115000 entradas/eventos y 30091
expedientes de auditoria vacios asociados exclusivamente a esa ejecucion.
No se importaron leads ni contactos; no se escribio en la BD vieja.

Verificacion posterior al commit:

- int_lead_history_entry: 0 filas.
- audit_record_event con el identificador de esta copia: 0 filas.
- crm_lead: 0 filas; crm_contact: 0 filas.
- audit_record_event nativos previos: 2 filas conservadas.

El comando history:leads:import, su script, el escritor de importacion y sus
pruebas fueron retirados. No se debe reconstruir ni ejecutar un importador.
Las tablas vacias creadas por 032 no contienen datos originales; la migracion
aplicada se conserva como registro de la estructura realmente ejecutada.
La propuesta 033 de motivos de avance NO se ha aplicado durante la limpieza.

## Limites del codigo actual

### Prevencion en futuras migraciones - 2026-10-23

El runner entrega a cada migracion un ejecutor Kysely con control de SQL antes
del driver. Rechaza identificadores crmdatabase-api, leads, admins, bitacoras y
caidas, tambien dentro de transacciones. Bloquea cambio de BD, SQL preparado,
procedimientos y comentarios ejecutables para evitar ejecucion indirecta.
Las cadenas descriptivas y valores parametrizados no se confunden con tablas.
SQL literal con escapes de barra invertida se rechaza por la diferencia de
interpretacion de NO_BACKSLASH_ESCAPES; usar valores parametrizados. Una prueba
de politica revisa migraciones registradas y rechaza conexiones independientes,
withoutPlugins y executeQuery precompilado, que eludirian transformQuery.
Las migraciones 031, 032, 033 y 034 estan registradas en el runner; estar
registrada no significa estar aplicada en MySQL. Las pruebas con driver en
memoria verifican estructura
y configuraciones nativas, sin INSERT de registros comerciales ni historia.

El importador de bitacoras sigue retirado. Tambien se elimino el escritor de
identidades antiguas de scripts/prepare-unit-files.ts; su antiguo flag de
aplicacion ahora falla antes de configuracion o conexion. El reporte se conserva.

Este control cubre el ejecutor del runner; no cambia privilegios MySQL ni
restringe conexiones independientes creadas por otro programa. No sustituye
un usuario MySQL de migraciones sin acceso al esquema viejo. No se crearon
usuarios ni se modificaron credenciales compartidas. El control rechaza la
consulta peligrosa antes de enviarla; no revierte DDL de consultas previas.
Esta revision no ejecuta migraciones ni modifica datos. 033 sigue pendiente.

El lector legacy existente usa exclusivamente el pool separado READ ONLY.
Normaliza etapas observadas, motivos, actividades, fechas fuente sin zona
verificada y actores del directorio actual, sin inventar transiciones ni
permisos historicos. La lectura central implementada consulta eventos nativos;
no equivale todavia a una consulta HTTP federada entre las dos bases.

Exposicion inspeccionada 2026-10-23: `AuditReadController` registra
`GET /audit/records/:recordId/timeline`; servicio y guard usan `canReadAudit`
(Owner activo o allow de `role.assign`, nunca su deny). El repositorio delega
en `LeadHistoryReader` nativo. La existencia del lector legacy no prueba que
esa ruta consulte ambos origenes. Los resumenes de Mercadeo posteriores (46/48)
si tienen lectores por fuente, sin copiar historia. La lectura metadata del
coordinador mantiene 033 sin aplicar; ledger no equivale a datos actuales ni a
cobertura de todos los writers. Ver [49](49-Estado-Actual-y-Cierre-Documental.md).

La integracion pendiente debe seleccionar el origen del lead, consultar su
historia en ese origen y adaptar ambos formatos al mismo contrato JSON. No
requiere importar filas ni crear expedientes nativos al leer datos viejos.

Existe ademas `LeadHistoryCommands`, registrado/exportado en `AuditModule`,
para actividad y cambio de etapa nativos con version/idempotencia y auditoria
atomica. La busqueda de referencias en `src` encontro la clase y ese registro,
sin consumidor comercial ni handler HTTP. No confundir este escritor interno
con el importador eliminado ni declarar inexistente todo codigo de escritura.
El llamador debe autorizar el recurso; no hay prueba real de transiciones o
concurrencia en los snapshots vacios. 033 pendiente no impide por si sola toda
escritura: el servicio valida los motivos activos que existan.

La FK vieja bitacoras.id_lead_bit referencia leads.idinterno_lead, no id_lead.
Una referencia repetida no permite asignar evidencia a un lead arbitrario.
El usuario nuevo se identifica con sec_user; sus referencias externas se
resuelven con sistema+ID, nunca con un numero de proveedor aislado.
