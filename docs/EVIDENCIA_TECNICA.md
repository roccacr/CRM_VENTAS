# Evidencia tecnica verificable

Este documento convierte el estado del API Kapso en evidencia reproducible. La regla es simple: no se afirma que algo funciona si no existe un comando, una prueba, un log o una validacion que lo respalde.

## Resumen ejecutivo

| Pregunta de jefatura                               | Respuesta verificable                                                                                 |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Que problema resuelve?                             | Automatiza el primer contacto de leads nuevos sin depender de escritura manual inicial por WhatsApp.  |
| Que reduce para ventas?                            | Reduce tiempo de primer contacto, evita bloqueos por contacto manual inicial y estandariza bitacoras. |
| Como evita ciclos infinitos?                       | Usa ejecuciones por `flow_uuid + idinterno_lead` y estados terminales por respuesta/error.            |
| Como se prueba que el sistema no duplica acciones? | Webhooks idempotentes, jobs BullMQ y pruebas e2e/unitarias sobre recepcion y procesamiento.           |
| Que falta para declarar cierre 10/10 productivo?   | Prueba de carga en staging, migracion real validada, Entra productivo y storage compartido.           |

## Comandos de evidencia

| Objetivo                         | Comando                                                                                    | Evidencia esperada                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Formato                          | `npm run format:check`                                                                     | No hay archivos fuera de formato.                     |
| Lint                             | `npm run lint`                                                                             | No hay reglas ESLint incumplidas.                     |
| TypeScript                       | `npm run typecheck`                                                                        | Compilacion estatica sin errores.                     |
| Unitarias/e2e aisladas           | `npm test -- --runInBand`                                                                  | Todas las pruebas `.spec.ts` no integracion pasan.    |
| E2E HTTP                         | `npm run test:e2e -- --runInBand`                                                          | Endpoints publicos/webhooks responden segun contrato. |
| Build                            | `npm run build`                                                                            | Nest compila a `dist/`.                               |
| Cobertura                        | `npm run test:coverage`                                                                    | Reporte en `coverage/`.                               |
| Integracion MySQL                | `npm run test:integration`                                                                 | Requiere MySQL/Redis de integracion disponibles.      |
| Rendimiento smoke sin auth       | `npm run test:performance:smoke`                                                           | Latencia/RPS sobre liveness/readiness local.          |
| Rendimiento endpoint autenticado | `PERF_AUTH_TOKEN=<token> PERF_PATHS=/kapso/business-flows npm run test:performance:smoke`  | Latencia/RPS sobre endpoint protegido.                |
| Gate p95                         | `PERF_REQUESTS=200 PERF_CONCURRENCY=20 PERF_MAX_P95_MS=500 npm run test:performance:smoke` | Falla si p95 supera el umbral definido.               |
| Worker con datos reales          | Revisar logs `Lead template diagnostic worker finished {...}`                              | Conteos `scanned`, `configured`, `sent`, `skipped`.   |

## Matriz codigo contra comportamiento documentado

| Comportamiento documentado                 | Evidencia en codigo/pruebas                                           | Resultado esperado                                                       |
| ------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Lead candidato solo entra si cumple reglas | Worker consulta `01-LEAD-INTERESADO`, `estado_lead = 1`, `sent = 2`.  | Si falta proyecto/flujo/template, queda `skipped` con razon clara.       |
| Asesor debe tener numero Kapso activo      | Repositorio cruza lead con asignacion Admin-Kapso.                    | Si no existe relacion activa, se bitacora y no se envia.                 |
| Proyecto debe estar habilitado             | Tabla de flujo-proyecto controla habilitacion.                        | Si el proyecto no esta permitido, no se envia template.                  |
| Flujo puede pausarse                       | `enabled` bloquea ejecucion sin borrar configuracion.                 | El worker no ejecuta envios de flujos inactivos.                         |
| Template saludo debe estar aprobado        | Catalogo local valida `approved`.                                     | No se envia template `submitted` o no sincronizado.                      |
| Respuesta `No, gracias` cierra el flujo    | Webhook clasifica intencion negativa y actualiza lead/bitacora.       | Lead pasa a perdido con caida 67 y ejecucion terminal.                   |
| Respuesta positiva continua flujo          | Webhook clasifica intencion positiva, actualiza lead y prepara intro. | Lead pasa a seguimiento, caida 69, `whatsapp_template_contact_sent = 0`. |
| Telefono invalido no llama a Kapso         | Normalizacion valida antes de enviar.                                 | Bitacora caida 68 y ejecucion cerrada para no reintentar el mismo flujo. |
| Adjuntos por proyecto se limpian           | Al quitar proyecto se elimina metadata y carpeta del proyecto/flujo.  | No quedan archivos huerfanos ligados a ese proyecto dentro del flujo.    |
| Webhooks no duplican efectos               | Receipts/idempotency key + payload hash + estado de procesamiento.    | Reintentos de Kapso no ejecutan doble el mismo evento.                   |

## Indicadores de producto recomendados

Estos indicadores deben medirse en staging/produccion para demostrar impacto real de negocio.

| KPI                                       | Como medirlo                                                           | Uso                                              |
| ----------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------ |
| Tiempo a primer contacto                  | Diferencia entre `creado_lead` y envio exitoso del template.           | Confirmar reduccion de espera para leads nuevos. |
| Leads contactados automaticamente         | Conteo de ejecuciones `initial_template_sent` por dia/proyecto/asesor. | Medir adopcion del flujo.                        |
| Leads omitidos por falta de configuracion | Conteo `skipped` por razon.                                            | Detectar asesores o proyectos no configurados.   |
| Respuestas positivas                      | Conteo `answered_yes` / envios iniciales.                              | Medir aceptacion del canal WhatsApp.             |
| Respuestas negativas                      | Conteo `answered_no` / envios iniciales.                               | Medir rechazo y evitar insistencia.              |
| Telefonos invalidos                       | Bitacoras caida 68.                                                    | Mejorar captura de datos en CRM.                 |
| Errores Kapso                             | Conteo por status y endpoint Kapso.                                    | Separar fallos propios de fallos proveedor.      |
| Tiempo de worker                          | Duracion por lote y cantidad procesada.                                | Ajustar concurrencia y frecuencia.               |

## Criterio honesto de cierre

El proyecto puede considerarse 10/10 documentado si el README y anexos explican el flujo, riesgos, decisiones y pruebas. Para considerarlo 10/10 productivo verificable, hacen falta estas evidencias externas:

- Migracion ejecutada en staging con respaldo y rollback probado.
- Prueba de carga con datos y token reales.
- Validacion de Entra con usuarios autorizados y no autorizados.
- Validacion de storage compartido si se despliega mas de una replica.
- Ejecucion end-to-end real: lead candidato, template enviado, respuesta positiva/negativa y bitacora CRM.
