# Formalización: lectura por banner

## Reglas vigentes de fondos y finalización — 2026-11-03

Las reglas actuales de [78](78-Formalizacion-Origen-Fondos-y-Gestion-Bancaria.md)
prevalecen sobre los predicados históricos de este documento:

- Contratos exige la aprobación explícita de Formalización, actividad y ausencia
  de caída/borrado; no exige nuevamente las otras dos aprobaciones. Aprobar una
  orden mantiene sus prerrequisitos propios de Jefatura y Desarrolladora.
- Las ocho etapas incluyen `bank_management_in_progress`. Al salir de Contratos,
  con firma confirmada, `own_funds` conduce a `pending_balance` y `bank_financing`
  a `bank_management_in_progress`; sin origen no hay avance. Origen y etapa se
  guardan con la misma transacción y auditoría; el replay compara su elección histórica.
- Traspasos pendientes exige cuotas sí, unidad traspasada no y unidad entregada no.
  Traspaso firmado exige cuotas sí, traspasada sí, llaves no y entregada no.
  Unidad entregada sí habilita cierre aunque los otros tres sean desconocidos.
  NULL nunca sustituye un no confirmado. Se conservan firma, permisos y versión.
- El cierre anual exige evidencia `closed` en el año de Costa Rica y unidad
  entregada sí. Una combinación fuera de tabla mantiene la etapa guardada y
  visibilidad autorizada en **Todas**; no se inventa un cambio durante GET.
- `counts.bankingInProgress` distingue banca en proceso del agregado Home
  `banking`; el seguimiento devuelve `counts.bankInProgress` y `bank` reúne
  los dos estados bancarios. Los cuatro indicadores son booleanos/NULL.
- Los eventos NetSuite `edit`/`xedit` pueden avanzar desde saldo/traspaso/firmado
  a un destino posterior confirmado, conservando responsable y actor integración.
  Flags, visita, auditorías y cursor comparten transacción. No revierten etapas
  ni permiten regresar a saldo una vez iniciado el traspaso.

Adéndum es una capacidad independiente: [83](83-Adendum-Migracion-065-y-Rollback.md)
y [84](84-Adendum-Manual-Migracion-066-y-Permisos.md). El permiso de banner solo da
conteo; `formalizacion.orders.addendum.read` controla bandeja, marca y evidencia.
La marca no cambia etapa/aprobaciones. Esta revisión no repite pruebas históricas,
no escribe en BD ni acredita edición real de NetSuite o despliegue.

Regla autorizada el 2026-10-28: el rol efectivo activo Formalización puede consultar órdenes de todos los vendedores, exclusivamente en las categorías cuyo permiso de lectura tenga concedido. La asignación personal no restringe estas lecturas. Esta regla sustituye el alcance de lectura por vendedor descrito en cortes anteriores.

| Banner / bandeja | Permiso de lectura |
| --- | --- |
| Pendientes de aprobación | `formalizacion.home.approvals.read` |
| Contratos pendientes; por enviar; pendientes de firma | `formalizacion.home.contracts.read` |
| Gestión bancaria | `formalizacion.home.banking.read` |
| Pendientes de saldo | `formalizacion.home.balance.read` |
| Traspasos pendientes | `formalizacion.home.transfer_pending.read` |
| Traspaso firmado | `formalizacion.home.transfer_signed.read` |
| Formalizaciones cerradas este año | `formalizacion.home.closed.read` |

El mismo permiso protege contador, listado y filtros. “Todas” reúne únicamente las categorías autorizadas. El filtrado de autorización ocurre antes de calcular totales, proyectos y páginas. Una denegación explícita prevalece. El detalle, tiempos, historial e inspección ERP ahora requieren el permiso independiente «Ver orden de venta», según la aclaración posterior del propietario en [64](64-Formalizacion-Permiso-Ver-Orden.md); no requieren permiso del banner.

Los contratos incluyen las órdenes aprobadas por enviar y pendientes de firma. Las etapas posteriores requieren firma confirmada. El cierre anual conserva su pertenencia aunque la orden se haya reabierto: el acceso procede si coincide cualquiera de las categorías permitidas. Se conserva la identidad de origen nativo o legacy, sin importar datos entre bases.

## Configuración y compatibilidad

La migración `202610280047_formalization_banner_permissions` sustituye el permiso agregado `formalizacion.home.stages.read` por seis permisos específicos en `CRM_THINK_V2`. Conserva el historial de concesiones y excepciones, incluidas denegaciones y vigencias; respeta configuraciones granulares preexistentes. Desactiva el permiso agregado e invalida versiones de permisos. Es transaccional, auditable y no copia datos de negocio ni escribe en la base legacy.

La compatibilidad de perfiles anteriores a la migración solo acepta el permiso agregado cuando no hay entradas granulares. En la base migrada está inactivo, por lo que quitar los permisos específicos no puede reactivar el acceso anterior.

## Límites

Esta autorización es de lectura. Los permisos y alcances de modificación, aprobación y transición conservan sus controles independientes; poder consultar una orden no permite modificarla. Las invitaciones a notas tampoco conceden acceso a la orden vinculada.

La interfaz oculta categorías no autorizadas y descarta resultados o detalles anteriores cuando cambian los permisos. El servidor vuelve a comprobar el acceso al registro; la interfaz no sustituye esa validación.

## Verificación

La aceptación incluye perfiles con un único banner, denegaciones, ausencia de rol, acceso directo a órdenes de otra categoría, permisos revocados y órdenes de ambas fuentes. Las etapas firmadas y el cierre anual no vuelven a exigir permiso de aprobaciones si una aprobación cambia después: su propia pertenencia autorizada basta.

Evidencia del 2026-10-28, anterior a separar el permiso de detalle en [64](64-Formalizacion-Permiso-Ver-Orden.md):

- Migración047 aplicada mediante el runner con selección explícita de esa única migración; sin importar órdenes ni escribir en legacy.
- Consulta real con el perfil de `tet formalizacion`: 189 órdenes (185 contratos, 3 aprobaciones y 1 saldo), pese a conservar asignación organizativa `self`.
- Perfil de prueba reducido en memoria a Contratos: 185 órdenes de varios vendedores; Gestión bancaria devuelve 403. No se modificaron permisos reales para esta prueba.
- Orden `legacy:208`, en pendiente de saldo: permitida con el perfil real y denegada con Contratos solamente.
- API: suite completa, 6250 pruebas aprobadas y 141 omitidas por compuertas de entorno. Revisión independiente detectó y se corrigió el veto de aprobaciones en etapas firmadas; regresiones aprobadas.
- Compilación API y frontend aprobada. Frontend: formato, lint y tipos aprobados; suite global con 1124 aprobadas y un fallo en `formalization-order-progress.spec.tsx` (confirmación de aprobación/proyección del proveedor, fuera del cambio de banners). Esa suite aislada aprobó sus 19 pruebas; no se declara la ejecución global verde.
- API global: formato señaló `formalization-approval.repository.ts` y lint señaló una condición innecesaria en `common/filters/sanitized-error.filter.ts`, archivos de otros cambios del árbol compartido. No se alteraron para ocultar esos resultados. Lint de archivos propios aprobado.
- API local: `/health/live` y `/health/ready` respondieron correctamente después de aplicar la migración.

Estas lecturas reales actualmente devuelven cero órdenes nativas; no equivalen a probar un expediente nativo real. Las pruebas automáticas cubren sus proyecciones. Los resultados globales de formato/lint y la revisión visual se reportan por separado; no deben inferirse de las cifras anteriores.
