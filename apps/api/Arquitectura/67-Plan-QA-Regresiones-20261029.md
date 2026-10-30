# 67 - Plan y resultados QA de regresiones - 2026-10-29

## Alcance y reparto

Solicitud: identificar los fallos reportados, planificar las pruebas y ejecutar
QA con varios agentes. Tres revisores separan API/permisos, frontend/navegacion
y notas/tiempo real. La revision principal contrasta resultados y ejecuta las
pruebas SQL aisladas. Cada revisor presenta su plan antes de editar.

Solo se corrigen pruebas desactualizadas dentro de este alcance; no se cambian
permisos de negocio, datos comerciales, credenciales ni integraciones.
No se importan datos legacy ni se realizan commits o despliegues.

## Fallos reproducidos y plan de correccion

| Grupo | Evidencia actual | Causa y cambio minimo | Aceptacion |
| --- | --- | --- | --- |
| Inventario HTTP | 1 fallo, esperado 73 y real 78 | Actualizar inventario explicito para los cinco handlers agregados; conservar descriptores obligatorios | Todas las rutas previstas presentes y protegidas |
| Calendario HTTP | 20 fallos antes de enviar HTTP | Faltan mappings read/create/update y membresia en fixture; POST devuelve 200 por contrato | Lectura/escritura autorizada; sin lectura, sin membresia, deny, Owner+deny y revocacion bloquean antes del servicio |
| Actividad reciente | 1 fallo: 403 en caso esperado 200 | Fixture usa permiso de aprobaciones; ruta requiere formalizacion.orders.read | Lectura permite, banner sin lectura no permite y revocacion bloquea |
| Navegacion Formalizacion | Cuatro fallos historicos buscando Resumen | Menu vigente no contiene Resumen; conservar intencion de sesion/refresh comprobando Inicio/Gestion y ausencia de Resumen | Los casos de autenticacion siguen verificando recuperacion y permisos actuales |
| Precarga de App | Timeout actual beforeAll de 10 segundos | Aislar precarga de componentes para distinguir transformacion fria de comportamiento; ampliar solo hook si se confirma | Suite completa ejecuta sus casos sin relajar esperas de interfaz |
| Redis multinodo | Sin endpoint privado configurado | No se puede inferir distribucion real a partir de sockets single | Dos APIs, Redis QA TLS y pruebas de reconexion/revocacion sin duplicados |

Archivos de pruebas previstos: API `test/security/route-permission.http.spec.ts`
y frontend `test/app/App.spec.tsx`. Reutilizar sus harness y fixtures; ninguna
modificacion del codigo de produccion es necesaria para expectativas obsoletas.

## Ejecucion y criterios de cierre

1. Reproducir suites fallidas sin cambios y guardar salida/exit code.
2. Corregir exclusivamente expectativas y fixtures con contrato independiente.
3. Agregar negativos que prueben membresia, lectura y revocacion de Calendario.
4. Repetir suites completas de permisos/navegacion y dominios relacionados.
5. Ejecutar regresion de notas API/frontend y SQL/socket en esquemas temporales.
6. Revisar diff, formato, lint, tipos y builds; ejecutar chequeo global despues.
7. Separar resultados actuales, historicos y aceptacion de infraestructura.

No cerrar como aprobado si una suite aborta antes de sus casos, si solo pasan
pruebas filtradas, o si se omite una dependencia real sin declararlo.

## Aceptacion pendiente de infraestructura

Usar Redis privado TLS dedicado a QA, dos APIs y dos sesiones sinteticas con
BD temporal. Conectar destinatario a B y generar invitacion/respuesta/mencion
desde A; verificar campana e hilo sin recarga y deduplicacion por eventId.
Revocar acceso en A y comprobar el siguiente REST/publicacion en B. Interrumpir
Redis y reiniciar un proceso: la escritura debe conservarse y reconciliar al
recuperar, sin devolver acceso revocado. Medir p50/p95/maximo de entrega bajo
carga controlada; no prometer latencia sin medicion.

Finalmente comprobar el flujo visual con dos cuentas autorizadas. Las sesiones
sinteticas y sockets reales de pruebas no equivalen a esta aceptacion manual.
No se enviaran notas a usuarios ajenos como parte del QA.

## Resultados

Resultados focalizados actuales, con salida exit0 comprobada:

| Suite | Resultado |
| --- | --- |
| Inventario y fronteras HTTP | 441 aprobadas; resueltos los 22 fallos y agregados 23 negativos |
| App y navegacion/politica relacionada | 110 aprobadas: 73 App y 37 relacionadas |
| Notas API y esquema | 259 aprobadas; 32 SQL condicionadas ejecutadas aparte |
| Notas frontend | 171 aprobadas |
| Configuracion de API | 48 aprobadas |
| Calendario y politicas de orden/banners | 36 aprobadas |
| Home Formalizacion | 11 aprobadas |
| SQL base | 10 aprobadas |
| SQL colaboracion/socket | 13 aprobadas |
| SQL transporte/notificaciones | 9 aprobadas |

Las suites se solapan: no sumar estos renglones como un total de pruebas unicas.
Los tres esquemas `crm_notes_test_*` fueron creados con nombres aleatorios,
usados solo para datos sinteticos y eliminados al terminar cada runner.
No se escribio en tablas comerciales ni se importaron datos.

Red/green: API HTTP paso de 396 aprobadas/22 fallidas a 441 aprobadas.
App con limite diagnostico de precarga paso de 69 aprobadas/4 fallidas a 73
aprobadas. Se conserva el control de permisos; solo se actualizo la expectativa
del menu retirado. El limite de 60 segundos afecta solo el beforeAll de precarga,
no las esperas de acciones de usuario ni la configuracion global de tests.

Verificacion final:

- `check-all.cmd`: API completa aprobada, con 6524 pruebas aprobadas y 151
  omitidas condicionales, formato/lint/tipos/build aprobados. Frontend detecto
  nueve errores TS2769 introducidos en las nuevas aserciones de QA: ByRoleOptions
  no admite exact. Se retiro esa opcion; comparar name string ya es exacto.
- Despues de corregir el tipado se ejecuto `pnpm check` completo del frontend:
  1233 pruebas aprobadas, sin omitidas, 89 archivos aprobados; formato, lint,
  typecheck y build aprobados, exit0. App aislado tambien aprobo 73/73.
- Por tanto ambos checks de proyecto estan aprobados, aunque el primer comando
  raiz conserva exit1 historico por el error de tipado corregido. No se presenta
  ese log como si hubiera terminado con exit0.
- Las 32 SQL condicionadas de notas omitidas en el runner general se aprobaron
  por separado con sus dependencias reales. Las restantes omisiones del API no
  se certifican como pruebas ejecutadas. No se afirma cobertura al 100 %.
- Build frontend conserva advertencia de chunk Ant Design mayor de 500 kB y
  jsdom emite avisos getComputedStyle de pseudoelementos; no causaron fallos.
- Diff revisado y `git diff --check` aprobado en archivos de pruebas e indice.
  No se modifico codigo de produccion en esta tarea.

Evidencia local bajo `C:/codex-data/`: `qa-20261029-api.log` (rojo),
`qa-20261029-api-final.log` (verde), `qa-20261029-app.log` (timeout),
`qa-20261029-app-longhook.log` (rojo semantico),
`qa-20261029-app-green.log`, `qa-20261029-notes.log`,
`qa-20261029-ui-notes.log`, `qa-20261029-notes-config.log`,
`qa-20261029-domains.log`, `qa-20261029-api-home.log`,
`qa-20261029-sql-base.log`, `qa-20261029-sql-collaboration.log`,
`qa-20261029-sql-transport.log`, `qa-20261029-check-all.log`,
`qa-20261029-app-typed-green.log` y `qa-20261029-frontend-final.log`.

Permanecen sin verificar Redis multinodo, benchmark de carga/latencia y
aceptacion visual con dos cuentas reales. Los resultados locales aprobados no
cierran esas tres condiciones.

## Reconciliacion documental posterior - 2026-10-29

Tres agentes revisaron documentacion API, frontend y entradas/mapa del proyecto;
la coordinacion contrasto contratos, leyes de producto y contextos personales.
Se actualizaron README, CHANGELOG, instrucciones e indices, estados vigentes,
contratos de notas/tiempo real, UX y diccionario052/053. Los cortes anteriores
conservan sus fechas; no se borran resultados fallidos ni se convierten funciones
pendientes en operativas mediante la documentacion.

Validacion documental: 25 Markdown clave comprobados con Prettier; escaneo de
122 Markdown del repositorio, con 983 referencias locales a archivos y cero
destinos faltantes. No se validaron enlaces web ni anchors con ese escaneo.
Revision de diff y git diff --check sin errores. Esta tarea documental no
ejecuto de nuevo las suites de aplicacion; los resultados anteriores conservan
su ejecucion y fuente. Sin cambios de codigo, BD, configuracion o despliegue.
