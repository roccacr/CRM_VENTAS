# 55 - Revision documental integral del checkout - 2026-10-27

## Carácter histórico y precedencia — revisión 2026-11-03

Este documento conserva decisiones, pendientes y resultados de sus cortes fechados; no es una nueva medición ni un inventario exhaustivo del checkout actual. Para migraciones hasta 067 prevalece [03](03-Base-Datos-y-Migracion.md); para el perfil federado [77](77-Perfil-Completo-Lead.md), y para permisos/nota/marcado manual de adéndum [84](84-Adendum-Manual-Migracion-066-y-Permisos.md). 067 concede el default manual a Owner/Jefe General/Jefe de Formalizaciones mediante grants reales, manteniendo deny y la excepción al comodín Owner; no al rol operativo Formalización.

Las pausas, bypass antiguos, conteos de pruebas/rutas/migraciones y propuestas de importación inferiores no sustituyen los contratos posteriores. No se reejecutaron aquí suites, BD, fixtures, restauraciones, integraciones ni despliegues; la documentación no cierra Q 05, CI remoto o aceptación productiva.

## Resultado y alcance

Revision solicitada por el propietario, con tres agentes y coordinacion. Se
contrasto la documentacion propia del proyecto con archivos presentes de API,
frontend, migraciones, scripts y pruebas. Este documento es el indice de la
revision actual; [49](49-Estado-Actual-y-Cierre-Documental.md) conserva la cronologia.
No certifica todas las lineas de codigo, datos productivos o despliegue.

Solo se modifico Markdown. No se editaron fuentes de runtime, configuracion,
`.env`, SQL, dependencias o pruebas. No se ejecutaron migraciones, importadores,
limpiezas, comandos comerciales ni llamadas a ERP. Tampoco hubo nuevas consultas
MySQL. Las verificaciones del26 se conservan como evidencia fechada.

Plan aplicado:

1. Inventariar documentos propios y fuentes de implementacion; separar paquetes
   de skills, generados y referencias historicas del contrato actual.
2. Revisar en paralelo API/seguridad/contratos, frontend/UX/permisos y datos/runners.
3. Corregir contradicciones actuales y documentar funciones omitidas, reutilizando
   las guias existentes y conservando snapshots con su fecha.
4. Actualizar entrada, leyes, indices, mapa frontend y limites de pruebas.
5. Validar enlaces/anclas, diferencias y comandos disponibles; registrar fallos
   sin convertirlos en una certificacion positiva.

## Precedencia

Las solicitudes expresas del propietario y la ley de producto conservan autoridad.
Este inventario describe implementacion; no agrega permisos de negocio. Los
blueprints y reuniones no invalidan ampliaciones posteriores implementadas.
Versiones de React, cifras de registros o flags de otros dias no son mediciones
actuales por aparecer en una guia. Archivo de migracion, registro en runner,
aplicacion en ledger y conformidad del esquema son evidencias distintas.

## Matriz de cobertura y correcciones

