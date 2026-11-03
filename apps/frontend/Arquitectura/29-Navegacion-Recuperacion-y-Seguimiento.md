# Navegacion, recuperacion y seguimiento - 2026-10-22

## Navegación vigente contrastada - 2026-11-02

`app-routes.ts` registra los consumidores resumidos en [30](30-Estado-Frontend-Verificado.md).
Calendario global se reutiliza en cuatro módulos; Resumen de Formalización está
retirado y una URL anterior se considera desconocida. Las páginas sin Page
siguen placeholders, no se les atribuye un flujo comercial.

Sesión y permisos se comprueban antes de montar la página; History API, Suspense
y RouteErrorBoundary conservan recuperación explícita. La ficha de Formalización
revalida identidad exacta y permisos propios, sin exigir banners. Inicio limpia
query/hash de orden incluso si el pathname coincide. Calendario transporta fecha
y evento en query a su ruta registrada sin saltarse permisos de lectura/edición.
Las notas identifican su recurso por tipo/origen/ID y no por URL: un invitado
conserva conversación sin acceso a la ficha, sin exponer datos comerciales.

Los apartados siguientes conservan la navegación y limitaciones de sus fechas;
no describen seguimiento/calendario actuales como consumidores vacíos.

## Estado contrastado - 2026-10-27

[30 - Estado frontend verificado](30-Estado-Frontend-Verificado.md) inventaría las rutas, contratos y límites actuales: Captación conectada, seguimiento y cambio protegido de etapa de Formalización. Los cortes fechados siguientes son antecedentes; sus cifras de QA no se reejecutaron en esta revisión documental.


## Actualizacion de lectura - 2026-10-23

Las cifras de pruebas, bundles e inventario de la entrega siguiente conservan el corte 2026-10-22; no se ejecutaron nuevamente. Ahora los seis banners de etapas consumen `GET /formalization/home/summary`, con rol efectivo activo Formalizacion y `formalizacion.home.stages.read` permitido sin deny. Owner puede heredar el rol por politica backend; no exige asignacion directa. Aprobaciones conserva su permiso independiente. Colas/seguimiento siguen sin fuente; list/send/revert no estan activos. Inventario actualizado: [27](27-Entrega-Administracion-y-QA.md); cobertura transversal: [49](../../api/Arquitectura/49-Estado-Actual-y-Cierre-Documental.md).

## Antecedente del corte documental f2dc4f1 - 2026-10-22

Implementacion contrastada con App, app-routes, AppRouteContent, LazyRoute,
RouteErrorBoundary, GlobalHomeShell y componentes/servicio de Formalizacion.
Las verificaciones automatizadas siguientes pertenecen a la remediacion previa;
esta actualizacion solo revisa documentos, enlaces y diff.

Entrada a Formalizacion: membresia activa del modulo en el perfil; la exencion
Owner existente se resuelve en backend. El frontend no inventa acceso por nombre
de rol. El permiso anterior formalizacion.home.read esta inactivo.
formalizacion.home.approvals.read controla exclusivamente el banner y GET del
resumen, no la entrada general ni aprobar/devolver. ApprovalStrip se monta solo
con allow y sin deny, por lo que un perfil no autorizado no inicia esa consulta.
Carga con Spin/Consultando, error No disponible; nunca un cero de respaldo.
La disponibilidad nativa/legacy depende de configuracion backend, no del banner.

Inicio conserva buscador, Proyecto y Bandeja. Gestion conserva buscador, Etapa,
Proyecto, Responsable y Limpiar segun criterios. Orden de bandejas: Todas,
Pendientes de aprobacion (solo autorizado), Contratos pendientes, Gestion bancaria,
Pendientes de saldo, Traspasos pendientes, Traspaso firmado y Formalizaciones
cerradas este anio. Los banners conservan el mismo orden de etapas; Contratos
distingue Por enviar y Pendientes de firma. Sin fuente no hay opciones de
proyecto/responsable DEMO. Tabla vacia y ceros de selectores no son datos reales.

## Inventario documental de la revision historica - 2026-10-22

Rutas relativas a apps/frontend; se revisaron los 30 archivos propios siguientes.
Clasificacion no equivale a una autorizacion nueva de producto.

