# Habita: despliegue en Ubuntu / Apache

## Verificación y build por aplicación

### CI paralelo y reparto por duración — 11/11/2026

La implementación usa el secuenciador público de **Vitest 5**, sin servicio
adicional ni dependencia nueva. **ci-sequencer.mts** solo se activa mediante
CI_TEST_PLAN; las pruebas locales habituales conservan su secuencia original.

- **Validaciones / app / format:check|lint|typecheck** ejecuta los tres controles
  en paralelo para las apps modificadas, sin retrasar planificación ni pruebas.
- Cada app descubre su inventario con Vitest. **frontend-shards.py** (nombre
  histórico, compartido por API y frontend) calcula lotes mediante LPT:
  coloca primero archivos lentos en el lote de menor carga, con un máximo
  de 40 archivos frontend o 80 API por lote.
- El número aumenta según cantidad y duración acumulada: objetivo orientativo
  de 90 s de trabajo con 2 workers por runner. No garantiza una duración exacta;
  un archivo pesado no se divide internamente. Cada app permite hasta 6 lotes
  simultáneos; los demás esperan runner disponible.
- El historial procede únicamente de artefactos **ci-timings-api/frontend**
  de los últimos cinco runs **push exitosos de la rama release, mismo repo**.
  Contiene rutas relativas y duraciones, nunca credenciales ni datos del CRM.
  Si no existe, expiró o no se puede leer, se estima por tamaño de archivo.
  Las pruebas nuevas siempre se incluyen. Cada merge exitoso renueva los tiempos.
- El plan es un artefacto del run actual. El secuenciador rechaza archivos
  nuevos no planificados, asignaciones duplicadas y contadores incompatibles.
  El merge exige todos los blobs y el exportador compara uno a uno los archivos
  ejecutados contra el plan: no acepta omisiones, duplicados ni tests fallidos.
- Los lotes suben resultados con cobertura V8. El merge combina cobertura,
  no promedia porcentajes ni repite tests. En API, los umbrales se desactivan
  **solo en el comando de cada lote parcial**; el merge global aplica los
  umbrales originales: 75% statements, 65% branches, 80% functions, 78% lines.
  Las pruebas SQL opt-in mantienen sus condiciones y su aviso de omisión;
  el job NetSuite/MariaDB independiente no cambia.
- **Quality / api** y **Quality / frontend** conservan sus nombres de checks
  requeridos y fallan ante errores de detección, validación, plan o cobertura.
  Cada app compila una sola vez después de aprobar. Se preservan la caché pnpm,
  la reutilización del build intacto, auditorías y la promoción protegida.
  No cambia shared/api.env, ningún secreto, la BD ni el servidor.