| Area | Estado contrastado y correccion | Fuentes de implementacion y documento operativo |
| --- | --- | --- |
| Identidad y BFF | Sesion, perfil, usuarios/roles, overrides y guards; no atribuir acceso a usuarios solo por existir en sec_user | `src/modules/crm/identity/`, `src/common/security/`; [31](31-Contrato-Identidad-y-Permisos-P0-S1.md), [33](33-Contrato-API-Identidad-P0-S1.md), [guia BFF](../../GUIA-AUTH-CRM-TINK.md) |
| Rutas API | Inventario de ampliaciones registradas, sin confundir controladores preparados con modulos importados | `src/app.module.ts`; [22](22-Mapa-de-Implementacion-API.md) |
| Administracion/catalogos | Lectura/escritura depende de permiso, fuente y gates; Expedientes sigue siendo consulta | `src/modules/crm/catalogs/` y dominios dedicados; [35](35-Catalog-API-and-Schema.md) |
| Leads e historia | Esquema nativo, responsable por sec_user, proveedor+ID e historial repetible; sin CRUD comercial general ni copia automatica de legacy | [43](43-Leads-Esquema-Nativo.md), [44](44-Bitacora-Legacy-y-Timeline.md) |
| Inicio Mercadeo | Resumen real independiente; conversion por cohortes y completadas por evento/fecha tienen semanticas distintas | [46](46-Mercadeo-Resumen-Leads.md), [48](48-Mercadeo-Metricas-Citas.md) |
| Captacion | Reporte real con una respuesta, nativo primero y legacy opcional; periodos/filtros/desgloses/exportaciones actuales sustituyen maqueta | [53](53-Captacion-Leads-Reporte-Federado.md), [30 frontend](../../frontend/Arquitectura/30-Estado-Frontend-Verificado.md) |
| Eventos y citas | Menu y permiso mercadeo.appointments.read retirados por038; Calendario y calculos se conservan | `202610260038_remove_marketing_appointments.ts`; [03](03-Base-Datos-y-Migracion.md) |
| Calendario | Modelo nativo y lectores de metricas; no editor de agenda conectado, Graph o notificaciones por inferencia | [47](47-Calendario-Compartido-Esquema.md) |
| Formalizacion | Seguimiento, tiempos y comandos send/revert/stage registrados; eliminar afirmaciones actuales de solo Home | `ContractTransitionModule`, `HomeSummaryModule`; [50](50-Plan-Seguimiento-Formalizacion.md), [52](52-Etapas-Responsables-y-Tiempos.md) |
| NetSuite | Consulta GET diagnostica dedicada, autorizacion CRM antes del proveedor; no persistencia ni escritura ERP | `src/integrations/netsuite/`; [04](04-Integraciones-ERP.md), [README adaptador](../src/integrations/netsuite/README.md) |
| Persistencia/migraciones | 36 migraciones registradas,035-038 y runners con destinos diferentes; numeracion no equivale a pendientes | `scripts/run-schema-migrations.ts`; [03](03-Base-Datos-y-Migracion.md), [52](52-Etapas-Responsables-y-Tiempos.md) |
| Limpieza e importadores | Evidencia historica y scripts sensibles, no acciones aprobadas por actualizar documentos | [45](45-Usuarios-Por-Correo.md), [51](51-Limpieza-Datos-Nativos.md) |
| UX/rutas | Conexion real, placeholders y simulaciones separados; loader actual CaptureLoading, periodos Trimestre/Ano y grafico apilado | [30 frontend](../../frontend/Arquitectura/30-Estado-Frontend-Verificado.md) |
| Operacion/CI/QA | Comandos y gates documentados; CI versionado no demuestra ejecucion remota ni restore | [Operacion](Operacion-Despliegue-Rollback.md), [CI MySQL](CI-MySQL-Pruebas.md) |
| Reuniones/blueprints/artefactos | Conservados como propuestas o snapshots; mapa Archify del26 no regenerado | [LEEME mapa](../../../.archify/architecture-crm-actual-20261026-084555/LEEME.md), [SKILLS](../../../SKILLS.md) |

El frontend [30](../../frontend/Arquitectura/30-Estado-Frontend-Verificado.md)
contiene la matriz detallada de rutas/servicios y limites visuales. API22 contiene
las rutas HTTP actuales y sus permisos; los documentos de dominio mantienen el
contrato y las reglas, sin duplicarlos aqui como otra fuente de verdad.

## Validacion ejecutada en esta revision

- `pnpm typecheck`, API: aprobado el27.
- `pnpm typecheck`, frontend: aprobado el27.
- `check-all.cmd`, raiz: fallo en `pnpm format:check` de API. Avisos en
  `migrations/schema-only/202610260038_remove_marketing_appointments.ts`,
  `test/identity/formalization-home-catalog.spec.ts` y
  `test/migrations/formalization-stage-permission.spec.ts`. La cadena no llego a
  lint/typecheck/test/build ni a frontend. No se formateo codigo en esta tarea.
- Agente datos:108 pruebas aprobadas en nueve archivos unitarios con dobles.
  No equivale a persistencia MySQL, HTTP autenticado o prueba productiva.
- Agente API:17 pruebas estaticas/adapters con dobles aprobadas en tres archivos
  (registro/seguridad de AppModule, wiring Captacion y retiro de permiso).
  Se reportan por corrida, sin sumar totales unicos entre conjuntos.
