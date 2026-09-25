# 08 - Revision del Blueprint y Siguiente Paso API

## Veredicto actualizado

El analisis externo entiende bien la intencion del proyecto: construir un CRM nuevo, no maquillar el CRM actual. Tambien detecta el riesgo principal: si se implementa demasiado pronto, el API empieza a parecer un CRM generico antes de que el producto este bien gobernado.

La decision actual es detener el scaffolding del API y volver a fase de diseno. El runtime NestJS, `src/`, migraciones, OpenAPI ejecutable y dependencias locales fueron retirados hasta aprobar primero:

1. cara de producto;
2. jerarquia de documentacion;
3. modelo canonico P0;
4. contrato minimo del primer corte.

## Lo que el analisis entendio correctamente

- El CRM nuevo debe tener base de datos propia.
- El CRM legacy debe tratarse como fuente temporal, no como modelo a copiar.
- NetSuite y Odoo deben quedar detras de ports/adapters.
- El dominio CRM no debe depender de nombres, estados ni estructuras del ERP.
- El frontend no debe decidir permisos finales.
- La bitacora comercial y la auditoria tecnica son conceptos distintos.

## Lo que falta antes de implementar

Antes de recrear `package.json`, NestJS, OpenAPI, migraciones o endpoints, falta cerrar:

- documento de producto en 2 paginas;
- que somos y que no somos;
- usuarios principales y responsabilidades;
- P0-S1 exacto;
- reglas madre de conflicto entre documentos;
- riesgos aplazados: duplicados, IDOR, PII/Ley 8968, idempotencia ERP, adjuntos, asignacion, busqueda, mobile y notificaciones;
- contrato canonico minimo de lead;
- modelo fisico MySQL minimo aprobado.

## Regla para el siguiente agente

El siguiente agente no debe comenzar creando codigo. Debe leer:

1. `AGENTS.md`
2. `Arquitectura/00-Indice.md`
3. `Arquitectura/21-P0-Direccion-Tecnica-Construccion-Pausada.md`
4. `Arquitectura/22-Mapa-de-Implementacion-API.md`
5. `Arquitectura/23-Alcance-P0-Vertical-Leads.md`
6. Este documento.

Luego debe proponer o ajustar documentacion de producto antes de construir runtime.

## Decision

El API queda temporalmente como carpeta de arquitectura, reglas y skills locales:

```txt
apps/api
```

No se debe crear codigo en la raiz del proyecto. No se debe recrear runtime dentro de `apps/api` hasta aprobar el diseno de producto y el contrato P0.