Se priorizan cargas similares en vez de igual cantidad de archivos, respetando
el techo por lote. Verificación:
python -B -m unittest discover -s deploy/habita -p test_frontend_shards.py.
Referencia: [secuenciador de Vitest](https://vitest.dev/config/sequence).

El workflow `quality.yml` detecta los cambios antes de ejecutar las suites.
Un cambio dentro de `apps/api/` ejecuta lint, tipos, cobertura, build, auditoría
de dependencias y pruebas NetSuite del API. Dentro de `apps/frontend/` ejecuta
las comprobaciones del frontend. Los cambios en ambas apps, workflows,
despliegue o configuración compartida verifican ambas. Un despacho manual
también verifica ambas. La documentación global por sí sola omite el release.

En la rama de release, la comparación parte de un CI exitoso ancestro con los
dos builds todavía disponibles. Así se incluyen también cambios de pushes
anteriores que fallaron. La app sin cambios reutiliza ese artefacto verificado,
sin instalar dependencias ni ejecutar su suite o build. Si falta una base
válida o expiraron los artefactos, se reconstruyen ambas. La selección requiere
`actions: read` y descarga artefactos únicamente del mismo repositorio.

La publicación sigue usando un único paquete con los dos builds, SHA-256,
activación atómica, comprobaciones de salud y rollback. El manifiesto conserva
las apps reconstruidas y el commit/run de reutilización. El identificador
mostrado por un frontend reutilizado corresponde al build original de esa app.
Los archivos privados de configuración permanecen en `shared/api.env`.

Validación local del detector y de las reglas de reutilización
`python -B -m unittest discover -s deploy/habita -p test_detect_ci_changes.py`.

## Corte operativo del 10/11/2026

El último despliegue de Habita confirmado en el registro de ejecución fue el
release `20261109185625-63139a8-local` del 09/11/2026, basado en `63139a8`.
El activador verificó 1.410 archivos fuente y 773 artefactos. El enlace
`current` apuntó al release, `habita-pm2` quedó activo y el login y
`/health/ready` respondieron HTTP 200. También se comprobó el SVG oficial
servido y se encontró `v2.0.0` con la revisión `63139a8` en el bundle
público. Esta evidencia cubre una comprobación pública sin sesión.

El corte Git revisado llega a `4ad7a59`, con tres commits adicionales sobre
`63139a8`. La promoción CI/CD y otros cambios del árbol local se documentan
como preparación. La revisión documental no volvió a consultar producción
ni acredita un release posterior, la activación de SuiteScript o una migración.
Los [registros del 29/10](DEPLOYMENT-20261029.md),
[03/11](DEPLOYMENT-20261103.md) y [04/11](DEPLOYMENT-20261104.md) son históricos.

## Alcance del runbook

Este es el runbook del despliegue registrado en
[DEPLOYMENT-20261029.md](DEPLOYMENT-20261029.md), no una autorización permanente
para publicar. La revisión actual inspeccionó las plantillas/scripts locales;
no abrió SSH, consultó dominios, reinició procesos ni validó la infraestructura.
El release histórico del29 no demuestra que `fcbf0c2` ni los cambios locales057
estén publicados. Cada nueva publicación necesita su autorización y evidencia.
Cobertura global: [informe72](../../apps/api/Arquitectura/72-Reconciliacion-Documental-20261102.md).

| Artefacto | Responsabilidad y efecto al ejecutarlo |
| --- | --- |
| `publish.ps1` | Copia fija del código, builds, manifiesto/hash y transferencia/activación remota; tiene efectos, no es un diagnóstico read-only |
| `activate-release.sh` | Prepara y activa el release. El cambio local admite overlay sobre un clon y artefacto CI sin clon. En ambos modos instala el runtime y recarga el API |
| `verify-release.py` | Valida rutas y SHA-256. En modo overlay elimina del clon archivos ausentes del manifiesto. En modo artefacto exige coincidencia exacta del inventario y rechaza enlaces simbólicos |
| `package-ci-release.py` | Cambio local que empaqueta los builds de CI y los archivos mínimos de runtime, con manifiesto y SHA-256 |
| `apache-http.conf`, `apache-https.conf` | Plantillas de sitios/proxy SPA, API y WebSocket; no se aplican al compilar ni publicar un Markdown |
| `ecosystem.config.cjs`, `habita-pm2.service` | Configuración del proceso y supervisor PM2 aislado; requiere instalación operativa |
| `habita-api.service` | Alternativa histórica de servicio directo; no ejecutar a la vez que PM2 |
| `renewal-hook.sh` | Hook de renovación del certificado; puede recargar Apache |

El publicador excluye `.env` privados y llaves por nombre, pero esa exclusión no
detecta credenciales incrustadas dentro de JS. La excepción temporal del emisor
NetSuite documentada en el [README SuiteScript](../../apps/api/src/integrations/netsuite/suitescript/README.md)
debe resolverse antes de tratar ese paquete como una entrega productiva segura.
Esta revisión no cambia ni invalida credenciales compartidas.

Destino de referencia del despliegue histórico: ubuntu@3.12.74.187. Fuente: rama
`temp/crm-tink-api-frontend-inicial` más los cambios locales aprobados.
No se requiere commit/push para aplicar un overlay verificado sobre el clon.

- Web: https://habita.roccacr.com
- API: https://api-habita.rdghub.com
- El navegador usa `VITE_API_ORIGIN=https://habita.roccacr.com`; Apache reenvía
  las rutas API y WebSocket a 127.0.0.1:3100. Evita cookies de terceros entre
  roccacr.com y rdghub.com sin cambiar SameSite ni la autenticación existente.
- Callback Microsoft, plataforma **Web**:
  `https://habita.roccacr.com/identity/microsoft/callback`.
- Release: `/var/www/habita-crm/releases/<identificador>`; symlink `current`.
- Secretos fuera de Git y del DocumentRoot: `shared/api.env`, modo 0600.
- Calendario Microsoft en producción: `ENABLE_CALENDAR_EXTERNAL=true` en ese entorno compartido. El valor por defecto del código es `false`; iniciar sesión con Microsoft no activa la integración. Los releases reutilizan este archivo, sin sustituirlo por el `.env.example` ni por el entorno local. Al cambiar calendario, verificar también salas, disponibilidad y lectura de agenda con una sesión real en Habita; `health/ready` por sí solo no acredita estas funciones.
- API: `NODE_ENV=production`, `API_BIND_HOST=127.0.0.1`, `PORT=3100`,
  `FRONTEND_ORIGIN=https://habita.roccacr.com`, `TRUSTED_PROXY_IPS=127.0.0.1`.
- Mantener destinos BD y claves criptográficas durante la transferencia.
- NetSuite: el origen de producción de Habita selecciona ese entorno.
  Verificar el RESTlet, el modo de lectura y los parámetros de cuenta
  de acuerdo con [el runbook de NetSuite](ACTIVAR-NETSUITE.md).
  Sandbox usa la configuración separada `NETSUITE_SANDBOX_*`.
- CA RDS: ruta absoluta del certificado público dentro del release remoto.

## Secuencia

1. Clonar la rama en un directorio de release nuevo. Aplicar el overlay local
   sin secretos/dependencias de Windows y comprobar SHA-256.
2. Compilar localmente con los lockfiles existentes; frontend con su origen
   público. Transferir `dist` de ambas apps; instalar dependencias de runtime
   del API con pnpm 10.28.2 sobre Node 22 en Linux.
3. Preparar entorno privado y validar sin imprimir secretos. No migrar ni
   inicializar bases de datos durante el despliegue.
4. Validar configuración Apache y PM2/systemd. Habilitar HTTP de estos dos hosts;
   emitir certificado ACME usando la cuenta existente. Habilitar HTTPS.
5. Registrar el callback Web aditivo en Azure, conservando las URI existentes.
6. Verificar liveness/readiness, HTML/activos, navegación profunda, sesión,
   callback y WebSocket. Ninguna comprobación crea datos ficticios.

## Operación y rollback

`sudo systemctl status habita-pm2` permite diagnosticar el supervisor. PM2 usa
`PM2_HOME=/var/www/habita-crm/shared/pm2` y únicamente administra `habita-api`.
Sus logs están en `shared/pm2/logs/`; el directorio es privado. No ejecutar
`pm2 restart all` ni usar el daemon de otras aplicaciones. `habita-api.service`
queda deshabilitado como alternativa de recuperación, sin dos procesos activos.
`sudo systemctl reload habita-pm2` reinicia únicamente este API;
no publicar logs que pudieran contener datos del negocio. Apache registra rutas
sin query para no escribir códigos OAuth en el access log.

Un rollback cambia `current` al release anterior conocido, reinicia únicamente
`habita-pm2` y valida salud. En la primera instalación no hay release anterior:
se detiene ese servicio y se deshabilitan únicamente los dos sitios nuevos.
No tocar aplicaciones previas, BD, migraciones, credenciales ni virtual hosts
existentes. Las plantillas no certifican un despliegue exitoso: registrar la
evidencia de ejecución al terminar.

## Publicar los siguientes cambios locales

Desde PowerShell 7, con Node 22, pnpm 10.28.2 y dependencias locales instaladas:

```powershell
./deploy/habita/publish.ps1 -SshKeyPath 'RUTA_A_LA_LLAVE.pem'
```

El encabezado de Habita muestra la versión del producto junto al logo.
El publicador incorpora el identificador del release en la compilación del
frontend. La etiqueta muestra la revisión corta y su detalle conserva el
identificador completo.

Incluye la rama actual y sus cambios locales, sin commit/push. Compila API y
frontend desde una copia fija antes de transferir, verifica la copia de código,
excluye `.env` y llaves, y verifica SHA-256 en destino. `activate-release.sh`
clona la rama, aplica el overlay verificado en un release nuevo, instala solo
dependencias de producción con lockfile y sin scripts de instalación, valida
entorno y binding nativo, cambia `current` y reinicia exclusivamente el API.
Si falla la activación o la comprobación de salud, restaura el release anterior
y solicita verificar su salud. Después de verificar la salud y desarmar el rollback,
la retención conserva únicamente `current` y elimina releases/paquetes anteriores
de Habita. El anterior sigue disponible durante la activación, pero se retira
tras su éxito; recuperar una versión histórica requiere volver a desplegarla.

El archivo de producción ya está en `shared/api.env` (0600), con `NODE_ENV=production`
y los dominios públicos. Cada release enlaza `apps/api/.env` a ese archivo y Node
lo carga mediante `--env-file`; no se sustituye con el `.env` de desarrollo en cada
publicación. Cambiar secretos requiere actualizar ese archivo privado y reiniciar
el API. Ese corte histórico conservó Sandbox; la revisión local del 03/11 fija Producción para Habita y requiere completar su URL antes de publicar.

`ecosystem.config.cjs` define el proceso y `habita-pm2.service` inicia su PM2
aislado al arrancar Ubuntu. PM2 7.1.1 está instalado solo en
`shared/process-manager`, sin cambiar el Node del sistema ni los otros servicios.
Los cambios de Apache/supervisor son operativos: se instalan por separado tras
validar configuración; el publicador aplica código y builds, no sobrescribe vhosts.

El perfil del cliente consulta `/leads/profile`. El prefijo `/leads` debe estar
tanto en `ProxyPassMatch` como en la exclusión de la regla SPA del vhost HTTPS.
Si falta, Apache devuelve `index.html` con 200 en lugar de JSON. Después de
instalar la plantilla, validar con `apache2ctl configtest` antes de recargar:
una consulta sin sesión a `/leads/profile` debe responder 401, nunca HTML.
La vista de Notas `lead-profile` corresponde a Formalización y conserva el
permiso efectivo `lead.profile.read`, incluidas sus denegaciones.

Certbot administra el certificado SAN de ambos dominios en
`/etc/letsencrypt/live/habita-crm/`. `renewal-hook.sh` recarga Apache después de
renovar únicamente ese certificado. Son certificados HTTPS/TLS, no llaves SSH.

## Callback Microsoft

El callback Web permanece en el dominio del frontend porque Apache reenvía
`/identity/*` al API y las cookies de autenticación conservan su origen. Moverlo
solo al dominio `rdghub.com` separaría las cookies del navegador. Azure conserva
el callback local y las URL de otras aplicaciones; se añadió únicamente la URI
Web pública autorizada.

Entra puede enviar `clientdata` además de `code`, `state`, `session_state` y
`client_info`. El DTO lo admite como texto opcional de hasta 4096 caracteres;
no se usa como identidad, no sustituye state/PKCE y se siguen rechazando campos
desconocidos, arrays y tamaños inválidos. Nunca publicar la URL completa del
callback ni sus códigos en capturas o logs.


## NetSuite Produccion — IDs confirmados 03/11/2026

Valores del perfil del API para la version unificada confirmada:

```dotenv
NETSUITE_PRODUCTION_RESTLET_URL=https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=3739&deploy=1
NETSUITE_PRODUCTION_READ_MODE=modules
NETSUITE_ENVIRONMENT=production
```

Con FRONTEND_ORIGIN de Habita se selecciona Produccion aun si queda un selector
antiguo sandbox. Conservar NETSUITE_* de cuenta4552704 y mantener separados
NETSUITE_SANDBOX_*; no rotar ni copiar secretos entre ambientes. La configuracion
local de estos valores no acredita actualizacion de shared/api.env ni despliegue.
Referencias: libreria9625078 en SuiteScripts/, RESTlet3739/1 y User Event3740.
La lectura real de diagnostico encontro ENVIRONMENT_NOT_AUTHORIZED: configurar
custscript_crm_account_id=4552704 en el deployment RESTlet y verificar GET.
El receptor de Produccion esta en /integrations/netsuite/production/order-events
del API publico, con secreto dedicado y flags explicitos. Publicar el UE no
configura automaticamente sus parametros ni demuestra la entrega real.


## Activación acotada histórica del 03/11/2026

En ese corte quedó activo `20261103171020-netsuite`, basado en `20261103154247-4d446ed-local`.
Overlay de 12 fuentes de integracion, con 637 artefactos API compilados. Se
verificaron las 1286 fuentes y719 artefactos finales; frontend conservado.
SHA256 del overlay: `a77f9bbcb6a4ecea59f4548cfb1130886126bd95765b2ade895d46a6acdd308d`.
Compilacion aislada aprobada y267 pruebas de11 suites aprobadas sobre la copia.
La activacion conserva backup privado de api.env y rollback conjunto de entorno
mas current; sin migraciones ni instalaciones de dependencias nuevas.

En vivo: ready200, identidad sin sesion401, receptor production sin secreto401,
cuerpo invalido autenticado400 antes de persistencia. Perfil efectivo production,
URL3739/deploy1, module=salesOrders y OAuth realm4552704. El proveedor devuelve
HTTP200/status403 ENVIRONMENT_NOT_AUTHORIZED: falta completar la correccion/config
remota de NetSuite. Sandbox3353/1 devuelve200, pero aun sin fields.custbody37.
No se probaron escrituras de negocio ni se acredita sincronizacion E2E.

El local compartia la misma BD y PERSIST=true; se cambio a false para evitar que
Sandbox sobrescriba datos reales. Worker local recargado despues de ese cambio.
Las instrucciones y archivos concretos estan en [ACTIVAR-NETSUITE.md](ACTIVAR-NETSUITE.md).

## Promoción CI/CD con GitHub Actions, preparada localmente

La revisión está en el árbol local. Ver [CRM quality](../../.github/workflows/quality.yml)
y [Habita promotion](../../.github/workflows/habita-promote.yml). El primero
corre formato, lint, tipos, cobertura y build en push, PR y ejecución manual.
API y frontend ejecutan lotes por carga y combinan sus coberturas antes de compilar. El job focalizado
de NetSuite repite casos relevantes en MariaDB/InnoDB desechable. La
persistencia MySQL general se informa por separado y no bloquea el empaquetado.
Si `CRM_MYSQL_TESTS_READY` no está en `true` o el PR es externo, los jobs de
infraestructura y persistencia MySQL general quedan omitidos: no es una prueba SQL aprobada.
El job focalizado de NetSuite conserva su MariaDB desechable y sus validaciones.

La inspección de SuiteScript admite únicamente la credencial fija autorizada por
el propietario, identificada por SHA-256 estático, una vez y solo en
`SS2_1_LIB_CRM_habita.js`. Cualquier otro token, duplicado o ubicación se rechaza
sin imprimir su valor. La clave no se rota ni se reemplaza durante CI.
El ZIP manual generado por `pnpm netsuite:package` contiene esa credencial y es
privado; no se publica como artefacto. El paquete CI de Habita usa los builds y
no incorpora la fuente SuiteScript.

La promoción solo aplica a un push en la rama protegida configurada en
`HABITA_RELEASE_BRANCH` aunque la promoción esté desactivada. El empaquetado espera
los controles de calidad de ambas apps, la auditoría de dependencias y
NetSuite. El mismo archivo pasa de QA a producción cuando
`HABITA_PRODUCTION_ENABLED=true` y QA ha terminado correctamente. Cada
promoción comprueba que el SHA de la ejecución sigue siendo la punta de
la rama, valida el SHA-256 y coteja el activador con la copia del paquete.

El identificador del artefacto tiene formato
`AAAAMMDDhhmmss-<sha-corto>-ci-<run-id>-<intento>`. El build de CI usa
`VITE_API_ORIGIN=same-origin` y `VITE_HABITA_RELEASE` contiene el SHA
completo. La etiqueta del encabezado muestra su revisión corta. El
paquete incluye los builds y los archivos mínimos de runtime. La clave
SSH y la lista de hosts conocidos vienen del entorno correspondiente
y se usan en archivos temporales privados. En producción, el workflow puede reutilizar `SCADMINAPIS` cuando no existe una llave propia del entorno.

### Habilitación

1. Confirmar y proteger la rama de release en GitHub. Configurar las variables
   de repositorio `HABITA_RELEASE_BRANCH`. Activar `HABITA_QA_ENABLED=true` solo si se usa QA.
2. Configurar `production` y, si se usa QA, `habita-qa`, restringidos a esa rama.
   Cada entorno requiere las variables `HABITA_SSH_TARGET` (usuario@host),
   `HABITA_WEB_ORIGIN` y `HABITA_API_ORIGIN`, más los secretos
   `HABITA_SSH_KEY` y `HABITA_SSH_KNOWN_HOSTS`. Usar credenciales dedicadas
   por entorno y registrar la clave de host a partir de una fuente confiable.
3. Si se usa QA, preparar una instancia independiente con el mismo layout de Habita,
   configuración propia, API en puerto 3100 y proxy de mismo origen. En cada
   servidor, crear `/var/www/habita-crm/shared/deploy-environment` con su nombre
   exacto (`habita-qa` o `production`), propiedad de administración y solo lectura
   para el usuario de despliegue. El activador valida esa identidad antes de
   extraer el release. Se requiere un release inicial sano en cada host.
4. Probar un fallo de CI, una promoción sana y un rollback en QA. Activar
   `HABITA_PRODUCTION_ENABLED=true` solo después de esa validación y configurar
   revisión del entorno si el plan de GitHub lo admite. Ante una activación
   fallida, revisar el rollback y relanzar el workflow completo para generar un
   nuevo identificador de release.

El activador conserva `shared/api.env`, instala las dependencias de runtime
desde el lockfile, cambia `current` de forma atómica y recarga `habita-pm2`.
Comprueba readiness local y pública y compara el HTML de login con el
artefacto. Si la activación falla, restaura el release anterior e intenta
verificarlo. Las migraciones se ejecutan por separado. Antes de considerar
habilitado este flujo, falta validar la configuración de GitHub y ejecutar
la promoción y el rollback en QA.


## Retención de artefactos de Habita

`cleanup-releases.py` limita la CLI a `/var/www/habita-crm`, comparte
`shared/deploy.lock` y nunca elimina el release apuntado por `current`,
datos/configuraciones compartidos ni otros proyectos. Revalida la ruta canónica
antes de cada borrado y no sigue enlaces de releases antiguos (incluido `.env`).

`activate-release.sh` lo invoca solo después de salud correcta y fuera del trap
de rollback, heredando FD9. Si la limpieza falla, informa el pendiente y conserva
el despliegue saludable; nunca intenta restaurar una versión ya retirada.
Los paquetes posteriores y de otro despliegue generado en el mismo segundo
se conservan, pues pueden estar cargándose antes de adquirir el bloqueo.

`habita-cleanup.cron` es el mantenimiento diario independiente: 03:17 en la zona
del servidor, ejecutado como `ubuntu`, con registro local `habita-cleanup`.
`--stale-only` limpia restos fallidos con timestamp y mtime mayores de 24 horas;
no interfiere con un deploy bloqueado ni con cargas recientes. El helper instalado
vive en `shared/cleanup-releases.py`; su cron dedicado en
`/etc/cron.d/habita-cleanup`. No modifica los cron de otros proyectos.

Verificación Linux/CI: `python3 -m unittest discover -s deploy/habita -p 'test_cleanup_releases.py'`.
Incluye enlaces en ancestros, cambio de current, rechazo de rutas externas,
inventario generado con semilla `20261111` y candidatos malformados.
En Windows se omite explícitamente por requerir semántica POSIX de enlaces.

Limpieza autorizada del 11/11/2026: 43 releases y 55 paquetes retirados;
se conservó `20261111154437-ba941a2-ci-43050757530-1`, salud ready,
entorno/configuración/CA idénticos. Disco de 100 % a 75 %, 3,8 GB libres.
No se publicó ni se reinició la aplicación por esta limpieza.
