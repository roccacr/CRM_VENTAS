# CI y gate MySQL

## Alcance

.github/workflows/quality.yml configura GitHub Actions para push, pull_request y
ejecucion manual. Dos jobs independientes ejecutan pnpm check para API/frontend,
con Node 22, pnpm 10.28.2 y lockfiles separados. No instala Docker, despliega,
ejecuta migraciones, restaura Owner ni usa secretos de produccion.
Las acciones estan fijadas por SHA; actualizarlas requiere revision.

La configuracion esta preparada en el arbol local, no activada en GitHub:
no se hizo commit/push ni se cambiaron settings del repositorio.
El primer checkout remoto solo sera reproducible cuando todos los archivos
necesarios, incluidas las funcionalidades anteriores, esten versionados.
No mezclarlos en un commit unico de remediacion.

## Habilitacion por el administrador del repositorio

1. Identificar el servidor de pruebas autorizado, separado de produccion, y
   validar su UUID por un canal independiente. El nombre CRM_THINK_V2 solo no
   demuestra aislamiento: el runtime exige ese nombre incluso en pruebas.
2. Preparar schema y configuracion nativa para las cinco suites revisadas.
   La autorizacion vigente es exclusivamente CRM_THINK_V2: no abrir
   crmdatabase-api, no ejecutar DDL ni migraciones desde el runner.
   El resto de suites requiere revision independiente; algunas esperan legacy
   con proyecto Amara, al menos 51 expedientes y tipos A/B/C. Esos datos NO
   se importan ni consultan en esta entrega.
3. Crear el environment GitHub crm-mysql-tests con revisores obligatorios y
   restricciones de ramas. No conceder secretos a PRs no confiables; no usar
   pull_request_target para ejecutar codigo propuesto.
4. Configurar estos secretos en ese environment: MYSQL_TEST_DB_HOST,
   MYSQL_TEST_DB_USER, MYSQL_TEST_DB_PASSWORD y MYSQL_TEST_SERVER_UUID.
   El usuario debe tener privilegios solo sobre las bases de pruebas necesarias.
   Las suites de catalogos/migraciones con DDL quedan fuera del grupo permitido:
   el rollback no protege DDL en MySQL.
5. Configurar MYSQL_TEST_DB_PORT y MYSQL_TEST_DATASET como variables del
   environment. La conexion remota requiere TLS verificado; certificados privados
   requieren provisionar una CA confiable en el runner antes de habilitar el job.
6. Solo despues de revisar destino, fixtures y permisos, establecer la variable
   de repositorio CRM_MYSQL_TESTS_READY=true. No habilitarla para aparentar verde.
7. Hasta cerrar Q05, hacer obligatorios SOLO Quality / api y Quality / frontend.
   MySQL es informativo: no agregar sus checks a la proteccion de ramas.
   El workflow conserva fallos y resumen de MySQL, pero continue-on-error impide
   que bloqueen el resultado global de calidad. Un resultado informativo no
   significa que persistencia este aprobada. No se cambiaron settings remotos.

## Marcador de aislamiento

El runner verifica SELECT @@server_uuid contra el valor aprobado y exige una fila
de metadata en la BD de pruebas. No crea el marcador ni importa fixtures.
Este DDL ilustrativo debe revisarlo y ejecutarlo el responsable SOLO sobre el
destino de pruebas aprobado, nunca sobre la base actual ni produccion:

```sql
CREATE TABLE crm_ci_test_environment (
    purpose VARCHAR(32) NOT NULL PRIMARY KEY,
    dataset_id VARCHAR(128) NOT NULL
) ENGINE=InnoDB;
INSERT INTO crm_ci_test_environment (purpose, dataset_id)
VALUES ('isolated-tests', 'identificador-del-dataset-aprobado');
```

El valor debe coincidir con MYSQL_TEST_DATASET. El marcador ayuda a evitar
errores operativos; no reemplaza validacion independiente, permisos minimos ni
aprobacion del servidor. El script bloquea cualquier .env local y requiere
CI=true, GITHUB_ACTIONS=true y confirmacion explicita. No es un comando para
activar las suites contra el .env del desarrollador.

## Ejecucion y criterio de aprobacion

En CI se ejecuta pnpm test:mysql:ci desde apps/api. El runner:

- Comprueba configuracion e identidad del destino con SELECT, antes de fixtures.
- Descubre todos los archivos .mysql.spec.ts para detectar cobertura pendiente,
  pero ejecuta solo el grupo nativo revisado: lifecycle de ordenes, gestion de
  acceso, sesiones HTTP locales y changelog de identidad/catalogos.
  Activa sus flags y fuerza ENABLE_LEGACY_FALLBACK=false y nombre legacy vacio.
- Ejecuta las suites en serie para limitar interferencia y conexiones.
- Requiere salida exitosa, todas las suites permitidas presentes, al menos una
  prueba por suite y todas las aserciones aprobadas. Cero pruebas, skips, todo,
  errores o archivos ausentes no pasan el gate. Si quedan suites descubiertas
  fuera del grupo revisado, el resultado es parcial y el gate completo falla
  con BLOQUEADO POR ALCANCE aunque el grupo nativo pase.
- Publica solo coverage/mysql-ci-summary.json, sin conexiones, credenciales ni
  reportes detallados con potenciales datos sensibles. El directorio coverage
  esta ignorado por Git. El resumen puede mostrar partial y suites no verificadas;
  publicarlo no convierte ese resultado parcial en aprobacion.

