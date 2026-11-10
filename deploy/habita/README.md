# Habita: despliegue en Ubuntu / Apache

Revisión documental03/11/2026: el inventario vigente está en [85](../../apps/api/Arquitectura/85-Reconciliacion-Documental-20261103.md). Los recibos, hashes, instalación o despliegue inferiores conservan su fecha; no se reejecutaron ni acreditan el árbol actual.

## Vigencia y límites — revisión 2026-11-02

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
| `activate-release.sh` | Prepara release, instala runtime, valida, cambia symlink/reinicia exclusivamente API y revierte ante fallo |
| `verify-release.py` | Verifica paths y hashes del overlay; **también elimina archivos del clon** ausentes del manifiesto dentro del release validado; no consulta BD |
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
- NetSuite: FRONTEND_ORIGIN de Habita fija Producción; configurar previamente
  NETSUITE_PRODUCTION_RESTLET_URL con script/deploy confirmados y NETSUITE_* de
  cuenta 4552704. NETSUITE_PRODUCTION_READ_MODE elige legacy o modules según el
  contrato del script. No publicar esta revisión con URL pendiente.
  Sandbox usa NETSUITE_SANDBOX_* únicamente en el backend local.
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
y solicita verificar su salud. Los releases y paquetes se conservan para revisión;
revisar espacio disponible antes de publicar repetidamente.

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


## Activacion acotada verificada — 2026-11-03

Release activo `20261103171020-netsuite`, basado en `20261103154247-4d446ed-local`.
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

## CI/CD con GitHub Actions

El workflow `CRM quality` ejecuta formato, lint, tipos, pruebas con cobertura y build en cada push y PR. Las pruebas se ejecutan una sola vez por app. Para un push a la rama protegida
`HABITA_RELEASE_BRANCH`, los builds de API y frontend se guardan en paralelo.
El empaquetado espera a ambos controles de calidad, auditoría de dependencias
y pruebas de NetSuite. MySQL general conserva su estado informativo. QA y
producción reciben el mismo archivo, con SHA del commit y SHA-256 del paquete.
El frontend usa el origen del navegador para hablar con el proxy de cada entorno.

### Habilitación

1. Confirmar y proteger la rama de release en GitHub. Configurar las variables
   de repositorio `HABITA_RELEASE_BRANCH` y `HABITA_QA_ENABLED=true`.
2. Configurar los entornos `habita-qa` y `production`, restringidos a esa rama.
   Cada entorno requiere las variables `HABITA_SSH_TARGET` (usuario@host),
   `HABITA_WEB_ORIGIN` y `HABITA_API_ORIGIN`, más los secretos
   `HABITA_SSH_KEY` y `HABITA_SSH_KNOWN_HOSTS`. Usar credenciales dedicadas
   por entorno y registrar la clave de host a partir de una fuente confiable.
3. Preparar una instancia QA independiente con el mismo layout de Habita,
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
Compara el HTML publicado con el build y valida el health de la API. Si falla,
restaura y comprueba el release anterior. Las migraciones se ejecutan por
separado. Los despliegues parciales quedan para después de validar este flujo.
