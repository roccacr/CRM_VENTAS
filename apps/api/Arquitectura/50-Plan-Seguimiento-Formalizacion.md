# 50 - Plan de seguimiento de Formalizacion

Actualizacion posterior 2026-10-26: seguimiento ya conectado; la bandeja Todas
incluye unicamente la union de condiciones de los banners. Totales, proyectos
y paginacion excluyen ordenes sin etapa elegible. Ver [52](52-Etapas-Responsables-y-Tiempos.md).
La investigacion y el plan siguientes describen el corte anterior.

Fecha: 2026-10-26. Estado: investigacion de solo lectura y plan; no implementado.
Alcance solicitado: llenar Pendientes de seguimiento con lecturas federadas,
busqueda, proyecto y bandeja. No habilitar transiciones, envios ni importaciones.

## Evidencia actual

- `FormalizationFollowUpPreview.tsx` conserva una coleccion vacia intencional;
  no existe todavia un endpoint de seguimiento conectado a esta tabla.
- En CRM_THINK_V2, `crm_sales_order` tiene codigo nativo, ID publico, alias de
  produccion, expediente y propietario. No tiene columna/FK hacia `crm_lead`,
  ni se encontro otra relacion declarada orden-lead en information_schema.
- `crm_lead` enlaza contacto principal, proyecto y usuario responsable mediante
  PK internas nativas. Las respuestas HTTP deben usar IDs publicos.
- El numero de proveedor equivalente a `id_ov_tranid` vive en
  `crm_sales_order_external_reference.transaction_number_sales_order_external_reference`.
  `native_code_sales_order` es el codigo propio del CRM; no son el mismo dato.
- En legacy, `ordenventa.id_ov_lead = leads.idinterno_lead`, no `leads.id_lead`.
  Expediente: `idExpediente_ov = expedientes.ID_interno_expediente`.
  Vendedor del lead: `id_empleado_lead = admins.idnetsuite_admin`.
  Proyecto del lead: `idproyecto_lead = proyectos.id_ProNetsuite`.
- Consulta observada: 270 ordenes activas/no caidas; las 270 coinciden por
  referencia de proveedor de lead y expediente, cero por PK local de lead.
  Las 186 con tres aprobaciones tienen lead unico, vendedor y proyecto.
- La conexion configurada a CRM_THINK_V2 reporto cero ordenes y cero leads.
  Son observaciones puntuales, no invariantes ni valores para codificar.
- No se consultaron contrasenas ni se realizaron escrituras o fixtures.

## Decision previa a implementar

Propuesta: agregar mediante migracion aditiva nativa un enlace nullable
`lead_id_sales_order` hacia `crm_lead.id_lead`, indexado y con FK restrictiva.
Un lead puede tener varias ordenes. Resolver el ID publico a PK en el API;
no guardar IDs de proveedor como FK, inferir por nombre, ni importar leads.
Preparar/aplicar esta migracion requiere confirmacion del propietario.
Sin relacion confirmada, una orden nativa debe mostrar cliente no relacionado,
nunca tomar arbitrariamente un lead legacy o un contacto con el mismo nombre.

## Plan de implementacion

1. Confirmar el enlace y crear migracion/tipos/pruebas nativos. No cambiar
   estructura legacy ni copiar registros. Toda orden nativa existente sin
   enlace permanece nullable hasta disponer de evidencia explicita.
2. Reutilizar snapshot read-only de Home y puerto/adaptador legacy. Consultar
   nativo primero; excluir de legacy cualquier orden con alias nativo, aunque
   la version nativa este inactiva. No desduplicar por numero visible.
3. Proyectar cliente/contacto, proyecto del lead, codigo del expediente y
   responsable del lead. LEFT JOIN preserva ordenes con datos incompletos;
   referencias ambiguas no deben multiplicar filas ni elegir personas al azar.
