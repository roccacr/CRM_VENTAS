# Formalización: correcciones de roles y recuperación

## Ampliaciones posteriores de capacidades — 2026-11-03

La tabla049 inferior conserva su alcance original. Fondos y finalización
ya tienen reglas implementadas según [78](78-Formalizacion-Origen-Fondos-y-Gestion-Bancaria.md);
calendario tiene contrato operativo condicionado en
[64](64-Calendario-Global-API-y-Contexto.md). Adéndum agrega lectura y gestión
independientes según [84](84-Adendum-Manual-Migracion-066-y-Permisos.md): después067,
el marcado manual se concede por defecto a Owner, Jefe General y Jefe de
Formalizaciones mediante grants reales; no al rol operativo Formalización.
El deny conserva prioridad y ver un banner no concede lectura del marcador.

Regla confirmada por el propietario el 2026-10-28: **Formalización y Jefe de Formalizaciones gestionan todas las órdenes del módulo cuando tienen el permiso de la acción**, independientemente del vendedor del lead. Esta autorización sustituye las restricciones de escritura por vendedor de los cortes anteriores. No concede permisos por el nombre del rol ni omite denegaciones individuales, sesión, disponibilidad del registro, aprobaciones previas, firma, versiones o auditoría.

## Lectura, gestión y supervisión

Se acepta cualquiera de los dos roles efectivos activos: `formalizacion` o `jefe_formalizaciones`. Owner conserva su resolución de roles heredados; no se añade una excepción por su etiqueta. La selección de módulo permanece en el modelo de identidad existente.

| Capacidad por defecto | Formalización | Jefe de Formalizaciones |
| --- | --- | --- |
| Seis banners de etapas y sus listas | Sí | Sí |
| Ver una orden, tiempos e historial | Sí | Sí |
| Registrar envío, revertir envío y cambiar etapas implementadas | Sí | Sí |
| Ver pendientes de aprobación y aprobar Formalización | No | Sí |
| Saltos y retrocesos excepcionales con motivo | No | Sí |

Son valores iniciales, no un bypass: Administración puede configurar permisos individuales y las denegaciones prevalecen. Las configuraciones de rol ya desactivadas no se reactivan por la migración. No se habilita la transición a `pending_approval`, pues no existe el comando para devolver aprobaciones.

Los permisos reconocidos con metadatos `self`, `assigned`, `own_area`, `own_area_and_children` o `all_areas` tienen alcance de módulo para estas acciones, según la decisión expresa del propietario. Un alcance desconocido sigue fallando de forma cerrada. Las funciones de otros módulos y la privacidad de las notas no se amplían.

## Persistencia de la configuración

La migración `202610280049_formalization_role_workflows` comprueba destino `CRM_THINK_V2`, tablas InnoDB, ambos roles activos y permisos activos existentes. Agrega solo relaciones de rol/permisos ausentes; conserva filas desactivadas e historial y no modifica excepciones individuales ni membresías. Invalida versiones de permisos y escribe auditoría en la misma transacción. Es idempotente.

No crea usuarios, permisos especulativos, importaciones o registros comerciales. No escribe en la BD legacy. El permiso retirado `formalizacion.home.read` se excluye del nuevo conjunto: no se reactiva para conseguir que el preflight pase.

## Correcciones funcionales

- La actualización después de aprobar o cambiar etapa usa la lectura exacta `/formalization/orders/:source/:id/record`; ya no depende de un banner. Evita dejar la ficha desactualizada cuando solo se tiene permiso de detalle o cuando la orden cambia a otra categoría.
- Los errores 401/403 bloquean comandos y ofrecen actualización, en lugar de sugerir reintentos con permisos obsoletos.
- Ante una respuesta incierta se conserva la clave de operación y no se permite editar el contenido para reenviarlo con otra identidad. No hay reintentos automáticos de escrituras. Una escritura confirmada no se presenta como fallida solo porque la lectura posterior falle.
- Los errores de entrada directa ofrecen reintentar o volver a Formalización.
- El recorrido de una orden cerrada muestra «Formalización cerrada / Proceso finalizado». Las posiciones anteriores usan «Etapa anterior», sin afirmar visitas históricas que los saltos pueden haber omitido.
- Los textos de acciones describen el movimiento de etapa; no afirman registrar firmas o pagos que el comando no escribe.

## Límites que permanecen

La corrección no crea gestión documental, firma externa, pagos, calendario operativo, reasignación o reportes nuevos. Registrar una etapa no acredita saldo cancelado, traspaso o entrega de llaves. Los criterios financieros, recursos propios y evidencias de cierre de la reunión siguen requiriendo definición/implementación específica; no se dan por resueltos con permisos o cambios visuales.

Tampoco se ejecutan aprobaciones o transiciones reales para probar el cambio. La integración ERP conserva su contrato y entorno configurado; esta entrega no despliega un RESTlet ni cambia credenciales. Los listados conservan su ordenación anterior; priorización global por antigüedad y reportes de jefatura siguen siendo pendientes separados.

## Evidencia

- Migración049 aplicada mediante selección explícita de esa única migración. El primer preflight detectó el permiso de Home retirado y abortó antes de mutaciones; se retiró del conjunto requerido, sin reactivarlo, y la ejecución siguiente terminó correctamente.
- Configuración leída de la BD real y probada con perfiles de rol construidos en memoria: ambos roles leen detalle y gestionan sin restricción por vendedor; Formalización no obtiene aprobación/salto por defecto y Jefatura sí. Una denegación individual de envío sigue dando 403. Los repositorios de mutación fueron sustituidos: no hubo escrituras de negocio.
- Pruebas de regresión confirmaron primero los fallos y después las correcciones. Las comprobaciones generales y visuales deben registrarse con su resultado, sin sustituir una aceptación operativa real por el número de pruebas.
- API: verificación general aprobada con formato, lint, tipos, 6320 pruebas y compilación; 141 casos permanecen omitidos por compuertas de entorno. La ejecución inicial de lint se interrumpió por un archivo de NetSuite que cambió durante el trabajo compartido; una nueva ejecución pasó sin modificar ese trabajo ajeno.
- Navegador autenticado: se comprobó la orden legacy208 con etiquetas neutrales y la acción «Registrar paso a Pendiente de traspaso». Tras un 502 transitorio del proveedor, la recarga de `record`, `database` y `netsuite` devolvió200. No se cambió una orden ni la configuración ERP para esa prueba.
- Las tres expectativas antiguas detectadas por la suite general frontend se actualizaron al nuevo contrato de revalidación/etiquetas. Sus 52 casos volvieron a pasar, conservando las comprobaciones de identidad y sin aumentar tiempos de espera.
- Frontend: `pnpm check` completo aprobado con formato, lint, tipos, 1144 pruebas y compilación. Permanece el aviso de tamaño del bundle de Ant Design; no es un fallo de build. El comando raíz se ejecutó y detectó aquellas expectativas antiguas; después de corregirlas se repitió todo el chequeo frontend, conservando la ejecución API aprobada de ese mismo corte.
- Revisión independiente final sin hallazgos bloqueantes en estas correcciones. Los cinco fallos del informe original quedaron cubiertos; los límites operativos de este documento siguen abiertos y no se presentaron como funciones terminadas.
