# 42 - Jefaturas, modulos seleccionados y permisos

## Correccion autorizada: plantilla General editable - 2026-10-23

Owner debe poder administrar Jefe General desde Roles y seguridad, modo Por rol.
La plantilla General deja de ser dinamica/protegida para edicion: reutiliza
`sec_role_permission` y `sec_role_module` para persistir acciones y modulos.
Owner sigue siendo global y protegido. General no obtiene Administracion ni
puede eliminarse. Un deny individual, incluido `role.assign` para el actor,
prevalece. Esta decision sustituye las referencias a General inmutable de los
cortes historicos documentados mas abajo.

El acceso del empleado es la interseccion entre los modulos habilitados en la
plantilla General y sus modulos asignados. Quitar un modulo del rol lo cierra
para todos sus titulares, aunque conserven membresias o allows antiguos. Quitar
un permiso del rol no debe regenerarlo desde el catalogo; siguen aplicando las
excepciones personales dentro del techo modular y los grants de otros roles
asignados explicitamente. Los roles derivados son efectivos, no asignaciones
fisicas nuevas. Elegir solo parte de los modulos no elimina el rol General.

Plan: pruebas de regresion del perfil/politica; migracion nativa 030 que conserva
la base operativa actual en filas editables; guardado atomico de modulos y
permisos con motivo, bitacora y versionado; controles reutilizados del editor;
revision independiente, pruebas completas y verificacion visual aislada.
No modificar legacy, datos comerciales, credenciales ni asignar empleados.
La evidencia de este nuevo corte se registra abajo, sin reutilizar como prueba
los resultados historicos de 029.

## Evidencia de la correccion 030

Aplicada con autorizacion expresa del propietario mediante el runner dirigido:
`pnpm exec tsx scripts/run-schema-migrations.ts --only=202610230030_general_manager_template`,
confirmando `CRM_THINK_V2`. Lectura real posterior del repositorio: General
activo, `locked: false`, cuatro modulos operativos, 140 permisos persistidos,
cero administrativos; ledger y un evento de migracion presentes. Cero usuarios
asignados a General en la lectura. No se modificaron asignaciones, overrides,
datos comerciales, legacy ni credenciales. La migracion invalida versiones de
permisos de titulares afectados; no se usaron fixtures.

Prueba visual aislada del componente real RolesSecurityPage con servicios
dobles, en 1440x1000 y 375x900: Owner edita General, deshabilita Ventas y envia
modulos/permisos restantes en un unico payload. Sin errores JavaScript ni
desbordamiento horizontal. Guardado capturado solo en memoria del harness,
sin autenticacion ni escritura real de la matriz. Capturas
`C:/codex-data/audit-reports/general-template-1440.png` y `general-template-375.png`;
script `verify-general-template-ui.cjs` en ese directorio. No equivale a una
sesion autenticada ni demuestra concurrencia real.

Revision independiente: cerrados los casos de replay tras renombrar General,
vista previa de empleado contaminada por borradores sin guardar y guardado de
un rol que marcaba como persistidos borradores de otros. Pruebas de regresion
RED/GREEN; 60 pruebas enfocadas frontend aprobadas y 56 de gestion API.

Verificacion API completa del corte: formato, lint, tipos, build y 5359 pruebas
aprobadas; 113 MySQL omitidas. La primera pasada encontro una cadena opcional
innecesaria en una prueba nueva, corregida. La segunda se detuvo en formato
frontend por cuatro archivos de Mercadeo ajenos a esta correccion:
`marketing-home-preview.model.ts`, `MarketingHomePage.tsx`,
`MarketingHomeSections.tsx` y `MarketingPeriodPicker.tsx`. No se modifican para
forzar un resultado verde. Evidencia completa de esa corrida en
`C:/codex-data/audit-reports/CRM-TINK-General-Editable-2026-10-23-check-all-rerun.log`.
El resultado global de `check-all.cmd` es fallido, no aprobado.

Verificacion frontend separada posterior: lint, tipos y build aprobados; formato
de archivos modificados por esta correccion aprobado. Suite completa: 659
aprobadas y una falla en `test/home/marketing-preview.spec.tsx:178`, que espera
el heading exacto `Leads sin cita` mientras el componente presenta
`Leads sin cita (ultimos 7 dias)` (con acentos en la UI). No se modifico esa
maqueta ni su prueba. Las pruebas de RolesSecurityPage y alcance modular
aprobaron, incluidas las dos regresiones de borradores. Avisos no bloqueantes:
pseudo-elementos JSDOM y chunk Ant Design superior a 500 kB. Diff sin errores
de whitespace; prueba visual repetida tras los ultimos cambios, aprobada.

