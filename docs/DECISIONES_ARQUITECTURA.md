# Decisiones de arquitectura

Este registro explica las decisiones importantes del API Kapso, sus motivos y las alternativas descartadas. Sirve para que otro ingeniero pueda revisar el sistema sin depender de contexto verbal.

## ADR-001 · NestJS como framework backend

| Campo                  | Detalle                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| Decision               | Usar NestJS 11 con modulos, controllers, services, repositories y guards.                        |
| Motivo                 | El flujo requiere webhooks, jobs, seguridad, validacion, testing y separacion clara de dominios. |
| Alternativa descartada | Express/Fastify directo.                                                                         |
| Por que se descarto    | Habria requerido construir manualmente DI, estructura modular, guards, pipes y convenciones.     |
| Riesgo                 | Nest agrega complejidad inicial.                                                                 |
| Mitigacion             | Mantener modulos enfocados y evitar capas innecesarias.                                          |

## ADR-002 · MySQL/TypeORM sobre la base CRM existente

| Campo                  | Detalle                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------- |
| Decision               | Usar MySQL existente del CRM y TypeORM para entidades/migraciones Kapso.           |
| Motivo                 | Leads, admins, proyectos, caidas y bitacoras ya viven en MySQL.                    |
| Alternativa descartada | Base separada para Kapso.                                                          |
| Por que se descarto    | Duplicaria datos y complicaria consistencia con bitacoras CRM.                     |
| Riesgo                 | Consultas productivas pueden impactar una base sensible.                           |
| Mitigacion             | Repositorios enfocados, proyecciones explicitas, indices y pruebas de integracion. |

## ADR-003 · BullMQ/Redis para jobs distribuidos

| Campo                  | Detalle                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| Decision               | Ejecutar sincronizacion y worker de leads con BullMQ/Redis.                                |
| Motivo                 | Evita que dos instancias ejecuten el mismo timer y permite reintentos controlados.         |
| Alternativa descartada | `setInterval` local.                                                                       |
| Por que se descarto    | En despliegues con mas de una replica duplica trabajos y puede repetir envios.             |
| Alternativa futura     | Kafka/RabbitMQ si el volumen supera las necesidades de BullMQ.                             |
| Criterio para migrar   | Alto volumen, multiples consumidores heterogeneos o necesidad de streaming/event sourcing. |

## ADR-004 · Idempotencia durable para webhooks

| Campo                  | Detalle                                                                         |
| ---------------------- | ------------------------------------------------------------------------------- |
| Decision               | Guardar recibos de webhooks con idempotency key/hash y estado de procesamiento. |
| Motivo                 | Kapso/Meta pueden reintentar eventos. La API debe ser segura ante duplicados.   |
| Alternativa descartada | Cache en memoria.                                                               |
| Por que se descarto    | Se pierde al reiniciar y no funciona con multiples instancias.                  |
| Riesgo                 | Si el proveedor cambia headers, se debe adaptar la extraccion de idempotencia.  |
| Mitigacion             | Logs de headers/payload seguro y tests e2e de duplicados.                       |

## ADR-005 · Template para saludo inicial

| Campo                  | Detalle                                                                        |
| ---------------------- | ------------------------------------------------------------------------------ |
| Decision               | Usar template aprobado `saludo` para iniciar conversacion.                     |
| Motivo                 | Meta exige template para iniciar conversacion fuera de la ventana de 24 horas. |
| Alternativa descartada | Mensaje normal inicial.                                                        |
| Por que se descarto    | No es permitido si el cliente no ha abierto ventana activa.                    |
| Resultado              | El primer mensaje es controlado, auditable y cumple politica de WhatsApp.      |

## ADR-006 · Intro normal despues de respuesta positiva

| Campo                  | Detalle                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| Decision               | Enviar la intro como mensaje normal con media por proyecto despues del `Si`.                   |
| Motivo                 | Al responder, el cliente abre ventana de conversacion y se pueden adjuntar recursos variables. |
| Alternativa descartada | Crear un template diferente por proyecto y por combinacion de media.                           |
| Por que se descarto    | Multiplicaria templates y aprobaciones, haciendo dificil operar mas de 40 proyectos.           |
| Riesgo                 | Si se cierra la ventana de 24 horas, podria requerir template.                                 |
| Mitigacion             | Registrar tiempo de respuesta y validar ventana antes de cada mensaje normal.                  |

## ADR-007 · Filesystem local para primera etapa de adjuntos

| Campo                  | Detalle                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| Decision               | Guardar adjuntos bajo `archivos/<flow_uuid>/proyectos/<id>-<nombre>/`.                         |
| Motivo                 | Permite validar rapidamente negocio, UI y limpieza por proyecto sin contratar storage externo. |
| Alternativa descartada | S3/Azure Blob desde el primer dia.                                                             |
| Por que se descarto    | Agregaba costo operativo antes de validar el flujo comercial.                                  |
| Riesgo                 | No es adecuado para multiples replicas sin volumen compartido.                                 |
| Cierre recomendado     | Migrar a storage compartido antes de alta disponibilidad.                                      |

## ADR-008 · Seguridad por HMAC y media firmada

| Campo                  | Detalle                                                                        |
| ---------------------- | ------------------------------------------------------------------------------ |
| Decision               | Validar webhooks con firma y servir media con URLs HMAC temporales.            |
| Motivo                 | Evita aceptar payloads falsos y evita exponer archivos permanentes.            |
| Alternativa descartada | URLs publicas fijas o endpoints sin firma.                                     |
| Por que se descarto    | Riesgo de acceso indebido a adjuntos y procesamiento de eventos no confiables. |
| Riesgo                 | Relojes desincronizados pueden expirar URLs antes de tiempo.                   |
| Mitigacion             | TTL configurable y logs seguros de expiracion.                                 |
