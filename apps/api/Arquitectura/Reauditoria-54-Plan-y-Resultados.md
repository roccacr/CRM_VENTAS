# Reauditoria: plan y resultados verificables

## Carácter histórico y precedencia — revisión 2026-11-03

Este documento conserva decisiones, pendientes y resultados de sus cortes fechados; no es una nueva medición ni un inventario exhaustivo del checkout actual. Para migraciones hasta 067 prevalece [03](03-Base-Datos-y-Migracion.md); para el perfil federado [77](77-Perfil-Completo-Lead.md), y para permisos/nota/marcado manual de adéndum [84](84-Adendum-Manual-Migracion-066-y-Permisos.md). 067 concede el default manual a Owner/Jefe General/Jefe de Formalizaciones mediante grants reales, manteniendo deny y la excepción al comodín Owner; no al rol operativo Formalización.

Las pausas, bypass antiguos, conteos de pruebas/rutas/migraciones y propuestas de importación inferiores no sustituyen los contratos posteriores. No se reejecutaron aquí suites, BD, fixtures, restauraciones, integraciones ni despliegues; la documentación no cierra Q 05, CI remoto o aceptación productiva.

> Continuidad documental 2026-10-23: [49 - Estado actual](49-Estado-Actual-y-Cierre-Documental.md)
> consolida cambios posteriores de producto. Las mediciones siguientes son
> historicas de cada corrida: este cierre no repite check-all/cobertura ni
> acredita una nueva nota, despliegue, CI remoto o concurrencia MySQL.

## Plan central F01-F13 - 2026-10-23

Fuente: auditoria independiente `C:/codex-data/audit-reports/CRM-TINK-Auditoria-2026-10-22.md`. Sus F01-F13 pertenecen a esa auditoria; no renumeran los identificadores de planes anteriores. Remediacion local ejecutada con seis agentes implementadores, cuatro revisores independientes y coordinador. El cierre de codigo/documentacion se apoya en las verificaciones nuevas siguientes; no equivale a certificacion productiva ni sustituye las pruebas MySQL pendientes.

| Orden / responsable | Remediacion minima y regresion requerida | Estado de validacion nuevo |
| --- | --- | --- |
| 1 / security y data | F01 sanear URL/query OIDC conservando trazabilidad; F02 frontera de lockout 3->4->5 y evento; F03 rechazar tipos invalidos en detail conservando omitido/vacio/null. | Implementado; regresiones, contrarrevision y gate API aprobados. |
| 2 / directory | F04 retirada Microsoft efectiva, primer enlace sin recuperar acceso retirado, actor administrativo real y omision que conserva estados; F05 MFA unknown/No verificado. | Implementado; regresiones, inyeccion, contrarrevision y gate aprobados. Sin tenant ni usuarios reales. |
| 3 / session y mobile | F06 generaciones en login/logout/refresh/perfiles, sin respuestas/eventos/replays de otro contexto; F07 filtros/hash conservados; F08 ciclo de foco y cierre al pasar a escritorio. | Implementado; carreras, retry, logout y teclado probados. Revision cruzada sin bloqueantes; frontend integral aprobado. Sin ensayo real de cookies/lector de pantalla. |
| 4 / data | F09 migracion 021 fail-closed ante tablas previas sin ledger, con dobles y SQL compilado. | Implementado y probado sin conexiones. No se ejecuta DDL ni se afirma drift real. |
| 5 / coordinador | F10 adaptador de estilos idempotente, aserciones observables y maxWorkers=2. Sin subir timeouts, retries o exclusiones. | Cinco corridas completas de 507 pruebas y cobertura aprobadas, con carga registrada. |
| 6 / docs | F11 runbook central; F12 dos banners reales/cinco provisionales; F13 defaults distintos del snapshot y produccion desconocida. | Corregido; contrarrevision documental, enlaces y diff aprobados. |

Antes de editar: inspeccionar instrucciones, producto/indices, archivos y reutilizacion de cada area; cada propietario concreta sus archivos y el parche minimo. Conservar Home-only, bandejas vacias, reglas, permisos y autorizacion backend existentes. No activar list/send/revert. Workspace compartido y sucio: no revertir cambios ajenos ni editar fuera del ownership sin coordinacion.

