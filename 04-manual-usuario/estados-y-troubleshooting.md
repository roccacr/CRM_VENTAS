# Estados y solución de problemas

> **Avance de primera fase — última modificación: 2026-07-09**

Este documento reúne estados identificados en el código y recomendaciones operativas. Los nombres que aparecen en pantalla, la transición válida entre estados y los permisos por rol deben confirmarse con usuarios clave.

## Estados de atención del lead

La lógica del backend identifica, entre otros, los valores técnicos `NUEVA` y `SEGUIMIENTO`, además de un estado activo. En la interfaz también se muestran agrupaciones de leads nuevos, en atención, activos y totales.

| Situación operativa | Acción del usuario | Control |
|---|---|---|
| Lead recién recibido | Abrir y contactar. | Registrar la primera actividad. |
| Lead en atención | Crear nota, evento o seguimiento. | Definir próxima acción. |
| Lead con interés comercial | Crear oportunidad. | Verificar relación y responsable. |
| Lead sin continuidad | Marcar perdido y documentar motivo. | No eliminar el contexto. |

## Estados observados en Kapso

El servicio técnico utiliza los siguientes estados de sincronización:

| Estado | Interpretación operativa |
|---|---|
| `not_started` | Aún no se inicia la sincronización. |
| `pending_remote_sync` | Se espera información del servicio remoto. |
| `missing_phone_number_id` | Falta asociar el identificador del número remoto. |
| `synced` | El número y su detalle fueron sincronizados. |
| `sync_failed` | La sincronización terminó con error. |
| `processed` | El webhook o evento fue procesado. |
| `processed_with_warnings` | Se procesó, pero dejó advertencias. |

Los eventos pueden registrarse como recibidos, procesados, con advertencias, pendientes, fallidos o eliminados. Para soporte, conservar el identificador del número, evento o idempotencia que aparezca en pantalla o logs autorizados.

## Problemas frecuentes

### No puedo iniciar sesión

1. Confirmar usuario y contraseña.
2. Verificar que se está usando la URL correcta.
3. Intentar la recuperación de contraseña.
4. Si persiste, reportar usuario, hora y mensaje visible al administrador.

No enviar la contraseña en el reporte.

### No aparece un lead

1. Revisar la lista correcta: activos, nuevos, atención o totales.
2. Usar la búsqueda o filtros disponibles.
3. Confirmar que se consulta la subsidiaria/proyecto esperado.
4. Verificar si otro usuario ya lo atendió.
5. Reportar nombre, contacto o identificador del registro, sin datos sensibles innecesarios.

### Una acción devuelve error

1. Leer el mensaje mostrado.
2. No repetir varias veces de inmediato.
3. Consultar si el registro se creó o actualizó antes de reintentar.
4. Registrar módulo, acción, identificador, fecha/hora y mensaje.
5. Escalar el caso al soporte técnico.

### El CRM no refleja un cambio de NetSuite

La integración legacy ejecuta varias operaciones de NetSuite bajo demanda y no se encontró un cron general de importación masiva de NetSuite en la revisión. Por ello:

1. Confirmar si la operación mostró éxito.
2. Esperar la actualización indicada por el responsable técnico.
3. Verificar el identificador en el módulo correspondiente.
4. No modificar manualmente datos relacionados para “forzar” la sincronización.
5. Escalar con el identificador de CRM/NetSuite, ambiente y hora.

### No llega una invitación de calendario

1. Confirmar correo y fecha/hora del evento.
2. Revisar si el evento quedó guardado en el CRM.
3. Confirmar que no se trate de una reprogramación pendiente.
4. Reportar el identificador del evento y la hora de creación.

El backend tiene un proceso que revisa invitaciones nuevas o reprogramadas cada minuto, pero la entrega final también depende de Microsoft/Outlook y del correo del participante.

### Kapso muestra `pending_remote_sync` o `sync_failed`

1. Abrir el detalle de la relación o número.
2. Revisar si el número remoto existe y está disponible.
3. Confirmar que la relación administrador–número sea la correcta.
4. Esperar el siguiente ciclo automático antes de repetir varias veces.
5. Escalar con número remoto, administrador, estado y mensaje de error.

El worker técnico revisa pendientes cada 30 segundos por defecto y procesa lotes de hasta 10 registros; estos valores pueden cambiar por configuración de ambiente.

## Formato para reportar incidentes

```text
Módulo:
Usuario:
Acción realizada:
Identificador del registro/evento:
Fecha y hora:
Ambiente: producción / pruebas
Mensaje visible:
Pasos para reproducir:
Captura sin información sensible: sí / no
```

## Escalamiento

| Tipo de caso | Primera atención |
|---|---|
| Contraseña o acceso | Administrador del CRM. |
| Datos comerciales incorrectos | Supervisor o responsable comercial. |
| Error de integración NetSuite | Soporte técnico del CRM/ERP. |
| Error de WhatsApp/Kapso | Administrador Kapso y soporte técnico. |
| Evento o correo no recibido | Responsable del CRM y soporte Microsoft/Outlook. |

## Pendientes para la siguiente actualización

- Validar catálogo oficial de estados y motivos de pérdida.
- Confirmar permisos por rol y campos obligatorios.
- Confirmar ambientes y tiempos operativos de cada integración.
- Incorporar capturas de pantalla aprobadas por el negocio.
- Validar con usuarios reales los pasos de estimación, pre-reserva, reserva y cierre firmado.