Sin commits, push ni despliegue. No se acredita concurrencia MySQL, una sesion
autenticada que guarde la matriz mediante HTTP ni persistencia de fixtures.
La persistencia real verificada corresponde a la migracion 030 y a su lectura
posterior, no a un cambio comercial o una asignacion real de empleado.

## Especificacion autorizada - 2026-10-23

El propietario aprueba implementar el plan de jerarquia modular. Owner sigue
heredando todos los roles/permisos activos. Jefe General no es Owner: obtiene
permisos operativos solamente dentro de los modulos activos seleccionados para
esa persona. Administracion de usuarios/roles no se concede automaticamente.
Los denies individuales prevalecen en todos los niveles.

Jefes de area conservan sus grants configurados, limitados a su modulo y a las
membresias activas del empleado. El nombre del rol no es una autorizacion.
Roles sin una politica modular mantienen su comportamiento previo; una persona
con una jefatura modular no puede ampliar su techo agregando un allow directo.
Una asignacion adicional de Owner activa su politica global de manera explicita.

## Modelo y contratos

- Reutilizar `sec_user_role`, `sec_user_org_unit` y overrides existentes.
- Migracion nativa 029: politica `permission_inheritance_mode_role` y relacion
  normalizada `sec_role_module` con claves foraneas, clave compuesta e indice
  inverso. No insertar roles heredados en las asignaciones del usuario.
- Jefe General: politica `selected_modules`; grants persistidos de la plantilla
  dentro de la interseccion de sus modulos habilitados y los del empleado.
  No conceder automaticamente administracion ni regenerar acciones retiradas.
- Relacionar roles base y jefaturas conocidas con sus modulos existentes. No
  inventar areas ni conceder permisos nuevos a jefes de area por el titulo.
- El catalogo de seguridad expone `moduleCodes` y `permissionInheritance` por
  rol; el editor conserva asignaciones directas y permite configurar el techo
  modular de roles. Solo Owner edita General; la plantilla Owner sigue protegida.
- Mantener forma del perfil HTTP: roles efectivos, membresias y permisos
  efectivos. Filtrar permisos fuera del modulo antes de entregarlos al resto
  de servicios; no confiar solamente en ocultar navegacion.
- Cambios de acceso: transaccion con bitacora antes/despues y version de permisos
  para invalidar acceso anterior. No permitir escalada administrativa implicita.

## Plan y responsabilidades

1. Tests de perfil/politica antes de implementacion: parent.
2. Migracion y tests aislados del esquema: agente de BD; parent aplica solamente
   029 y posteriormente 030 con autorizacion y revision. No fixtures en bases compartidas.
3. Catalogo, DTOs y auditoria de gestion de acceso: agente API.
4. Selectores existentes, vista de permisos heredados y pruebas UI: agente frontend.
5. Revision independiente de escaladas, denies y coherencia: agente revisor.
6. Integrar, revisar diff y ejecutar `check-all.cmd`, sin suites MySQL de fixtures.

## Aceptacion

Ana con Jefe General y Mercadeo/Formalizacion accede a esos modulos, no a Ventas
ni a administracion por inferencia. Retirar Formalizacion elimina permisos y
roles efectivos de ese contexto. Denegar un permiso lo bloquea en HTTP y servicio.
Sin modulos no recibe acceso operativo. Un jefe de Mercadeo no accede a
Formalizacion por un grant directo o por el nombre del cargo. Owner permanece
global, sujeto a deny. Revocaciones, roles/modulos inactivos y sesiones obsoletas
no conservan acceso. Registrar evidencia ejecutada y limites al cerrar.

## Limites

Sin cambios en datos comerciales, BD legacy, credenciales ni integraciones ERP.
No activar nuevas vistas comerciales, envio de correos o transiciones de ordenes.
Pruebas con dobles no acreditan concurrencia/persistencia MySQL. La migracion
aditiva autorizada no es permiso para cargar fixtures en las BD compartidas.

## Gestion administrativa