No commits/push/deploy, dependencias, `.env`, DB/conexiones, fixtures reales ni DDL. Cada agente ejecuta solo pruebas focalizadas de su area; el coordinador realiza revision cruzada y `.\check-all.cmd` serial, mas cobertura/carga integral. Registrar comandos exactos, salidas, omisiones y limites antes de declarar cierres. No se certifican produccion, persistencia MySQL ni 13 hallazgos resueltos por tener parches locales.

### Evidencia final nueva

Gate integral final del coordinador: `.\check-all.cmd` Exit 0 con 24 flags MySQL en 0 y fallback/auditoria/escrituras desactivados solo en el proceso de pruebas. Formato, lint, typecheck, tests y build de ambas apps aprobados: API 5194 aprobadas y 113 MySQL omitidas; frontend 507/507, 36 archivos. La corrida del gate mas cuatro repeticiones seriales dieron cinco aprobaciones completas con el mismo codigo. Vitest: 106.45, 106.96, 106.05, 105.58 y 106.07 s.

Cobertura final: API 5194/113 omitidas, statements 72.04%, branches 60.37%, functions 78.03%, lines 74.28%; frontend 507/507, statements 83.95%, branches 75.76%, functions 83.57%, lines 85.75%. Ambos comandos test:coverage terminaron con Exit 0. pnpm audit completo de ambas apps: cero avisos en esta consulta; no equivale a pentest ni a ausencia de defectos.

F10: el helper de `getComputedStyle` acumulaba wrappers; la regresion de 100 instalaciones fallo antes del fix. El adaptador estable y la asercion de `aria-invalid` evitan depender del DOM animado. MaxWorkers=2 acota concurrencia, no es un limite estricto de CPU/RAM. Las repeticiones finales muestrearon CPU maxima 25-34% y al menos 10017 MiB libres; son condiciones de esta maquina, no prueba causal ni benchmark productivo. La cobertura frontend tardo 152.79 s de Vitest. Manifiesto de 141 archivos de fuente/pruebas/configuracion sin cambios durante el gate y repeticiones.

La revision cruzada tambien corrigio resize que dejaba inert, perfiles/login/refresh tardios, retry retenido, logout pendiente, replay cruzado y actor de revocacion incorrecto. Dos errores de tipos en nuevas pruebas se corrigieron antes del gate. Los lotes intermedios detenidos y sus fallos no se convierten en evidencia final; logs/metricas/manifiestos se conservan en `C:/codex-data/audit-reports/CRM-TINK-Remediacion-2026-10-23` y el informe hermano `.md`.

Limites: 113 pruebas MySQL omitidas, sin DDL/fixtures/concurrencia real, restore ni inspeccion productiva. Sin cambios de .env, credenciales, grants, dependencias, commits, push o deploy. No se certifican clon limpio ni CI remoto del arbol con cambios previos. El warning existente de vendor-antd de 1050.81 kB minificados sigue visible; no se oculto subiendo el limite. Para F11-F13 consultar [operacion](Operacion-Despliegue-Rollback.md), [README](../../../README.md) y [resumen frontend](../../frontend/Arquitectura/01-Resumen-Frontend.md).

## Antecedentes de remediacion - 2026-10-22

Fecha: 2026-10-22. Fuente: auditoria adjunta de 54/100. Esa nota usa una escala
distinta de la anterior; no demuestra una regresion. Este informe no asigna nota.

## Continuidad tras reauditoria de 65 puntos - 2026-10-22

Este corte posterior prevalece sobre el estado inicial de S04 y los conteos de
pruebas de las secciones historicas siguientes. No asigna una nota nueva ni
acredita despliegue, BD real o ejecucion remota de CI.

- Dependencias: audit reprodujo un aviso bajo de Fastify y uno moderado de
  ip-address. Commit `936a51a` fija Fastify 5.12.6 directo y dentro de Nest, e
  ip-address 10.7.4 solo dentro de rate-limit. Ambos audits API (completo y prod)
  pasan sin avisos conocidos; frontend completo y prod tambien. El lockfile solo cambia
  esas versiones/overrides. No se atribuye una fecha de publicacion nueva a los
  avisos ni se convierte el resultado anterior en garantia permanente.
- Documentacion: `f02e9f5` confirma las 78 revisiones pendientes de la pasada
  anterior. Se normalizaron cinco Markdown con CRLF a LF conforme a la regla
  existente; no se modifico la politica de finales de linea ni archivos ajenos.
