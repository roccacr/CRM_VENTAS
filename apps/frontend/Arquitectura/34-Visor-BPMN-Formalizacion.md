# Visor BPMN de Formalización

Implementación local del 12 de noviembre de 2026. Este documento no acredita despliegue.

## Accesos y propósito

El botón **Ver proceso** aparece únicamente junto a recargar en Inicio de Formalización.
El panel lateral y la ficha completa de una orden no incluyen este acceso. Abre un modal
de consulta con tres mapas: proceso principal, adéndum y venta caída/finiquito.
Los carriles agrupan la intervención de Formalización, cliente/banco y seguimiento
de saldo, traspaso y entrega. Cada actividad muestra descripción, requisitos y
siguiente paso. Hay zoom, ajuste al área y una lista de pasos accesible por teclado.

La selección desde una figura, su etiqueta o la lista marca la actividad en ámbar,
la centra y amplía el mapa hasta una escala legible. La etapa actual de la orden
conserva su marca azul; seleccionar una actividad no cambia esa etapa. Al elegir
otra actividad se retira solo la selección anterior. **Ajustar mapa** recupera la
vista completa y es posible volver a localizar el mismo paso seleccionado.

No ejecuta transiciones, no envía correos, no agrega llamadas al API, no modifica
sesión, permisos ni datos comerciales. El módulo conserva sus puertas de entrada.
Los mapas generales son ayuda del producto; no contienen datos de órdenes.

## Posición de una orden

El acceso actual desde Home abre mapas generales, sin una orden asociada. El
componente conserva el soporte contextual descrito a continuación, pero no se
expone desde el panel lateral ni desde la ficha de una orden.

- Principal: resalta únicamente `item.state.code` recibido en la lectura autorizada.
  Se reutilizan códigos y etiquetas de `ORDER_STAGES`; una etapa desconocida queda
  explícitamente sin posición. No se presume un historial por el orden del mapa.
- Adéndum: resalta `item.addendumStatus` solamente con lectura efectiva de orden y
  adéndum, reutilizando `canReadOrderAddendum`; un deny prevalece. Sin permiso se
  muestra el mapa general sin exponer el marcador de la orden.
- Finiquito: muestra el mapa general. Su estado actual sigue consultándose en el
  panel operativo existente: el DTO de seguimiento no incluye todos sus pasos y
  no se deducen del check Venta caída ni de la etapa comercial.

La posición corresponde a la última consulta de la pantalla. No es seguimiento
en tiempo real. Consultar un paso no concede capacidad para ejecutarlo.

## Modelos y fuentes

`src/modules/home/formalization-processes.ts` contiene los tres modelos internos
versionados. Representan el recorrido habitual y sus decisiones principales,
no todas las combinaciones excepcionales ni una especificación ejecutable.

Fuentes revisadas del API (carpeta `modules/crm/sales/sales-orders`):

- `contract-transition.dto.ts` y `contract-transition.repository.ts`: ocho etapas,
  firma, salida por fondos, controles de avance, retroceso y saltos excepcionales.
- `formalization-approval.ts` y `formalization-approval.repository.ts`: aprobación
  independiente y confirmación externa antes de su registro local.
- `formalization-completion.policy.ts`: condiciones de cuotas, traspaso y entrega.
  La sincronización tiene reglas diferentes de la acción manual; el mapa lo explica.
- `finiquito.policy.ts`: elegibilidad por venta caída/reserva aplicada, validación
  financiera independiente y envío/recepción condicionados al contrato firmado.
- `sales-order-addendum.repository.ts`: marcador independiente de la etapa y del
  calendario; pendiente y enviado pueden resolverse según los permisos existentes.

Las políticas del servidor siguen siendo la autoridad. Las descripciones se deben
revisar cuando cambien esos contratos. Este visor no duplica su autorización ni
calcula si una orden puede avanzar.

## Componente compartido y BPMN 2.0

`src/components/processes/ProcessViewer.tsx` utiliza el `NavigatedViewer` de
`bpmn-js` 18.31.1, cargado en el chunk diferido del modal. Libera el visor al
desmontarse e ignora importaciones tardías. Un error de importación permite
reintentar y conserva la lista de actividades y sus explicaciones.

`process-definition.ts` define el contrato compartido de actividades, carriles y
conexiones. Genera XML BPMN 2.0 con referencias y coordenadas DI, escapando texto.
Los modelos admiten tamaños propios de actividad y posiciones explícitas de
etiquetas de conexión: las rutas con salidas próximas no dependen de un centro
automático compartido. Adéndum separa sus salidas superior/inferior; Finiquito
reserva espacio independiente para espera, actualización y registro de documentos.
**Descargar BPMN** exporta el modelo general como `.bpmn`, sin datos de la orden.
Los modelos declaran `isExecutable="false"`. No hay importación de archivos ni
editor de diagramas, motor BPMN, ejecución de scripts o recursos XML externos.

Para extender a Mercadeo u otro módulo: revisar primero sus reglas reales, crear
un `ProcessDefinition` versionado y montar el visor desde una entrada del módulo
ya autorizada. Mapear solamente posiciones recibidas por un contrato autorizado.
El componente es reutilizable; los mapas de otros módulos aún no están implementados.

## Verificación

Pruebas en `test/home/formalization-processes.spec.ts` y
`test/home/formalization-process-viewer.spec.tsx`: XML/referencias, alcance de nodos,
rutas de fondos/entrega, posiciones canónicas y desconocidas, recuperación de
importación, desmontaje, acceso/cierre y privacidad del marcador de adéndum.
La revisión en navegador usa datos sintéticos; no autoriza operaciones comerciales.
