# API CRM legacy — catálogo de endpoints

> **Última modificación:** 2026-07-09 (jueves)
>
> **Método observado:** `POST` para todas las rutas del catálogo, salvo `GET /` y `POST /api/v2.0/webhooks/microsoft/calendar`.
>
> **Fuente:** `CRM_VENTAS BACKEND/src/routes/idpRoutes.js`. Los nombres de método corresponden a los modelos registrados en `routesConfig`.

## Convenciones

- URL base local: `http://localhost:7000/api/v2.0`.
- URL base de producción referenciada por el frontend: `https://api-node-v2.roccacr.com/api/v2.0`.
- Body común: `token_access`, `database`, `sqlQuery`, `type`; cada módulo agrega sus propios campos.
- `Auth` significa que se ejecuta `validateAccessToken`.
- `Externa` significa que la ruta usa `allowNoAuth` en el código actual; debe protegerse con una credencial de integración controlada.
- En éxito, el wrapper responde HTTP 200; el shape interno depende del modelo o Stored Procedure.

## Salud y autenticación

| Método | Ruta | Protección | Handler | Descripción |
|---|---|---|---|---|
| GET | `/` | Pública | — | Verifica que la API está activa. |
| POST | `/login` | Auth | `authenticated.startSession` | Inicia sesión y genera JWT. |
| POST | `/admins/validarUsuario` | Auth | `SP_VALIDAR_EMAIL` | Valida si el correo existe. |
| POST | `/admins/recuperar_Contrasena` | Auth | `SP_RECUPERAR_CONTRASENA` | Inicia recuperación de contraseña. |
| POST | `/usuario/microsoft` | Auth | `usuarioMicrosoft` | Resuelve usuario autenticado por Microsoft. |
| POST | `/usuario/verificaionDeUsuario` | Auth | `verificaionDeUsuario` | Verifica datos de usuario. |
| POST | `/usuario/validarToken` | Auth | `validateTokenUser` | Valida JWT, expiración y token persistido. |
| POST | `/usuario/logout` | Auth | `logoutUser` | Invalida la sesión actual. |

## Home, KPIs y notificaciones

| Método | Ruta | Protección | Handler | Descripción |
|---|---|---|---|---|
| POST | `/home/getAllBanners` | Auth | `getAllBanners` | Banners visibles por rol y administrador. |
| POST | `/home/getAllEventsHome` | Auth | `getAllEventsHome` | Eventos mostrados en inicio. |
| POST | `/home/getNotifications` | Auth | `getNotifications` | Pre-reservas y órdenes próximas/vencidas. |
| POST | `/home/updateEventStatus` | Auth | `updateEventStatus` | Actualiza el estado inicial de un evento. |
| POST | `/home/getMonthlyDatakpi` | Auth | `fetchGetMonthlyDataKpi` | Datos mensuales para KPI. |
| POST | `/home/getMonthlyData` | Auth | `getMonthlyData` | Agregados mensuales generales. |
| POST | `/home/getMonthlyData_venta` | Auth | `getMonthlyData_venta` | Agregados mensuales de venta/reserva. |
| POST | `/home/fetchupdateEventDate` | Auth | `fetchupdateEventDate` | Cambia la fecha de un evento. |

## Leads y seguimiento

