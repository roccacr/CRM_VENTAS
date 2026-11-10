# Pendiente Roberto

Checklist central de avances y pendientes del CRM.

**Responsable del seguimiento:** Roberto.
**Última actualización documental:** 10 de noviembre de 2026, Costa Rica.
**Origen:** pendientes anteriores del proyecto, avances registrados en esta conversación y reunión del 29 de octubre de 2026.

## Cómo mantener este documento

- Agregar aquí cada nuevo pendiente del sistema, dentro de su sección, sin duplicar tareas existentes.
- `[x]` significa implementado dentro del alcance descrito; no certifica por sí solo aceptación operativa completa.
- `[ ]` significa pendiente. Las etiquetas **Validar** y **Definir** distinguen una aceptación faltante de una decisión todavía abierta.
- Marcar una tarea como completada solo con evidencia y registrar la fecha de cierre o la referencia de verificación.
- Conservar las tareas terminadas para poder consultar el avance; no borrar su historia.
- Actualizar la fecha de este documento cuando cambie el checklist.
- Una tarea documentada no autoriza por sí sola escrituras, envíos, migraciones o despliegues.

## Validaciones abiertas del corte de noviembre

- [ ] **Validar Catálogos:** repetir en Chrome con registros reales la carga de 500, apertura de detalle, cambio de página y filtros. En Campañas se verificaron 294 registros en local. Apertura del detalle y filtros de páginas grandes aún pueden tener latencia.
- [ ] **Validar Auditoría y Expedientes:** medir Auditoría con un lote mayor de 18 eventos y probar Expedientes con proyectos accesibles. En la sesión local de revisión se mostraron cero proyectos para Expedientes.
- [ ] **Validar NetSuite y Formalización:** confirmar el contrato de entregas y el cierre con datos de prueba aislados, verificar la migración 074 antes de su eventual aplicación y probar el recorrido en el ambiente autorizado. La migración y las modificaciones locales no tienen aplicación registrada en este corte.
- [ ] **Validar promoción por artefacto:** comprobar el flujo local contra el ambiente QA, los controles de promoción y el rollback antes de considerarlo operativo. El último release registrado se publicó con el procedimiento manual.
- [ ] **Validar QA del siguiente release:** registrar resultado por commit de CI, persistencia MySQL y recorridos autenticados. Consultar el [estado del proyecto](README.md#estado-documental-vigente--2026-11-10).

## 1. Base del sistema, acceso y permisos

- [x] Conectar la BD nueva y la anterior, con una respuesta unificada desde el API.
- [x] Priorizar la orden de la BD nueva; gestionarla en la anterior cuando todavía viva allí.
- [x] Mantener la bitácora central de los cambios realizados desde nuestro API.
- [x] Registrar actor, fecha y valores anteriores/nuevos en las operaciones implementadas.
- [x] Permisos por rol y por empleado, con denegaciones individuales prioritarias.
- [x] Owner con permisos efectivos, respetando denies y capacidades que requieren grant explícito;067 concede marcar Adéndum a Owner/General/Jefe Formalización.
- [x] Jefe General con acceso a los módulos seleccionados.
- [x] Inicio de sesión con Microsoft.
- [x] Publicar API y frontend con HTTPS.
- [x] Corregir la consulta global de Mercadeo para Kenneth y Claudio.
- [x] Habilitar a Claudio el permiso para consultar la orden completa.
- [ ] **Validar:** recorrido completo de ambos usuarios desde sus propias sesiones.
- [ ] Configurar el proveedor de correo para las funciones que necesitan envíos reales.
- [ ] Completar la recuperación de contraseña cuando se defina ese proveedor.

## 2. Formalización: inicio y seguimiento

- [x] Banner de pendientes de aprobación conectado a las BD.
- [x] Banner de contratos: **Por enviar / Pendientes de firma**.
- [x] Contadores conectados para banco, saldo, traspasos y cierres.
- [x] Permisos independientes para consultar banners y órdenes.
- [x] Listado de seguimiento con datos de orden, cliente, proyecto, unidad y vendedor.
- [x] Búsqueda y filtros por proyecto y bandeja.
- [x] Aplicar las condiciones de cada bandeja autorizada; «Todas» puede conservar órdenes con flags incompatibles para revisión, sin inventar un avance.
- [x] Precarga de contadores y botón para recargarlos.
- [x] Movimientos recientes de las órdenes.
- [x] Contador anual de formalizaciones cerradas.
- [ ] Permitir seleccionar varias bandejas simultáneamente.
- [ ] Guardar la selección de filtros.
- [x] Identificar Adéndum como marca paralela, con banner, distintivo y bandeja bajo permisos independientes.
- [ ] Definir e implementar el seguimiento paralelo de finiquito.
- [ ] Completar la priorización por antigüedad y comprobar su ordenación entre páginas.
- [ ] Incorporar el banner de eventos del día solicitado anteriormente.

## 3. Detalle de la orden y navegación

- [x] Abrir la orden completa desde el panel lateral.
- [x] Mantener la orden seleccionada al refrescar la página.
- [x] Validar sesión y permiso antes de consultar el detalle.
- [x] Línea de avance conectada a la etapa actual.
- [x] Datos principales conectados a la BD.
- [x] Consulta de información de la orden en NetSuite.
- [x] Secciones de información primaria, ventas y autorización.
- [x] Secciones de artículos, reserva, detalle de pago y resumen económico.
- [x] Tabla de líneas de artículos.
- [x] Panel del cliente desde la orden.
- [x] Panel del expediente de unidad desde la orden.
- [x] Bitácora de la orden en formato de historial.
- [x] Acceso del perfil a órdenes relacionadas y agenda contextual disponible bajo sus permisos.
- [ ] Definir otros accesos comerciales desde el lead fuera de esos recorridos.
- [x] Perfil federado operativo bajo `lead.profile.read`, en `/home/formalization/perfil`; no concede CRUD general de Leads. Ver77.
- [x] Enlaces al expediente y planos seguros en presentación compartida; sin reescribir URL original. Verfrontend31.
- [x] Tarjeta independiente de Origen de fondos de compra en ficha y drawer, después de Adéndum; edición sin cambiar etapa.
- [ ] **Validar:** ubicación solicitada en el resumen superior y aceptación del guardado independiente, distinto de la tarjeta ya implementada.
- [ ] **Nuevo:** distinguir mejor navegación entre registros y cambio de etapa.
- [ ] **Nuevo:** revisar y revertir **RDR678**, confirmando el estado de destino y dejando auditoría.

## 4. Aprobaciones y cambios de etapa

- [x] Permiso específico para aprobar Formalización.
- [x] Botón de aprobación condicionado al permiso.
- [x] Integración de aprobación con NetSuite.
- [x] Sincronización local cuando NetSuite confirma la aprobación o ya estaba marcada.
- [x] Mensajes para errores y resultados de aprobación.
- [x] Botones para avanzar en las etapas actualmente implementadas.
- [x] Permiso separado para movimientos excepcionales.
- [x] Motivo obligatorio en los cambios excepcionales correspondientes.
- [x] Guardar el cambio en la fuente autoritativa y conservar auditoría.
- [x] Actualizar el estado sin volver a consultar toda la información de NetSuite.
- [x] Exigir contrato firmado para Gestión bancaria y etapas posteriores.
- [ ] **Validar:** integración de aprobación contra el entorno productivo de NetSuite; las pruebas realizadas han usado Sandbox.
- [ ] Implementar la devolución/rechazo de aprobación cuando se confirme su regla y efecto en NetSuite.
- [ ] Completar la acción para registrar la firma del contrato y su actualización en NetSuite.
- [x] Separar Gestión bancaria de Gestión bancaria en proceso; ocho etapas. Ver78.
- [x] Actualizar botones, avance, contadores, filtros y tiempos con la etapa bancaria en proceso.

## 5. Correos y plantillas

- [x] Apertura de Outlook con el correo del cliente en el flujo preparado.
- [ ] **Definir:** si el CRM enviará correos mediante botón, automáticamente al cambiar de etapa, o ambas opciones.
- [ ] **Nuevo:** plantilla para **Pendiente de firma**.
- [ ] Confirmar destinatarios, copias, asunto y contenido de cada plantilla.
- [ ] Resolver el correo asociado al inicio de Gestión bancaria, mencionado en la reunión anterior.
- [ ] Implementar los envíos reales y registrar su resultado.
- [ ] Mostrar confirmación o error visible.
- [ ] Controlar reintentos para evitar correos duplicados.
- [ ] Confirmar y conectar la plantilla de venta caída.
- [ ] Más adelante: avisar sobre cancelaciones de firmas de crédito, con destinatarios y canal definidos.

## 6. Bancos, saldo y cierre

- [ ] Crear el catálogo de bancos con permisos.
- [ ] Registrar banco, asesor, correo y teléfono.
- [ ] Permitir agregar un asesor cuando todavía no exista.
- [ ] Relacionar el banco con la orden.
- [ ] **Definir con Claudio:** opciones y datos obligatorios.
- [x] Origen de fondos obligatorio: propios → Pendiente de saldo; bancario → Gestión bancaria en proceso, auditado en ambas fuentes.
- [x] Omitir etapa bancaria al salir de contratos con Fondos propios; sin valor por defecto.
- [x] Campo confirmado `custbody_cuotas_pagadas`: cuotas completamente pagadas, distinto de otros importes/flags financieros.
- [x] Traspaso pendiente exige cuotas Sí, unidad traspasada No y entregada No; llaves no restringe ese destino.
- [x] Traspaso firmado exige cuotas Sí, traspasada Sí, llaves No y entregada No; NULL no equivale a No.
- [x] Desmarcar cuotas conserva la etapa alcanzada y bloquea avances inválidos; no retorna a saldo.
- [ ] Distinguir consulta financiera realizada de condición financiera aprobada.
- [ ] Definir el tratamiento de saldos a favor.
- [ ] Agregar alertas por proximidad de entrega —incluido el umbral de tres meses— y entrega vencida.
- [x] Cierre prioriza unidad entregada Sí en la política final; contrato/aprobación conservan sus validaciones generales. Ver52/78.
- [x] Aplicar la política central de cuotas, entrega, traspaso y llaves a movimientos/listas/resúmenes/eventos NetSuite. No equivale a escribir esos checks desde CRM.
- [ ] Verificar un cierre completo con sus evidencias y su contador anual.
- [ ] Completar la consulta del recorrido: duración de cada tramo y duración total.
- [ ] Incorporar asignación de responsable por orden o etapa, separada del vendedor y del actor que registra el cambio.

**Regla vigente:** la visibilidad de Formalización continúa siendo sobre las órdenes autorizadas del módulo; la propuesta antigua de cartera individual no debe introducir restricciones nuevas sin confirmación.

## 7. Adéndum

- [x] Una marca por orden en ambas BD: pendiente, completada o cancelada; seguimiento independiente de la etapa y del lead.
- [x] Marcar manualmente sin evento, con nota opcional de hasta2000 caracteres; vacío se conserva NULL.
- [x] Botón debajo de Ver orden completa y junto a Agendar evento en ficha; gestión debajo de Acciones de la etapa.
- [x] Registrar actor, fecha, versión, nota y diff en auditoría de BD nueva, incluso cuando la orden vive en legacy.
- [x] Banner junto a pendientes de aprobación, bandeja y distintivo con permisos independientes; ocultar marca/bandeja no oculta la orden.
- [x] Marca manual por defecto para Owner, Jefe General y Jefe de Formalizaciones mediante067; permitir concesión individual, prevaleciendo deny.
- [x] Evento Adéndum exige exactamente una orden y su lead; relaciones quedan fijas tras guardarlo, incluso al editar tipo.
- [x] Bloquear un segundo Adéndum futuro activo de la misma orden y mostrar fecha del existente según autorización; comprobación atómica en servidor.
- [x] Completar/cancelar desde la orden; no modifica automáticamente el evento de calendario. Reintentos usan versión e idempotencia.
- [ ] **Validar:** aceptación de marca/evento/gestión con cuentas reales de cada rol y registros de ambas fuentes; tests SQL locales no equivalen a esa aceptación.

El motivo obligatorio, vencimiento propio, envío/firma y selección de varias órdenes de la propuesta anterior no forman parte del contrato autorizado de una sola marca por orden. No son requisitos vigentes para marcar pendiente. Contratos83/84.

## 8. Venta caída y finiquito

- [x] Sincronizar Venta caída a nivel de orden y asignar fecha al marcar según regla confirmada; sin modificar lead. Ver74/76.
- [ ] Definir captura adicional de motivo y etapa de caída; no inferirla del checkbox.
- [x] Conservar historial de orden y auditoría al sincronizar Venta caída.
- [ ] Registrar si corresponde devolución y su monto, sin confundirlo con ejecutar un pago.
- [ ] **Nuevo:** detectar **venta caída + contrato firmado**.
- [ ] Crear el seguimiento paralelo de finiquito.
- [ ] Crear su banner y acciones.
- [ ] **Definir:** estados y contadores entre **Por enviar / Enviado / Firmado**.
- [ ] Definir permisos, plantilla, evidencia y posible reactivación de la orden.

## 9. Calendario

- [x] Calendario compartido entre módulos.
- [x] Selección inicial según el módulo activo.
- [x] Superposición de calendarios autorizados.
- [x] Identificar el módulo de origen del evento.
- [x] Catálogo global de tipos, colores y módulos.
- [x] Formulario con tipo obligatorio, nombre, fechas, ubicación y descripción.
- [x] Selección de varios participantes internos y correos externos.
- [x] Preferencia de reunión Teams registrada en el CRM.
- [x] Vincular notas pendientes, leads y órdenes de ambas fuentes.
- [ ] **Validar:** creación y edición reales de un evento completo, con participantes y vínculos persistidos.
- [x] Tipos de Ventas registrados: Cita, Reunión, Tarea y Seguimiento;061.
- [x] Tipos de Formalización registrados: Formalización bancaria, Reunión, Tarea, Seguimiento y Adéndum;061.
- [x] En Adéndum y flujo contextual, seleccionar lead filtra sus órdenes, sin cruzar identidades ni ampliar alcance.
- [x] En Adéndum/contexto de orden, completar su lead canónico y conservar relaciones bloqueadas cuando corresponde.
- [ ] Incorporar el enlace directo a la orden desde el evento.
- [x] Implementar integración Graph de calendario: feed, disponibilidad, salas, propuestas y publicación/edición con recibos/versiones.
- [ ] **Validar:** invitaciones y edición reales en Microsoft con la conexión, consentimientos y aceptación correspondientes.
- [x] Implementar solicitud de reunión Teams en publicación Graph.
- [ ] **Validar:** creación externa y recepción real del enlace Teams; no acreditada por guardar preferencia CRM.
- [x] Backend de avisos de calendario: persistencia transaccional, consulta y lectura individual con autorización del destinatario.
- [x] Consumidor de avisos conectado a la campana mediante CalendarNotifications y NoteNotifications en el corte16:02.
- [ ] Validar avisos con cuentas reales, pruebas dedicadas y banner de eventos de hoy; wiring no equivale a aceptación.

## 10. Notas, colaboración y tickets

- [x] Base de notas personales y colaborativas.
- [x] Vínculos de notas con registros.
- [x] Seleccionar Cliente/lead y Orden mediante Select con búsqueda, sin escoger BD; mostrar resúmenes autorizados en tarjetas, hoja y conversación. Contrato68.
- [x] Responsables, vencimientos, recordatorios e historial implementados.
- [x] Notificaciones internas y transporte en tiempo real implementados.
- [ ] **Validar:** recorrido colaborativo con dos usuarios reales.
- [ ] **Validar:** funcionamiento distribuido con Redis y dos instancias.
- [ ] Resolver la proyección compatible de notas hacia el sistema anterior; el requisito documentado no está implementado por el receptor de eventos NetSuite.
- [ ] **Validar:** casos SQL y recorrido real de selección/guardado de vínculos que no se certificaron por el timeout documentado el29; no se volvieron a ejecutar contra BD en esta revisión.
- [ ] Definir y desarrollar el flujo de tickets desde el cliente.
- [ ] Asignar solicitudes a personas o áreas y mantener respuestas visibles.
- [ ] Definir estados, responsables, cierre y plazos de los tickets.
- [ ] Habilitar avisos por correo a participantes sin acceso al CRM.

**Las notas colaborativas existentes no equivalen todavía al flujo completo de tickets.**

## 11. Ventas, Mercadeo y Kapso

- [x] Inicio y Captación de Mercadeo conectados a datos reales.
- [x] Consulta global habilitada para Kenneth y Claudio.
- [ ] Registrar y presentar contactos previos a una cita.
- [ ] Considerar el historial del CRM anterior.
- [ ] Aplicar **No calificado** por defecto.
- [ ] Registrar el criterio y la nota de calificación.
- [ ] Impedir retirar una calificación una vez confirmada.
- [ ] **Definir:** relación entre Perdido, No calificado y Calificado.
- [ ] Agregar el gráfico de pérdidas por motivo.
- [ ] Definir y aplicar **Más probable** como valor inicial de oportunidades.
- [ ] Revisar configuración y habilitación de Kapso para todos los proyectos.

## 12. Documentos y aceptación final

- [ ] Integrar OneDrive: ubicación, permisos, carga y consulta de documentos.
- [ ] Probar el flujo completo: aprobación → contrato → banco → saldo → traspaso → cierre.
- [ ] Probar permisos positivos, denegaciones y revocaciones con cuentas reales.
- [ ] Verificar órdenes que viven en cada una de las dos BD.
- [ ] Validar mensajes, auditoría y recuperación ante fallos.
- [ ] Actualizar la documentación al cerrar cada entrega.

## Orden de ejecución recomendado

1. Validar aceptación real del flujo implementado y sus permisos, sin reutilizar tests históricos como nueva evidencia.
2. Cerrar correos, bancos, finiquitos y aceptación de RDR678 cuando exista autorización operativa.
3. Completar aceptación NetSuite/Graph/Teams y tratamiento de fallos externos.
4. Mantener matriz de campos y estados, Adéndum y documentación al cambiar sus contratos.
5. Completar pendientes de calendario/notificaciones y relaciones fuera del alcance implementado.
6. Continuar con Ventas, Mercadeo, tickets y OneDrive.
7. Ejecutar la aceptación integral.

## Funciones retiradas por solicitud de Roberto

Se mantienen retirados el menú Resumen, la sección «Pendientes por proyecto» y la tabla independiente «Tiempos de gestión bancaria». No se consideran tareas pendientes de reconstrucción. Calcular duraciones desde el historial no implica volver a agregar esa tabla a Inicio.

## Registro de actualizaciones

| Fecha      | Actualización                                                                                                                                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 29/10/2026 | Creación del checklist central con los pendientes anteriores, avances registrados y nuevas tareas de la reunión. Los estados reflejan el corte documentado; esta creación no ejecutó pruebas, cambios de negocio ni despliegues. |

## Referencias para verificar y cerrar tareas

- [Roles y recuperación de Formalización](apps/api/Arquitectura/65-Formalizacion-Correcciones-Roles-y-Recuperacion.md).
- [Reunión anterior y aclaraciones posteriores](apps/frontend/Arquitectura/29-Formalizacion-Reunion-Ajustes.md).
- [Participantes y vínculos del calendario](apps/api/Arquitectura/68-Calendario-Participantes-y-Vinculos.md).
- [Notas colaborativas y seguimiento](apps/api/Arquitectura/66-Notas-Enterprise-Seguimiento.md).
- [QA y límites de aceptación](apps/api/Arquitectura/67-Plan-QA-Regresiones-20261029.md).
- [Reconciliación completa por commits y comprobaciones nuevas](apps/api/Arquitectura/72-Reconciliacion-Documental-20261102.md).
- [Antecedente y traspaso de sincronización NetSuite](apps/api/Arquitectura/70-Plan-Sincronizacion-Ordenes-NetSuite.md#traspaso-para-retomar-2026-11-02). Corte histórico02/11; escritor v2 y matriz actuales en73/74/75, que sustituyen ese estado.
- [Publicación Habita: evidencia del29, no del HEAD actual](deploy/habita/DEPLOYMENT-20261029.md).
- [Lectura global de Mercadeo](apps/api/Arquitectura/69-Mercadeo-Lectura-Global.md).

## Nuevos pendientes sin clasificar

### NetSuite → CRM: cambios posteriores al guardado (30/10/2026)

- [x] Crear y probar localmente la entrada global User Event `afterSubmit`, con validación compartida en `lib/` y acción de órdenes en su módulo. El corte inicial solo diagnosticaba; el corte posterior del30 envía al receptor local, sin persistencia CRM.
- [x] El usuario informó que actualizó los archivos SuiteScript en NetSuite.
- [ ] **Validar:** versiones/deployment activos y dependencias en NetSuite; la confirmación del usuario no equivale a una nueva inspección del proveedor en esta revisión.
- [x] Escritor v2, recibos/idempotencia y control de orden de eventos implementados. Cola/reintento durable del emisor y reconciliación externa siguen limitaciones explícitas de73/74.
- [x] IDs y matriz confirmados de cuotas/traspaso/entrega en75; los campos sin origen confirmado se excluyen.
- [x] Actualizar la matriz autorizada en la BD autoritativa con auditoría nativa; avance automático de etapas solo bajo política explícita, sin crear órdenes no encontradas.
- [ ] Incorporar acciones de leads, estimaciones y corredores con tipos de registro y campos confirmados.
- [ ] Probar una edición real autorizada en Sandbox; habilitar producción solo con su configuración y aceptación correspondientes.

Al recibir otro pendiente, agregarlo en su sección o registrarlo aquí hasta precisar su alcance y criterio de cierre.

### NetSuite → API local por ngrok (30/10/2026)

- [x] Implementar envío de órdenes Sandbox desde afterSubmit, reutilizando lectura de orden y transporte en lib.
- [x] Receptor local autenticado, desactivado por defecto y bloqueado en producción; v1 solo recepción, v2 persistencia gated.
- [ ] Resolver la configuración segura de API Secret `custsecret_crm_local_events` frente a la excepción temporal documentada; la subida de archivos fue informada por el usuario, no se repite aquí.
- [ ] Validar recepción de una edición real de Sandbox y su log `received_local`. Las pruebas con dobles no acreditan ese recorrido.
- [x] Implementar idempotencia y actualización auditada durable v2.
- [ ] Completar aceptación de entrega/reintentos/reconciliación desde NetSuite antes de certificar sincronización productiva.

### Revisión documental y calidad (02/11/2026)

- [x] Inventariar los35 commits de este checkout, los módulos, rutas, documentos, migraciones y herramientas. Ver informe72 para cobertura y límites.
- [x] Incorporar la recepción local NetSuite, logging, vínculos de notas, calendario y la publicación fechada en los documentos de entrada.
- [x] Documentar las siete banderas057 de órdenes con semántica independiente de etapas; cambio local e implementación histórica de DDL diferenciados.
- [ ] Corregir formato de `SS2_1_LIB_CRM_EjecutarAccion.js`, que detiene el check raíz del02/11.
- [ ] Revisar la expectativa de migraciones en `identity-schema-migration.spec.ts`: el registro local incluye057, la expectativa termina en056.
- [ ] Corregir el orden de imports de `CalendarEventDrawer.tsx`, `CalendarGuestFields.tsx` y `PersonalNotes.tsx`, y la complejidad de `NotesInbox`, detectados por lint del02/11.
- [ ] Investigar el fallo de movimiento rápido en `personal-notes.spec.tsx:161` del02/11: se esperaba70px y se observó60px. La suite dio1270 aprobadas/1 fallida; el QA aprobado del29 no cierra esa incidencia nueva.
- [ ] Sustituir la credencial temporal directa del emisor Sandbox por API Secrets con el responsable, sin divulgar el valor ni invalidar credenciales compartidas por esta revisión.
- [ ] Repetir checks completos después de las correcciones técnicas; no sustituir sus fallos por cifras aprobadas de octubre.

## Reconciliación del 03/11/2026

- [x] Reconciliar documentación y checklist contra los cambios de la rama y archivos nuevos; cobertura detallada en [85](apps/api/Arquitectura/85-Reconciliacion-Documental-20261103.md).
- [x] Registrar navegación contextual, contacto, Outlook y WhatsApp con permisos específicos, sin enviar mensajes automáticamente.
- [x] Diferenciar la capacidad implementada de las migraciones aplicadas anteriormente y la aceptación real pendiente.

Los fallos de calidad registrados el02/11 conservan su fecha: no se cierran ni se declaran todavía reproducibles por esta revisión documental. Antes de corregirlos o certificar el árbol actual, ejecutar el check correspondiente sobre el estado vigente. La copia legacy de notas, correo automatizado, bancos, finiquitos, tickets, OneDrive, Redis multinodo y aceptación externa no se completan por reconciliar documentación.

- [ ] **Brecha al corte03/11 16:02 UTC:** parser `calendar-service.ts:231` exige `canEdit=false` para Outlook, mientras el API/editor ya admiten edición propia. Validar y reconciliar ese contrato en su tarea de implementación; sin corrección de código en esta revisión.
