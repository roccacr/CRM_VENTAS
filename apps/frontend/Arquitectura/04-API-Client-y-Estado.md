# 04 - API Client y Estado

## Cliente API

Todo acceso HTTP debe pasar por `services/api`.

Reglas:

- cliente tipado;
- manejo centralizado de errores;
- refresh/auth por capa comun;
- no repetir fetch/axios en componentes;
- no exponer estructuras legacy.
- no exponer estructuras NetSuite/Odoo.
- consumir permisos efectivos desde el API para mostrar u ocultar acciones.
- usar contratos canonicos del CRM para requests y responses.
- usar `publicId` canonico del CRM para rutas, query keys y acciones; nunca ids de proveedores externos.

## TanStack Query

Uso obligatorio para:

- listados;
- detalle;
- busqueda;
- paginacion;
- mutaciones;
- invalidacion;
- reintentos;
- optimistic UI cuando sea seguro.

## Query keys

Definir query keys por modulo:

```txt
leads.list(filters)
leads.detail(leadPublicId)
activities.byEntity(entityType, entityPublicId)
calendar.events(range)
notes.byEntity(entityType, entityPublicId)
notes.byView(viewCode, filters)
notes.history(notePublicId)
reports.dashboard(filters)
```

## Contrato canonico

El frontend debe enviar JSON estandar del CRM. No debe enviar campos con nombres de NetSuite, Odoo o legacy.

Ejemplo conceptual para crear lead:

```json
{
  "nombre": "Cliente Ejemplo",
  "correo": "cliente@empresa.com",
  "telefono": "88888888",
  "proyectoId": 10,
  "campanaId": 25,
  "subsidiariaId": 3,
  "comentario": "Interesado en informacion",
  "origen": "web",
  "estadoInicial": "interesado"
}
```

El API decide si ese contrato se sincroniza con NetSuite, Odoo u otro sistema. El frontend no contiene mappers de ERP.

Si el API devuelve referencias externas por soporte o auditoria, el frontend no debe usarlas como identificadores principales de navegacion, cache o relacion entre entidades.

## Notas adhesivas

Las notas deben consumirse por `services/api` y TanStack Query.

Reglas:

- no guardar notas como fuente de verdad en Zustand;
- no guardar notas como fuente de verdad en localStorage;
- invalidar `notes.byEntity` cuando una nota se crea, edita, comparte, resuelve o elimina;
- invalidar `notes.byView` cuando cambia una nota asociada a la vista;
- persistir posicion visual por API cuando aplique;
- no llamar Kapso, correo ni Microsoft 365 desde componentes de notas.

## Zustand

Usar solo para:

- sidebar;
- preferencias de tabla;
- filtros persistentes;
- layout;
- estado UI no remoto.

## Seguridad de estado

- No guardar secretos.
- No guardar tokens en frontend bajo ningun flujo del CRM.
- No persistir datos sensibles innecesariamente.
- Limpiar cache al cerrar sesion.
- No guardar permisos como fuente final de verdad; siempre revalidar por API.
- No guardar payloads de proveedores externos como estado de UI.
- No guardar ids externos como fuente principal de identidad de UI.

## Permisos visibles

El frontend puede usar permisos efectivos para mejorar la experiencia:

- mostrar u ocultar botones;
- deshabilitar acciones;
- explicar por que una accion no esta disponible;
- adaptar menus por rol o permiso.

Pero el backend siempre valida la accion real. Un permiso visible en UI nunca sustituye un guard del API.