| Método | Ruta | Protección | Handler | Descripción |
|---|---|---|---|---|
| POST | `/leads/getAll_LeadsNew` | Auth | `getAll_LeadsNew` | Leads nuevos. |
| POST | `/leads/getAll_LeadsAttention` | Auth | `getAll_LeadsAttention` | Leads que requieren atención. |
| POST | `/leads/getBitacora` | Auth | `getBitacora` | Historial/bitácora de un lead. |
| POST | `/leads/getAll_LeadsComplete` | Auth | `getAll_LeadsComplete` | Leads completos filtrados. |
| POST | `/leads/getAll_LeadsRepit` | Auth | `getAll_LeadsRepit` | Leads con correos duplicados. |
| POST | `/leads/get_Specific_Lead` | Auth | `get_Specific_Lead` | Detalle de un lead. |
| POST | `/leads/insertBitcoraLead` | Auth | `insertBitcoraLead` | Inserta una entrada de bitácora. |
| POST | `/leads/updateLeadActionApi` | Auth | `updateLeadActionApi` | Actualiza acción, estado y seguimiento. |
| POST | `/leads/getAllStragglers` | Auth | `getAllStragglers` | Leads rezagados/inactivos. |
| POST | `/leads/loss_reasons` | Auth | `loss_reasons` | Motivos de pérdida. |
| POST | `/leads/setLostStatusForLeadTransactions` | Auth | `loss_transactions` | Marca transacciones del lead como perdidas. |
| POST | `/leads/getAllLeadsTotal` | Auth | `getAllLeadsTotal` | Resumen total de leads. |
| POST | `/leads/getDataSelect_Campaing` | Auth | `getDataSelect_Campaing` | Catálogo de campañas. |
| POST | `/leads/getDataSelect_Proyect` | Auth | `getDataSelect_Proyect` | Catálogo de proyectos. |
| POST | `/leads/getDataSelect_Subsidiaria` | Auth | `getDataSelect_Subsidiaria` | Catálogo de subsidiarias. |
| POST | `/leads/getDataSelect_Admins` | Auth | `getDataSelect_Admins` | Catálogo de administradores. |
| POST | `/leads/getDataSelect_Corredor` | Auth | `getDataSelect_Corredor` | Catálogo de corredores. |
| POST | `/leads/getDataInformations_Lead` | Auth | `getDataInformations_Lead` | Información adicional del lead. |
| POST | `/leads/eventos` | Auth | `eventos` | Eventos asociados a un lead. |
| POST | `/leads/oportunidades` | Auth | `oportunidades` | Oportunidades asociadas a un lead. |
| POST | `/leads/inactivateOpportunitiesByLead` | Auth | `inactivateOpportunitiesByLead` | Inactiva oportunidades activas del lead. |
| POST | `/leads/update_LeadStatus` | Auth | `update_LeadStatus` | Actualiza el estado directo del lead. |
| POST | `/leads/SP_OBTENER_LEADS_PERDIDOS_MINIMO_SEGUIMIENTO_API` | Auth | `SP_OBTENER_LEADS_PERDIDOS_MINIMO_SEGUIMIENTO_API` | Recupera leads perdidos con seguimiento mínimo. |

## Leads ↔ NetSuite

| Método | Ruta | Protección | Handler | Dirección / descripción |
|---|---|---|---|---|
| POST | `/leads/getDataLead_Netsuite` | Auth | `getDataLead_Netsuite` | Consulta cliente/lead en NetSuite por ID. |
| POST | `/leads/createdNewLead_Netsuite` | Auth | `createdNewLead_Netsuite` | Crea un lead en NetSuite y registra el contexto local. |
| POST | `/leads/editarInformacionLead_Netsuite` | Auth | `editarInformacionLead_Netsuite` | Edita información/estado en NetSuite y refleja cambios locales seleccionados. |

## Calendarios y Outlook

| Método | Ruta | Protección | Handler | Descripción |
|---|---|---|---|---|
| POST | `/calendars/get_Calendars` | Auth | `get_Calendars` | Obtiene calendarios visibles. |
| POST | `/calendars/createEvent` | Auth | `createEvent` | Crea evento CRM. |
| POST | `/calendars/createOutlookEvent` | Auth | `createOutlookEvent` | Crea evento vinculado a Outlook. |
| POST | `/calendars/updateOutlookEventSchedule` | Auth | `updateOutlookEventSchedule` | Mueve/reprograma evento Outlook. |
| POST | `/calendars/updateOutlookEventDetails` | Auth | `updateOutlookEventDetails` | Edita detalles del evento Outlook. |
| POST | `/calendars/deleteOutlookEvent` | Auth | `deleteOutlookEvent` | Cancela/elimina evento Outlook y su vínculo local. |
| POST | `/calendars/registerOutlookCalendarSync` | Auth | `registerOutlookCalendarSync` | Registra o renueva suscripción Graph. |
| POST | `/calendars/processOutlookCalendarSync` | Auth | `processOutlookCalendarSync` | Ejecuta delta sync Outlook → CRM. |
| POST | `/calendars/getDataEevent` | Auth | `getDataEevent` | Detalle de evento. |
| POST | `/calendars/get_event_Citas` | Auth | `get_event_Citas` | Citas asociadas a un cliente/evento. |
| POST | `/calendars/editEvent` | Auth | `editEvent` | Edita un evento CRM. |
| POST | `/calendars/update_event_MoveDate` | Auth | `update_event_MoveDate` | Mueve la fecha de evento. |
| POST | `/calendars/update_Status_Event` | Auth | `update_Status_Event` | Cambia estado/acción del evento. |
| POST | `/calendars/getAll_ListEvent` | Auth | `getAll_ListEvent` | Lista de eventos por rango. |
| POST | `/calendars/getPendingActionCalendarEvents` | Auth | `getPendingActionCalendarEvents` | Eventos pendientes con lead y administrador. |

