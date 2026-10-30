# Habita: despliegue en Ubuntu / Apache

Destino autorizado: ubuntu@3.12.74.187. Fuente: rama
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
- API: `NODE_ENV=production`, `API_BIND_HOST=127.0.0.1`, `PORT=3100`,
  `FRONTEND_ORIGIN=https://habita.roccacr.com`, `TRUSTED_PROXY_IPS=127.0.0.1`.
- Mantener destinos BD, claves criptográficas e integración NetSuite configurada
  durante la transferencia; no cambiar Sandbox a producción automáticamente.
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
el API. La integración NetSuite conserva su destino Sandbox actual.

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