| Archivos | Clasificacion y uso |
| --- | --- |
| Arquitectura/02, 03, 04, 06 (nombres completos en el directorio) | Blueprint de estructura/estado/UX; dependencias propuestas separadas del runtime |
| Arquitectura/05-Testing-Frontend.md | Estrategia y checklist; resultados previos atribuidos a reauditoria |
| Arquitectura/07-Skills-Codex-Instaladas.md | Inventario local, uso condicionado y registro historico de fuentes |
| Arquitectura/08, 18, 22, 24 | Compuerta inicial historica; Administracion actual remitida a 27 |
| Arquitectura/09, 10, 11, 12, 13, 14, 15, 16, 17, 20 | Vision comercial futura y contratos conceptuales; reglas canonicas preservadas |
| Arquitectura/21-Seguridad-Autenticacion-BFF-y-Sesion.md | BFF vigente y recomendaciones futuras de herramientas |
| Arquitectura/23-Regla-IDs-Canonicos-y-Proveedores-Frontend.md | Identidad canonica vigente; referencias de proveedor solo soporte autorizado |
| Arquitectura/25-Continuidad-Administracion.md | Bitacora fechada, no inventario actual de BD |
| Arquitectura/26-Projects-Design-System.md | Contrato visual preservado; QA y adopcion DEMO fechados |
| Arquitectura/27-Entrega-Administracion-y-QA.md | Inventario administrativo mas historial QA |
| Arquitectura/28-Formalizacion-Recorrido-Visual.md | Estado vigente separado del recorrido DEMO historico |
| Arquitectura/29-Formalizacion-Reunion-Ajustes.md | Necesidades/decisiones pendientes, no autoridad ni implementacion nueva |
| Arquitectura/29-Navegacion-Recuperacion-y-Seguimiento.md | Remediacion vigente e inventario de esta auditoria |
| design-qa.md | QA historico del shell, no certificacion actual |
| public/Logo/README.md | Referencias locales actuales y procedencia historica; calidad no medida |

La ley visual, el indice, el resumen y el mapa se revisaron junto con las
entradas principales del repositorio; el [indice](00-Indice.md) enlaza 25/26/27/28
y ambos documentos 29 por nombre completo. Los dos prefijos 29 se conservan
para no romper referencias historicas. Inventario global y limites de esta
revision: [reauditoria](../../api/Arquitectura/Reauditoria-54-Plan-y-Resultados.md).

## Evidencia final previa, no reejecutada

La [reauditoria](../../api/Arquitectura/Reauditoria-54-Plan-y-Resultados.md)
registra FE 428 aprobadas en 31 archivos, 84.77% de lineas; API 4583 aprobadas,
113 MySQL omitidas. Formato/lint/typecheck/build y cobertura finales constan
aprobados en ese corte. Los fallos iniciales registrados mas abajo se conservan
como historia y no sustituyen ese resultado posterior. CI esta preparado en el
repositorio; no se acredita activacion remota. El clon limpio y los nueve commits
son evidencia previa, no operaciones Git ejecutadas por esta auditoria.

## F01-F04

- Las selecciones del usuario usan `pushState`; login, logout y correcciones de
  acceso usan `replaceState`. `popstate` lee la URL sin crear otra entrada.
  La limpieza inicial del callback conserva `replaceState`.
- Los permisos se comprueban en `AppRouteContent` antes de montar la pagina.
  Las rutas y contratos existentes se conservan.
- `RouteErrorBoundary` contiene fallos de render y carga de paginas. El mensaje
  visible no incluye el error interno. Reintentar es una accion explicita:
  crea otra instancia de `React.lazy`; nunca recarga automaticamente la pagina.
  Un fallo persistente vuelve al mismo aviso, sin bucles de recarga.
- Las paginas registradas se cargan con importaciones dinamicas. El shell
  permanece disponible durante la carga y ante fallos de una pagina.
- La sesion ya no espera 900 ms ni la pausa final de 550 ms. El loader sigue
  visible mientras se resuelven sesion/perfil; se conserva cancelacion de
  respuestas obsoletas y el cooldown real de reintento de identidad.

## F05 historico: seguimiento pendiente y contadores provisionales - 2026-10-22

Inicio, seguimiento y bandejas de gestion no muestran filas, movimientos,
opciones de proyecto/responsable ni totales tomados de `FORMALIZATION_EXAMPLES`.
Se muestra un estado explicito de no disponibilidad. No se implemento un API
de seguimiento ni se interpreta la ausencia de fuente como cero real.
Los seis indicadores provisionales conservan sus ceros por solicitud del usuario.
El contador real de aprobaciones conserva fuente, permisos, carga y error.

