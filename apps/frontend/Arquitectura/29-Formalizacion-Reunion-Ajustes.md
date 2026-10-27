# Formalizacion: registro de ajustes surgidos en reunion

## Estado contrastado - 2026-10-27

[30 - Estado frontend verificado](30-Estado-Frontend-Verificado.md) inventaría las rutas, contratos y límites actuales: Captación conectada, seguimiento y cambio protegido de etapa de Formalización. Los cortes fechados siguientes son antecedentes; sus cifras de QA no se reejecutaron en esta revisión documental.


## Resumen agregado de Home - 2026-10-23

El nuevo alcance conecta contratos y los cinco indicadores posteriores mediante
una sola peticion agregada, con rol efectivo activo `formalizacion` y permiso `formalizacion.home.stages.read` allow sin deny. Owner puede heredar el rol desde politica persistida; no se exige asignacion directa.
Aprobaciones conserva su permiso independiente. Mantener apariencia y preload
por numero; no agregar acciones persistidas ni listas de ordenes.
Plan, definiciones, resultados y limites:
[40 - Home y rendimiento](../../api/Arquitectura/40-Formalizacion-Home-Resumen-y-Rendimiento.md).
Los apartados historicos que describen ceros provisionales no son el contrato
de esta ampliacion. Los ceros de error, cuando se muestren por convencion visual
del propietario, se marcan Sin verificar y no acreditan ausencia de ordenes.

## Antecedente de dos banners de Home: carga y contadores - 2026-10-22

Correccion visual posterior: durante la carga, cada contador de contratos se sustituye por el mismo preload de 26x26 usado en aprobaciones. No hay spinner separado arriba ni ceros provisionales visibles mientras consulta; las etiquetas permanecen debajo. El numero, incluido cero real, aparece al resolver la consulta. Esta regla sustituye la descripcion de 0/0 durante carga del apartado siguiente; error/reintento y permisos no cambian.

- Contratos conserva ambos espacios de metricas y etiquetas; durante carga muestra un preload en lugar de cada numero. Se retira el reemplazo por "Contratos no disponibles". Error explicito con reintento y valores sin verificar, nunca convertir fallo de BD en cero confirmado.
- Datos correctos reemplazan los provisionales sin alterarlos. Lectura puntual verificada: aprobaciones 2, contratos Por enviar 186 / Pendientes de firma 0; no se fijan esos valores en codigo.
- Promesa compartida solo dentro del montaje para no repetir consultas por StrictMode. Sin cache global, sin dependencias nuevas ni peticiones en entrada directa a bandejas vacias. Al retirar permiso/rol se desmonta el consumidor y se ignoran resultados tardios; nuevo acceso consulta nuevamente.
- Aprobaciones mantiene permiso exacto con deny prioritario. Contratos mantiene rol activo formalizacion, no Owner ni otro rol sustituto. Los demas banners siguen en cero.
- Pruebas visuales aisladas con respuestas sustituidas en escritorio y viewport reducido, sin desbordamiento observado. No habia sesion autenticada en el navegador de QA: la medicion real de BD se documento separadamente en arquitectura API 38.
- Se compacto el fallo de contratos a "Sin verificar" con reintento pequeno y explicacion en tooltip; etiquetas de ambas metricas sin cambios. QA visual del fallo confirma 0/0 y sin desbordamiento. Tras este pulido: 63 pruebas focalizadas, lint, tipos y formato correctos; previamente check-all.cmd completo paso con API 5138 y frontend 472 pruebas (113 MySQL omitidas para no usar fixtures compartidos).

## Antecedente de alcance corregido: solo Home - 2026-10-22

Se retira el adelanto de la bandeja real y botones de registrar/revertir envio. Las colas de ordenes vuelven a la vista vacia anterior sin consultas de listado; solo queda el banner de Home conectado y protegido por rol formalizacion. No se modifican datos ni estados para deshacer UI. Los servicios/componentes de la bandeja agregados en ese adelanto se retiran; no mostrar acciones persistentes hasta una nueva autorizacion.

## Contratos conectado por rol - 2026-10-22