- Autorizacion: `f9ba243` agrega RequirePermission y resolver acotado a los 49
  handlers permission. Sin descriptor o sin grant correcto se rechaza antes
  del handler; deny gana. Los controles de servicio, membresia, recursos,
  asignacion condicional y transacciones no se retiran. Auditoria conserva la
  excepcion previa de Owner activo, pero deny explicito de role.assign ahora
  bloquea HTTP. No se otorgan permisos nuevos ni se resuelven scopes por proyecto.
- Las regresiones HTTP prueban permiso ausente/ajeno, deny incluido Owner,
  aliases, metadatos faltantes, mapas positivos, estados condicionales y siguiente
  request tras revocacion. La matriz usa controladores registrados y servicios
  sustituidos para comprobar cero ejecucion del handler/dominio denegado;
  las suites de identidad/catalogos reales complementan esos dobles. No prueba
  persistencia ni revocacion en una BD real. Contexto de seguridad no resoluble
  devuelve 403; DTOs mantienen validacion cuando el contexto es autorizable.
- Verificacion propia: check-all completo con salida 0, API 4866 aprobadas y
  113 MySQL omitidas; frontend 428 aprobadas. Formato/lint/tipos/build aprobados
  en ambas apps. Dos intentos iniciales se detuvieron por formato de archivos
  nuevos y fueron corregidos antes de la corrida completa; no hubo fallo de
  tests ocultado. Las 24 banderas de fixtures detectadas se forzaron a 0 y
  lectura/escritura legacy a false en los procesos de pruebas.
- Cobertura API V8 completa: lineas 70.48% (2758/3913), ramas 54.36%
  (1612/2965), statements 68.18%, funciones 75.17%. AuthGuard tiene 100% de ramas
  (14/14), resolver de permisos 92.18% (59/64), IdentityService 78.76% (115/146).
  El global sigue limitado; estos porcentajes no equivalen a seguridad probada
  de todas las reglas ni cierran Q05. Frontend no cambio funcionalmente.
- Revision independiente estatica del guard, mapas y pruebas: sin hallazgos
  accionables; no sustituye las corridas propias ni un pentest.
- Cache entre requests queda como candidata a medir, no falta automatica. El
  supuesto costo de cinco consultas no se presenta como benchmark realizado.

Regla de producto confirmada en este turno: las tres aprobaciones completas
inician Contratos pendientes / Por enviar, solo en CRM. Existencia en nativo
implica gestion/escritura solo nativa; ausencia implica gestion en legacy, no
doble escritura. Ver [regla y limites](38-Ordenes-Venta-Estados-Auditoria.md).
Se documenta sin ejecutar mutaciones: quedan por definir permiso de aprobacion,
acciones posteriores y concurrencia de migracion antes de habilitar el flujo.
No se hicieron push, cambios remotos, SQL, fixtures, grants ni conexiones DB.

Clon candidato preparado en `C:/codex-data/tmp/crm-tink-permissions-20261022`
desde commits locales, sin copiar .env ni archivos no versionados. Instalaciones
frozen/offline de ambas apps aprobadas. Check-all del clon en `f9ba243` tambien
paso con 4866 pruebas API, 113 MySQL omitidas y 428 frontend, formato/lint/tipos
y ambos builds. Git status vacio antes y despues; no es CI remoto ni prueba
del runner Linux. El cierre documental posterior no cambia codigo ni lockfiles.
Persisten avisos no bloqueantes de jsdom y chunk Ant Design de 1050.81 kB.

## Plan de ejecucion

1. Contener acceso productivo desde desarrollo: revisar `.env`, gate compartido,
   seis writers y pruebas existentes. Mantener lectura separada de escritura.
2. Corregir reset simulado y bypass Owner reutilizando contratos y pruebas HTTP.
3. Inventariar rutas reales antes de autenticacion global; reutilizar perfil solo
   dentro de una peticion, sin cache global ni persistencia de permisos obsoletos.
4. Corregir historial, aislamiento de errores, carga diferida y esperas del cliente.
   No cambiar el diseno del dashboard ni inventar flujo comercial.
5. Incorporar salud, errores sanitizados, cobertura, dependencias y runbook.
6. Verificar cambios completos, separar commits locales autorizados y comprobar
   instalacion frozen y checks desde clon limpio. No push ni despliegue.