Pendiente: definir y conectar el contrato canonico de listado de seguimiento,
detalle y movimientos, con permisos, filtros y paginacion. El contador de
aprobaciones no entrega esas filas. Calendario, Resumen y modelos de simulacion
existentes quedan fuera de este retiro acotado; esta entrega no certifica esos
flujos como conectados a operaciones reales. Las descripciones previas de
filas DEMO en el documento 28 son antecedentes para Inicio/seguimiento.

## Evidencia de bundles

Build previo: entrada JS 546.14 kB (gzip 160.66 kB), Ant Design 1050.90 kB.
Build posterior: entrada JS 85.09 kB (gzip 25.00 kB), Ant Design 1050.81 kB,
con chunks separados para las paginas. La advertencia de Ant Design sigue.
Durante el trabajo otro responsable actualizo Vite 8.3.1 a 8.3.3 y Vitest
5.0.1 a 5.0.3; estas medidas describen esos builds, no un benchmark controlado
ni una medicion de latencia de usuario.

La reauditoria registra 84.74 kB (gzip 24.89) en clon limpio frente a 85.09 kB
del workspace. No se controlaron todas las variables del entorno del SO;
no afirmar equivalencia de benchmark ni resolucion del chunk Ant Design.

## Archivos de esta entrega

Rutas relativas a `apps/frontend`; los cambios previos o concurrentes en estos
archivos se conservaron.

- `src/App.tsx`
- `src/routes/app-routes.ts`
- `src/routes/LazyRoute.tsx` (nuevo)
- `src/components/feedback/RouteErrorBoundary.tsx` (nuevo)
- `src/modules/home/FormalizationFollowUpPreview.tsx`
- `src/modules/home/FormalizationHomeInsights.tsx`
- `src/modules/home/FormalizationHomePage.tsx`
- `test/app/App.spec.tsx`
- `test/app/route-recovery.spec.tsx` (nuevo)
- `test/home/formalization-banners.spec.tsx`
- `test/home/formalization-no-demo.spec.tsx` (nuevo)
- `test/home/formalization-summary.spec.tsx`
- `Arquitectura/29-Navegacion-Recuperacion-y-Seguimiento.md` (nuevo)

## Comandos de verificacion

Ejecutados desde `apps/frontend`:

```powershell
pnpm typecheck
pnpm lint
pnpm build
pnpm test test/app/App.spec.tsx test/app/route-recovery.spec.tsx test/home/formalization-banners.spec.tsx test/home/formalization-no-demo.spec.tsx test/home/formalization-summary.spec.tsx test/home/formalization-home.spec.ts test/home/formalization-calendar.spec.tsx --maxWorkers=1 --reporter=dot
pnpm test test/unit-files/UnitFilesPage.spec.tsx --maxWorkers=1 --reporter=dot
```

La primera corrida completa (`pnpm test --reporter=dot --maxWorkers=2`) dio
427 pruebas correctas y un fallo de App al esperar Roles y seguridad. Despues
se sincronizaron las pruebas con la importacion dinamica y los eventos reales
de historial; no se aumentaron timeouts. La corrida de cobertura del responsable
principal tambien reporto fallos y sigue siendo evidencia separada. La pasada
focalizada no sustituye su cierre final de `check-all` y cobertura.

Resultado final focalizado: 7 archivos, 103 pruebas correctas. UnitFiles aislado:
10 pruebas correctas sin modificar ese modulo. Typecheck, lint y build correctos;
el build conserva la advertencia de tamano de Ant Design. No se ejecuto un nuevo
check-all ni cobertura completa por este responsable.

## Cambio manual de etapa desde la orden - 2026-10-26

El detalle de la orden real permite seleccionar cualquiera de las siete etapas posteriores a aprobaciones y Guardar con confirmacion. Requiere rol efectivo activo `formalizacion`, allow sin deny de `formalizacion.orders.stage.update`, `approvalsComplete=true` y `stateVersion` valido en la fila. Sin esos datos el editor queda deshabilitado. El API sigue siendo autoridad sobre permisos, alcance, aprobaciones y concurrencia.

Consume `POST /formalization/orders/stage` con source/id canonicos, expectedSequence, operationId UUID y targetState; un retroceso exige motivo. No envia correo. Una falla conserva el editor y la clave de la misma operacion para reintento explicito; cambiar la entrada genera otra clave. Un 409 bloquea guardar hasta actualizar. Un exito cierra el detalle y recarga listado y banners mediante el contador de Home. Pruebas usan dobles de API; no acreditan una mutacion real ni despliegue.