4. Implementar endpoint de lectura paginado con filtros validados en servidor:
   texto acotado, proyecto por identidad, bandeja y cursor/limite. Mantener
   limites de ejecucion, orden estable y ausencia de N+1. Totales y opciones
   deben corresponder al conjunto filtrado, no solo a la pagina recibida.
5. Aplicar rol efectivo Formalizacion y permiso de etapas antes de leer ambas
   fuentes, preservando denies individuales y politica Owner existente. La
   bandeja de aprobaciones y sus filas exigen tambien su permiso especifico;
   ocultarlas de Todas si no existe. Revisar alcances por recurso/proyecto.
6. Clasificar con las mismas reglas de banners: activa/no caida, tres
   aprobaciones para contratos, estado persistido para fases posteriores.
   Sin fecha limite excepto cierres efectivos del ano de Costa Rica. Cierres
   anuales acumulan evidencia historica incluso tras reapertura: una orden
   puede acreditar cierre anual y estar actualmente en otra etapa. Todas
   devuelve una fila por orden, no una por bandeja o evento.
7. Devolver un JSON canonico con schemaVersion, observedAt, filtros, pagina,
   totales por bandeja, proyectos autorizados y rows. Cada fila incluye
   identidad/origen, numero visible y referencias de proveedor separadas,
   cliente, proyecto, expediente, responsable, etapa actual, siguiente paso
   informativo y fecha efectiva/antiguedad nullable. No inventar antiguedad a
   partir de la fecha de importacion o creacion cuando no hay fecha de etapa.
8. Conectar servicio tipado React y tabla existente: carga, error/reintento,
   vacio real, paginacion y busqueda con debounce. Descartar respuestas tardias,
   no consultar componentes ocultos/sin permisos. Recargar desde BD; no cache
   compartida de resultados ni datos de ejemplo. No abrir la maqueta de detalle
   como si fuera un expediente real ni activar botones de cambio de estado.
9. Agregar console.log de desarrollo del contrato canonico recibido para
   inspeccion autorizada. Sin payload crudo de proveedores, credenciales,
   correos/telefonos ni logs en produccion. No consultar ambas BD desde React.
10. Medir consultas read-only y EXPLAIN antes de proponer indices adicionales.
    No aplicar DDL sobre produccion sin autorizacion separada. Ejecutar pruebas
    de servicio/repositorio/HTTP/UI y revisar el diff completo antes del cierre.

## Archivos y reutilizacion

- API: sales-orders/home-summary.repository.ts, approval-summary.repository.ts,
  home-summary.module.ts y route-permission.ts como patrones; adaptadores
  legacy-home-summary.reader.ts y legacy-marketing-home.reader.ts para precedencia
  y relaciones verificadas. Nuevo contrato/servicio/repositorio de seguimiento
  y adaptador legacy separados solo por sus responsabilidades existentes.
- Frontend: FormalizationFollowUpPreview.tsx y FormalizationHomePage.tsx;
  nuevo servicio tipado bajo services/formalization. Conservar estilos, nombres
  de bandejas, banners y permisos actuales; sin dependencias nuevas.
- Actualizar inventario de rutas, OpenAPI y documentacion de estado cuando
  exista implementacion comprobada. Este plan no declara esos contratos activos.

## Aceptacion

- Casos nativo-only, legacy-only, duplicado sombreado e inactivo/caido excluido.
- Relaciones validas, ausentes y ambiguas sin duplicacion de ordenes.
- Todas/bandejas/proyecto/busqueda/paginacion consistentes; aprobaciones no
  aparecen sin su permiso, ni por busqueda o conteo indirecto.
- Tres aprobaciones -> Por enviar salvo etapa posterior persistida; firma
  comercial legacy no sustituye al nuevo estado de contrato enviado.
- Cierres limitados al ano correcto; pendientes sin recorte de fechas.
- Sin inventar fechas, permisos, referencias de proveedor ni datos de clientes.
- Pruebas automatizadas con dobles no equivalen a persistencia comprobada;
  no ejecutar fixtures en las BD compartidas. Verificacion real solo lectura.
