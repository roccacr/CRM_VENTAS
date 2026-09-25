@echo off
setlocal

REM Comando raiz de validacion del CRM TINK.
REM No crea workspace Node ni instala dependencias globales; solo orquesta los
REM checks locales de API y frontend, cada uno desde su propia carpeta.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\check-all.ps1" %*
exit /b %ERRORLEVEL%
