# Publicación verificada — 29/10/2026

Registro posterior a la publicación; no modifica el artefacto desplegado.

- Release activo: `20261029153635-ce19e12-local`.
- Archivo SHA-256: `c9d37c58f923cc6a47bd42da56cb226c294cbfa07b1e907adadece6f57aaa81a`.
- Fuente: rama `temp/crm-tink-api-frontend-inicial`, base local
  `ce19e122a27ffc5f9a24142fc32ce816bf7ef6d6`, más cambios locales autorizados.
  El clon remoto original era `72a0c0e9ad8a582f7a91271ca128a4f8cf3e5f65`;
  el manifiesto describe el overlay, no un checkout limpio publicado en Git.
- Verificados 1120 archivos fuente y 651 archivos compilados en destino.
- Builds API/frontend correctos desde copia fija. API typecheck, ESLint y
  Prettier de los dos archivos modificados correctos; 42 pruebas del controlador
  de identidad aprobadas. La prueba con `clientdata` falló antes de la corrección
  y pasó después. No se ejecutó toda la suite ni fixtures MySQL.
- Node 22.23.2; pnpm 10.28.2; PM2 7.1.1 privado. `habita-pm2` activo y habilitado
  al inicio; proceso `habita-api` online. Servicio directo anterior deshabilitado.
- Apache: configuración válida; mantiene una advertencia previa de otro sitio
  por `/var/www/sambox/crmm-app/`, ajena a Habita.
- Certbot: certificado SAN vigente para `habita.roccacr.com` y
  `api-habita.rdghub.com`, renovación programada y hook Apache instalado.
- `/` redirige 302 a `/auth/login`; login, recursos JS/CSS, ruta profunda SPA y
  `/health/ready` público responden 200. Peticiones protegidas sin sesión: 401.
- Inicio Microsoft por POST con CSRF: 200 hacia `login.microsoftonline.com`,
  con callback Web `https://habita.roccacr.com/identity/microsoft/callback`.
  Callback con `clientdata` pero sin código/state: fallo controlado 303,
  sin el anterior 400 del DTO. Esto no certifica un login real de un empleado.
- Azure: callback Web público añadido, conservando localhost y otras URI.
- `.env` producción: `shared/api.env`, 0600, enlazado desde el API y cargado con
  `--env-file`. La BD nativa sigue siendo `CRM_THINK_V2`, legacy conserva
  `crmdatabase-api` y NetSuite permanece Sandbox. No hubo migraciones,
  fixtures, cambios comerciales ni escrituras ERP de verificación.
- El publicador se ejecutó realmente. Detectó y detuvo un cambio concurrente
  de fuente; luego se corrigió para compilar una copia fija. La primera activación
  de esa copia revirtió automáticamente por permisos de lectura de Apache y
  se confirmó la salud del release anterior. Se corrigieron solo los permisos
  del camino público y del build frontend; la publicación final pasó los controles.
- Captura de la pantalla de acceso:
  `C:/codex-data/visualizations/2026/10/29/habita-crm-publicado.png`.

Pendiente de aceptación: entrar con la cuenta corporativa del usuario y comprobar
la navegación funcional autorizada. No se afirma que NetSuite esté en producción.
