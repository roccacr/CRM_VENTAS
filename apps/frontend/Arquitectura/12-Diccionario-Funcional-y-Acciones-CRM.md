# 12 - Diccionario Funcional y Acciones CRM

## Veredicto

El frontend debe tener documentacion funcional propia para que cualquier agente, disenador o desarrollador entienda que significa cada accion del CRM antes de construir pantallas.

El API documenta tablas y contratos tecnicos.

El frontend documenta:

- que ve el usuario;
- que accion esta ejecutando;
- que permisos necesita;
- que campos se muestran;
- que filtros existen;
- que estados visuales debe soportar;
- que texto de negocio se usa;
- que timeline debe aparecer despues de la accion.

## Regla de organizacion

Los documentos funcionales viven dentro del frontend:

```txt
apps/frontend/Arquitectura/
```

Cuando los modulos crezcan, se organizaran asi:

```txt
Diccionario-Funcional/
+-- 00-Indice.md
+-- 01-Leads.md
+-- 02-Timeline-y-Bitacora.md
+-- 03-Calendario-y-Actividades.md
+-- 04-Oportunidades.md
+-- 05-Estimaciones.md
+-- 06-Ordenes-de-Venta.md
+-- 07-Contratos.md
+-- 08-Corredores.md
+-- 09-Reporteria.md
+-- 10-Administracion-y-Permisos.md
```

Estos archivos se crean conforme cada modulo pase a implementacion.

## Plantilla obligatoria por accion UI

```md
## Nombre de accion visible

Codigo canonico:

Modulo:

Pantalla/seccion:

Usuarios que la usan:

Permiso requerido:

Campos visibles:

Campos requeridos:

Motivos disponibles:

Validaciones:

Respuesta esperada del API:

Timeline que debe verse despues:

Estados de UI:
- cargando
- exito
- error validacion
- error permisos
- error integracion

Notas UX:
```

## Acciones iniciales de leads

### Crear lead

Codigo canonico:

```txt
lead.create
```

Debe permitir registrar un lead nuevo con datos canonicos del CRM.

Debe generar en timeline:

```txt
Lead creado
```

Si el API sincroniza con un sistema externo, el frontend no lo nombra ni lo decide.

### Editar lead

Codigo canonico:

```txt
lead.update
```

Debe mostrar al usuario solo campos de negocio.

Debe generar timeline con:

```txt
Lead actualizado
Campos modificados
Usuario
Fecha
Seccion
```

Si hay campos sensibles, la UI los muestra u oculta segun permisos.

### Cambiar estado

Codigo canonico:

```txt
lead.status.change
```

Debe mostrar estados por nombre:

```txt
Interesado
Seguimiento
Oportunidad
Pre-reserva
Reserva
Contrato
Perdido
```

Debe requerir motivo cuando el API lo indique.

Debe generar timeline:

```txt
Estado cambiado de X a Y
Motivo
Detalle opcional
```

### Marcar como perdido

Codigo canonico:

```txt
lead.lost.mark
```

Debe mostrar solo motivos de perdida, no todos los motivos de accion.

Ejemplos:

```txt
No contesta
Presupuesto
Ubicacion
No es lo que buscaba
Busca alquiler
Duplicado
No tiene WhatsApp
Numero de telefono no valido
Mejor oferta
Tema laboral
Tema personal
No sujeto a credito
```

Debe generar timeline:

```txt
Lead marcado como perdido
Motivo
Detalle
```

### Agregar nota

Codigo canonico:

```txt
lead.note.create
```

Debe crear una entrada visible en timeline.

No debe cambiar estado por defecto.

### Crear evento o seguimiento

Codigo canonico:

```txt
lead.activity.create
```

Debe permitir programar fecha/hora, responsable, tipo de actividad y detalle.

Debe generar timeline:

```txt
Actividad programada
```

### Completar evento

Codigo canonico:

```txt
lead.activity.complete
```

Debe permitir resultado y detalle.

Debe generar timeline:

```txt
Actividad completada
```

### Asignar corredor

Codigo canonico:

```txt
lead.broker.assign
```

Debe usar selector de corredor activo.

Debe generar timeline:

```txt
Corredor asignado
```

### Retirar corredor

Codigo canonico:

```txt
lead.broker.unassign
```

Debe generar timeline:

```txt
Corredor retirado
```

### Editar perfil del lead

Codigo canonico:

```txt
lead.profile.update
```

Seccion funcional:

```txt
Perfil del lead
```

Agrupa identificacion, contacto alternativo, residencia, perfil comercial, origen de fondos y personas relacionadas.

Debe generar timeline con campos cambiados cuando aplique.

## Acciones futuras por modulo

### Oportunidades

Pendiente documentar en archivo propio:

```txt
04-Oportunidades.md
```

Minimo a definir:

- cuando un lead se convierte a oportunidad;
- si el lead sigue visible;
- estados de oportunidad;
- permisos;
- timeline;
- reportes.

### Estimaciones

Pendiente documentar en archivo propio:

```txt
05-Estimaciones.md
```

Minimo a definir:

- quien crea estimacion;
- desde que entidad nace;
- estados;
- envio;
- caida;
- aprobacion;
- relacion con oportunidad/reserva/orden de venta;
- timeline visible;
- errores de integracion.

### Ordenes de venta

Pendiente documentar en archivo propio:

```txt
06-Ordenes-de-Venta.md
```

Minimo a definir:

- cuando se crea;
- desde estimacion, reserva u oportunidad;
- estados;
- quien aprueba;
- relacion con contrato;
- documentos;
- timeline.

### Contratos

Pendiente documentar en archivo propio:

```txt
07-Contratos.md
```

Minimo a definir:

- cuando se considera firmado;
- que documentos se muestran;
- quien puede modificar;
- que pasa si se cae despues de firmado.

## Regla de UI

Si una accion cambia algo del lead, el usuario debe poder ver despues una entrada en timeline que explique que paso.

La UI no debe depender de numeros internos, nombres legacy ni nombres de proveedores externos.

## Decisiones cerradas del flujo comercial

| Pregunta | Decision |
| --- | --- |
| Donde nace el proceso comercial? | Todo nace desde lead. |
| Cual es el orden oficial? | Lead -> Oportunidad -> Estimacion -> Orden de Venta -> Contrato. |
| Reserva es lo mismo que orden de venta? | No exactamente. Reserva es una marca/estado dentro de orden de venta. |
| Pre-reserva, reserva y contrato son modulos separados? | No en P0; son hitos/estados del avance comercial. |
| Quien puede aprobar o caer una estimacion? | Depende de permisos efectivos entregados por el API. |
| Hay campos obligatorios globales del perfil para avanzar? | No en P0. |
| Puede cambiar corredor despues de reserva o contrato? | Si, si el API devuelve permiso. |

Ver detalle y diagramas en `13-Flujo-Comercial-CRM.md`.

## Preguntas pendientes

1. Que acciones puede hacer un vendedor sin aprobacion?
2. Que acciones necesitan aprobacion de supervisor, gerente o jefe?
3. Que acciones deben quedar ocultas para vendedor pero visibles para gerente?
4. Que filtros necesita la vista principal del vendedor en P0?
5. Que campos exactos se muestran para estimaciones, ordenes de venta y contratos?