Antecedente del segundo banner: el Home actual usa el resumen agregado y roles efectivos descritos al inicio; `contract-summary-service.ts` conservado no es el consumidor de etapas actual. Mantener este titulo como destino de enlaces historicos. Listado/envio/reversion no son handlers activos; existencia de clases/pruebas no acredita su registro en AppModule.

Banner real GET /formalization/contracts/summary conectado. Solo el rol activo formalizacion monta el consumidor; Owner/Jefatura o un permiso del banner de aprobaciones no bastan. Denegaciones de permisos retirados o ajenos no sustituyen esta regla de lectura por rol; envio/reversion tienen sus permisos efectivos separados en backend.

Se pasan roles reales del perfil por AppRouteContent/app-routes, se muestran preload/error sin convertir fallos en cero, y el log DEV [Formalization API: contracts/summary] Incoming aggregate muestra exclusivamente el contrato agregado validado. Se elimina el log local-placeholder anterior. Cuentas exclusivas Por enviar/Pendientes de firma, fuentes y deduplicacion resueltas en API; ningun cliente decide autoridad de BD. Regla vigente: tres checks completos sin etapa posterior arranca Por enviar, no se infiere envio por la firma historica.

La consulta del banner no agrega operaciones sobre ordenes. Los endpoints de envio/reversion estan en API; lista operativa y botones reales siguen fuera de este corte. No modificar la preview vacia para simular cambios persistidos. Detalle y evidencia: [38 - Contratos por fuente](../../api/Arquitectura/38-Ordenes-Venta-Estados-Auditoria.md#contratos-resumen-y-transiciones-por-fuente---2026-10-22).

## Diagnostico de consola de Contratos - 2026-10-22

En desarrollo, al montar Inicio, se registra [Formalization: contracts/banner] Current data con source=local-placeholder, apiConnected=false y los dos valores locales mostrados (toSend/pendingSignature). No es un JSON recibido del API ni acredita lectura de BD: el contador contractual sigue sin conectar. No agrega peticiones, datos personales ni logs en produccion. El servicio de aprobaciones conserva su log Incoming JSON existente. Verificado con 21 pruebas de banners (incluye DEV/produccion), ESLint focalizado, Prettier, typecheck y build; advertencia previa del vendor mayor a 500 kB permanece.

## Contratos pendientes: aclaracion confirmada, solo documentacion - 2026-10-22

El propietario pide guardar la idea, sin implementar aun. El siguiente trabajo sera conectar el banner Contratos pendientes con un resumen API global de ambas BD, como antecedente de lectura del banner de aprobaciones. Los ceros actuales no se convierten en resultados reales por esta nota.

- Por enviar: tres aprobaciones completas y envio no registrado. Pendientes de firma: envio registrado, firma pendiente. Son estados distintos y excluyentes; no contar enviadas/firmadas como Por enviar solo por conservar tres checks aprobados.
- El banner exige al menos rol activo `formalizacion` y contexto del modulo, con comprobacion backend antes de leer y frontend antes de consultar. Modulo solo o Jefatura sin rol base no bastan. No concede acciones de envio/reversion ni cambia el permiso independiente del banner Pendientes de aprobacion.
- Registrar envio: boton y confirmacion sin nota obligatoria; no manda correos. El rol Formalizacion heredara el permiso y una denegacion directa por empleado prevalecera. No aplicar asignaciones en esta pasada.
- Revertir a Por enviar: permiso separado, motivo obligatorio y nota en la bitacora. Registrar actor, fecha, orden/fuente, valores anteriores/nuevos y transicion; agregar evento sin borrar historia. No se presume grant por defecto del permiso de reversion.
- Envio y reenvio reales ocurren fuera del CRM; no agregar integracion de correo ni evento automatico de reenvio. El CRM registra solo los cambios de estado autorizados.
- Lectura de ambas fuentes: nativo primero por identidad migrada, sin duplicados ni escrituras. Gestion futura solo en la fuente autoritativa: nativo si existe, legacy si no. Fuente fallida no significa ausencia ni cero.

Detalle canonico, mapeo de las tres aprobaciones, ejemplo JSON y aceptacion pendiente: [38 - Ordenes e historial](../../api/Arquitectura/38-Ordenes-Venta-Estados-Auditoria.md). Falta verificar el mapeo de envio/firma/etapa en cada fuente antes de consultar; no inventar columnas ni fechas. No se conecto API ni BD en esta revision.

## Confirmacion posterior del propietario - 2026-10-22

Se resuelve parte del punto 1: cuando Jefatura, Formalizacion y Desarrolladora estan aprobadas, inicia Contratos pendientes / Por enviar. Es una etapa CRM, no una instruccion para modificar el ERP. Desarrolladora corresponde a `aprobacion__rdr_ov`, Jefatura a `chekJefeVenta` y Formalizacion a `aprobacion_forma_ov`; la duda historica RDR/desarrolladora queda resuelta para este mapeo.

Autoridad de gestion confirmada: orden existente en `CRM_THINK_V2` se modifica solo en nativo; si no existe, se gestiona en `crmdatabase-api`, con su historial. No duplicar mutaciones ni cambiar a legacy ante errores de la fuente nativa. Detalle y limites: [38 - Ordenes e historial](../../api/Arquitectura/38-Ordenes-Venta-Estados-Auditoria.md). Esta decision no resuelve el resto de transiciones ni acredita implementacion operativa o escrituras ejecutadas.

## Clasificacion al corte f2dc4f1 - 2026-10-22

Registro de necesidades y dudas de reunion, no autoridad nueva de producto. Las decisiones abiertas de aprobaciones, llaves, adendas, cartera, tickets, notificaciones y cierre anual no quedan resueltas por la remediacion tecnica. Los apartados fechados de implementacion/QA conservan su evidencia original; no se ejecutaron de nuevo. Estado de Inicio/seguimiento y permisos: [29 - Remediacion](29-Navegacion-Recuperacion-y-Seguimiento.md). El contador es una lectura autorizada; no implementa la bandeja gestionable ni concede aprobar/devolver. Los seis banners son provisionales y seguimiento/movimientos no estan disponibles; Calendario/Resumen siguen DEMO.

## Naturaleza del registro

- Fecha de incorporacion a la documentacion: 15/10/2026, Costa Rica.
- Fecha de la reunion: no especificada en el material recibido.
- Fuente: texto aportado por el usuario, titulado "Resumen de reunion - Ajustes al CRM y al proceso de formalizacion", adjunto Texto pegado.txt, identificador beef1d3c-ae3e-496e-b90a-65756c16605e.
- Fuente complementaria incorporada el 15/10/2026: transcripcion de llamada aportada por el usuario, adjunto Texto pegado.txt, identificador cda83c55-2551-4e23-9a1a-8cad05167c6e. Los minutos siguientes son posiciones de esa transcripcion, no horas de reloj.
- Instruccion del usuario: registrar unicamente en documentacion; no implementar.
- Estado: necesidades expresadas en reunion, con definiciones pendientes explicitadas. Este registro no certifica aprobacion final de reglas ni implementacion.
- Relacion: complementa [28-Formalizacion-Recorrido-Visual.md](28-Formalizacion-Recorrido-Visual.md). Ese documento describe la maqueta anterior; no demuestra que estos ajustes de reunion ya esten hechos.

No se modifican pantallas, menu Resumen, permisos, API, BD ni integraciones como consecuencia de este registro.

### Avance posterior autorizado: nombres y textos - 15/10/2026

Despues del registro de reunion, el usuario autorizo exclusivamente renombrar
los banners y sus textos: Traspaso firmado, descripcion Firma registrada /
Llaves pendientes; Formalizaciones cerradas este anio, descripcion Proceso
finalizado. Los titulos de sus bandejas mantienen los mismos nombres.

Este avance es solo de texto: no modifica filtros, poblaciones, contadores,
fechas, permisos, transiciones ni integraciones. La muestra inicial conserva
3 y 0. El contador firmado sigue representando contratos firmados, no traspasos
firmados con llaves pendientes; los cierres todavia no filtran por anio.
Inicio y ambas bandejas muestran una aclaracion explicita de esta limitacion.
La nueva logica de los puntos 6 y 7 sigue pendiente; no se considera implementada.

Verificacion de este ajuste: prueba previa fallo por los nombres antiguos;
`pnpm check` final aprobado con formato, lint, TypeScript, 414 pruebas en 29
archivos y build. En navegador autenticado se verificaron nombres, descripcion,
acceso a la bandeja de tres ordenes y ausencia de desbordamiento de textos en
movil 390x844 y escritorio 1440x1000. Sin cambios API/BD. Permanece el aviso no
bloqueante de bundle mayor a 500 kB.

### Limpieza visual posterior - 15/10/2026

El usuario pidio quitar los mensajes de ejemplo, conservando los datos de
prueba. Se retiran de Inicio y bandejas la nota del cambio de nombres y los
avisos de datos ficticios/solo consulta; tambien los avisos generales de
demostracion en ficha, calendario, formularios, indicadores y Resumen.
Los titulos, pies de tabla y etiquetas generales usan textos neutros.

No cambia ningun fixture, contador, filtro, transicion, fecha, permiso ni
integracion. Los indicadores siguen fijos y los nombres nuevos siguen sin
incorporar logica de traspaso/llaves o periodo anual. La ausencia de avisos
en pantalla no acredita operacion productiva.

Se conservan controles de prueba (Simular resultado, Usar documento de ejemplo
y Restablecer ejemplo), nombres/identificadores de los registros ficticios,
validaciones de campos/requisitos y la marca Sin validez legal del documento
de muestra. No se presentan lecturas de contenido de archivos que no existen.
El checklist conserva los pendientes de politica y cobertura parcial.

Verificacion final de limpieza: `pnpm check` aprobado con formato, lint,
TypeScript, 414 pruebas en 29 archivos y build. Los casos actualizados exigen
ausencia de los avisos retirados y mantienen los valores de ejemplo y las
validaciones del flujo. En navegador autenticado se comprobaron Inicio,
formulario de contrato y Nuevo evento; Inicio no contiene los bloques de
aviso retirados. Sin desbordamiento horizontal en 1440x1000 y 390x844.
Evidencia: inicio-limpio-15oct.png en la carpeta de evidencias de Formalizacion.
Persisten avisos no bloqueantes de jsdom y tamano de bundle.

### Limites de la transcripcion

La fuente advierte que el contenido generado por IA puede ser incorrecto.
Ademas, salta de 2:39 a 47:36: no contiene casi 45 minutos de la llamada.
Todas las intervenciones estan atribuidas al mismo nombre y varias frases/nombres
son imprecisos. Sirve para registrar necesidades y dudas, no para identificar con
certeza quien aprobo cada regla.

Los puntos del resumen inicial que no aparecen en el fragmento recibido
(aprobaciones, umbral de tres meses, adendas, cierre anual, entre otros) se
conservan con su fuente original; la ausencia en esta transcripcion parcial no
los confirma ni los descarta. El usuario autorizo documentar lo faltante para
trabajarlo despues, no implementarlo.

## 1. Aprobacion previa de ordenes

Requerido en reunion:

- Validar tres verificaciones: jefatura, desarrollador y formalizacion.
- Incorporar bandeja/banner "Pendientes de aprobacion", solo para supervision. Se menciono a Milena como persona con acceso.
- La supervisora revisa y aprueba desde una tabla antes del ingreso a "Contratos pendientes".

Pendiente:

- Orden exacto de las tres verificaciones respecto a la aprobacion de supervision.
- Si supervision constituye una cuarta aprobacion, una de las tres o una revision del mismo control.
- Si el permiso pertenece al rol supervisor o exclusivamente a Milena.
- La transcripcion (2:17-2:39) menciona a Milena y a Katty, esta ultima con perfil
  individual y de supervision. No confirma el acceso exclusivo de Milena indicado
  en el resumen inicial. Ver el punto 13 antes de asignar permisos a personas.
- Correspondencia entre "desarrollador" de estas notas y "RDR" de la documentacion anterior: no asumir equivalencia.

## 2. Compra con o sin financiamiento bancario

- Agregar un campo en la orden, gestionado en CRM, que indique si requiere financiamiento bancario.
- Con banco: Gestion bancaria y despues Pendientes de saldo.
- Sin banco: omitir Gestion bancaria y pasar a Pendientes de saldo.
- Mostrar instrucciones/acciones de respuesta o formalizacion de entidad bancaria solo cuando requiera banco.

Contradiccion recogida en las notas: tambien se menciona que una venta sin banco pasa directamente a traspaso. Confirmar si esto solo sucede despues de validar la condicion financiera. No adoptar el salto como regla aprobada ni equiparar "sin banco" a "sin saldo".

## 3. Evento de ingreso a Gestion bancaria

- El envio de un correo al cliente habilita o ejecuta el paso a Gestion bancaria.
- Reflejar el cambio en la orden.
- Mantener "Sin iniciar / En proceso" en su banner.
- Revisar en NetSuite desembolsos o pagos asociados al cliente y la orden.

Pendiente: identificar el correo disparador; si enviar cambia automaticamente el estado o habilita otra accion; y que movimiento de NetSuite debe validarse. No asumir que se trata del correo de envio del contrato ni confundir apertura del correo con envio.

## 4. Alertas segun fecha de entrega

- Consultar la fecha de entrega de la unidad.
- Calcular tres meses antes de esa fecha.
- Mostrar en rojo las gestiones bancarias pendientes al llegar a ese umbral.
- Identificar tambien ordenes con entrega vencida que continuan en Gestion bancaria.

Pendiente: diferenciar visualmente proxima entrega y entrega vencida. Antes de implementar, precisar origen de la fecha, tratamiento de fechas ausentes/cambiadas y criterio de meses calendario; esas reglas no estan definidas en el resumen.

## 5. Pendientes de saldo y consulta financiera

- Consultar saldo de la orden en NetSuite.
- Mostrar en Pendientes de saldo las ordenes con monto por pagar.
- Registrar que la consulta financiera fue realizada y validada.
- Incorporar boton para pasar a Traspasos pendientes cuando cumpla la condicion financiera.

Pendiente: si avanzar requiere saldo cero, aprobacion de consulta o ambas; tratamiento de saldos a favor. Registrar una consulta no debe documentarse como equivalente a aprobarla mientras esa relacion no se defina.

## 6. Traspaso firmado y cierre

- Renombrar el banner "Contratos firmados" a "Traspaso firmado".
- Incluir ordenes cuyo traspaso ya se firmo y cuya entrega de llaves sigue pendiente.
- Para cerrar, validar conjuntamente:
  1. Consulta o condicion financiera aprobada.
  2. Traspaso firmado.
  3. Llaves entregadas.
- Renombrar cierre a "Formalizaciones cerradas este anio", descripcion "Proceso finalizado".
- Contar cierres por anio: el nuevo periodo inicia en cero, conservando historial de anios anteriores.

Impacto semantico: no es solo cambiar el titulo del banner. Firma de contrato y firma de traspaso son hitos distintos; el nuevo contador cambia su poblacion. La firma de contrato sigue siendo un paso del flujo.

Pendiente derivado del contraste: definir quien registra/consulta entrega de llaves, desde que area y con que respaldo; y si la excepcion de traspaso pendiente autorizado del flujo anterior permite cerrar o deja de hacerlo bajo estos tres requisitos. No resolver esta incompatibilidad por suposicion.

El contador anual debe entenderse como cambio de periodo de consulta, no como instruccion de borrar cierres o historiales.

## 7. Panel general para supervision

| Banner solicitado | Clasificacion o descripcion |
| --- | --- |
| Pendientes de aprobacion | Por revisar y aprobar |
| Contratos pendientes | Por enviar / Pendientes de firma |
| Gestion bancaria | Sin iniciar / En proceso |
| Pendientes de saldo | Consulta financiera |
| Traspasos pendientes | Por gestionar |
| Traspaso firmado | Firma registrada; entrega de llaves pendiente |
| Formalizaciones cerradas este anio | Proceso finalizado |

Debe permitir comprender el avance completo desde el inicio hasta el cierre.

Pendiente: si los contadores representan la etapa actual exclusivamente o tambien una vista acumulada. No sumar poblaciones superpuestas como si fueran ordenes diferentes.

## 8. Pendientes de seguimiento

- Agregar filtro por proyecto.
- Ordenar por mayor antiguedad primero.
- Mostrar dias transcurridos en la etapa actual.

Parte de esta presentacion tiene antecedente en la maqueta. Eso no acredita el calculo operativo ni la cobertura del filtro en todas las bandejas. Para implementacion futura se debe precisar fecha de entrada/reentrada a cada etapa.

## 9. Tiempos de gestion bancaria

Tabla requerida para ordenes financiadas:

1. Orden y estado actual.
2. Fecha de firma.
3. Fecha de inicio bancario.
4. Fecha de formalizacion bancaria.
5. Dias firma a inicio.
6. Duracion bancaria, diferenciando en proceso/finalizada.
7. Dias firma a formalizacion bancaria.

La referencia compartida es ficticia: corte al 14/10/2026, dias naturales, sin recalculo al simular acciones. No hay metas ni alertas aprobadas para estas duraciones.

Pendiente: que firma inicia el calculo y como se actualizan indicadores operativos. No confundir las alertas de tres meses antes de entrega del punto 4 con un SLA de duracion bancaria.

## 10. Adendas por atraso de entrega

- Identificar ordenes que requieren adenda por cambio de fecha de entrega.
- Consultar proyecto, unidad y fecha contractual.
- Identificar afectadas cuando se conozca un atraso.
- Permitir marcar si corresponde adenda a una persona autorizada; se menciono a Katia como ejemplo, no como asignacion definitiva de permiso.
- Registrar fecha programada de envio.
- Generar evento o recordatorio en calendario.
- Banner de cantidad de adendas pendientes.
- Tabla: orden, cliente, proyecto, unidad, fecha contractual, fecha programada de envio y estado.
- Registrar envio y finalizacion del seguimiento.
- Estados minimos mencionados: pendiente de envio, enviada, no aplica, cancelada.

Pendiente:

1. Cuando corresponde emitir adenda.
2. Como se registra/confirma atraso del proyecto.
3. Quien puede marcar aplicacion, programar y cancelar.
4. Si seguimiento termina con envio o requiere firma y cumplimiento.
5. Distincion entre no aplica y cancelada.

No se considera definida una automatizacion de emision contractual. El alcance anterior dejaba estas gestiones para fases posteriores; la reunion incorpora su necesidad, sin resolver por si sola su aprobacion o reglas.

## 11. Acciones y recordatorios del cliente

Ampliar acciones del cliente para centralizar:

- WhatsApp.
- Llamadas.
- Correos.
- Tareas.
- Reuniones.
- Citas y eventos.
- Recordatorios de respuestas y pendientes.

Se plantea seguimiento tipo ticket para consultas que no se resuelven inmediatamente.

El resumen inicial terminaba en "si un cliente consulta algo que no puede
resolverse de inmediato". La transcripcion complementa la necesidad en
54:59-57:34:

- Crear la tarea o ticket desde la gestion del cliente, sin tener que salir a
  preguntar por otros canales y despues duplicar una nota de seguimiento.
- Asignar a las personas o areas que pueden ayudar, por ejemplo Operaciones
  o Ventas.
- Notificarlas al crear la solicitud, dentro de la misma gestion.
- Mantener visible la respuesta o asunto pendiente para quien solicito ayuda.
- Usuarios con CRM pueden ver la notificacion, abrir el ticket y responder;
  la respuesta debe quedar visible para la formalizadora.
- Personas sin acceso al CRM deben poder recibir la solicitud por correo.
  Esto no implica concederles una cuenta o permisos de CRM.

Estado: necesidad registrada, no implementada. Pendiente delimitar tarea frente
a evento/ticket, participantes y responsables, estados, cierre, plazos, historial,
reglas de notificacion y alcance transversal. La transcripcion no define que
una persona externa pueda contestar por correo y que esa respuesta se incorpore
automaticamente al ticket; no asumir esa integracion.

## 12. Microsoft y documentos en OneDrive

Fuente: 0:28-0:48 y 50:29-50:48.

- Se expresa la intencion de usar Microsoft para la autenticacion habitual.
- La cuenta local presentada se explica como cuenta de prueba, al no contar
  con las cuentas de las usuarias para demostrar el acceso.
- Se espera vincular/subir los documentos mediante OneDrive.

No es prueba de que OneDrive ya funcione ni autorizacion para retirar el acceso
local existente. Pendiente validar cuentas, permisos, ubicacion documental y
comportamiento de la integracion. Iniciar sesion con Microsoft y tener acceso
al repositorio son capacidades distintas que deben verificarse.

## 13. Cartera individual, supervision y asignacion

Fuente: 1:59-2:39 y 47:36-47:56.

- Se discute si todas las formalizadoras ven todas las ordenes o solamente
  las que llevan asignadas.
- Se plantea una cartera individual por formalizadora y una vista conjunta
  para supervision.
- La jefatura debe poder asignar responsable a cada orden, pensando tambien
  en el crecimiento del equipo.
- Se menciona a Katty con perfil individual de formalizadora y perfil de
  supervisora para ver el conjunto de su gestion y la de Milena.

Pendiente confirmar alcance de lectura, gestion y reasignacion por rol, asi
como visibilidad de contadores y ordenes no asignadas. No convertir los ejemplos
de nombres en privilegios personales definitivos. La transcripcion usa variantes
como Katty/Katia: confirmar identidades y su correspondencia con los roles.

## 14. Orden caida o perdida

Fuente: 50:48-51:25 y mencion de "orden perdida" en 54:34.

Necesidad omitida en el resumen inicial:

- Incorporar la gestion de enviar/marcar la orden como caida.
- Usar una plantilla de caida; en la llamada se afirma que ya esta establecida.
  Su existencia y contenido no se han verificado en esta tarea.
- Registrar motivo, etapa del proceso en que cae y si corresponde devolucion.
- Incluir monto de devolucion cuando aplique.
- Permitir entender si cae durante la gestion bancaria o despues de formalizar.

Pendiente confirmar si "caida" y "perdida" son el mismo estado, quien puede
ejecutarlo, destinatarios de la plantilla, evidencia, efecto en banners y
posible reactivacion. No atribuir al CRM la ejecucion de una devolucion de
dinero: registrar un monto y realizar el pago son operaciones diferentes.

## 15. Tipos de evento y banner de eventos del dia

Fuente: 1:38-1:59, 52:36-53:16 y 54:06-54:34.

- Definir los tipos de actividad propios de Formalizacion.
- Diferenciar firma de credito de una reunion generica para consultar las
  firmas coordinadas para la semana.
- Se plantea un banner de eventos para hoy, con acceso a firmas de contrato,
  firmas de credito y reuniones.
- Mantener fecha/hora, relacion con la orden y vistas de calendario/agenda.

Estado: propuesta registrada para definicion posterior. Pendiente confirmar
taxonomia, conteos, filtros de persona/supervision y ubicacion del banner.
No mezclar firma de contrato, firma de credito y firma de traspaso como un
unico hito ni tratar una firma agendada como firma realizada.

## 16. Notificar cancelacion de firma de credito

Fuente: 53:16-53:35.

- Se solicita como mejora posterior notificar cuando se cancele una firma
  de credito que ya estaba agendada.
- Destinatarios mencionados: quien hace la solicitud ("a mi"), Katia y Stanley.
  La transcripcion no permite identificar con certeza a quien corresponde
  "a mi".

Prioridad expresada: "mas adelante"; no compromiso inmediato. Pendiente
confirmar receptores, permisos, canal, contenido, momento de aviso y distincion
entre cancelar y reprogramar. No se activa ningun envio con este registro.

## 17. Cuotas y proyecciones corresponden a Cobros

Fuente: 49:41-50:07.

Se atribuye la edicion de cuotas/proyecciones a Cobros, no a Formalizacion.
El fragmento contiene errores de reconocimiento ("covers"), por lo que se
registra la interpretacion contextual, coherente con la separacion de areas
ya documentada. No autoriza edicion financiera desde Formalizacion.

## 18. Bitacora y ubicacion de botones: aclaraciones pendientes

Fuente: 49:03-49:41.

- Se escucha que el historial es una bitacora y "se va a quitar". Confirmar
  si se refiere a quitar/reubicar ese bloque visual; no interpretar como
  aprobacion para eliminar auditoria, fechas o trazabilidad.
- Se propone acomodar todos los botones en un lugar y tambien se describe
  la agrupacion actual por banco y traspaso. No queda resuelta la distribucion
  final de la botonera.

Mantener estos asuntos como decisiones de presentacion pendientes, sin
modificar pantallas ni retirar registros.

## Ampliaciones detectadas al contrastar la llamada

| Registro | Referencia | Incorporacion para trabajo posterior |
| --- | --- | --- |
| Punto 11 ampliado | 54:59-57:34 | Ticket colaborativo, asignacion, notificacion en una sola gestion y destinatarios sin CRM |
| Punto 12 | 0:28-0:48; 50:29-50:48 | Acceso habitual Microsoft y expectativa documental OneDrive |
| Punto 13 | 1:59-2:39; 47:36-47:56 | Cartera individual, supervision conjunta y asignacion por jefatura |
| Punto 14 | 50:48-51:25; 54:34 | Orden caida/perdida, plantilla, motivo, etapa y monto de devolucion |
| Punto 15 | 52:36-53:16; 54:06-54:34 | Firma de credito diferenciada, seguimiento semanal y eventos del dia |
| Punto 16 | 53:16-53:35 | Avisos por cancelacion de firma, expresamente para mas adelante |
| Punto 17 | 49:41-50:07 | Delimitacion de cuotas/proyecciones hacia Cobros |
| Punto 18 | 49:03-49:41 | Confirmar reubicacion de bitacora y distribucion de botones |

Todos estos registros son entrada para definir trabajo posterior; ninguno
se marca como desarrollado, conectado o aprobado tecnicamente.

## Contraste con la base anterior

| Tema | Base visual/documental anterior | Necesidad registrada en reunion |
| --- | --- | --- |
| Ingreso | Ejemplo con aprobacion Jefatura y RDR | Tres verificaciones y revision de supervision; secuencia pendiente |
| Supervision | Sin bandeja nueva especifica documentada | Pendientes de aprobacion, visibilidad restringida |
| Inicio bancario | Gestion tras contrato firmado, modalidad y acciones de inicio | Correo disparador por definir y revision de movimientos NetSuite |
| Sin banco | Omite credito; consulta condicion antes del traspaso | Notas contradictorias sobre salto a saldo o traspaso |
| Finanzas | Consulta simulada desconocido/pendiente/cancelado | Evidencia de consulta validada y boton de avance; criterio pendiente |
| Banner de firma | Contratos firmados, transversal al proceso | Traspaso firmado y llaves pendientes; no son el mismo hito |
| Cierre | Traspaso o autorizacion ficticia; llaves fuera de fase | Condicion aprobada + traspaso firmado + llaves entregadas |
| Periodo de cierre | Sin periodo anual operativo | Cierres este anio e historico por anio |
| Alertas | Sin umbrales aprobados en la maqueta | Tres meses antes de entrega y entrega vencida; diferenciacion pendiente |
| Adendas | Fuera de primera fase segun resumen ajustado | Nueva necesidad detallada, sin criterios finales |
| Cliente | Agenda de ejemplo ligada a orden | Acciones multicanal y ticket colaborativo; detalle ampliado con la transcripcion |
| Cartera | Asignacion de ejemplo en la maqueta | Alcance individual/supervision y permisos pendientes de confirmar |
| Caida/perdida | No contemplada en el resumen inicial | Plantilla, motivo, etapa y posible monto de devolucion |
| Eventos | Tareas/reuniones de ejemplo | Firma de credito diferenciada, agenda semanal, eventos de hoy y avisos futuros |

La reunion cambia o amplia aspectos del alcance anterior. Conservar ambos antecedentes evita convertir la maqueta existente en prueba de cumplimiento de los nuevos requisitos. Antes de implementar, conciliar explicitamente llaves/adendas, aprobaciones, excepciones y permisos con la persona responsable.

## Trazabilidad y siguiente uso

Los puntos 1 a 11 conservan el orden del resumen inicial; el punto 11 se completo
con la transcripcion. Los puntos 12 a 18 y la tabla de ampliaciones registran
lo adicional, con minutos de referencia. Las dudas derivadas del contraste
no se presentan como acuerdos confirmados.

Este documento sirve de entrada para una futura validacion de requisitos. No autoriza desarrollo ni reemplaza las decisiones pendientes. La matriz y el checklist de la aplicacion permanecen como referencia de la entrega visual anterior; no se actualizaron en esta tarea.