- No se ejecutaron suites MySQL, ERP, migraciones, builds o recorridos de
  navegador por este cierre documental. Los resultados anteriores no se
  reetiquetan como verificacion del27.

### Limites de aceptacion conservados

La suite de esquema de Leads exige siete etapas iniciales; una BD limpiada no es
ese fixture. La prueba live de Captacion asume cero leads nativos y legacy
habilitado: no acredita por si sola un futuro dataset mixto con registros nativos.
Esos limites y la infraestructura aislada estan en CI-MySQL-Pruebas.
La configuracion de escritura local descrita el26 no se volvio a leer y no se
presume igual hoy. Tampoco se verifico ningun despliegue, CI remoto, acceso real,
restore o identidad de un proveedor.

## Resultado de enlaces y revision cruzada

Barrido final del27:105 Markdown propios,803 enlaces locales y46 anclas
comprobados sin destinos o anclas ausentes. Los conteos incluyen el inventario
de este cierre. Tres contrarrevisiones de55/README/49 no detectaron errores
factuales bloqueantes; se reforzaron los encabezados historicos de49 y las
frases de alcance anterior deREADME. `git diff --check` documental aprobado
al terminar; los avisos de conversion CRLF no representan enlaces rotos.
No se inspecciono disponibilidad de URLs externas ni se modificaron paquetes
de skills por sus referencias internas.

## Inventario documental y trazabilidad

Incluye Markdown propio visible y oculto del proyecto, excluyendo `.git`,
`node_modules`, `.agents`, `.codex` y `.superpowers`. Los paquetes de skills son
instrucciones externas: no se reescribieron sus referencias internas. Se verifico
la existencia de siete SKILL.md locales del registro, sin comparar hashes o pins.
Los artefactos binarios/HTML/SQL se conservaron; no se regeneraron diagramas ni
se ejecutaron ejemplos SQL para corregir un documento.

Cada entrada siguiente fue clasificada en su area; que se conserve un documento
historico no implica que sus propuestas esten implementadas. Las correcciones
especificas se encuentran en los encabezados de corte de los documentos y en
los mapas22/30. La revision es documental por archivo/dominio, no una garantia
de ausencia de toda omision futura en un checkout compartido que sigue cambiando.

Inventario de cierre: **105 Markdown**.

