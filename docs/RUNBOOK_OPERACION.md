# Runbook operativo API Kapso

Este runbook existe para que otro desarrollador pueda diagnosticar el modulo sin depender del autor original.

## Checklist rapido ante incidente

1. Validar salud del API:

   ```bash
   curl http://localhost:8002/api/v1/health/live
   curl http://localhost:8002/api/v1/health/ready
   ```

2. Revisar si MySQL esta disponible y confirmar `KAPSO_JOBS_DRIVER=local`.
3. Revisar logs recientes del worker `Lead template automation worker finished`.
4. Confirmar si Kapso tiene incidente activo o errores HTTP.
5. Confirmar que el flujo este activo y que el proyecto este permitido.
6. Confirmar que el template `saludo` este `approved`.
7. Confirmar que el asesor tenga una relacion Admin-Kapso activa.
8. Revisar bitacoras CRM antes de reintentar manualmente.

## Fallos comunes

| Sintoma                                | Causa probable                                       | Accion segura                                                              |
| -------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `verify` falla por `CRM_JWT_SECRET`    | CI/test levanta `AppModule` real sin secreto JWT.    | Agregar secreto dummy solo para CI/test; no relajar `validateEnv`.         |
| `flow_project_or_template_not_ready`   | Proyecto, flujo o template no estan listos.          | Revisar flujo activo, proyecto permitido y template aprobado en catalogo.  |
| No se envia saludo                     | Lead no cumple reglas o ya tiene ejecucion previa.   | Revisar `kapso_lead_flow_executions` por `flow_uuid + idinterno_lead`.     |
| Webhook duplicado                      | Kapso/Meta reintento el mismo evento.                | Verificar `kapso_webhook_receipts`; no reprocesar si ya esta terminal.     |
| Media no carga                         | Archivo fisico eliminado o URL firmada expirada.     | Regenerar lista desde BD y confirmar existencia fisica antes de servir.    |
| Scheduler no ejecuta jobs              | Proceso API detenido, variable incorrecta o worker desactivado. | Validar que el API este arriba y `KAPSO_JOBS_DRIVER=local`.                |
| MySQL no resuelve DNS o cae            | Problema de red/base.                                | No mutar datos; esperar conectividad y revisar readiness.                  |
| Kapso devuelve error al enviar mensaje | Template, telefono, credenciales o proveedor fallan. | Registrar bitacora y no reintentar infinito sin clasificar la causa.       |

El flujo normal corre completo dentro del mismo API; no requiere Docker ni Redis. En servidor Ubuntu se valida asi:

```bash
grep KAPSO_JOBS_DRIVER .env
npm run start:prod
```

Si aparece `ECONNREFUSED 127.0.0.1:6379`, no corresponde al modo local: hay un proceso viejo corriendo con configuracion anterior o el entorno esta arrancando con `KAPSO_JOBS_DRIVER=bullmq`.

## Validacion de staging

Antes de produccion completa:

1. Crear base staging aislada.
2. Hacer respaldo.
3. Ejecutar:

   ```bash
   npm run migration:run
   npm run test:integration
   ```

4. Probar rollback controlado:

   ```bash
   npm run migration:revert
   npm run migration:run
   ```

5. Guardar evidencia de tablas, seeds y resultado.

## Prueba funcional minima

La prueba real de cierre debe demostrar:

1. Lead cumple `01-LEAD-INTERESADO`, `estado_lead = 1`, `whatsapp_template_contact_sent = 2`.
2. Asesor tiene numero Kapso activo.
3. Proyecto esta permitido en el flujo.
4. Template `saludo` esta aprobado.
5. API envia el template.
6. Cliente responde `Si` o `No`.
7. Webhook entra firmado e idempotente.
8. CRM actualiza lead y bitacora.
9. El mismo lead no vuelve a procesarse para el mismo flujo.

## Prueba de rendimiento minima

Ejecutar primero smoke local:

```bash
npm run test:performance:smoke
```

Luego staging:

```bash
PERF_BASE_URL=https://kapso-crmventas.rdghub.com/api/v1 PERF_REQUESTS=300 PERF_CONCURRENCY=30 npm run test:performance:smoke
```

Guardar:

- ambiente;
- fecha;
- comando;
- RPS;
- p95;
- p99;
- errores;
- observaciones del worker y backlog.
