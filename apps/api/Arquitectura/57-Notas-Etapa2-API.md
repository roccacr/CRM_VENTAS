# 57 - Notas: API nativa, etapa 2

## Extensiones vigentes - 2026-10-29

Este documento conserva el contrato base de notas; la colaboración, acceso entre
módulos y transporte actuales están en [60](60-Notas-Etapa4-Colaboracion-y-Notificaciones.md)
y [62](62-Notas-Tiempo-Real-Implementacion.md), no en las restricciones iniciales de
etapa2. [66](66-Notas-Enterprise-Seguimiento.md) añade API de tarea/recordatorio,
ubicaciones Home e historial. No se cambió la autoría inmutable ni se concedió
edición ajena. Los comandos conservan versiones independientes y `operationId`.
Un resultado de red incierto no autoriza otra operación con ID nuevo; recuperar
el mismo recibo exige acceso vigente. Solo los deadlocks MySQL1213 permiten
reintentar la transacción completa, hasta tres intentos, porque garantizan rollback.

Una invitación permite consultar/responder la nota según capacidad; no concede
permiso sobre la orden. Su identidad mantiene `source` y `id`, sin usar ID ERP.
Las ubicaciones adicionales no cambian el vínculo principal. Copia legacy e
imports siguen desactivados. Evidencia fechada y límites de QA: [67](67-Plan-QA-Regresiones-20261029.md).

Fecha: 2026-10-27. Alcance: API protegida; interfaz, campanita y copia legacy permanecen pendientes.

## Contrato y seguridad

Las rutas `/notes` usan sesion BFF por cookie, permisos efectivos por modulo y CSRF canonico `X-CRM-CSRF-Token` en escrituras. Respuestas sin cache. El autor se obtiene de la sesion; no se acepta un autor enviado por el cliente. Cada nota conserva su modulo de origen inmutable.

Permisos: `<modulo>.notes.read`, `.create`, `.edit_own`, `.resolve_own`, `.archive_own`, para ventas, mercadeo, formalizacion, contabilidad y administration. Se crean definiciones, sin asignarlas automaticamente a roles comerciales. Owner conserva la herencia existente de permisos activos, pero no puede editar notas ajenas. Denegacion explicita prevalece. Lectura con alcance self solo devuelve notas propias; otros alcances siguen exigiendo autoria o participacion activa y acceso al contexto.

Contextos implementados: Home del modulo y orden nativa de Formalizacion autorizada mediante OrderTimingService. No se admiten contextos legacy, leads ni otros registros en esta etapa. Un enlace invalido, multiple o un registro inactivo/cancelado/eliminado se rechaza. Compartir una nota no concede acceso al registro.

| Metodo | Ruta | Uso |
| --- | --- | --- |
| GET | /notes?moduleCode=mercadeo | Lista propia/autorizada, paginada por contexto |
| GET | /notes/:id?moduleCode=mercadeo | Contenido y posiciones personales |
| GET | /notes/:id/history?moduleCode=mercadeo | Historial de metadatos; no restaura texto anterior |
| POST | /notes | Crear nota privada propia |
| PATCH | /notes/:id | Reemplazar titulo, texto, color y prioridad de nota abierta propia |
| POST | /notes/:id/complete | Completar propia |
| POST | /notes/:id/reopen | Reabrir propia completada |
| POST | /notes/:id/archive | Archivar propia sin borrado fisico |
| PUT | /notes/:id/my-placement | Guardar posicion individual con control de version propio |

Ejemplo POST (el operationId debe ser unico por usuario; reutilizarlo solo para reintentar la misma solicitud):

```json
{
  "moduleCode": "mercadeo",
  "operationId": "notes_operation_0001",
  "title": "Revisar seguimiento",
  "text": "Contenido de la nota",
  "color": "#FFFF88",
  "priority": "normal",
  "context": { "kind": "view" }
}
```

Respuesta de comando: `{ "noteId": "ULID", "version": 1, "replayed": false }`. Para editar o cambiar estado se requiere `expectedVersion`; la posicion usa `expectedLayoutVersion` (0 al crear), `viewportClass`, `anchorMode`, x/y, width/height, collapsed y hidden. Consultar esquemas estrictos y OpenAPI de NotesController: campos desconocidos se rechazan. Listado: page/pageSize, status, contextType y recordId para una orden.

