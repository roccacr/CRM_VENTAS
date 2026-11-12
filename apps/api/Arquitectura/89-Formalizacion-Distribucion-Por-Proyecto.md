# 89 — Distribución de Formalización por proyecto

Estado: implementación local y lectura real verificadas, 2026-11-03. Sin migraciones, escrituras comerciales ni despliegue.

## Experiencia y conteos

El botón de la bienvenida reaparece como **Ver distribución por proyecto**. Abre un modal dentro de Inicio; no navega al listado ni altera proyectos, búsqueda o bandejas de la tabla. Muestra barras horizontales por proyecto, proyectos ordenados por cantidad de órdenes únicas de mayor a menor, con nombre e ID como desempate, cantidades por estado, leyenda y tabla desplegable con los valores exactos. Consulta toda la distribución autorizada, independientemente de la página y filtros abiertos en Inicio. Los estados sin órdenes conservan su leyenda autorizada y no inventan segmentos.

Colores y orden: aprobación azul; contratos por enviar naranja y pendientes de firma naranja oscuro; gestión bancaria sin iniciar violeta y en proceso índigo; saldo cian; traspaso pendiente verde azulado; firmado verde; cerradas este año verde oscuro. Adéndum pendiente se presenta en columna violeta independiente: es marca de la orden y no una etapa. Las condiciones son exactamente las de los banners; una orden puede coincidir en varias bandejas (incluido cierre anual), por lo que el total único no se obtiene sumando segmentos. La nota visible explica esa diferencia. Pasar el mouse o enfocar un segmento muestra proyecto, estado y cantidad; la tabla proporciona valores también sin depender del color.

## API y autorización

`GET /formalization/home/project-distribution`, autenticado, `Cache-Control: no-store`, sin filtros ni paginación; parámetros extra se rechazan. Comparte acceso de Formalización, permisos efectivos/denegaciones y snapshot de seguimiento. El botón necesita alguna bandeja de lectura autorizada. Cambios parciales de permisos alteran la key de FormalizationHomeContent y desmontan el modal, incluidos datos y respuestas pendientes.

Respuesta: `{schemaVersion:1, observedAt, totalOrders, series, projects:[{id,name,total,counts}]}`. Series ordenadas: approvals, send, signature, bank_not_started, bank_in_progress, balance, transfer, signed, closed, addendum. Solo se publican series y claves de conteo autorizadas. Cada proyecto.total y totalOrders cuentan órdenes únicas, no membresías. Sin proyecto se agrupa bajo id NULL y etiqueta Sin proyecto. La suma de totales por proyecto coincide con totalOrders.

FollowUpRepository.projectDistribution une las proyecciones nativa y legacy con la autoridad/exclusión de aliases existentes. projectDistributionQuery reutiliza followUpMatches y la clasificación del listado; aplica OR de bandejas autorizadas y agrupa la cartera completa en SQL, sin cargar páginas ni registros de contacto al navegador. Mantiene el switch legacy y la misma normalización de collation de la federación. Una fuente fallida no devuelve un total parcial. Cliente valida enteros, límites por proyecto, claves anunciadas, proyectos únicos y suma global; respuestas inválidas muestran error/reintento, nunca un cero ficticio.

## Verificación y límites

- Lectura real en transacción de solo lectura:243 órdenes en14 proyectos; aprobación5, por enviar238, restantes0. La suma por proyecto coincide con243 y los conteos con los banners. No se modificaron órdenes ni preferencias de filtros.
- API:58 pruebas de seguimiento y6 del inventario centrado en la ruta/descriptores aprobadas; lint, typecheck y build aprobados. El inventario completo mantiene fallos ajenos Calendar/NetSuite/finiquito, no se presenta como verde.
- Frontend:14 pruebas de servicio/modal, incluidas respuestas parciales/malformadas, solapamiento de Adéndum, error/reintento, revocación total y parcial real desde el padre. Typecheck y build aprobados en el corte, con advertencia de tamaño de chunks. Además,75 regresiones de Inicio/banners/seguimiento aprobaron junto a las primeras13 pruebas del modal (88 casos); la prueba adicional de tooltip por teclado aprobó después.
- Navegador: modal real abierto con243 órdenes/14 proyectos, colores y totales comprobados; ajuste al z-index compartido1400 mantiene el panel por encima de la máscara1299. No se crearon eventos ni se envió correo.

