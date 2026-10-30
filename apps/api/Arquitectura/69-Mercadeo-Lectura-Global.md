# Lectura global de Mercadeo

El permiso `mercadeo.reports.read_all` permite consultar todos los vendedores en
Inicio y Captación de Mercadeo. Cada vista sigue requiriendo su permiso ordinario:
`mercadeo.home.read` o `mercadeo.leads.read`. Una denegación de esa lectura siempre
bloquea la vista. Una denegación del permiso global conserva el filtro de alcance
ordinario; no revoca por sí sola la lectura que ya estuviera autorizada.

Esta capacidad no cambia el alcance organizativo, la edición de leads, eventos,
notas ni el acceso a otros módulos. Se administra en Mercadeo / Informes y puede
asignarse por rol o por empleado. La migración 056 crea el permiso sin concederlo
automáticamente a roles o personas. Las asignaciones individuales usan el escritor
de seguridad existente, incrementan la versión de permisos y registran auditoría.

Motivo de la corrección: el perfil Mercadeo de Kenneth tenía alcance `self` y
devolvía cero leads; Jefe General de Claudio usaba `own_area_and_children` y
mostraba solo vendedores con membresía organizativa configurada. En la consulta
de octubre de 2026 devolvían 0 y 29 frente a 1307 leads globales. Son una
observación fechada, no valores fijos ni una autorización para modificar cartera.

La lectura mantiene la unión nativa/legacy, deduplicación y los filtros del período.
No se copian ni modifican leads, órdenes ni registros de producción legacy.

## Aplicación del 29 de octubre de 2026

La migración 056 quedó aplicada en `CRM_THINK_V2`. Se concedió el permiso
individualmente a `kmartinez@roccacr.com` y `ccordoba@roccacr.com` mediante el
escritor transaccional de acceso. Ambas asignaciones tienen su evento de auditoría;
sus versiones de permisos pasaron a 6. Se comprobó que los roles, módulos y demás
permisos efectivos conservaron sus valores y alcances anteriores.

El código quedó publicado en la entrega `20261029162653-ce19e12-local`. La
verificación de datos a las 16:30 UTC devolvió **1308 leads para ambos perfiles**,
tanto en Inicio como en Captación, para el período 01/10/2026–29/10/2026. Esta
consulta posterior contiene un lead más que el diagnóstico inicial; los números
son fotografías de datos vivos, no valores fijados en el código.

Validación: 82 pruebas pasaron; una prueba MySQL existente permaneció omitida,
sin ejecutar fixtures en las BD compartidas. Lint de los archivos afectados,
TypeScript y los builds de API/frontend pasaron. La página pública de acceso y
la comprobación pública de disponibilidad del API respondieron HTTP 200. La
lectura se verificó con perfiles reales y repositorios contra ambas BD; no se
suplantaron las sesiones de los empleados ni se certificó una navegación
interactiva desde sus dispositivos.