El texto se almacena como texto plano, no HTML arbitrario. Operaciones repetidas con igual clave y contenido devuelven el recibo; igual clave con otra solicitud o version desactualizada devuelve 409. El layout no modifica version/fecha del contenido ni genera entregas. PIN se representa mediante anchorMode=viewport; la interfaz que lo representa pertenece a etapa3.

## Persistencia y efectos

Migracion040 agrega origin_module_code_note, int_note_command y el outbox general int_event_outbox. Todos los campos nuevos tienen COMMENT; se preservan las FK/CHECK de039. Solo acepta crm_note vacia y039 registrada; no importa ni transforma datos legacy.

Nota, auditoria, recibo y eventos de outbox se confirman en la misma transaccion. El bloqueo del actor serializa sus claves de operacion y el del registro protege versiones. Se escriben fechas UTC explicitas. La auditoria global guarda acciones, metadatos y huellas de texto/titulo, nunca cuerpos privados. Si la auditoria esta deshabilitada o falla, la mutacion no se confirma.

Cada cambio de contenido/estado deja eventos pendientes para notification y legacy_projection. No hay despachador, correo, campanita ni escritor legacy instalado en este modulo. Los eventos contienen identificadores/versiones, no el texto privado. Etapas4/5 deben autorizar destinatarios y contexto nuevamente antes de entregar. Los reintentos no duplican eventos.

## Verificacion y limites

Pruebas de contrato, servicio, repositorio y HTTP cubren sesion/CSRF, denegacion, autoria, contexto, versiones, claves repetidas, independencia del layout y rollback. La suite MySQL optativa exige una base vacia aislada crm_notes_test_* y confirmacion exacta; nunca usa CRM_THINK_V2 ni la base antigua para fixtures. Prueba SQL/transacciones reales con un doble de auditoria dentro de la transaccion: no equivale a una prueba integral del escritor central RecordAuditService ni de entregas futuras.

## Siguiente entrega

Etapa3: interfaz personal en Home y un detalle real de Formalizacion, crear/editar/completar/archivar, mover/redimensionar/PIN, estados de carga/error y conflictos409. Etapa4: compartir/responder/mencionar y campanita con lectura individual. Etapa5: copia compatible legacy. Etapa6: aceptacion integral y retiro ensayado del origen antiguo.

## Evidencia de cierre del27

-040 aplicada por runner y segundo intento omitido por ledger;25 permisos definidos.
-CRM_THINK_V2:0 notas,0 recibos,0 eventos outbox al finalizar;21 columnas de tablas nuevas y modulo de nota comentados. Sin imports.
-API: lint, typecheck y build aprobados;5820 pruebas aprobadas,126 omitidas. Formato de archivos tocados aprobado.
-MySQL aislado:7 pruebas aprobadas; la primera corrida excedio el limite local de5 segundos en dos casos y se repitio completa con30 segundos, pasando. Base temporal eliminada tras la verificacion.
-Revision independiente sin hallazgos bloqueantes. Auditoria configurada activa, sin cambiar env. Escritor central revisado e integrado, sin ensayo end-to-end de escritura real en la base compartida. No se prueba campanita/copia porque aun no existen en esta etapa.

## Ampliacion posterior, etapa3

[58](58-Notas-Etapa3-Interfaz-Personal.md) implementa el editor personal y layout. A solicitud del propietario, el perfil efectivo agrega base self con definiciones activas de notas en modulos ya habilitados; no persiste grants masivos y deny prevalece. Los parrafos anteriores conservan el corte historico de etapa2.

## Correccion posterior de contextos

[59](59-Notas-Contexto-Opcional-y-Vistas.md): crear personal sin vinculo desde cualquier pantalla, vista registrada opcional y ordenes native/legacy. Nuevo contextType=personal, viewCode y recordSource. Conserva hashes de Home; revalida su permiso de lectura. Migracion041 solo registro del sistema referenciado, no copia datos. Las limitaciones native-only de este corte historico quedan ampliadas por59.