Archivos: adaptadores `integrations/legacy-crm`, identidad, seguridad comun,
expedientes, bootstrap, App/rutas/frontend, configuracion Vitest/CI y documentacion.
Se reutilizan Kysely, Fastify, validacion Zod, permisos efectivos y tests existentes.
No se ejecutan fixtures, DDL, migraciones, grants ni cambios en datos reales.

## Alcance y clasificacion

- `CRM_THINK_V2`: desarrollo con datos importantes, no instancia desechable.
- `crmdatabase-api`: produccion. Comparten host; no constituye aislamiento.
- Las pruebas reales previas consumieron AUTO_INCREMENT pese al rollback. No se
  repitieron en esta entrega ni se reiniciaron secuencias.
- Un cambio local no demuestra despliegue activo, usuario MySQL read-only,
  cabeceras reales del frontend o disponibilidad de servicios externos.
- Un archivo grande, OFFSET o dos librerias no es por si mismo una vulnerabilidad.
  Requieren medicion y comparacion funcional, no reescritura por una nota.
- Leads/clientes/oportunidades no definidos para esta fase no se implementan
  como una supuesta correccion tecnica de Formalizacion.

## Matriz de hallazgos del corte inicial (ver continuidad anterior)

| Hallazgo | Entrega y criterio de cierre |
| --- | --- |
| Desarrollo expuesto y escritura legacy | `.env` local vuelve a loopback/fallback=false; seis writers requieren entorno production y opt-in de escritura booleano, aparte de lectura. Pruebas sin SQL en desarrollo. Reiniciar proceso existente para aplicar bind/entorno. |
| Credenciales compartidas | Pendiente DBA: preparar cuentas separadas con SELECT sobre legado, permisos nativos minimos y prueba de compatibilidad antes de rotar. No alterar credenciales compartidas ni grants desde este trabajo. |
| Reset aceptado sin envio | S01: opcion honesta deshabilitada, 503 uniforme incluso al alcanzar limites; sin buscar cuenta ni simular entrega. Completar token valido conserva contrato. Correo real pendiente del proveedor pospuesto. |
| Bypass Owner | S05 parcial: permiso exacto obligatorio y deny prevalece antes de lecturas; exencion de pertenencia de Owner se conserva. |
| Scopes proyecto/area | Pendiente decision de modelo usuario/proyecto; filtrar proyectos no equivale a autorizarlos. Aceptacion: lista/detalle/opciones/facetas de ambas fuentes impiden acceso cruzado. |
| Rutas sin clasificar | Q08: inventario del grafo real Nest, metodos y aliases; falla con handler nuevo sin clasificacion. |
| Guard global / permisos | S03 implementado y probado: denegacion por defecto, excepciones publicas explicitas, CSRF primero. F07 intrapeticion comparte perfil por instancia/token exacto y recarga en siguiente request. S04 sigue parcial: permiso exacto y fila se validan en servicios; la etiqueta permission no sustituye esas comprobaciones. |
| Lockout 5 fallos/15 min | S02 pendiente: preservar defensa distribuida hasta acordar recuperacion segura del ultimo administrador y probar enfriamiento. No eliminar lockout para mejorar una nota. |
| Passwords / inactividad | S06/S08 pendientes de politica y criterios de compatibilidad; no imponer plazos arbitrarios ni invalidar sesiones existentes. |
| Rate limit memoria / lecturas | S09 implementado por proceso para GET/HEAD protegidos: cuotas independientes por usuario verificado e IP, 429/Retry-After. Defaults iniciales 120/600 por minuto, cache 5000 por contador, sin benchmark de capacidad. S10 pendiente: reinicio/eviccion/replicas no comparten contadores; autenticacion se valida antes del limite, no limita su propio costo de DB. |
| Microsoft | Vinculo existente usa subject; diagnostico de identidades reales solo lectura y con autorizacion. No migracion automatica de cuentas. |
| Consulta completa de proyectos | D06 parcial: seleccion por IDs en SQL para lista/opciones/facetas; selector conserva contrato. Falta EXPLAIN y carga representativa aislada. |
| OFFSET / pool fijo | Medicion pendiente; cambiar cursor o pool sin volumen/topologia puede romper contratos o saturar servidor compartido. |
| Frontend historial / errores / lazy / espera | F01-F04 implementados con pruebas de Atras/Adelante, redireccion replace, recuperacion de render/chunk y retry explicito. Loader solo mientras existe trabajo real. Build genera paginas separadas; ver mediciones debajo. |
| Formalizacion DEMO | F05: retirar datos demostrativos de vistas operativas, sin convertir cero provisional en metrica conectada. P02-P04 siguen pendientes de flujo real. |
| Cobertura ausente | Q06: proveedor V8 dev-only, scripts y artefactos CI para src; registrar medicion antes de decidir umbrales. |
| Dependencias | S12: audit completo y de produccion, analizar avisos antes de parches dirigidos; ninguna actualizacion automatica masiva. |
| MySQL sin verificar | Q05 bloqueado por instancia aislada preparada; 113 omisiones no son aprobaciones. Runner/preflight solo dobles en esta entrega. |
| CI / checkout | Q04: workflow local; usuario autoriza commits separados, no push. Clon limpio local no equivale a CI remoto activo. Solo Quality/api y Quality/frontend obligatorios; MySQL informativo. |
| Health/readiness | O01 implementado: liveness sin IO, readiness SELECT nativo con respuesta de un segundo y una consulta pendiente maxima, sin requerir legacy; pruebas con dobles. El timeout no cancela el driver ni comprueba esquema. |
| Errores globales | O02 implementado: conserva 4xx y sanitiza 5xx, correlacion generada/log seguro sin SQL ni secretos. 503 estatico compartido entre filtro y hook de reset. |
| Operacion / rollback | O03: runbook basado en scripts reales, supervisor e infraestructura pendientes de validacion. No down destructivo ni restauraciones ejecutadas. |
| Catalogos duplicados / archivos grandes / CSS / supresiones | A01-A06 pendientes: piloto con contratos equivalentes y diff visual, no mezclar refactor estructural con seguridad ni borrar documentacion util. |
| DataTables/Ant Design | F06 requiere prueba de equivalencia, accesibilidad y rendimiento antes de retirar dependencia. |
| CSP frontend | S11 requiere respuesta del servidor real, que no vive en este checkout; Helmet API no certifica el host frontend. |
| Producto comercial | P01 matriz en runbook; P02-P05 requieren reglas y alcance aceptados. Persistencia de estados no es flujo completo implementado. |

