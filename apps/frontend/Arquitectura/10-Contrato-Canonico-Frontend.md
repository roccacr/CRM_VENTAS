# 10 - Contrato Canonico Frontend

## Vigencia documental - 2026-10-22, corte f2dc4f1

La regla de aislamiento de proveedores sigue vigente. Los ejemplos de crear/leer lead son conceptuales y futuros; no acreditan un endpoint, DTO o formulario instalado. El core backend conserva nombres CRM y resuelve referencias externas en su capa de integracion; ninguna referencia externa se convierte por ello en identidad canonica de navegacion.

## Regla principal

El frontend trabaja solo con lenguaje del CRM.

No debe existir dependencia de nombres, campos o payloads de NetSuite, Odoo o legacy dentro de:

- formularios;
- stores;
- hooks;
- componentes;
- rutas;
- clientes API;
- tipos TypeScript publicos del frontend.

## Crear lead

El formulario de lead debe construir un JSON canonico:

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

Ese contrato es estable aunque el backend sincronice con NetSuite hoy y Odoo despues.

La UI no envia ids de proveedor para relacionar vendedor, lead, oportunidad, estimacion, orden o contrato.

Regla:

```txt
relaciones de UI = publicId canonico del CRM
ids externos = solo datos tecnicos si el API los expone con permiso
```

## Lectura de datos

El frontend recibe datos normalizados del API:

```txt
Lead
├── id
├── nombre
├── correo
├── telefono
├── estado
├── propietario
├── proyecto
├── campana
├── subsidiaria
├── comentario
├── hasRelatedLead
├── creadoEn
└── actualizadoEn
```

El frontend no necesita saber si el dato nacio en CRM, ERP o legacy.

El `id` visible para rutas, stores y query keys debe ser un identificador canonico del CRM, no un id externo.

## Prohibido

- `netsuiteId` como campo de formulario.
- `odooId` como campo de formulario.
- `idinterno_lead` como id principal de UI.
- `netsuiteId` u `odooId` como ruta o query key principal.
- `segimineto_lead` como nombre de estado en codigo nuevo.
- payloads externos construidos en componentes.
- condicionales de UI basados en proveedor ERP.

## Permitido

El API puede exponer informacion normalizada como:

- referencia externa visible;
- origen del registro si el negocio decide mostrarlo;
- estado de sincronizacion;
- error de sincronizacion simplificado.

Pero esos nombres deben venir en lenguaje CRM, no en lenguaje de proveedor externo.
