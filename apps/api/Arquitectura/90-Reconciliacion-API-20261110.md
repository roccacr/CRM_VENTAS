# 90 — Reconciliación del API de Habita · 2026-11-10

La revisión toma como base el corte [85](85-Reconciliacion-Documental-20261103.md) en `06a489c` y contrasta los nueve commits posteriores hasta `4ad7a59` con el código. La revisión distingue el historial de Git, el árbol de trabajo y la publicación de Habita.

| Revisión | Qué cambió o qué acredita |
| --- | --- |
| `72c2d52` | Revisión adversarial, pruebas de propiedades y fuzzing. Ajustes de SuiteScript, Calendario y cobertura de permisos efectivos. |
| `5a667e7` | Límite al futuro en marcas temporales NetSuite antes de persistir. Pruebas HTTP y de cursor. |
| `4c7af0a`, `48b7707` | Ajustes de teardown de pruebas de frontend. |
| `874518e`, `63139a8` | Integración de marca, filtros/banners y calidad, con cambios de configuración y pruebas del API. `63139a8` es la base del release Habita `20261109185625-63139a8-local` verificado el 9 de noviembre. |
| `3f2537c` | Rechazo de caracteres invisibles en correos y lectura tolerante de snapshots de persona con JSON dañado en historial de órdenes. |
| `6d38014` | Aserciones específicas y más pruebas de límites, ordenación de eventos, permisos, contratos y criterios de expedientes. Reporte explícito de suites de persistencia omitidas. |
| `4ad7a59` | Configuración de pruebas frontend con fast-check, jest-dom y tiempo de espera de 20 segundos. |

El release de Habita identifica la versión del API/frontend publicada. La versión o instalación de SuiteScript en cada cuenta de NetSuite y el ledger MySQL necesitan comprobación independiente.

## Comportamiento versionado

- **NetSuite.** El escritor v2 valida `sourceModifiedAt` y los extremos de la ventana de lectura presentes. Rechaza con HTTP 400 una marca superior al reloj del servidor más 60 segundos, antes del repositorio. El límite es superior y conserva el tratamiento de eventos históricos por las reglas de ordenación, idempotencia y autoridad nativa/legacy. V1 conserva `persisted:false`. [73 — Eventos, cursor y auditoría](73-Sincronizacion-Estados-Ordenes-NetSuite.md).
- **Calendario.** La lectura efectiva de Mercadeo puede ampliar la población mediante `mercadeo.reports.read_all`; Formalización puede ampliar la lectura por equipo para roles activos de Formalización y Jefe de Formalizaciones, con pertenencia, permiso efectivo y denegaciones aplicadas. La ampliación de lectura no concede escritura ajena. La búsqueda de órdenes reutiliza dentro de la misma petición la resolución autorizada del lead asociado cuando varias órdenes lo comparten. [64 — Calendario](64-Calendario-Global-API-y-Contexto.md), [69 — Mercadeo](69-Mercadeo-Lectura-Global.md).
- **Identidad e historial.** Login local, solicitud de restablecimiento y DTOs de usuarios rechazan correos con caracteres invisibles, de control o direccionales cubiertos por `NO_INVISIBLE_CHARACTERS`. Si un snapshot de persona del historial no contiene JSON válido, esa persona se trata como dato ausente y el resto de la respuesta sigue disponible. [33 — Contrato de identidad](33-Contrato-API-Identidad-P0-S1.md).
- **Calidad.** Se usan Vitest y fast-check. Las pruebas de persistencia requieren el fixture MySQL autorizado y el reporte separa las omitidas de las ejecutadas. `pnpm test:mysql:ci` usa el runner dedicado; no apunta a una base productiva. La presencia de estas pruebas en Git no acredita una ejecución nueva de todo el árbol.

## Cambios del árbol local al 10 de noviembre

Los cambios de esta sección están fuera del commit `4ad7a59`. Su presencia en archivos no acredita publicación, ejecución de migraciones, operación del RESTlet externo ni aceptación con datos reales.

### Entrega y cierre de Formalización