Si READY no es true, o es un PR de un fork, el gate de disponibilidad falla con
BLOQUEADO POR INFRAESTRUCTURA y la persistencia no se ejecuta. Los jobs de calidad
continuaran y pueden aprobar independientemente: MySQL es informativo mediante
continue-on-error y no debe ser obligatorio en proteccion de ramas hasta Q05.
Su fallo sigue siendo evidencia de persistencia NO verificada. Si falta UUID/marcador,
TLS o credenciales, persistencia falla antes de ejecutar las suites.
Los fallos de las pruebas no se convierten en omisiones ni en exito.

## Verificacion local y pendientes

Las pruebas unitarias test/ci/mysql-ci.spec.ts cubren configuracion ausente,
confirmacion incompleta, reporte vacio, suites faltantes y tests omitidos/fallidos.
Se verifico tambien el formato JSON con un reporte real de Vitest 5 sin conectar
a MySQL. Eso verifica el gate, no la persistencia.

El usuario autoriza exclusivamente CRM_THINK_V2 de apps/api/.env. La conexion
nativa respondio. Se ejecutaron cinco suites rollback-only con legado
deshabilitado: la primera corrida tuvo 29 pruebas aprobadas y una fallida.
El fallo era la asercion generica /password/ que rechazaba el booleano permitido
localPasswordAssigned. Se excluye solo ese campo cuando es booleano; se conserva
la prohibicion de contrasenas, hashes, tokens, secretos y provider_subject.
Se reejecuto completo el archivo afectado: nueve pruebas aprobadas.
Asi quedan verificadas 30 pruebas distintas en cinco archivos, no las 113.
No se ejecuta el runner CI contra ese .env: este continua exigiendo
configuracion remota explicita y ausencia de dotenv local.
No se ejecutaron DDL, migraciones ni conexiones legacy desde esta entrega.
Los conteos observados antes y despues coinciden: dos usuarios y cero ordenes,
eventos de estado y eventos de aprobacion. Los fixtures fueron revertidos,
pero se consumieron valores AUTO_INCREMENT en esa base. Es un efecto real de
las pruebas: rollback y conteos coincidentes no equivalen a "sin cambios".
No se cuantifican los IDs consumidos porque no se capturaron las secuencias
previas. No reiniciar ni corregir secuencias para ocultar esos huecos.
Q04 necesita una ejecucion remota real para cerrar la activacion operativa;
Q05 necesita evidencia de todas las suites MySQL ejecutadas sin omisiones;
las suites fuera del alcance autorizado no pueden cerrarse por este resultado.

Verificacion final local: check-all.cmd aprobado con formato, ESLint,
TypeScript y build de ambas apps; 4457 pruebas API y 426 frontend aprobadas.
La corrida general conserva 113 omisiones por flags; la evidencia real de
30 pruebas nativas anterior es una ejecucion separada, no esta incluida en ese
conteo general. YAML parseado por Prettier; sin ejecucion remota en GitHub.

Referencias:
- https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md
- https://vitest.dev/guide/reporters

## Clasificacion confirmada por el propietario

El 2026-10-22 el propietario confirma CRM_THINK_V2 como desarrollo/en
construccion, con datos que no se pueden perder. crmdatabase-api es produccion
y fuente de la migracion progresiva. Ambas configuraciones usan el mismo host
RDS; la BD de desarrollo no se presenta como servidor fisicamente aislado.
No ejecutar mas fixtures ni DDL por el mero hecho de llamarse desarrollo.
CI necesita un destino/dataset de pruebas explicitamente preparado, distinto
de los datos de desarrollo que deben conservarse. La clasificacion es la
declaracion del propietario, no una certificacion externa de infraestructura.
Esta revision no abre conexiones a ninguna de las dos BD.

## Runner verificado con dobles

test/ci/mysql-ci-runner.spec.ts simula conexion MySQL, filesystem y procesos.
Cubre configuracion runtime invalida, fallo de conexion, UUID incorrecto,
marcador ausente/erroneo, fallo de lectura del marcador, cierre de conexion,
rechazo de dotenv local, ejecucion correcta, fallo del proceso hijo y resultado
parcial. Verifica que spawnSync nunca se invoque tras un fallo de preflight.
Las 14 pruebas combinadas de politica y runner pasaron sin MySQL real.

## Criterio de checkout reproducible antes de activar CI

No activar CI remoto hasta tener los cambios necesarios versionados en commits
separados y con dependencias explicitas. La prueba de aceptacion es:

1. Clonar la rama candidata en una carpeta nueva y vacia, sin copiar archivos
   locales, .env, node_modules ni cambios sin seguimiento del checkout actual.
2. Registrar git rev-parse HEAD del clon.
3. Desde apps/api ejecutar pnpm install --frozen-lockfile y pnpm check.
4. Desde apps/frontend ejecutar pnpm install --frozen-lockfile y pnpm check.
5. Confirmar git status --porcelain vacio tras las verificaciones y registrar
   codigos de salida, omisiones MySQL y logs sin secretos.

Si falta cualquier archivo versionado o falla un check, no se considera
reproducible ni se activa CI remoto. Un check del arbol sucio no sustituye esta
prueba. Sigue pendiente: no se hicieron commits, clon candidato ni push.

## Decision de S01

El proveedor de correo y su responsable se configuraran despues, segun el
propietario. No habilitar envios ni simular confirmaciones de entrega.
La salida de deshabilitar honestamente la recuperacion se aplicara en S01;
en esta entrega no se modificaron endpoints de autenticacion.

## Evidencia de esta revision

check-all.cmd aprobado: 4467 pruebas API y 426 frontend, formato, ESLint,
TypeScript y ambos builds. Las 113 pruebas MySQL se deshabilitaron explicitamente
en el entorno del comando; no se abrieron conexiones reales ni se repitieron
fixtures. Las 14 pruebas de politica/runner estan incluidas en el total API.
YAML revisado con Prettier y git diff --check sin errores.
No se hicieron commits, clon candidato, push ni cambios de settings remotos.
