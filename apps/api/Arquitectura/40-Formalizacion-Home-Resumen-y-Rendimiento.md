# 40 - Formalizacion: resumen de Home y rendimiento

## Actualizacion de autorizacion - 2026-10-23

[41 - Owner](41-Owner-Herencia-y-Denegaciones.md) prevalece sobre el corte original:
los banners de etapas exigen rol efectivo Formalizacion y permiso
`formalizacion.home.stages.read`. Owner lo hereda mediante politica persistida;
una denegacion individual bloquea tanto API como frontend. Aprobaciones conserva
su permiso independiente. Las consultas de negocio y contadores no cambian.

## Alcance solicitado - 2026-10-23

Conectar contratos y los cinco indicadores restantes a lecturas reales de las dos
fuentes. No habilitar listados, cambios de estado, correos, ERP ni restauraciones.
El permiso independiente del banner de aprobaciones se conserva. Los otros seis
banners requieren el rol activo exacto `formalizacion`, tanto antes de montar el
consumidor React como antes de consultar negocio en el API.

Este documento separa plan, reglas confirmadas, lecturas puntuales reales y
pruebas sinteticas. No certifica rendimiento productivo bajo carga.

## Plan de implementacion

1. Reutilizar identidad, politica de rol activo, transaccion de solo lectura y
   snapshot REPEATABLE READ de los resumenes existentes. Preservar sus endpoints.
2. Agregar `GET /formalization/home/summary`, un contrato agregado para contratos,
   banco, saldo, traspasos, firmado y cierre anual. Una consulta agregada por
   fuente, sin recorrer paginas ni devolver IDs/ordenes al navegador.
3. Mantener SQL legacy en su adaptador. Excluir alli toda identidad ya presente
   en nativo, aunque su fila nativa este inactiva, caida o eliminada. No contar
   ambas fuentes ni recurrir a legacy cuando nativo no cumple elegibilidad.
4. Resolver etapa actual por la mayor secuencia del historial, incluso si hubo
   retroceso. Los tres checks habilitan Por enviar; no inferir nuevas etapas a
   partir de flags historicos de firma ni datos de ejemplo.
5. Sustituir los cinco ceros provisionales y el consumidor contractual por un
   solo consumidor React. Conservar apariencia, etiquetas y preload por numero.
   Releer al entrar a Home, volver a una ventana visible o reintentar; agrupar
   disparadores simultaneos y descartar respuestas obsoletas.
6. Probar autorizacion, precedencia, respuesta invalida/fallida, ultima secuencia,
   limites anuales y numero acotado de consultas. Simular volumen/concurrencia
   fuera de las BD compartidas; registrar por separado los limites de esa prueba.
7. Revisar diff, ejecutar formato, lint, tipos, pruebas y builds disponibles.

Archivos: nuevo resumen API junto a `contract-summary.*`, adaptador y registro
legacy, registro del modulo, servicio agregado frontend, Home y pruebas
focalizadas. No agregar dependencias, DDL, tablas ni estados nuevos para leer
los codigos de etapa ya definidos.

## Reglas de conteo

- Solo `Formalizaciones cerradas este anio` tiene limite anual. Aprobaciones,
  contratos (ambos subtotales), banco, saldo, traspasos pendientes y traspaso
  firmado no filtran por fecha de creacion, antiguedad ni anio de entrada a la
  etapa. Una orden de un anio anterior sigue contando mientras cumpla las reglas
  de elegibilidad y permanezca en esa etapa. Cambiar de anio no reinicia esos
  pendientes. Las fronteras `period` del JSON se aplican solo a `closedThisYear`.
- Orden valida actual: activa, no caida y sin borrado logico nativo.
- Contratos: tres aprobaciones explicitas completas; sin etapa o etapa inicial
  corresponde a Por enviar. `contract_pending_signature` corresponde a firma
  pendiente. Una etapa posterior no pertenece a ninguno de esos dos grupos.
- Banco, saldo, traspaso y firmado: etapa actual persistida respectivamente
  `bank_management`, `pending_balance`, `pending_transfer`, `transfer_signed`.
  No se inventan subestados ni se exige nuevamente una aprobacion para borrar
  del conteo una etapa posterior que ya esta registrada.
- `transfer_signed` mide esa etapa, no una comprobacion adicional de entrega de
  llaves: el esquema inspeccionado no tiene evidencia independiente para ello.
- Promover una orden legacy a nativo debe preservar su etapa/historial antes de
  dar por migrada su identidad. El lector no recupera una etapa legacy cuando
  ya existe el alias nativo; hacerlo violaria la autoridad acordada. Este corte
  no implementa ni certifica un migrador de ordenes.