Archivos: API project-distribution.contract.ts, follow-up.query/repository/service.ts y home-summary.module.ts; frontend FormalizationProjectDistribution.tsx/.css, project-distribution-service.ts e integración en FormalizationHomePage.tsx. Se conserva oculto el menú Gestión de formalizaciones y permanece la ruta directa con sus permisos.

Actualización solicitada: se retiró la tabla desplegable «Ver cantidades por estado». El modal conserva únicamente el gráfico, sus cantidades y ayudas al pasar el mouse o enfocar los segmentos. Las menciones anteriores a la tabla describen la versión inicial.


## Ampliación autorizada — Finiquito por proyecto, 12 de noviembre de 2026

Esta revisión local amplía el contrato anterior. Abrir el modal conserva los filtros; al pulsar
un segmento se cierra y se abre el seguimiento filtrado exactamente por su proyecto y bandeja.
Se reemplazan otras bandejas/proyectos, se limpia búsqueda y se vuelve a página 1. Los banners
fuera del gráfico conservan su selección acumulativa. Banco conserva sus dos subetapas específicas.

La fila muestra dos barras independientes, Comercial y Finiquito, con columnas Comerciales,
En finiquito y Adéndum. Solo se dibujan segmentos con cantidad positiva. Cada segmento es botón
nativo con nombre accesible, tooltip por foco/hover y cantidad visible. Las etapas de finiquito son:

| Serie | Etapa | Color |
| --- | --- | --- |
| finiquito_validation | Validación de saldo | Rojo oscuro #991b1b |
| finiquito_pending | Finiquito pendiente | Rojo #dc2626 |
| finiquito_signed | Finiquito firmado | Coral #f87171 |
| finiquito_formalized | Formalizada | Rojo suave #fecaca |

Los dos circuitos usan escalas independientes y muestran los números para no depender del color.
Los rojos claros usan texto oscuro. El gráfico y su leyenda se mantienen dentro de un área con
scroll, y las tarjetas se acomodan en dos columnas en pantallas estrechas.

La API conserva schemaVersion 1 y agrega esas cuatro series al array existente, únicamente con
canReadFormalizationOrder. El deny efectivo impide publicarlas. El permiso de los banners comerciales
sigue siendo independiente. Se reutilizan followUpMatches y finiquitoClassificationFor, incluyendo
ajustes manuales de órdenes antiguas, la autoridad nativa/legacy y el snapshot de la consulta.
No se agregan permisos, endpoint, tablas ni migraciones.

**project.total y totalOrders continúan contando solo órdenes comerciales únicas autorizadas**
(incluida la membresía Adéndum ya existente), usando OR de membresías comerciales, sin sumar bandejas.
El total del finiquito se obtiene sumando sus cuatro etapas mutuamente excluyentes, por proyecto.
Un proyecto con cero comerciales y finiquitos positivos se conserva, incluso con id NULL.
Los finiquitos nunca se suman a totalOrders ni al denominador del circuito comercial.
El cliente valida las cuatro series completas o su ausencia, números seguros y claves autorizadas;
no limita los conteos de finiquito al total comercial del proyecto.

Arriba se muestran: En finiquito, Pendientes (validación + pendiente + firmado), Finalizados
(Formalizada) y Avance (finalizados / total del circuito). Con cero finiquitos se muestra
Sin órdenes en el avance, evitando un cociente 0/0. Son cifras del portafolio autorizado completo,
no de la página visible ni constantes tomadas de una captura.

El proyecto NULL se filtra con el valor canónico `unassigned`, aceptado por el DTO de seguimiento,
preferencias y selector. SQL lo compara mediante COALESCE(projectId,'unassigned') con valores ligados;
no se convierte accidentalmente en un filtro de todos los proyectos. Los IDs reales conservan su
validación anterior. Las preferencias antiguas y el resto de los filtros se siguen admitiendo.

