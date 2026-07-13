# Alcance y pendientes de la primera fase

> **Última modificación:** 2026-07-09 (jueves)
>
> **Estado:** avance de documentación; no sustituye todavía un inventario firmado de producción ni un contrato oficial de integración.

## Alcance entregado

| Tema solicitado | Cobertura de esta fase |
|---|---|
| Qué hace el CRM | Módulos, navegación, datos y flujo comercial documentados. |
| Cómo conecta con NetSuite | Restlets, autenticación, direcciones, acciones y llamadas bajo demanda identificadas. |
| Registros sincronizados | Matriz de leads, admins, campañas, corredores, expedientes, oportunidades, estimaciones y órdenes de venta. |
| Frecuencia | Cron jobs internos y worker Kapso identificados; se diferencia sincronización programada de llamadas bajo demanda. |
| Qué almacena el CRM / qué almacena el ERP | Separación funcional y campos compartidos documentados con nivel de certeza. |
| Manual de usuario | Guías de login, leads, oportunidades, estimaciones, órdenes, calendario, reportes y Kapso. |
| Links, flujos y diagramas | Índice de GitHub, enlaces relativos y diagramas Mermaid incluidos. |

## Criterios utilizados

- Se documenta lo que existe en el código; no se inventan nombres de campos de NetSuite que no estén presentes en los payloads locales.
- Se evita incluir valores de `.env`, tokens, contraseñas, API keys, JWT, datos personales o contenido del respaldo de base de datos.
- La frecuencia se expresa en hora de Costa Rica cuando el código especifica `America/Costa_Rica`.
- Si una integración ocurre por una acción de usuario, se registra como **bajo demanda**, no como sincronización periódica.
- La rama de documentación queda independiente del código fuente para permitir lectura, revisión y actualización sin mezclar artefactos.

## Pendientes prioritarios para la siguiente fase

| ID | Pendiente | Por qué importa | Evidencia o responsable a confirmar |
|---|---|---|---|
| P-NS-01 | Obtener catálogo de Restlets 1763, 1764 y 1774 con nombre, deploy, payload y respuesta oficial. | Permite cerrar el contrato CRM ↔ NetSuite. | Administrador NetSuite / scripts de cuenta. |
| P-NS-02 | Confirmar qué procesos alimentan `leads`, `admins`, `campanas`, `corredores`, `expedientes`, `oportunidades`, `estimaciones` y `ordenventa`. | El código muestra lecturas/escrituras, pero no todos los orígenes externos. | Integración NetSuite y base productiva. |
| P-NS-03 | Resolver uso de ambiente sandbox `4552704-sb1` frente a producción `4552704` en módulos de oportunidad y estimación. | Reduce el riesgo de enviar operaciones al ambiente equivocado. | Configuración de deployment. |
| P-NS-04 | Confirmar la frecuencia real de carga de maestros y transacciones NetSuite. | El código no muestra un cron general de importación NetSuite. | Logs, jobs de infraestructura y NetSuite. |
| P-API-01 | Publicar OpenAPI formal para la API CRM legacy. | Hoy la superficie se define por `routesConfig` y body dinámico. | Backend y consumidores. |
| P-API-02 | Documentar autenticación efectiva por ambiente y proteger rutas externas. | La API legacy valida `token_access` en el body y deja cuatro rutas sin ese middleware. | Seguridad / DevOps. |
| P-APIK-01 | Confirmar si `kapso/integrations` y `kapso/integrations/:id/templates` siguen vigentes. | El frontend las referencia, pero no aparecen en los controladores actuales de `API_Kapso`. | Frontend y API Kapso. |
| P-APIK-02 | Confirmar autorización de los endpoints admin de Kapso. | El controlador actual no muestra un guard de rol. | Seguridad / producto. |
| P-FE-01 | Añadir capturas de pantalla aprobadas al manual. | Facilita capacitación del usuario final. | Dueño del proceso / soporte. |
| P-OP-01 | Validar catálogo oficial de estados y motivos de pérdida. | Algunos estados provienen de catálogos/Stored Procedures. | Jefatura comercial. |
| P-OP-02 | Validar reglas de aprobación, comisión, reserva y cierre firmado. | Hay flags en DB y acciones en UI, pero falta la política formal. | Finanzas / ventas. |

## Próxima actualización recomendada

1. Entrevista de 30–45 minutos con ventas, administración NetSuite y soporte.
2. Prueba controlada de un lead, una oportunidad, una estimación y una reserva en sandbox.
3. Comparación de respuesta Restlet contra la fila resultante en MySQL.
4. Capturas del frontend para el manual.
5. Revisión de seguridad de secretos, webhooks, rutas públicas y roles.