## Evidencia de ejecucion del corte inicial

Consolidacion posterior del mismo cierre: `.\check-all.cmd` tambien paso en el
clon actualizado al commit documental `f2dc4f1`, con estado Git limpio. Los
resultados de la tabla corresponden a esa serie verificada; no se reejecutaron
durante la revision exclusivamente documental descrita al final.

Comando oficial desde raiz: `.\check-all.cmd`, salida 0 en arbol de trabajo y
clon limpio de `7572b97`. Tras el ultimo ajuste de metadatos de reset, `pnpm check`
API paso de nuevo en el clon actualizado a `056f9d0`, con una prueba adicional.
El frontend no cambio entre esos commits. Todos los flags de
suites MySQL se fijaron a 0 y ambos flags legacy a false en el proceso de pruebas.

| Verificacion | API | Frontend |
| --- | --- | --- |
| Formato / ESLint / TypeScript | Aprobados | Aprobados |
| Pruebas generales | 4583 aprobadas; 113 MySQL omitidas, 21 archivos | 428 aprobadas, 31 archivos |
| Build | Aprobado | Aprobado |
| `pnpm test:coverage` | Aprobado; mismas 4583 pruebas y 113 omitidas | Aprobado; mismas 428 pruebas |
| Cobertura lineas | 69.99% (2715/3879) | 84.77% (3459/4080) |
| Cobertura statements | 67.61% | 83.08% |
| Cobertura branches | 53.40% | 74.86% |
| Cobertura funciones | 73.82% | 82.97% |
| `pnpm audit --prod` | Sin avisos conocidos | Sin avisos conocidos |
| `pnpm audit` completo | Sin avisos conocidos | Sin avisos conocidos |

Cobertura V8 incluye src; excluye entradas main y tipos declarativos API o .d.ts
frontend. No incluye persistencia real omitida. Reportes locales en
`apps/api/coverage` y `apps/frontend/coverage`, ignorados por Git; CI prepara
artefactos. No hay umbral minimo inventado: Q06 medicion/configuracion resuelto,
politica de umbrales pendiente de linea base revisada. En fallos de checks o
tests puede no generarse reporte; upload always no garantiza archivo existente.