- Cierre anual, confirmado por el propietario: acumulado de ordenes que
  completaron el proceso en ese anio. El evento final `closed` registrado por el
  usuario acredita esa finalizacion; no inferirla de aprobaciones, flags ERP ni
  automaticamente de una etapa anterior. Contar cada orden valida una sola vez
  si tiene al menos un evento final con fecha efectiva conocida dentro del anio
  de Costa Rica. Repetir el cierre no duplica el total y reabrir no borra el hito
  anual. Conserva la elegibilidad de actividad/no caida/borrado descrita arriba.
  No sustituir fecha desconocida por importacion. Parametrizar fronteras, sin
  `YEAR()` por fila. No exigir un historial ficticio de todas las etapas para
  contar un cierre final confirmado; validar transiciones pertenece al escritor
  futuro, no a este lector.
- Los otros contadores describen etapa actual; el anual describe un hito. Una
  orden reabierta puede figurar en ambos: no sumar todos los banners como si
  fueran grupos excluyentes. El lector no ejecuta cambios automaticos de estado.

Contrato: `schemaVersion=1`, `observedAt` UTC, `period` con anio/zona/fronteras,
`counts` con `contracts.toSend`, `contracts.pendingSignature`, `banking`,
`balance`, `transferPending`, `transferSigned` y `closedThisYear`; `sources`
contiene los mismos subtotales native/legacy, `legacyEnabled` y
`duplicatesExcluded`. Los endpoints de resumen anteriores permanecen compatibles.

## Frescura y limites

No Redis, cache de contadores, localStorage, totales persistidos ni respuestas
reutilizadas entre peticiones. Cada solicitud autorizada lee la BD y devuelve
`Cache-Control: no-store`. El estado temporal necesario para mostrar una respuesta
en React no es una cache compartida ni la fuente de verdad.

El boton con icono `Recargar banners`, a la derecha de Formalizacion, vuelve a
consultar los resumenes autorizados sin navegar ni refrescar la pagina. Cada
contador muestra su preload. Clicks durante una solicitud en curso comparten esa
solicitud; no inician peticiones duplicadas. Sin rol/permiso para algun banner,
ese consumidor sigue sin montar ni consultar; sin ningun banner autorizado se
oculta el boton. No recarga bandejas ni ejecuta comandos comerciales.

Actualizar al recuperar foco no es actualizacion instantanea entre usuarios.
Sin polling o notificaciones del servidor no puede prometerse que una pagina
abierta cambie por si sola inmediatamente despues de una escritura externa.
Agregar SSE/polling requiere definir su frecuencia y cobertura de escritores;
no se habilita infraestructura especulativa en este corte de lectura.

Una fuente habilitada que falla no debe producir un total parcial presentado
como correcto. Cero verificado, carga y error son estados distintos. Legacy
deshabilitado se identifica en el JSON; no acredita lectura de ambas BD.

## Rendimiento: decisiones y evidencia requerida

Priorizar agregacion SQL, respuesta pequena, consultas acotadas y reutilizacion
del pool. Fastify ya esta instalado: cambiar librerias no elimina un escaneo
o viajes repetidos a MySQL. Reutilizar primero los indices de elegibilidad,
alias nativo y `(orden, secuencia)` existentes en las migraciones.

Antes de proponer nuevos indices, obtener EXPLAIN con parametros representativos,
motor, cardinalidad y distribucion real en un entorno autorizado. La existencia
en un archivo de migracion no demuestra que un indice este aplicado ahora.
No ejecutar DDL ni carga de fixtures en las bases compartidas para este trabajo.

Una simulacion de un millon de registros verifica un modelo de conteo; un doble
de SQL verifica llamadas, contrato y manejo de errores. Ninguno ejecuta el
optimizador MySQL ni certifica p95 de RDS, indices, consistencia entre motores,
pool real o concurrencia con migradores/escritores externos.

### Siguiente medicion, no implementacion especulativa

- Medir separadamente autenticacion, espera del pool, agregados SQL y red; registrar
  p50/p95/p99 en un entorno autorizado antes de fijar un SLA.
- Probar SQL con distribucion representativa de ordenes e historiales solo en una
  base desechable autorizada. No usar produccion/desarrollo compartido como carga.
- Si crece el costo de buscar la ultima etapa, evaluar planes por grupo/maximo o
  una referencia de estado actual en BD mantenida atomica con el historial. No
  sustituir el historial por contadores en memoria ni agregar esa estructura ahora.
- Si domina la latencia de viajes a la BD, medir un unico SELECT que agregue ambas
  fuentes; preservar adaptador legacy, autoridad y snapshot. Dos SELECT constantes
  son la mejora aplicada, no una promesa de tiempo constante con cualquier volumen.
