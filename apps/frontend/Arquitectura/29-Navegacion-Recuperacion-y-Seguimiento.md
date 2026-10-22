# Navegacion, recuperacion y seguimiento - 2026-10-22

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

## F05: fuente real pendiente

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
