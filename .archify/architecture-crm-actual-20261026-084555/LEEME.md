# Mapa actual CRM TINK

Nota de revision documental 2026-10-27: este mapa es el artefacto fechado26,
no se regenero su HTML, evidencia ni capturas durante la actualizacion.
La URL de servidor siguiente es historica y no acredita un proceso activo.
Estado reconciliado actual: [55](../../apps/api/Arquitectura/55-Revision-Documental-Integral-20261027.md).


Abrir `crm-actual.html` en un navegador. Es un HTML interactivo autocontenido.
Vista local de esta sesion: http://127.0.0.1:53706/crm-actual.html.

Diagrama de arquitectura basado en inspeccion manual del checkout local del
26/10/2026. Incluye cambios sin commit: no representa los bytes del HEAD ni
un despliegue productivo. `evidencia-local.json` registra los 20 archivos
inspeccionados, sus hashes SHA-256 y la revision de contexto. No contiene
secretos ni datos de usuarios u ordenes.

Se agrupan repositorios y adaptadores de distintos modulos en una sola caja
conceptual; no se afirma un servicio adicional desplegado. Las limitaciones
operativas, demostraciones y esquemas sin runtime estan en las notas del mapa.

Archify 3.0.1: finalize aprobado en modo showcase; validacion, entrega,
comprobacion de artefacto y navegador aprobadas, sin diagnosticos. Capturas
claro/oscuro a 1440x900 y 2048x1320 aprobadas e inspeccionadas visualmente.
Recibos: crm-actual.finalize-summary.json y visual-check/.

La evidencia automatica acredita el artefacto y su navegador; la inspeccion
de fuentes es manual y se documenta aparte, sin certificado de Git fijado.
No se modifico codigo del CRM, configuracion, permisos ni bases de datos.

El servidor de vista previa esta ligado solo a 127.0.0.1 y sirve esta carpeta.
El HTML tambien funciona directamente sin ese servidor.
