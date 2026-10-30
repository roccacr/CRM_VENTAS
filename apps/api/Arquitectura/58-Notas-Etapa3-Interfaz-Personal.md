# 58 - Notas personales: interfaz, etapa 3

## Lectura vigente - 2026-10-29

Este documento conserva la entrega personal de etapa3; colaboracion, respuestas,
campana y sockets ya estan implementados segun [60](60-Notas-Etapa4-Colaboracion-y-Notificaciones.md)
y [62](62-Notas-Tiempo-Real-Implementacion.md). Responsable, vencimiento,
recordatorios, ubicaciones e historial: [66](66-Notas-Enterprise-Seguimiento.md).
El listado abre en Todas y Mostrar Todas, con filtro Pendientes (`open`),
Completadas y Archivadas. Las pruebas y pendientes actuales estan en
[67](67-Plan-QA-Regresiones-20261029.md). La copia legacy sigue pendiente.

Actualización28 de octubre de2026: posición, tamaño, PIN y ocultación se guardan en segundo plano mediante una cola por nota y clase de pantalla. Soltar una hoja no activa el bloqueo del editor ni inmoviliza otras notas. Los gestos nuevos conservan su posición visual y se agrupan para guardar el último usando la versión confirmada anterior. La hoja no se desmonta al recibir cada acuse. Un fallo muestra «Posición sin confirmar» y reintento local; conserva exactamente la operación incierta antes de enviar una posición posterior. No se reintentan escrituras automáticamente ni se almacenan textos en el navegador. La colaboración y tiempo real vigentes se documentan en [62](62-Notas-Tiempo-Real-Implementacion.md).

Fecha del corte original: 2026-10-27. [59](59-Notas-Contexto-Opcional-y-Vistas.md) permite crear desde cualquier pantalla y elegir vincular, incluyendo ordenes legacy. Compartir, respuestas y campana se incorporaron despues; su ausencia descrita en las pruebas originales es historica.

## Uso

- Icono Mis notas inmediatamente junto a Notificaciones, en el encabezado de escritorio y movil. Abre el mismo panel lateral derecho y tema de los demas detalles.
- En Inicio, las notas pertenecen al modulo actual. Al marcar vincular, en el detalle de una orden nativa o legacy de Formalizacion pertenecen a esa orden. Sin marcar son personales. Cambiar de contexto desmonta peticiones y borradores del anterior; no hay fallback silencioso de una orden a Inicio.
- Nueva nota permite titulo opcional, texto plano, color y prioridad. Listado por abiertas/completadas/archivadas/todas, con paginacion. Editar, completar, reabrir y archivar respetan capacidades del API; solo el autor modifica contenido/estado.
- Una nota abierta aparece como hoja sobre su contexto. Arrastrar por el titulo mueve; la esquina inferior cambia tamano. Ambos controles admiten flechas del teclado. PIN usa posicion fija al viewport; sin PIN acompana el documento. Ocultar solo cambia la posicion personal; Mostrar en la vista la recupera desde el panel.
- Posicion, tamano y PIN se guardan al terminar cada gesto, en layout individual y separado por escritorio/tablet/movil. Redimensionar la ventana selecciona el layout correspondiente y mantiene controles visibles sin sobrescribir el layout de otro dispositivo automaticamente.

## Acceso y seguridad

A solicitud del propietario, todo usuario activo tiene una base personal self en sus modulos efectivos existentes, usando solo definiciones activas de notas. Se calcula en IdentityProfileRepository, sin grants masivos ni migracion. Los permisos configurados mas amplios conservan su comportamiento; las denegaciones explicitas prevalecen. No otorga acceso a modulos nuevos ni permite editar notas ajenas. Owner conserva politica existente.

Se reutiliza apiRequest para cookies/CSRF. No se guardan textos o credenciales en localStorage/sessionStorage. No se inserta HTML. Las respuestas se validan antes de mostrarse y no hay datos de ejemplo como fallback. Las solicitudes y borradores se aislan por contexto. Un cambio de modulo no remonta el shell de navegacion ni rompe su foco.

Cada guardado utiliza operationId. Ante fallo de red o5xx no confirmado se bloquea la edicion y Reintentar el mismo guardado conserva solicitud e identificador, evitando duplicados. Un409 pide recargar antes de editar; recargar descarta el borrador de manera explicita. Un401/403/404 oculta los datos que ya no estan disponibles. Version de contenido y version de posicion son independientes.

## Archivos principales

Frontend: GlobalHomeShell.tsx, FormalizationRecordSummary.tsx, modules/notes/PersonalNotes.tsx, NoteSheet.tsx, note-placement.ts y services/notes/notes-service.ts. Backend: identity-profile.repository.ts; esquema y endpoints conservan contrato57.

## Limites y verificacion

Pruebas de cliente: validacion, paginacion, versiones, CSRF delegado y reintentos no automaticos. Pruebas de interfaz: crear en Home, contexto nativo, bloquear legacy, permisos, PIN, teclado/tamano, conflictos/reintento con mismo identificador, texto seguro y descarte de respuestas obsoletas. Pruebas de geometria: posiciones extremas y pantalla estrecha. Pruebas de perfil: base self, modulos efectivos, definiciones activas y deny.

Revision visual con shell/componentes reales y notas temporales en memoria; escrituras bloqueadas. El navegador disponible no tenia sesion autenticada. Esta revision no constituye una creacion end-to-end en la base compartida y no inserta fixtures en CRM_THINK_V2. Sin dependencias nuevas, envio de correos ni activacion de trabajadores.

## Sigue etapa 4

Compartir una nota ya creada, participantes, respuestas y menciones multiples, notificaciones por destinatario y lectura individual en la campanita. Antes de entregar, validar acceso vigente al contexto; mover la nota nunca debe notificar. Etapa5 implementa la copia legacy compatible y etapa6 ensaya el retiro de la base antigua.
## Evidencia de cierre

-Frontend completo:979 pruebas aprobadas en72 archivos. Notas:30 pruebas de cliente/interfaz/geometria; notas mas navegacion movil38. Typecheck y build aprobados. Vite advierte sobre tamano de chunks AntD, sin fallo de build.
-API completo:5824 aprobadas y126 omitidas; lint/typecheck/build aprobados. Base personal de permisos validada sin escrituras SQL.
-Lint del modulo Notas, cliente, pruebas y encabezado aprobado. En el detalle compartido FormalizationRecordSummary.tsx aparecio durante el trabajo concurrente complejidad9 (limite8) en su funcion principal; la insercion de NotesTarget no agrega condiciones. El lint global frontend mantiene ademas dos no-null assertions en test/home/formalization-order-progress.spec.tsx, ajeno a notas. check-all.cmd se detiene en formato de tres archivos API ajenos: migracion038, formalization-home-catalog.spec.ts y formalization-stage-permission.spec.ts. No se declara check-all aprobado.
-Revision independiente: corregidos PIN fuera de pantalla, cambio de dispositivo y reintento pendiente tras cerrar/abrir. Sin P1/P2 pendientes en la revision final.
-No se realizo guardado end-to-end autenticado en la base compartida: navegador sin sesion, pruebas visuales con fixture en memoria y mutaciones bloqueadas. Sin imports, migraciones, commits, despliegue o cambios de entorno en esta etapa.