Pruebas focalizadas adicionales: 51 para gate y seis writers, 50 para seleccion
de proyectos/servicio de expedientes. Los tests HTTP del guard verifican 401,
403, 429/Retry-After, ausencia de ejecucion del handler bloqueado, permiso
revocado en la siguiente peticion y una sola carga de perfil compartida con el
servicio. Inventario comprueba el grafo registrado, aliases y allowlist publica.

Se observaron fallos transitorios durante integracion: cobertura frontend inicial
tuvo 13 fallos (timing/importaciones/interacciones), y API inicial cuatro por
respuesta 503 no uniforme entre hook y filtro. Se corrigieron la sincronizacion
de tests de navegacion y el contrato 503; cobertura usa dos workers para limitar
contencion, sin subir timeouts. Las corridas finales anteriores pasan completas.
No se ocultan esas primeras corridas ni se atribuyen a defectos productivos sin
reproduccion. Persisten avisos no bloqueantes jsdom/pseudo-elementos y chunk
Ant Design de 1050.81 kB (gzip 332.61).

Ultimo ajuste: `@HttpCode` del reset seguia declarando 202 aunque respondia 503.
Prueba nueva reprodujo el metadato incorrecto y se cambio a 503. Se corrigio
tambien una referencia de metodo sin binding en esa prueba, sin supresiones;
check API completo y cobertura finales incluyen la prueba adicional.

Build del arbol de trabajo: entrada JS 85.09 kB (gzip 25.00); clon limpio:
84.74 kB (gzip 24.89). Antes 546.14 kB segun build
previo registrado; el total no desaparece, pasa a chunks por ruta. No es una
medicion controlada de latencia. Vite tambien cambio de patch entre builds.

