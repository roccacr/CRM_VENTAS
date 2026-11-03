# Enlaces al expediente de unidad

Cambio local de presentación, 2026-11-02. No cambia esquemas, valores persistidos, permisos ni contratos HTTP.

## Identificación y origen

Consultas de solo lectura sobre information_schema confirmaron:

| BD | Tabla | Columna | Tipo |
| --- | --- | --- | --- |
| crmdatabase-api | expedientes | planosDeUnidad_exp | TEXT |
| CRM_THINK_V2 | crm_unit_file | unit_plans_unit_file | TEXT |

`UNIT_FIELDS.unitPlans` y `UNIT_COLUMNS.unitPlans` declaran la equivalencia. «Planos de la unidad (referencia de origen)» usa esas mismas columnas: no es otro campo en este proyecto.

La lectura legacy conserva el valor existente de expedientes; la lectura nativa conserva el valor de crm_unit_file. El registro legacy 3167 (código en BD `LE-Ga FF008`, referencia interna 12915, proyecto 30) contiene la URL Box suministrada. La tabla nativa tiene cero filas al consultar; no se insertaron datos para probarla.

No se encontró en este proyecto un escritor de esta URL ni un mapeo NetSuite que la asigne. `custbody38` identifica la relación con el expediente en la orden, no su URL. El productor histórico exacto (sincronizador externo o captura manual) no queda acreditado por estos lectores; no se infiere desde fecha_mod/cron_value.

## Inventario

Rutas relativas a la raíz del repositorio:

| Archivo | Componente / vista | Uso | Antes | Ahora |
| --- | --- | --- | --- | --- |
| apps/api/src/modules/crm/unit-files/unit-files.contract.ts | UNIT_FIELDS | Mapea columna legacy a unitPlans | No aplica | Sin cambios |
| apps/api/src/modules/crm/unit-files/unit-files.columns.ts | UNIT_COLUMNS | Mapea columna nativa a unitPlans | No aplica | Sin cambios |
| apps/api/src/modules/crm/unit-files/unit-files.repository.ts | UnitFilesRepository.detail | Lee campo nativo | No aplica | Sin cambios |
| apps/api/src/integrations/legacy-crm/unit-files/legacy-unit-files.reader.ts | LegacyUnitFilesReader.detail | Lee campo legacy | No aplica | Sin cambios |
| apps/api/src/modules/crm/unit-files/unit-files.mapper.ts | mapUnitDetail / unitText | Proyecta values sin recortar | No aplica | Sin cambios |
| apps/api/src/modules/crm/sales/sales-orders/order-record.query.ts | Allowlist de unidad | Lee ambas fuentes para ficha de orden | No aplica | Sin cambios |
| apps/frontend/src/services/formalization/order-unit-service.ts | getOrderUnitDetail | Proyecta ambas fuentes para el panel | No | Marca kind: expediente |
| apps/frontend/src/modules/administration/unit-files/UnitFilesPage.tsx | Detalle de expediente compartido por contexto de módulo | Muestra | Sí, con URL completa | Ver expediente |
| apps/frontend/src/modules/administration/unit-files/UnitFilesComparison.tsx | Comparación de unidades | Muestra | No | Ver expediente |
| apps/frontend/src/modules/home/FormalizationUnitDrawer.tsx | Unidad de orden, abierta desde FormalizationRecordSummary | Muestra | No | Ver expediente |
| apps/frontend/src/components/ExpedienteLink.tsx | Componente compartido nuevo | Valida y muestra | No existía | Ver expediente |

La proyección UnitSummary omite los planos; la tabla principal y sus filtros no los reciben. No se encontraron exportaciones/reportes ni una ficha de lead que presenten esta URL en el árbol revisado. No se agregan pantallas o exportaciones nuevas.

## Comportamiento

- Solo URLs absolutas HTTP/HTTPS parseables generan enlace.
- Etiqueta «Ver expediente», title con URL recortada, target="_blank", rel="noopener noreferrer".
- Nulos, vacíos y solo espacios muestran «—».
- Valores inválidos se muestran como texto escapado por React; nunca se interpretan como HTML.
- El componente centraliza trim para presentación, sin reescribir los valores del servicio o del backend.
- El panel de Formalización conserva el tratamiento de campos faltantes ajenos; el expediente vacío muestra «—».

## Verificación

Pruebas del componente cubren HTTP/HTTPS, espacios externos, vacíos/nulos, protocolos no permitidos, URLs incompletas y contenido HTML. Pruebas de las tres vistas cubren enlace, vacío y texto inválido; el servicio cubre columnas nativas y legacy con dobles de respuesta.

La evidencia con BD real confirma columnas, URL legacy y ausencia de unidades nativas. No acredita navegación autenticada extremo a extremo ni acceso/autorización del documento Box. No se dispararon sincronizaciones ni escrituras.

El check oficial de raíz se ejecutó y se detuvo en format:check del API por 14 archivos ajenos a este cambio. La validación frontend se ejecutó separadamente: 55/55 pruebas focalizadas aprobadas y pnpm build aprobado (incluye tsc --noEmit). El primer typecheck encontró errores en archivos de perfil/cliente/orden ajenos; el build posterior pasó con el árbol concurrente actualizado. El lint global encontró errores ajenos y dos de imports de esta tarea, corregidos con autofix limitado a esos dos archivos. Lint y formato de los diez archivos TS/TSX de esta tarea aprobados. Suite frontend completa: 1297 pruebas aprobadas y 1 fallida en test/leads/lead-profile.spec.tsx por Invalid Chai property: toBeInTheDocument, archivo ajeno a esta tarea (95 archivos: 94 aprobados y 1 fallido). La ejecución duró 336.70s; hubo ediciones concurrentes en archivos ajenos durante la validación. diff --check de los cambios de esta tarea aprobado.