- Cuando se habiliten acciones de estado, su confirmacion debe disparar una nueva
  lectura. La notificacion entre usuarios/escritores externos requiere una decision
  de SSE/sondeo y cobertura; no existe un canal de cambios habilitado por este lector.

## Referencias primarias consultadas

- [NestJS: rendimiento y Fastify](https://docs.nestjs.com/techniques/performance).
- [React: efectos, limpieza y carreras al consultar](https://react.dev/reference/react/useEffect).
- [MySQL: optimizacion de GROUP BY](https://dev.mysql.com/doc/refman/8.0/en/group-by-optimization.html).
- [MySQL: lecturas consistentes InnoDB](https://dev.mysql.com/doc/refman/8.0/en/innodb-consistent-read.html).
- [MySQL: semijoins y antijoins](https://dev.mysql.com/doc/refman/8.0/en/semijoins.html).

## Resultados de esta entrega

### Lectura real acotada, sin escrituras

2026-10-23: usando la configuracion protegida del API (sin imprimir secretos),
se verificaron las cinco tablas consultadas en ambos esquemas como InnoDB:
orden nativa, aprobaciones nativas, historial nativo, ordenventa e historial legacy.
Los dos esquemas fueron accesibles mediante la misma conexion nativa.
Tambien se leyeron los catalogos `conf_sales_order_state` de ambos esquemas:
ambos contienen los nueve codigos, incluidos los siete estados de etapas
contractuales/posteriores consultados y los iniciales `pending_approval` y
`unclassified`. No fue necesario agregar tablas ni estados para este lector.

Los agregados nuevos se ejecutaron dentro de una transaccion READ ONLY /
REPEATABLE READ. Resultado puntual, no valor fijo ni promesa futura:

| Fuente | Por enviar | Firma pendiente | Banco | Saldo | Traspaso | Firmado | Cerradas del anio |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Nativa | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Legacy, sin identidades nativas | 186 | 0 | 0 | 0 | 0 | 0 | 0 |

Duplicados excluidos: 0. Legacy habilitado. La consulta confirma cero firma
pendiente bajo el predicado de etapa actual, no ausencia historica de contratos
firmados ni ausencia de firmas en el ERP.

EXPLAIN FORMAT=JSON de los dos SELECT uso `idx_so_valid`, aprobaciones por PK,
`idx_ov_formalization_summary`, `uq_so_state_sequence` en ambos historiales,
PK del evento y `uq_so_legacy` para autoridad nativa. Estimacion de filas legacy
elegibles por actividad/no caida: 270. No se aplico DDL ni cambio de indice.
El escaneo de la tabla derivada agregada no es por si solo un defecto.

La primera conexion mas transaccion y ambos agregados tomo 813,23 ms en una
observacion local. Incluye conexion/red/TLS; no es tiempo SQL puro, p95 del API,
prueba HTTP autenticada ni benchmark de carga. No se ejecutaron fixtures,
escrituras, EXPLAIN ANALYZE ni pruebas concurrentes contra estas BD.

Despues de confirmar el acumulado anual, se repitieron los dos SELECT y EXPLAIN
con la consulta final: mismos totales, 892,13 ms incluyendo conexion nueva y
snapshot. El lookup adicional de cierres uso `uq_so_state_sequence` en ambas
fuentes. Es otra lectura puntual, no un benchmark ni un cambio de datos.

Smoke HTTP local con el servidor ya existente: `/health/live` 200,
`/formalization/home/summary` sin sesion 401 y `/formalization/contracts/orders`
404. Frontend existente escucha en `http://localhost:5173`. No se inicio una
sesion real ni se ejecuto una operacion comercial; el caso HTTP autorizado se
prueba con identidad/repositorios sustituidos, distinto de los SELECT reales.

### Simulacion reproducible sin BD

Desde `apps/api`:

```powershell
pnpm exec tsx scripts/performance/home-summary-benchmark.ts 500
```

Con la regla final de acumulado anual, dos modelos JavaScript independientes
compararon conjuntos deterministas de
100.000 y 1.000.000 registros con historiales desordenados, aprobaciones,
retrocesos, fechas desconocidas, limites anuales y aliases nativos. La generacion
y el conteo del modelo ocurren fuera del tiempo HTTP medido. No ejecutan SQL.

Se midieron 6.000 solicitudes y 80 de calentamiento usando una ruta delgada
Fastify con servicio/repositorios reales, identidad y resultados SQL sustituidos,
pool FIFO simulado de diez conexiones y demoras artificiales de 0/20 ms por
fuente. Concurrencia 1, 10 y 50. Cero errores, dos llamadas de fuente por peticion,
maximo diez conexiones simuladas, cola maxima 40 y todas liberadas al terminar.
RSS pico observado del proceso: 276,28 MiB. Se registraron 12.000 llamadas de
fuente, exactamente dos por peticion medida. La preparacion de ambos modelos
del conjunto de un millon tomo 2.188,89 ms fuera del tiempo HTTP.

Resultados finales locales con concurrencia 50:

| Registros del modelo | Demora por fuente | p50 ms | p95 ms | p99 ms | Peticiones/s |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 100.000 | 0 ms | 9,79 | 16,24 | 16,39 | 4.559 |
| 100.000 | 20 ms | 278,29 | 301,55 | 309,17 | 178 |
| 1.000.000 | 0 ms | 8,95 | 13,44 | 13,56 | 4.972 |
| 1.000.000 | 20 ms | 267,64 | 303,52 | 315,11 | 182 |

Log local bruto de esta repeticion:
`C:/codex-data/audit-reports/home-summary-cumulative-pool10-500-20261023-092052.log`.

Estas cifras no significan que MySQL cuente un millon de ordenes en 9 ms: el doble
devuelve agregados previamente calculados. Verifican concurrencia de aplicacion,
contrato, llamadas acotadas y liberacion del pool simulado. No miden seguridad
HTTP productiva, transporte de red, consultas reales de identidad, pool mysql2,
optimizador ni latencia de RDS bajo carga. El costo SQL puede crecer con filas e
historial aunque el numero de llamadas no crezca. No convertirlas en SLA.

Revision independiente de codigo: sin defectos accionables de alta confianza en
la version estable revisada; no sustituye pruebas de persistencia/concurrencia.
Primera validacion completa se detuvo en formato de una prueba HTTP nueva; se
corrigio el archivo. La siguiente corrida completo formato, lint, tipos, tests y
builds: API 5.226 correctas / 113 MySQL omitidas, frontend 584 correctas. Es evidencia
anterior a la aclaracion final del acumulado anual.

### Validacion final posterior a la aclaracion anual

`check-all.cmd` termino con codigo 0 despues de aplicar y revisar la regla anual:

| Comprobacion | API | Frontend |
| --- | --- | --- |
| Formato, lint y tipos | Aprobado | Aprobado |
| Tests | 5.230 correctas / 113 MySQL omitidas | 584 correctas |
| Build | Aprobado | Aprobado |

Duracion de tests: API 22,28 s; frontend 126,61 s. `git diff --check` correcto.
Los flags de fixtures MySQL, fallback y escrituras se apagaron solo en el proceso
de verificacion; no se modifico `.env`. Las 113 omitidas no acreditan persistencia
ni concurrencia MySQL real. Permanecen advertencias del entorno JSDOM para
pseudo-elementos y del bundle Ant Design mayor a 500 kB; no son errores de tests
ni quedaron resueltas por este cambio de contadores.

Log local final:
`C:/codex-data/audit-reports/CRM-TINK-Home-2026-10-23-check-all-annual-final.log`.
La simulacion con la regla final se ejecuto antes de esta corrida completa, sin
competir con ella. No se hicieron commits, push, despliegues, cambios de privilegios,
migraciones ni mutaciones comerciales. La nueva ruta es solo lectura; los
comandos/listados siguen sin registrar.

### Recarga manual de banners - 2026-10-23

Ampliacion posterior exclusivamente frontend: boton con icono y tooltip al final
del encabezado Formalizacion. Reutiliza ambos servicios, gates y promesas en
curso; invalida solo sus efectos de lectura, no remonta la pagina ni modifica
estados comerciales. No agrega endpoint, dependencia ni cambio en BD.

TDD: tres casos nuevos fallaron por ausencia del boton y luego pasaron; el caso
sin autorizacion confirma que no existe boton ni consulta. Verificados recarga
conjunta, recarga parcial segun permisos, preload y clicks repetidos sin duplicar.
`pnpm check` frontend: formato, lint, tipos, 588 tests y build correctos. La primera
corrida encontro complejidad/expresion void del encabezado; se corrigio separando
su componente antes de repetir todo. `git diff --check` correcto. Se conserva
la advertencia previa del bundle Ant Design.

QA visual en contexto aislado con respuestas HTTP sustituidas, no sesion real:
viewports medidos 1800 y 375 px, boton 40x40 sin solapar titulo ni desbordamiento
horizontal. Recarga observada sin navegacion, siete preloads de etapas con demora
simulada y dos llamadas totales de etapas tras carga inicial mas recarga doble.
El caso conjunto con aprobaciones se verifica en las pruebas de componente.
