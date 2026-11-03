# 01 - Resumen Frontend

## Estado contrastado - 2026-11-02

[30 - Estado frontend verificado](30-Estado-Frontend-Verificado.md) inventaría los
seis módulos reales, las rutas, servicios y los 34 documentos de Arquitectura.
La interfaz incluye identidad/Administración, reportes de Mercadeo, Formalización
con lecturas/etapa/aprobación, calendario compartido y notas colaborativas.
Las cifras históricas de QA se conservan con su fecha; no son una ejecución
nueva. El cierre documental del 2/11 registra verificaciones nuevas y sus fallos.


## Veredicto

El frontend del CRM debe ser una aplicacion React + Vite + TypeScript enfocada en productividad comercial: rapida, clara, densa, accesible y orientada a tablas, filtros, acciones y seguimiento.

La UI del producto sera en espanol para usuarios de Costa Rica.

Estado de fase:

```txt
vision completa del frontend != alcance autorizado actual
```

Formalización separa permisos de banners/listas, ficha, etapa y aprobación.
Ambos roles operativos gestionan todas las órdenes con permiso de la acción;
Owner consume el perfil efectivo sin eludir denies. Se conectaron seguimiento,
restauración de ficha, actividad, consulta de cliente/unidad/bitácora y capítulos
NetSuite confirmados. Los formularios generales de firma/banco/cartera no están
entregados por esas lecturas. El botón Outlook prepara un borrador, sin enviar
correo ni registrar envío de contrato; Resumen está retirado de la navegación.

Mercadeo lee agregados de leads/citas con `mercadeo.home.read` y Captación con
`mercadeo.leads.read`; vendedor/proyecto admiten selección múltiple, sin demo de
respaldo. El API resuelve las fuentes, alcance e identidad; programada no equivale
a realizada/asistida. El calendario nativo compartido sí está conectado en los
cuatro módulos operativos, sin activar Outlook ni correo externo. Notas/campana
internas son funciones separadas de los eventos, con ACL y actualización realtime.
Cobertura y límites: [30](30-Estado-Frontend-Verificado.md).

## Stack frontend

- React.
- Vite.
- TypeScript estricto.
- Ant Design, DataTables/SearchPanes y CSS del proyecto.
- Servicios tipados con fetch y estado/hooks React existentes.
- Vitest y Testing Library para pruebas automatizadas.

TanStack Query, Zustand, React Hook Form, Tailwind y Radix/shadcn son propuestas del blueprint, no el stack instalado. No incorporarlos solo para ajustar el codigo a documentos antiguos.

## Responsabilidades frontend

- Experiencia del vendedor.
- Interfaz en espanol orientada a la operacion comercial local.
- Vistas de leads, actividades, oportunidades, calendario, dashboard y reportes cuando su fase este aprobada.
- Formularios y validacion UX.
- Manejo de estados de carga/error.
- Ciclo de solicitudes y cache mediante los servicios/hooks implementados; autorizacion final siempre en API.
- Componentes reutilizables.
- Accesibilidad WCAG AA como objetivo, no certificacion global obtenida.

Navegacion mediante History API con popstate, rutas diferidas/Suspense y limite de errores recuperable por ruta. Las esperas artificiales de sesion se retiraron; los estados de carga representan solicitudes reales. Estos mecanismos no acreditan tiempos de respuesta productivos.

## No responsabilidades

- No decide permisos finales.
- No calcula permisos finales; consume permisos efectivos desde el API.
- No contiene reglas comerciales criticas.
- No llama NetSuite/Odoo directo.
- No llama legacy CRM directo.
- No guarda secretos.
- No usa estructuras legacy como contrato visual.