En Usuarios, crear/editar la persona, elegir Jefe General en Roles asignados y
seleccionar sus Modulos asignados. Sin seleccion no recibe acceso operativo;
Administracion no aparece como opcion de General. Registrar el motivo y guardar.
En Roles y seguridad, modo empleado, se mantienen las excepciones por permiso:
denegar quita la accion aunque la plantilla del rol la conceda.

En Por rol, Owner selecciona Jefe General y configura los modulos habilitados
y sus permisos. Guardar cambios exige motivo y persiste ambos atomica y
auditadamente. En Por empleado/Usuarios se elige el subconjunto de modulos para
cada persona y sus excepciones. No requiere editar tablas ni asignar todos los
roles de las areas. Owner conserva su plantilla global no editable.

## Evidencia historica: corte 029 anterior a la correccion

029 aplicada mediante `pnpm exec tsx scripts/run-schema-migrations.ts
--only=202610230029_general_manager_modules`, con confirmacion de destino nativo.
Verificacion de solo lectura: ledger presente, un evento de migracion,
Jefe General activo con `selected_modules`, cero relaciones estaticas para el
rol general y cuatro relaciones base/jefatura para Formalizacion y Mercadeo.
No se asignaron usuarios, no se modificaron overrides ni datos comerciales.

Con filas reales del catalogo, la funcion de politica resuelve Mercadeo y
Formalizacion con sus roles base/jefaturas; sin modulos conserva solo la funcion
Jefe General, sin acceso operativo. Es una previsualizacion de politica, no una
asignacion a un empleado ni una sesion HTTP autenticada.

Regresiones del perfil: grants conservan el rol que los origino y su techo,
evitando sobrevivir a una revocacion mediante otro rol. No se admiten permisos
administrativos de General aunque existan membresias/grants antiguos. El perfil
devuelve modulos efectivos, sin alterar asignaciones directas del editor. Se
verifican scopes distintos por modulo y una membresia excluida de mayor alcance.

Prueba visual aislada con componentes reales y catalogo doble en 1440x1000 y
375x900: seleccion de Jefe General y Mercadeo/Formalizacion, sin opcion de
Administracion, errores JavaScript ni desbordamiento horizontal. Cero envios de
formulario, autenticacion o persistencia. Capturas locales
`C:/codex-data/audit-reports/jefaturas-1440.png` y `jefaturas-375.png`; script
`verify-jefaturas-ui.cjs` en el mismo directorio. No es una sesion real de empleado.

Owner resuelve ademas membresias virtuales de todos los modulos activos, con
scope `all_areas`: una asignacion directa solo a `empresa` no debe ocultar sus
menus. La lectura real del resolver devolvio seis roles, siete modulos activos
y 204 permisos en ese corte; cero denies vigentes. No se cambiaron relaciones
fisicas y las pruebas verifican que un deny siga bloqueando la accion.

Los tres escritores de acceso requieren validacion interna dentro de su propia
transaccion, antes de lecturas de snapshot: bloqueo de roles seleccionados,
version/estado del actor y relectura de politica/grants. La bitacora y el cambio
se guardan en esa transaccion. Un rol nunca acotado rechaza `moduleCodes: []`;
no confundir una peticion de vaciado con permiso global. Owner, General y las
plantillas dinamicas no admiten eliminacion. Pruebas con dobles verifican orden,
rechazo de expansiones concurrentes simuladas y ausencia de escrituras/eventos
ante fallo; no acreditan concurrencia real de MySQL compartido.

Validacion final: `check-all.cmd` salida 0; formato, lint, tipos y builds de
ambos proyectos aprobados. API: 5325 pruebas aprobadas y 113 MySQL omitidas.
Frontend: 633 aprobadas. La primera corrida encontro una dependencia faltante
en el modulo de pruebas HTTP de catalogos; corregida, sus 3840 casos y la corrida
completa posterior aprobaron. Log:
`C:/codex-data/audit-reports/CRM-TINK-Jefaturas-2026-10-23-check-all-rerun.log`.

Avisos no bloqueantes: pseudo-elementos de JSDOM y chunk Ant Design mayor de
500 kB. HTTP local sin sesion: health 200, resumen de Formalizacion 401 y listado
de contratos no registrado 404. Revision independiente sin hallazgos pendientes
en el corte inspeccionado. No se certifican sesion autenticada de un Jefe General
real, concurrencia MySQL, CI remoto o despliegue. No hubo commits ni push.
