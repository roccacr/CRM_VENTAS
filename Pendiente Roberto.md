# Pendiente Roberto

Checklist central de avances y pendientes del CRM.

**Responsable del seguimiento:** Roberto.
**Última actualización documental:** 2 de noviembre de 2026, Costa Rica.
**Origen:** pendientes anteriores del proyecto, avances registrados en esta conversación y reunión del 29 de octubre de 2026.

## Cómo mantener este documento

- Agregar aquí cada nuevo pendiente del sistema, dentro de su sección, sin duplicar tareas existentes.
- `[x]` significa implementado dentro del alcance descrito; no certifica por sí solo aceptación operativa completa.
- `[ ]` significa pendiente. Las etiquetas **Validar** y **Definir** distinguen una aceptación faltante de una decisión todavía abierta.
- Marcar una tarea como completada solo con evidencia y registrar la fecha de cierre o la referencia de verificación.
- Conservar las tareas terminadas para poder consultar el avance; no borrar su historia.
- Actualizar la fecha de este documento cuando cambie el checklist.
- Una tarea documentada no autoriza por sí sola escrituras, envíos, migraciones o despliegues.

## 1. Base del sistema, acceso y permisos

- [x] Conectar la BD nueva y la anterior, con una respuesta unificada desde el API.
- [x] Priorizar la orden de la BD nueva; gestionarla en la anterior cuando todavía viva allí.
- [x] Mantener la bitácora central de los cambios realizados desde nuestro API.
- [x] Registrar actor, fecha y valores anteriores/nuevos en las operaciones implementadas.
- [x] Permisos por rol y por empleado, con denegaciones individuales prioritarias.
- [x] Owner con acceso global, respetando denegaciones individuales.
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
- [x] Mostrar únicamente órdenes que cumplen las condiciones de las bandejas autorizadas.
- [x] Precarga de contadores y botón para recargarlos.
- [x] Movimientos recientes de las órdenes.
- [x] Contador anual de formalizaciones cerradas.
- [ ] Permitir seleccionar varias bandejas simultáneamente.
- [ ] Guardar la selección de filtros.
- [ ] Identificar claramente seguimientos paralelos, como adéndum y finiquito.
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
- [ ] **Nuevo:** accesos rápidos de Formalización desde el lead.
- [ ] **Nuevo:** habilitar la vista completa del perfil del lead como acceso operativo.
- [ ] **Nuevo:** enlace directo al expediente de unidad.
- [ ] **Nuevo:** mostrar **Fondos de compra** en el resumen superior.
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
- [ ] **Nuevo:** separar **Gestión bancaria** de **Gestión bancaria en proceso**.
- [ ] Actualizar botones, línea de avance, contadores, filtros y tiempos con esa nueva etapa.

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
- [ ] Confirmar el recorrido de órdenes financiadas y de recursos propios.
- [ ] Confirmar cuándo se puede omitir la etapa bancaria.
- [ ] **Definir con Kenneth:** campo de NetSuite que indica cuotas pendientes en cero.
- [ ] Consultar y validar la condición financiera antes del avance correspondiente.
- [ ] Distinguir consulta financiera realizada de condición financiera aprobada.
- [ ] Definir el tratamiento de saldos a favor.
- [ ] Agregar alertas por proximidad de entrega —incluido el umbral de tres meses— y entrega vencida.
- [ ] Confirmar los tres requisitos de cierre y sus campos de NetSuite.
- [ ] Conectar las validaciones de cobros, entrega de unidad y traspaso.
- [ ] Verificar un cierre completo con sus evidencias y su contador anual.
- [ ] Completar la consulta del recorrido: duración de cada tramo y duración total.
- [ ] Incorporar asignación de responsable por orden o etapa, separada del vendedor y del actor que registra el cambio.

**Regla vigente:** la visibilidad de Formalización continúa siendo sobre las órdenes autorizadas del módulo; la propuesta antigua de cartera individual no debe introducir restricciones nuevas sin confirmación.

## 7. Adéndum