- `202611100074_netsuite_order_delivery` registra `int_netsuite_order_delivery` en la base nativa. Su PK es `(destination, order_id)`, con `destination` nativo o legacy y `delivered_on DATE NULL`. El DDL no altera el esquema legacy y el código de las consultas de cierre depende de la tabla central.
- El escritor lee `custbody_fecha_unidad_entregada` como fecha de calendario. Omisión conserva la fecha, `null` explícito o cadena vacía limpian una fecha previa y una fecha ISO válida se incluye en la comparación y en la auditoría. La escritura comparte transacción con los demás efectos del evento. El criterio de cierre anual usa la fecha ERP disponible; en su ausencia busca una visita `closed` dentro del periodo anual de Costa Rica.
- Ante `edit` o `xedit`, la política ERP puede registrar la etapa respaldada por los indicadores: traspaso o entrega confirmada lleva a `closed`, cuotas completas a `pending_transfer`, fondos propios a `pending_balance` y el resto a `bank_management`, sujetos a elegibilidad y auditoría. El escritor solo avanza; puede iniciar con `import_snapshot` cuando no existe visita previa. La transición manual mantiene su propia política.
- En las transiciones manuales, una compra financiada sale de Contratos a `bank_management` (Sin iniciar) y una de fondos propios a `pending_balance`. Desde Traspaso pendiente se puede registrar la firma antes de recibir la confirmación de traspaso de NetSuite cuando las cuotas están pagadas y las llaves y la unidad siguen explícitamente sin entregar. Se conservan autorización, versión y auditoría.
- Seguimiento proyecta los checks originales de aprobación, firma y venta caída como booleanos anulables. Una búsqueda exacta autorizada puede recuperar una orden fuera de las bandejas visibles cuando la consulta ordinaria no devuelve coincidencias. Usa el número canónico o una referencia externa activa de una orden nativa y conserva la autoridad de fuente. Sigue siendo una lectura y requiere el permiso efectivo independiente de orden. [50 — Seguimiento](50-Plan-Seguimiento-Formalizacion.md), [78 — Fondos, banco y cierre](78-Formalizacion-Origen-Fondos-y-Gestion-Bancaria.md).

### Consulta, sincronización y extracción de NetSuite

| Operación | Contrato local |
| --- | --- |
| `GET /formalization/orders/:source/:id/netsuite` | Lee NetSuite para la orden autorizada. |
| `POST /formalization/orders/:source/:id/netsuite/sync` | Actualiza una orden existente, sin aceptar un snapshot del navegador. |
| `POST /formalization/orders/netsuite/import` | Extracción explícita con cuerpo estricto `{ "tranid": "<número exacto>" }`, sesión, CSRF y permisos efectivos `formalizacion.orders.read` y `formalizacion.orders.stage.update`. El servidor confirma cuenta, ID y snapshot en el RESTlet, verifica el número y la identidad, y registra el actor. |

La extracción puede crear la orden nativa y su referencia en la misma transacción del escritor durable. Rechaza duplicados o coincidencias ambiguas, exige un cliente declarado por NetSuite y una integración activa, y usa el ambiente y las habilitaciones del servidor. El webhook continúa actualizando órdenes existentes. El RESTlet local incorpora `GET` de `salesOrders` con `action=findByTranId` y la librería local se identifica como `2026.11.10.4`. En el commit publicado de Habita, el archivo versionado se identifica como `2026.11.03.7`; ese dato describe el archivo del release, no la versión instalada en NetSuite. [Sincronización manual](86-Sincronizacion-Manual-Orden-NetSuite.md).

### Catálogos y contrato operativo

Los listados de catálogos, Bancos y Expedientes de Unidad admiten localmente hasta 500 registros y mantienen sus permisos. Catálogos y Bancos conservan offset; Expedientes conserva el cursor vinculado a criterios y límite. Los valores por defecto al omitir el parámetro se conservan en el API. [35 — Catálogos y expedientes](35-Catalog-API-and-Schema.md). El título de Swagger cambia localmente a `Habita Identity API`; el alcance de OpenAPI permanece limitado a identidad.

## Alcance de la verificación documental

Se contrastaron commits, diffs locales, controladores, contratos, consultas, migración, scripts y pruebas versionadas. Este corte no vuelve a ejecutar suites de aplicación, no abre conexiones de persistencia y no publica cambios. Para evidencias operativas, consultar el [procedimiento de Habita](../../../deploy/habita/README.md) y la evidencia fechada del release correspondiente.