Archivos: contratos/consulta/servicio de seguimiento y contrato de distribución en API; cliente de
distribución, componente/CSS, conexión en HomePage, FollowUpPreview, preferencias y opciones de proyecto
en frontend. Regresiones preparadas para conteos separados, finiquitos sin comerciales, permisos,
proyectos sin asignar, porcentajes y clic que sustituye filtros. Sin pruebas ejecutadas por instrucción.
No se consultaron ni modificaron órdenes reales y no se desplegaron cambios.

Comandos focalizados desde la raíz del repositorio:

```powershell
Push-Location apps/api
pnpm exec vitest run test/sales-orders/follow-up-query.spec.ts test/sales-orders/follow-up.http.spec.ts
$apiExit = $LASTEXITCODE
Pop-Location
Push-Location apps/frontend
pnpm exec vitest run test/home/project-distribution-service.spec.ts test/home/project-distribution-metrics.spec.ts test/home/project-distribution.spec.tsx test/home/formalization-filter-preferences.spec.ts test/home/formalization-project-options.spec.ts
$frontendExit = $LASTEXITCODE
Pop-Location
Write-Output "API=$apiExit Frontend=$frontendExit"
```

Quedan pendientes ejecución de pruebas, SQL aislado con datos sintéticos y aceptación visual real.
No inferir cantidades actuales ni tiempos de respuesta a partir de la inspección estática.
La comprobación completa posterior es `./check-all.cmd` desde la raíz.

Comprobaciones estáticas finales de esta ampliación: typecheck API/frontend, lint de archivos afectados y git diff --check con salida 0. Se corrigieron los avisos iniciales antes de la comprobación final. No se ejecutaron tests ni se verificó una sesión de navegador real. API y frontend deben actualizarse conjuntamente para consumir las series nuevas.


## Cantidades y porcentajes comparativos — 12 de noviembre de 2026

La tabla agrega porcentajes junto a las cantidades comerciales y de finiquito. La base es la suma
**C + F**: C = project.total (órdenes comerciales únicas autorizadas) y F = suma de las cuatro etapas
del finiquito, mutuamente excluyentes. No se suman los segmentos comerciales ni Adéndum.

- Porcentaje comercial del total: C / (C + F).
- Porcentaje del total en finiquito: F / (C + F).
- Columna Finiquito / comerciales: F / C, con sus dos cantidades explícitas.

El resumen global añade Total considerado (C + F), porcentaje del finiquito sobre ese conjunto y
comparación Finiquito / comerciales. Globalmente C es la suma de los totales únicos por proyecto;
F es la suma de sus cuatro etapas. Avance sigue siendo finalizados / F; no se confunde con la incidencia.

Ejemplo de la captura, sin fijarlo como dato del sistema: BC Lofts, C=48 y F=15, suma 63;
76,2 % comercial, 23,8 % del conjunto en finiquito y 31,3 % de finiquitos frente a comerciales.
Para C=255 y F=131, suma 386: 33,9 % del conjunto y 51,4 % frente a comerciales.
Los valores se recalculan con el agregado actual y se presentan con un decimal.

Cuando C=0 se muestra Sin base comercial para F/C, sin infinito ni cero inventado. Si C+F=0,
los porcentajes del total quedan sin base. Una ratio F/C superior a 100 % es válida y no se recorta.
Si el usuario no tiene permiso de finiquito, no se deduce que el porcentaje sea cero.

Estos indicadores miden **cantidad de órdenes del portafolio autorizado en el corte**. No miden montos
perdidos ni una tasa histórica de cancelación de una cohorte de compras. Comercial incluye las bandejas
autorizadas existentes, incluso aprobaciones; finiquito incluye todas sus etapas, incluso Formalizada.
No requieren nuevo endpoint, SQL, migración ni SuiteScript. Requieren el frontend actualizado.
Se prepararon tests de fórmulas, bases cero, ratio superior a 100 % y presentación por proyecto,
sin ejecutarlos. Añadir `test/home/project-distribution-metrics.spec.ts` al comando focalizado frontend.

Verificación de los porcentajes: lint de archivos afectados, typecheck frontend y git diff --check con salida 0. Tests preparados sin ejecutar; sin build ni despliegue y sin cambios en API o base de datos para este ajuste.