Además, la API expone `POST /api/v2.0/webhooks/microsoft/calendar` para validación y recepción de notificaciones Graph. Esta ruta no usa el wrapper estándar de `routesConfig`.

## Expedientes

| Método | Ruta | Protección | Handler | Descripción |
|---|---|---|---|---|
| POST | `/expedientes/getAllExpedientes` | Auth | `getFileList` | Lista de expedientes/unidades. |
| POST | `/expedientes/getExpediente` | Auth | `getExpediente` | Detalle local de un expediente. |
| POST | `/expedientes/updateExpediente` | Auth | `updateExpediente` | Consulta NetSuite y actualiza un expediente local. |

## Oportunidades

| Método | Ruta | Protección | Handler | Descripción |
|---|---|---|---|---|
| POST | `/oportunidad/getUbicaciones` | Auth | `getUbicaciones` | Catálogo de ubicaciones. |
| POST | `/oportunidad/getClases` | Auth | `getClases` | Catálogo de clases. |
| POST | `/oportunidad/getSpecificOportunidad` | Auth | `getSpecificOportunidad` | Detalle de oportunidad. |
| POST | `/oportunidad/getOpportunityTraceability` | Auth | `getOpportunityTraceability` | Snapshot e historial de estados. |
| POST | `/oportunidad/updateOpportunity_Probability` | Auth | `updateOpportunity_Probability` | Actualiza probabilidad/condición. |
| POST | `/oportunidad/updateOpportunity_Status` | Auth | `updateOpportunity_Status` | Actualiza estado de oportunidad. |
| POST | `/oportunidad/get_Oportunidades` | Auth | `get_Oportunidades` | Lista de oportunidades. |
| POST | `/oportunidad/updateEstadoOportunidad` | Auth | `updateEstadoOportunidad` | Actualiza estado operativo. |
| POST | `/oportunidad/editar_Oportunidad` | Auth | `editarOportunidad` | Edita una oportunidad local. |
| POST | `/oportunidad/validarDisponibilidad` | Auth | `validarDisponibilidad` | Valida disponibilidad de unidad/expediente. |
| POST | `/oportunidad/crear_Oportunidad` | Auth | `crear_Oportunidad` | Crea oportunidad en NetSuite. |

## Estimaciones

| Método | Ruta | Protección | Handler | Descripción |
|---|---|---|---|---|
| POST | `/estimacion/CrearEstimacion` | Auth | `crear_estimacion` | Crea estimación en NetSuite. |
| POST | `/estimacion/ObtenerEstimacionesOportunidad` | Auth | `ObtenerEstimacionesOportunidad` | Lista estimaciones de una oportunidad en CRM. |
| POST | `/estimacion/extraerEstimacion` | Auth | `extraerEstimacion` | Obtiene detalle combinado NetSuite + CRM. |
| POST | `/estimacion/editarEstimacion` | Auth | `editarEstimacion` | Edita estimación en NetSuite. |
| POST | `/estimacion/enviarEstimacionComoPreReserva` | Auth | `enviarEstimacionComoPreReserva` | Envía la estimación como pre-reserva. |
| POST | `/estimacion/actualizarEstimacionPreReserva` | Auth | `actualizarEstimacionPreReserva` | Actualiza flags y fechas locales de pre-reserva. |
| POST | `/estimacion/caidaReserva` | Auth | `caidaReserva` | Envía caída de pre-reserva a NetSuite y actualiza CRM. |
| POST | `/estimacion/ModificarEstimacionCliente` | Auth | `ModificarEstimacionCliente` | Modifica estado/relación de estimación y cliente. |

## Órdenes de venta

