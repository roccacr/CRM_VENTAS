# Checklist API Kapso GIT

## 1. Levantamiento

- [x] Confirmar que el proyecto es nuevo.
- [x] Confirmar que la BD del `.env` es produccion.
- [x] Confirmar uso de `mysql_crm_ventas` MCP para cambios de BD.
- [x] Confirmar endpoint webhook: `/api/v1/webhooks/kapso/platform`.
- [x] Confirmar desarrollo local con ngrok sobre puerto `8002`.
- [x] Confirmar que no se usara Docker.
- [x] Confirmar que el primer entregable es documentacion.

## 2. Scaffold NestJS

- [x] Crear proyecto NestJS dentro del repo.
- [x] Configurar TypeScript estricto.
- [x] Configurar ESLint.
- [x] Configurar Prettier.
- [x] Configurar Swagger/OpenAPI.
- [x] Configurar healthcheck.
- [x] Verificar `npm run start:dev`.
- [x] Crear comando unico `npm run verify`.

## 3. Configuracion

- [x] Definir `.env.example` sin secretos.
- [x] Cargar `PORT=8002`.
- [x] Cargar `DATABASE_URL`.
- [x] Cargar `KAPSO_API_KEY`.
- [x] Cargar `KAPSO_PLATFORM_WEBHOOK_SECRET`.
- [x] Cargar `CRM_API_INTERNAL_TOKEN`.
- [x] Validar variables al arrancar.

## 4. Logs

- [x] Instalar `nestjs-pino`.
- [x] Configurar logs compactos.
- [x] Crear salida local en `logs/`.
- [x] Ocultar secretos y tokens.
- [x] Agregar `requestId`.

## 5. Base de Datos

- [x] Inspeccionar esquema actual con `mysql_crm_ventas`.
- [x] Confirmar referencia futura de vendedor con `admins.idnetsuite_admin`.
- [x] Preparar SQL de `kapso_integracion_numero_whatsapp`.
- [x] Revisar SQL antes de ejecutar.
- [x] Crear tabla con MCP.
- [x] Verificar indices y columnas.
- [x] Configurar Prisma para MySQL.
- [x] Crear repository de `kapso_integracion_numero_whatsapp`.
- [x] Probar conexion DB con lectura sin modificar datos.

## 6. Webhook Kapso Platform

- [x] Crear modulo de webhooks Kapso.
- [x] Crear DTO/schema de evento platform.
- [x] Validar firma HMAC.
- [x] Leer `X-Webhook-Event`.
- [x] Registrar `X-Idempotency-Key` en logs.
- [x] Implementar `whatsapp.phone_number.created`.
- [x] Implementar `whatsapp.phone_number.deleted`.
- [x] Responder `200 OK` en flujo correcto.
- [x] Responder `401` si la firma no es valida.

## 7. API Interna Frontend

- [x] Crear guard de token interno.
- [x] Crear endpoint listar integraciones.
- [x] Crear endpoint activar integracion.
- [x] Crear endpoint inactivar integracion.
- [ ] Crear endpoint base de sync futuro.
- [x] Documentar endpoints en Swagger.

## 8. Pruebas

- [x] Definir regla permanente: toda funcion importante debe tener pruebas.
- [x] Definir minimo 3 escenarios por funcion/flujo importante.
- [x] Definir 4 escenarios preferibles para seguridad, BD, webhooks e integraciones.
- [x] Unit test configuracion base.
- [x] Unit test configuracion sin exponer secretos.
- [x] Unit test configuracion con puerto invalido.
- [x] Unit test armado seguro de `DATABASE_URL`.
- [x] Unit test configuracion MySQL desde `.env`.
- [x] Unit test repository lectura sin escritura.
- [x] Unit test DB check exitoso y fallo controlado.
- [x] Unit test guard token Bearer valido.
- [x] Unit test guard header alternativo valido.
- [x] Unit test guard sin token.
- [x] Unit test guard token invalido.
- [x] Unit test guard sin configuracion.
- [x] Unit test API interna listar.
- [x] Unit test API interna lista vacia.
- [x] Unit test API interna activar.
- [x] Unit test API interna desactivar.
- [x] Unit test API interna id invalido.
- [x] Unit test API interna registro inexistente.
- [x] Unit test webhook firma valida.
- [x] Unit test webhook firma invalida.
- [x] Unit test webhook sin header requerido.
- [x] Unit test numero creado.
- [x] Unit test numero creado duplicado.
- [x] Unit test numero creado con payload incompleto.
- [x] Unit test numero eliminado.
- [x] Unit test numero eliminado inexistente.
- [x] Unit test error DB al eliminar.
- [x] E2E healthcheck.
- [x] E2E webhook creado.
- [x] E2E webhook eliminado.
- [x] E2E API interna listar con token.
- [x] E2E API interna sin token.
- [x] E2E API interna token invalido.
- [x] E2E API interna activar.
- [x] E2E API interna desactivar.
- [x] Playwright smoke Swagger/health.
- [x] Playwright health API.
- [x] Playwright Swagger/OpenAPI.
- [x] Playwright DB read check.
- [x] Playwright routing 404.
- [x] Playwright webhook Kapso firmado sin escritura DB.
- [x] Playwright webhook firma invalida.
- [x] Playwright webhook evento faltante.
- [x] Playwright API interna listar con token.
- [x] Playwright API interna sin token.
- [x] Playwright API interna token invalido.
- [x] Playwright API interna activar bloqueado sin token.

## 9. Frontend CRM

- [ ] Buscar vista Kapso existente.
- [ ] Limpiar implementacion previa de Kapso.
- [ ] Dejar solo `h1` con `Kapso integracion`.
- [ ] Verificar que el frontend compile.

## 10. Etapas Futuras

- [ ] Investigar endpoint Kapso para detalle completo del numero.
- [ ] Agregar sincronizacion manual/API.
- [ ] Agregar WhatsApp webhooks por numero.
- [ ] Guardar conversaciones/chats.
- [ ] Asignar vendedor a integracion.
- [ ] Mostrar chats desde CRM.