| Documento revisado/clasificado | Area |
| --- | --- |
| [.archify/architecture-crm-actual-20261026-084555/LEEME.md](<../../../.archify/architecture-crm-actual-20261026-084555/LEEME.md>) | Compartido/artefacto |
| [AGENTS.md](<../../../AGENTS.md>) | Compartido/artefacto |
| [apps/api/AGENTS.md](<../AGENTS.md>) | API/datos |
| [apps/api/Arquitectura/00-Indice.md](<00-Indice.md>) | API/datos |
| [apps/api/Arquitectura/00-Producto-CRM-TINK-y-P0.md](<00-Producto-CRM-TINK-y-P0.md>) | API/datos |
| [apps/api/Arquitectura/01-Resumen-API.md](<01-Resumen-API.md>) | API/datos |
| [apps/api/Arquitectura/02-Arquitectura-Backend.md](<02-Arquitectura-Backend.md>) | API/datos |
| [apps/api/Arquitectura/03-Base-Datos-y-Migracion.md](<03-Base-Datos-y-Migracion.md>) | API/datos |
| [apps/api/Arquitectura/04-Integraciones-ERP.md](<04-Integraciones-ERP.md>) | API/datos |
| [apps/api/Arquitectura/05-Seguridad-Auditoria-Observabilidad.md](<05-Seguridad-Auditoria-Observabilidad.md>) | API/datos |
| [apps/api/Arquitectura/06-ADRs-API.md](<06-ADRs-API.md>) | API/datos |
| [apps/api/Arquitectura/07-Skills-Codex-Instaladas.md](<07-Skills-Codex-Instaladas.md>) | API/datos |
| [apps/api/Arquitectura/08-Revision-Blueprint-y-Siguiente-Paso.md](<08-Revision-Blueprint-y-Siguiente-Paso.md>) | API/datos |
| [apps/api/Arquitectura/09-Decisiones-P0-Permisos-y-Preguntas.md](<09-Decisiones-P0-Permisos-y-Preguntas.md>) | API/datos |
| [apps/api/Arquitectura/10-Analisis-CRM-Actual-Roles-Leads.md](<10-Analisis-CRM-Actual-Roles-Leads.md>) | API/datos |
| [apps/api/Arquitectura/11-Contrato-Canonico-y-Normalizacion.md](<11-Contrato-Canonico-y-Normalizacion.md>) | API/datos |
| [apps/api/Arquitectura/12-Modelo-Datos-P0-MySQL-Kysely.md](<12-Modelo-Datos-P0-MySQL-Kysely.md>) | API/datos |
| [apps/api/Arquitectura/13-Bitacora-Acciones-y-Timeline-Lead.md](<13-Bitacora-Acciones-y-Timeline-Lead.md>) | API/datos |
| [apps/api/Arquitectura/14-Diccionario-de-Datos-y-Modulos.md](<14-Diccionario-de-Datos-y-Modulos.md>) | API/datos |
| [apps/api/Arquitectura/15-Flujo-Comercial-Lead-a-Contrato.md](<15-Flujo-Comercial-Lead-a-Contrato.md>) | API/datos |
| [apps/api/Arquitectura/16-Alcance-PDFs-y-Modularizacion-Dominios.md](<16-Alcance-PDFs-y-Modularizacion-Dominios.md>) | API/datos |
| [apps/api/Arquitectura/17-Calendarios-por-Dominio-y-Supervision.md](<17-Calendarios-por-Dominio-y-Supervision.md>) | API/datos |
| [apps/api/Arquitectura/18-Notas-Adhesivas-y-Anotaciones.md](<18-Notas-Adhesivas-y-Anotaciones.md>) | API/datos |
| [apps/api/Arquitectura/19-Reglas-Operativas-Leads-SLA-y-Perdida.md](<19-Reglas-Operativas-Leads-SLA-y-Perdida.md>) | API/datos |
| [apps/api/Arquitectura/20-Pendientes-Decisiones-y-Preguntas-P0.md](<20-Pendientes-Decisiones-y-Preguntas-P0.md>) | API/datos |
| [apps/api/Arquitectura/21-P0-Direccion-Tecnica-Construccion-Pausada.md](<21-P0-Direccion-Tecnica-Construccion-Pausada.md>) | API/datos |
| [apps/api/Arquitectura/22-Mapa-de-Implementacion-API.md](<22-Mapa-de-Implementacion-API.md>) | API/datos |
| [apps/api/Arquitectura/23-Alcance-P0-Vertical-Leads.md](<23-Alcance-P0-Vertical-Leads.md>) | API/datos |
| [apps/api/Arquitectura/24-Seguridad-Autenticacion-BFF-OIDC-Local.md](<24-Seguridad-Autenticacion-BFF-OIDC-Local.md>) | API/datos |
| [apps/api/Arquitectura/25-Contrato-Canonico-Minimo-Lead-P0-S1.md](<25-Contrato-Canonico-Minimo-Lead-P0-S1.md>) | API/datos |
| [apps/api/Arquitectura/26-Estandar-Nombres-Base-Datos.md](<26-Estandar-Nombres-Base-Datos.md>) | API/datos |
| [apps/api/Arquitectura/27-Identidad-Usuarios-Roles-P0-S1.md](<27-Identidad-Usuarios-Roles-P0-S1.md>) | API/datos |
| [apps/api/Arquitectura/28-Matriz-Roles-Permisos-Areas-P0-S1.md](<28-Matriz-Roles-Permisos-Areas-P0-S1.md>) | API/datos |
| [apps/api/Arquitectura/29-Modelo-Fisico-MySQL-Identidad-P0-S1.md](<29-Modelo-Fisico-MySQL-Identidad-P0-S1.md>) | API/datos |
| [apps/api/Arquitectura/30-Identidad-Canonica-y-Referencias-Externas.md](<30-Identidad-Canonica-y-Referencias-Externas.md>) | API/datos |
| [apps/api/Arquitectura/31-Contrato-Identidad-y-Permisos-P0-S1.md](<31-Contrato-Identidad-y-Permisos-P0-S1.md>) | API/datos |
| [apps/api/Arquitectura/32-Seeds-Identidad-P0-S1.md](<32-Seeds-Identidad-P0-S1.md>) | API/datos |
| [apps/api/Arquitectura/33-Contrato-API-Identidad-P0-S1.md](<33-Contrato-API-Identidad-P0-S1.md>) | API/datos |
| [apps/api/Arquitectura/34-Cierre-Operativo-Administracion-P0-S1.md](<34-Cierre-Operativo-Administracion-P0-S1.md>) | API/datos |
| [apps/api/Arquitectura/35-Catalog-API-and-Schema.md](<35-Catalog-API-and-Schema.md>) | API/datos |
| [apps/api/Arquitectura/36-Registro-Entrega-Administracion.md](<36-Registro-Entrega-Administracion.md>) | API/datos |
| [apps/api/Arquitectura/37-Auditoria-Trazabilidad-y-Conflictos.md](<37-Auditoria-Trazabilidad-y-Conflictos.md>) | API/datos |
| [apps/api/Arquitectura/38-Ordenes-Venta-Estados-Auditoria.md](<38-Ordenes-Venta-Estados-Auditoria.md>) | API/datos |
| [apps/api/Arquitectura/39-Diccionario-Ordenes-Venta.md](<39-Diccionario-Ordenes-Venta.md>) | API/datos |
| [apps/api/Arquitectura/40-Formalizacion-Home-Resumen-y-Rendimiento.md](<40-Formalizacion-Home-Resumen-y-Rendimiento.md>) | API/datos |
| [apps/api/Arquitectura/41-Owner-Herencia-y-Denegaciones.md](<41-Owner-Herencia-y-Denegaciones.md>) | API/datos |
| [apps/api/Arquitectura/42-Jefaturas-Modulos-y-Permisos.md](<42-Jefaturas-Modulos-y-Permisos.md>) | API/datos |
| [apps/api/Arquitectura/43-Leads-Esquema-Nativo.md](<43-Leads-Esquema-Nativo.md>) | API/datos |
| [apps/api/Arquitectura/44-Bitacora-Legacy-y-Timeline.md](<44-Bitacora-Legacy-y-Timeline.md>) | API/datos |
| [apps/api/Arquitectura/45-Usuarios-Por-Correo.md](<45-Usuarios-Por-Correo.md>) | API/datos |
| [apps/api/Arquitectura/46-Mercadeo-Resumen-Leads.md](<46-Mercadeo-Resumen-Leads.md>) | API/datos |
| [apps/api/Arquitectura/47-Calendario-Compartido-Esquema.md](<47-Calendario-Compartido-Esquema.md>) | API/datos |
| [apps/api/Arquitectura/48-Mercadeo-Metricas-Citas.md](<48-Mercadeo-Metricas-Citas.md>) | API/datos |
| [apps/api/Arquitectura/49-Estado-Actual-y-Cierre-Documental.md](<49-Estado-Actual-y-Cierre-Documental.md>) | API/datos |
| [apps/api/Arquitectura/50-Plan-Seguimiento-Formalizacion.md](<50-Plan-Seguimiento-Formalizacion.md>) | API/datos |
| [apps/api/Arquitectura/51-Limpieza-Datos-Nativos.md](<51-Limpieza-Datos-Nativos.md>) | API/datos |
| [apps/api/Arquitectura/52-Etapas-Responsables-y-Tiempos.md](<52-Etapas-Responsables-y-Tiempos.md>) | API/datos |
| [apps/api/Arquitectura/53-Captacion-Leads-Reporte-Federado.md](<53-Captacion-Leads-Reporte-Federado.md>) | API/datos |
| [apps/api/Arquitectura/55-Revision-Documental-Integral-20261027.md](<55-Revision-Documental-Integral-20261027.md>) | API/datos |
| [apps/api/Arquitectura/CI-MySQL-Pruebas.md](<CI-MySQL-Pruebas.md>) | API/datos |
| [apps/api/Arquitectura/Diccionario-Datos/01-Identidad-y-Permisos.md](<Diccionario-Datos/01-Identidad-y-Permisos.md>) | API/datos |
| [apps/api/Arquitectura/Operacion-Despliegue-Rollback.md](<Operacion-Despliegue-Rollback.md>) | API/datos |
| [apps/api/Arquitectura/Plan-Correctivo-Auditoria-CRM-TINK.md](<Plan-Correctivo-Auditoria-CRM-TINK.md>) | API/datos |
| [apps/api/Arquitectura/Reauditoria-54-Plan-y-Resultados.md](<Reauditoria-54-Plan-y-Resultados.md>) | API/datos |
| [apps/api/src/integrations/netsuite/README.md](<../src/integrations/netsuite/README.md>) | API/datos |
| [apps/frontend/AGENTS.md](<../../frontend/AGENTS.md>) | Frontend |
| [apps/frontend/Arquitectura/00-Indice.md](<../../frontend/Arquitectura/00-Indice.md>) | Frontend |
| [apps/frontend/Arquitectura/00-Producto-CRM-TINK-y-P0-Frontend.md](<../../frontend/Arquitectura/00-Producto-CRM-TINK-y-P0-Frontend.md>) | Frontend |
| [apps/frontend/Arquitectura/01-Resumen-Frontend.md](<../../frontend/Arquitectura/01-Resumen-Frontend.md>) | Frontend |
| [apps/frontend/Arquitectura/02-Arquitectura-Frontend.md](<../../frontend/Arquitectura/02-Arquitectura-Frontend.md>) | Frontend |
| [apps/frontend/Arquitectura/03-UI-UX-CRM.md](<../../frontend/Arquitectura/03-UI-UX-CRM.md>) | Frontend |
| [apps/frontend/Arquitectura/04-API-Client-y-Estado.md](<../../frontend/Arquitectura/04-API-Client-y-Estado.md>) | Frontend |
| [apps/frontend/Arquitectura/05-Testing-Frontend.md](<../../frontend/Arquitectura/05-Testing-Frontend.md>) | Frontend |
| [apps/frontend/Arquitectura/06-ADRs-Frontend.md](<../../frontend/Arquitectura/06-ADRs-Frontend.md>) | Frontend |
| [apps/frontend/Arquitectura/07-Skills-Codex-Instaladas.md](<../../frontend/Arquitectura/07-Skills-Codex-Instaladas.md>) | Frontend |
| [apps/frontend/Arquitectura/08-Revision-Blueprint-y-Siguiente-Paso.md](<../../frontend/Arquitectura/08-Revision-Blueprint-y-Siguiente-Paso.md>) | Frontend |
| [apps/frontend/Arquitectura/09-Decisiones-P0-UX-Permisos-y-Preguntas.md](<../../frontend/Arquitectura/09-Decisiones-P0-UX-Permisos-y-Preguntas.md>) | Frontend |
| [apps/frontend/Arquitectura/10-Contrato-Canonico-Frontend.md](<../../frontend/Arquitectura/10-Contrato-Canonico-Frontend.md>) | Frontend |
| [apps/frontend/Arquitectura/11-UX-Bitacora-Acciones-y-Timeline-Lead.md](<../../frontend/Arquitectura/11-UX-Bitacora-Acciones-y-Timeline-Lead.md>) | Frontend |
| [apps/frontend/Arquitectura/12-Diccionario-Funcional-y-Acciones-CRM.md](<../../frontend/Arquitectura/12-Diccionario-Funcional-y-Acciones-CRM.md>) | Frontend |
| [apps/frontend/Arquitectura/13-Flujo-Comercial-CRM.md](<../../frontend/Arquitectura/13-Flujo-Comercial-CRM.md>) | Frontend |
| [apps/frontend/Arquitectura/14-Modularizacion-Frontend-por-Areas-y-Roles.md](<../../frontend/Arquitectura/14-Modularizacion-Frontend-por-Areas-y-Roles.md>) | Frontend |
| [apps/frontend/Arquitectura/15-UX-Calendarios-por-Area-y-Supervision.md](<../../frontend/Arquitectura/15-UX-Calendarios-por-Area-y-Supervision.md>) | Frontend |
| [apps/frontend/Arquitectura/16-UX-Notas-Adhesivas-y-Anotaciones.md](<../../frontend/Arquitectura/16-UX-Notas-Adhesivas-y-Anotaciones.md>) | Frontend |
| [apps/frontend/Arquitectura/17-UX-Dashboard-Leads-SLA-y-Perdida.md](<../../frontend/Arquitectura/17-UX-Dashboard-Leads-SLA-y-Perdida.md>) | Frontend |
| [apps/frontend/Arquitectura/18-P0-Direccion-Frontend-Construccion-Pausada.md](<../../frontend/Arquitectura/18-P0-Direccion-Frontend-Construccion-Pausada.md>) | Frontend |
| [apps/frontend/Arquitectura/19-Mapa-de-Implementacion-Frontend.md](<../../frontend/Arquitectura/19-Mapa-de-Implementacion-Frontend.md>) | Frontend |
| [apps/frontend/Arquitectura/20-Alcance-P0-Vertical-Leads-Frontend.md](<../../frontend/Arquitectura/20-Alcance-P0-Vertical-Leads-Frontend.md>) | Frontend |
| [apps/frontend/Arquitectura/21-Seguridad-Autenticacion-BFF-y-Sesion.md](<../../frontend/Arquitectura/21-Seguridad-Autenticacion-BFF-y-Sesion.md>) | Frontend |
| [apps/frontend/Arquitectura/22-UX-Identidad-Usuarios-Roles-P0-S1.md](<../../frontend/Arquitectura/22-UX-Identidad-Usuarios-Roles-P0-S1.md>) | Frontend |
| [apps/frontend/Arquitectura/23-Regla-IDs-Canonicos-y-Proveedores-Frontend.md](<../../frontend/Arquitectura/23-Regla-IDs-Canonicos-y-Proveedores-Frontend.md>) | Frontend |
| [apps/frontend/Arquitectura/24-Contrato-Visual-Identidad-P0-S1.md](<../../frontend/Arquitectura/24-Contrato-Visual-Identidad-P0-S1.md>) | Frontend |
| [apps/frontend/Arquitectura/25-Continuidad-Administracion.md](<../../frontend/Arquitectura/25-Continuidad-Administracion.md>) | Frontend |
| [apps/frontend/Arquitectura/26-Projects-Design-System.md](<../../frontend/Arquitectura/26-Projects-Design-System.md>) | Frontend |
| [apps/frontend/Arquitectura/27-Entrega-Administracion-y-QA.md](<../../frontend/Arquitectura/27-Entrega-Administracion-y-QA.md>) | Frontend |
| [apps/frontend/Arquitectura/28-Formalizacion-Recorrido-Visual.md](<../../frontend/Arquitectura/28-Formalizacion-Recorrido-Visual.md>) | Frontend |
| [apps/frontend/Arquitectura/29-Formalizacion-Reunion-Ajustes.md](<../../frontend/Arquitectura/29-Formalizacion-Reunion-Ajustes.md>) | Frontend |
| [apps/frontend/Arquitectura/29-Navegacion-Recuperacion-y-Seguimiento.md](<../../frontend/Arquitectura/29-Navegacion-Recuperacion-y-Seguimiento.md>) | Frontend |
| [apps/frontend/Arquitectura/30-Estado-Frontend-Verificado.md](<../../frontend/Arquitectura/30-Estado-Frontend-Verificado.md>) | Frontend |
| [apps/frontend/design-qa.md](<../../frontend/design-qa.md>) | Frontend |
| [apps/frontend/public/Logo/README.md](<../../frontend/public/Logo/README.md>) | Frontend |
| [apps/GUIA-AUTH-CRM-TINK.md](<../../GUIA-AUTH-CRM-TINK.md>) | Compartido/artefacto |
| [CHANGELOG.md](<../../../CHANGELOG.md>) | Compartido/artefacto |
| [README.md](<../../../README.md>) | Compartido/artefacto |
| [SKILLS.md](<../../../SKILLS.md>) | Compartido/artefacto |