| Método | Ruta | Protección | Handler | Descripción |
|---|---|---|---|---|
| POST | `/ordenVenta/listar` | Auth | `enlistarOrdenesVenta` | Lista órdenes con joins comerciales. |
| POST | `/ordenVenta/listarClientesCierreFirmado` | Auth | `enlistarClientesCierreFirmado` | Clientes con cierre firmado. |
| POST | `/ordenVenta/obtenerOrdendeventa` | Auth | `obtenerOrdendeventa` | Consulta detalle de orden en NetSuite. |
| POST | `/ordenVenta/aplicarComicion` | Auth | `aplicarComicio` | Actualiza indicador de comisión/pago. |
| POST | `/ordenVenta/crearOrdenVenta` | Auth | `crearOrdenVenta` | Crea orden de venta en NetSuite. |
| POST | `/ordenVenta/insertarOrdenVentaBd` | Auth | `insertarOrdenVentaBd` | Inserta relación de orden en MySQL. |
| POST | `/ordenVenta/editarOrdenVenta` | Auth | `editarOrdenVenta` | Edita orden en NetSuite. |
| POST | `/ordenVenta/enviarReservaCaida` | Auth | `enviarReservaCaida` | Registra caída de reserva local. |
| POST | `/ordenVenta/enviarReservaNetsuite` | Auth | `enviarReservaNetsuite` | Envía reserva a NetSuite. |
| POST | `/ordenVenta/actualizarOrdenVentaBd` | Auth | `actualizarOrdenVentaBd` | Actualiza flags/fechas de orden local. |
| POST | `/ordenVenta/obtenerOrdenesPorCliente` | Auth | `obtenerOrdenesPorCliente` | Lista órdenes de un cliente. |
| POST | `/ordenVenta/enviarCierreFirmando` | Auth | `enviarCierreFirmando` | Envía cierre firmado a NetSuite. |
| POST | `/ordenVenta/modificarCierrreFirmando` | Auth | `modificarCierrreFirmando` | Marca cierre firmado en CRM. |

## Búsqueda, reportes y catálogos externos

| Método | Ruta | Protección | Handler | Descripción |
|---|---|---|---|---|
| POST | `/buscador/getAll` | Auth | `getAll` | Buscador general. |
| POST | `/reporte/obtenerBusquedaGuardada` | Auth | `obtenerBusquedaGuardada` | Consulta una búsqueda guardada de NetSuite. |
| POST | `/campaign/add/crm` | Externa | `crearCampana` | Crea/integra campaña local desde una fuente externa. |
| POST | `/campaign/edit/crm` | Externa | `editarCampana` | Edita campaña local desde una fuente externa. |
| POST | `/partner/add/crm` | Externa | `crearpartner` | Crea/integra corredor local desde una fuente externa. |
| POST | `/partner/edit/crm` | Externa | `editarpartner` | Edita corredor local desde una fuente externa. |

## Sticky notes

| Método | Ruta | Protección | Handler | Descripción |
|---|---|---|---|---|
| POST | `/sticknotes/obtener` | Auth | `obtenerSticNotesPorTransaccion` | Lista notas de una transacción. |
| POST | `/sticknotes/crear` | Auth | `crearSticNote` | Crea nota. |
| POST | `/sticknotes/editar` | Auth | `editarSticNote` | Edita nota. |
| POST | `/sticknotes/posicion` | Auth | `actualizarPosicionSticNote` | Guarda posición visual. |
| POST | `/sticknotes/visibilidad` | Auth | `cambiarVisibilidadSticNote` | Muestra/oculta nota. |
| POST | `/sticknotes/estado` | Auth | `cambiarEstadoSticNote` | Cambia estado. |
| POST | `/sticknotes/pin` | Auth | `actualizarPinSticNote` | Fija/desfija nota. |
| POST | `/sticknotes/obtener-por-id` | Auth | `obtenerSticNotePorId` | Consulta una nota. |
| POST | `/sticknotes/eliminar` | Auth | `eliminarSticNote` | Elimina una nota. |

## Rutas no activas en el catálogo

El código conserva comentada la ruta `/oportunidad/crear_Oportunidad` dentro del grupo local de oportunidad; la ruta activa de creación está en el grupo `oportunidadNetsuite` y apunta al mismo path con el método `crear_Oportunidad`.