Dependencias: la consulta completa detecto nueve avisos dev-only al incorporar
medicion (incluida una dependencia nueva del proveedor). Se revisaron y aplicaron
parches dirigidos: Vitest/coverage-v8 5.0.3, Vite 8.3.3, source-map-js 1.2.2.
Vite explicito en API fija el peer de Vitest que pnpm mantenia en 8.3.1; no es
un servidor nuevo en runtime. Se conservaron las versiones previas de logging.
No hubo upgrade masivo, audit fix automatico ni cambios de version mayor.
Referencia primaria: [aviso de Vitest](https://github.com/vitest-dev/vitest/security/advisories/GHSA-qxg6-89mg-rqv8).
Un audit limpio no es pentest ni prueba de ausencia de vulnerabilidades.

Contencion local: `.env` permanece ignorado y fuera de commits; fallback=false,
bind loopback. Consulta de sockets confirmo API en `127.0.0.1:3000`, no 0.0.0.0.
No se llamo readiness real ni se abrio conexion DB para estas verificaciones.
Importante: con fallback apagado, el contador devuelve solo fuente nativa y
`legacyEnabled=false`, no un total combinado certificado. Rehabilitar lectura
requiere revisar el usuario read-only con DBA; lectura no habilita escritura.
Writer exige tambien destino legacy configurado; vacio/invalido no ejecuta SQL.
Editar nativo con escrituras legacy apagadas puede producir divergencia: D04
sigue abierto, no se presenta esta contencion como conciliacion implementada.

Revision cruzada: otro responsable reviso gate/writers/D06 sin nuevas regresiones;
otro reviso guard/contexto (lectura estatica, confianza moderada); otro reviso
health/filtro y ejecuto pruebas enfocadas con dobles. No sustituyen pentest ni
verificacion de grants, motores InnoDB o atomicidad real cross-schema.

### Commits y reproducibilidad

Usuario autoriza commits locales separados; sin push ni despliegue:

| Commit | Contenido |
| --- | --- |
| `3d45912` | Calidad, prueba de frontera y asercion de auditoria |
| `4b4118f` | Fundamentos previos de ordenes, auditoria y contador |
| `4807ec3` | Integracion/visual previo de Formalizacion y retiro DEMO Inicio |
| `989e96c` | Historial, limites de error, lazy y espera real frontend |
| `855742c` | Seguridad, contencion legacy, expedientes, salud y errores |
| `7572b97` | CI, gate MySQL, cobertura y dependencias dirigidas |
| `25521fc`, `056f9d0` | Alineacion final de metadatos HTTP del reset y regresion sin supresion de lint |

Estos commits separan la remediacion de calidad del producto previo; algunos
archivos compartidos y wiring dependen de commits de la misma serie. No se
certifica cada commit intermedio como release independiente.

Clon de verificacion: `C:/codex-data/tmp/crm-tink-audit-20261022`, creado vacio
con `git clone --no-hardlinks` de `7572b97`. Ambas instalaciones
`pnpm install --frozen-lockfile` y `.\check-all.cmd` aprobaron; no se copio `.env`.
`git status --porcelain` vacio antes/despues de instalar y verificar. El clon se
actualizo sin cambios locales a `056f9d0` y su `pnpm check` API volvio a aprobar
con 4583 pruebas. `git diff 7572b97..056f9d0 --name-only` contiene solo controller
de identidad y su test; frontend/lockfiles permanecen identicos.

Entorno local verificado: Windows, Node v22.20.0, pnpm 10.28.2. Esto acredita
instalacion/checks reproducibles de la serie versionada en esta maquina, no
artefactos byte-identicos ni ejecucion del runner Linux/GitHub. El commit posterior
de este informe/plan/runbook/README es documental y no cambia codigo ni lockfiles.
CI remoto, proteccion de ramas, despliegue y MySQL aislado permanecen abiertos.

## Orden restante sin cierre ficticio

1. DBA: cuenta nativa minima y lectura legacy separada; instancia de pruebas
   aislada con UUID/marcador y dataset autorizado. Ejecutar MySQL solo entonces.
2. Responsable funcional: scopes de expedientes y recuperacion ultimo Owner;
   luego S02/S05 integral, politica password/inactividad y limites por capacidad.
3. Responsable CI: push aprobado y environment/secretos de pruebas; ejecutar
   workflow remoto y activar solo checks de calidad como obligatorios.
4. Equipo backend/DBA: volumen sintetico, EXPLAIN, carga, tiempos y pools; despues
   evaluar cursores y cache entre requests con invalidacion demostrada.
5. Catalogos: piloto de dos dominios con contratos comparados y regresion HTTP;
   ampliar solo si reduce duplicacion real sin perder reglas particulares.
6. Producto: aprobar transiciones/acciones/actores y concurrencia de ordenes;
   implementar flujo conectado antes de ampliar a leads u otras areas.

El plan completo sigue abierto mientras existan estos prerequisitos. Ningun
resultado unitario sustituye pruebas de persistencia, despliegue o pentest.

## Revision documental integral - 2026-10-22

Alcance: los 87 Markdown versionados del producto, incluyendo reglas locales,
arquitectura API/frontend, contratos, diccionarios, planes, QA, marca y runbooks.
No incluye reescribir skills instaladas, adjuntos externos ni certificar fuentes
web. No hay PDF/DOCX/TXT versionados en este inventario Git.

Se actualizaron 78 documentos y se conservaron nueve sin cambios. Los inventarios
de [API/guia de autenticacion](36-Registro-Entrega-Administracion.md) y
[frontend/QA/marca](../../frontend/Arquitectura/29-Navegacion-Recuperacion-y-Seguimiento.md)
clasifican 39 y 30 documentos respectivamente. Los 18 restantes son README,
CHANGELOG, SKILLS, los tres AGENTS, leyes/indices/resumenes/mapas de ambas apps
y este informe, plan correctivo, CI MySQL y operacion. AGENTS raiz conserva su
contrato; ocho documentos API mantienen principios o evidencia historica validos.

Correcciones: scope posterior a identidad, permisos de Inicio/banner, lectura y
escritura legacy independientes, reset 503, autorizacion Owner, salud, historial
y carga diferida, metricas provisionales, limitaciones DEMO, stack instalado y
estado real de CI/clon limpio. Las fechas, firmas y resultados anteriores se
preservan como antecedentes; las propuestas futuras no se presentan como runtime.

Verificacion de esta pasada: parser Markdown sobre los 87 archivos, resolucion
de destinos locales, revision del diff y `git diff --check`. No se reejecutaron
lint/typecheck/tests/build/cobertura porque solo cambio documentacion; sus
resultados anteriores siguen atribuidos al corte verificado, no a esta pasada.
No hubo conexiones DB, fixtures, SQL, cambios funcionales, commits, push ni deploy.
Las verificaciones productivas, MySQL aislado, CI remoto y decisiones de negocio
pendientes siguen abiertas; actualizar documentos no las cierra.