- [ ] Registrar **Necesita adéndum** como seguimiento paralelo, fuera de las etapas principales.
- [ ] Exigir motivo y fecha límite.
- [ ] Definir permisos para solicitar, modificar y registrar el envío.
- [ ] Registrar **Adéndum enviado**, responsable y fecha.
- [ ] Mostrar su condición en la lista y sus filtros.
- [ ] Recuperar el banner y listado de adendas pendientes solicitados anteriormente.
- [ ] Seleccionar varias órdenes para una misma gestión.
- [ ] Crear un evento vinculado a esas órdenes, conservando motivo y vencimiento de cada solicitud.
- [ ] **Definir:** cuándo corresponde, qué ocurre al cancelar y si el seguimiento termina al enviar o requiere firma.

## 8. Venta caída y finiquito

- [ ] Registrar la caída con motivo y etapa en la que ocurrió.
- [ ] Conservar el historial previo.
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
- [ ] **Nuevo:** tipos de Ventas: **Cita, Reunión, Tarea y Seguimiento**.
- [ ] **Nuevo:** tipos de Formalización: **Formalización bancaria, Reunión, Tarea, Seguimiento y Adéndum**.
- [ ] Al seleccionar un lead, filtrar sus órdenes.
- [ ] Al seleccionar una orden, completar automáticamente el lead.
- [ ] Incorporar el enlace directo a la orden desde el evento.
- [ ] Integrar Outlook para invitaciones reales y sincronización.
- [ ] Crear reuniones y enlaces de Teams.
- [ ] Completar las notificaciones de eventos de hoy y su lectura individual.

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

1. Cerrar definiciones de correos, bancos, campos financieros y cierre.
2. Resolver navegación, accesos del lead y revisión de RDR678.
3. Agregar Gestión bancaria en proceso y sus validaciones.
4. Implementar correos, adéndum y finiquitos.
5. Completar calendario y relaciones automáticas.
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
- [Plan y traspaso de sincronización NetSuite, todavía sin escritor durable](apps/api/Arquitectura/70-Plan-Sincronizacion-Ordenes-NetSuite.md#traspaso-para-retomar-2026-11-02). Cierre de chat del 2026-11-02: recepción sin escrituras, autorización Sandbox a órdenes existentes en legacy, prioridad nativa, bitácora atómica pendiente y secuencia de continuación.
- [Publicación Habita: evidencia del29, no del HEAD actual](deploy/habita/DEPLOYMENT-20261029.md).
- [Lectura global de Mercadeo](apps/api/Arquitectura/69-Mercadeo-Lectura-Global.md).

## Nuevos pendientes sin clasificar

### NetSuite → CRM: cambios posteriores al guardado (30/10/2026)

- [x] Crear y probar localmente la entrada global User Event `afterSubmit`, con validación compartida en `lib/` y acción de órdenes en su módulo. El corte inicial solo diagnosticaba; el corte posterior del30 envía al receptor local, sin persistencia CRM.
- [ ] Registrar el nuevo script en NetSuite y verificar sus dependencias en el Archivador.
- [ ] Completar entrega duradera, reintentos y reconciliación; impedir duplicados, eventos atrasados y bucles. El receptor autenticado de recepción local ya está implementado; no confundirlo con el escritor pendiente.
- [ ] Confirmar el ID de «Cuotas pagadas por completo» y el mapeo de condiciones de cobro, traspaso y entrega.
- [ ] Actualizar campos autorizados de la orden en su BD autoritativa y guardar auditoría, sin sobrescribir etapas propias del CRM.
- [ ] Incorporar acciones de leads, estimaciones y corredores con tipos de registro y campos confirmados.
- [ ] Probar una edición real autorizada en Sandbox; habilitar producción solo con su configuración y aceptación correspondientes.

Al recibir otro pendiente, agregarlo en su sección o registrarlo aquí hasta precisar su alcance y criterio de cierre.

### NetSuite → API local por ngrok (30/10/2026)

- [x] Implementar envío de órdenes Sandbox desde afterSubmit, reutilizando lectura de orden y transporte en lib.
- [x] Implementar receptor local autenticado, desactivado por defecto y bloqueado en producción; confirma recepción sin guardar en BD.
- [ ] Configurar API Secret `custsecret_crm_local_events` en Sandbox con la clave exclusiva del `.env` local y subir el paquete actualizado.
- [ ] Validar recepción de una edición real de Sandbox y su log `received_local`. Las pruebas con dobles no acreditan ese recorrido.
- [ ] Implementar entrega duradera/reintentos/idempotencia y actualización auditada de la fuente autoritativa antes de llamarlo sincronización productiva.

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
