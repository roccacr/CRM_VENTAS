# Filtros multiples de Formalizacion

Cambio de presentacion y consulta, sin esquema ni escrituras de negocio.

Pendientes de seguimiento y Todas las ordenes comparten Selectmultiple de proyectos y bandejas. Los filtros se guardan automaticamente en localStorage por identidademail, superficie(home/orders) y contexto de bandeja/proyecto. No se guardan nombres/contactos ni busqueda libre. Limites:50proyectos y14seleccionesUI; laAPI recibe hasta12bandejas canonicas. Al cambiar filtros se vuelve a pagina1. La memoria no concede permisos y se depura al restaurar con los permisos vigentes.

ContratoGET /formalization/home/follow-up: se conservan projectId/queue anteriores; projectIds yqueues opcionales aceptan listas separadas por coma o arreglos. bankStages opcional admite bank_management/bank_management_in_progress y restringe solo la rama bank del OR. Se exigen permisos para todas las bandejas pedidas antes de consultar ambos adaptadores. Selecciones vacias significan todas las autorizadas. OR por eje, AND entre proyectos y bandejas; sin joins multiplicadores, con parametrosSQL y paginacion federada existente.

Las facetas counts incluyen proyecto+busqueda+permisos; el total/pagina/filas incluyen ademas la union de bandejas/subestados. El catalogo de proyectos permanece disponible mientras recargan las filas; las filas anteriores se invalidan incluso al volver a una combinacion previamente consultada.

Verificacion:46pruebasAPI y84frontend de los consumidores/serializacion/persistencia. Dos superficies, aislamiento por usuario, corrupcion de storage, cambio de permiso, filtros prohibidos, arrays acotados y continuidad de orden/drawer. Navegadorlocal comprobo Amara+Andira con14ordenes; reinicios concurrentes del backend interrumpen pruebas visuales y se distinguen de fallo de contrato. No se publica ni se ejecutan migraciones por esta implementacion.


Recarga real comprobada en localhost: los dos proyectos y las tres seleccionesde bandeja/subestado se restauran y vuelven a consultar14ordenes. Luego se limpiaron las selecciones de prueba. Se mantienen dimensiones de la vista y se amplian solo los controles dentro de la fila disponible; Selectborderless evita bordes anidados.

Bloqueos globales concurrentes: typecheckAPI en doblecalendar-external sin cancel; buildfrontend global en prueba calendar-crm-detail por castingCalendarEvent; lintFollowUpRow por nueva etiquetaAdendum sent fuera de esta implementacion. Se verifican por separado fuentes y buildVite, sin modificar esos cambios ajenos.
