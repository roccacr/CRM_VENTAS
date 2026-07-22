# Plan de pruebas de rendimiento

El objetivo no es declarar rendimiento por intuicion. El objetivo es medir, guardar resultados y detectar el punto donde el API deja de comportarse de forma segura.

## Herramienta incluida

El proyecto incluye un smoke test sin dependencias externas:

```bash
npm run test:performance:smoke
```

Por defecto consulta:

```text
http://localhost:8002/api/v1/health/live
http://localhost:8002/api/v1/health/ready
```

Salida esperada:

```json
{
  "totalRequests": 50,
  "concurrency": 5,
  "ok": 50,
  "failed": 0,
  "rps": 0,
  "latencyMs": {
    "min": 0,
    "avg": 0,
    "p50": 0,
    "p95": 0,
    "p99": 0,
    "max": 0
  }
}
```

Los valores reales dependen del ambiente. No deben copiarse de ejemplo.

## Variables

| Variable           | Ejemplo                        | Uso                                             |
| ------------------ | ------------------------------ | ----------------------------------------------- |
| `PERF_BASE_URL`    | `http://localhost:8002/api/v1` | Base URL a medir.                               |
| `PERF_PATHS`       | `/health/live,/health/ready`   | Endpoints separados por coma.                   |
| `PERF_REQUESTS`    | `200`                          | Cantidad total de requests.                     |
| `PERF_CONCURRENCY` | `20`                           | Requests simultaneos.                           |
| `PERF_AUTH_TOKEN`  | `<jwt>`                        | Token Bearer para endpoints protegidos.         |
| `PERF_MAX_P95_MS`  | `500`                          | Umbral opcional: falla si p95 supera ese valor. |

## Escenarios recomendados

| Escenario                   | Comando                                                                                   | Que demuestra                                        |
| --------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Health local basico         | `npm run test:performance:smoke`                                                          | API responde y readiness no se degrada.              |
| Health con mas concurrencia | `PERF_REQUESTS=300 PERF_CONCURRENCY=30 npm run test:performance:smoke`                    | Comportamiento bajo concurrencia moderada.           |
| Endpoint protegido          | `PERF_AUTH_TOKEN=<token> PERF_PATHS=/kapso/business-flows npm run test:performance:smoke` | Latencia de API autenticada.                         |
| Gate de latencia            | `PERF_MAX_P95_MS=500 npm run test:performance:smoke`                                      | Falla automaticamente si p95 rompe el umbral.        |
| Staging                     | `PERF_BASE_URL=https://kapso-crmventas.rdghub.com/api/v1 npm run test:performance:smoke`  | Medicion real de red, proxy y runtime de despliegue. |

## Metricas que deben guardarse

| Metrica            | Fuente                                           | Umbral inicial sugerido                    |
| ------------------ | ------------------------------------------------ | ------------------------------------------ |
| p95 HTTP           | `test:performance:smoke`                         | Definir despues de baseline local/staging. |
| RPS estable        | `test:performance:smoke`                         | Definir por necesidad operativa real.      |
| Errores HTTP       | `byStatus` en salida JSON                        | 0 errores en smoke.                        |
| Duracion worker    | Logs `Lead template diagnostic worker finished`. | Sin solapamiento entre lotes.              |
| Queue lag          | BullMQ/Redis metrics o logs de procesamiento.    | Sin acumulacion sostenida.                 |
| Query time MySQL   | Slow query log o instrumentation futura.         | Sin queries lentas en seleccion de leads.  |
| Duplicados webhook | Conteo de recibos duplicados ignorados.          | Duplicados no deben producir doble efecto. |

## Criterios de aceptacion

Antes de produccion completa:

- Health `live` y `ready` pasan con p95 documentado.
- Worker procesa lote sin solaparse con la siguiente ejecucion.
- Reintentos de webhook no duplican bitacoras ni envios.
- Envio inicial registra estado de ejecucion y respuesta Kapso.
- Respuesta `Si` y `No` actualiza lead, bitacora y estado terminal/continuacion.
- Carga de media no deja archivos huerfanos al eliminar proyecto.
- Si existen varias replicas, `archivos/` usa volumen compartido o storage externo.

## Registro de resultados

Copiar aqui los resultados reales cuando se ejecuten en local/staging.

| Fecha     | Ambiente | Comando | Requests | Concurrencia | OK  | Fallos | RPS | p95 ms | Observacion                          |
| --------- | -------- | ------- | -------- | ------------ | --- | ------ | --- | ------ | ------------------------------------ |
| Pendiente | staging  | -       | -        | -            | -   | -      | -   | -      | Ejecutar antes de salida productiva. |
