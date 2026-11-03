# 05 - Testing Frontend

## Actualización contrastada — 03/11/2026

El árbol local incorpora regresiones de Adéndum manual/lectura/bandeja/futuro, calendario contextual y vacío global, disponibilidad/consentimiento Microsoft, detalle Outlook/participantes/posición, perfil por secciones, teléfono/país y las combinaciones de flags de cierre. Las pruebas usan servicios HTTP sustituidos; leer sus aserciones no acredita que se ejecutaron. Los resultados y fallos fechados inferiores se conservan. Esta conciliación documental no ejecuta la suite completa ni atribuye a HEAD los conteos antiguos; cualquier verificación nueva se registra en el cierre raíz.

## Inventario y evidencia - 2026-11-02

El proyecto usa Vitest/jsdom y Testing Library. `vite.config.ts` limita a dos
workers. Existen suites en administración, app, auth, calendario, catálogos,
configuración, home, notas y expedientes; `test/support` contiene apoyo de test,
no una funcionalidad CRM de soporte. Los mocks HTTP no acreditan BD, NetSuite,
correo real, concurrencia Redis ni aceptación con dos identidades reales.

Comando del proyecto: `pnpm check` encadena formato, lint, tipos, pruebas y build.
`pnpm build` ejecuta también `tsc --noEmit`. Cobertura se solicita con
`pnpm test:coverage`; no se reutiliza el porcentaje histórico de líneas como
medición actual. La entrada oficial del repositorio es `check-all.cmd` desde raíz.

La revisión del 2/11 detectó que `pnpm check` pasa formato y se detiene en lint:
orden de imports en CalendarEventDrawer, CalendarGuestFields y PersonalNotes, y
complejidad de NotesInbox. Documentar el fallo no autoriza modificar código para
simular una comprobación aprobada. Las verificaciones separadas que ejecute el
cierre raíz conservan su comando y resultado; no se atribuyen a este check fallido.

La ejecución completa separada de pruebas del 2/11 terminó con 1.270 aprobadas y
una fallida: `personal-notes.spec.tsx` esperaba `left:70px` después de movimientos
encolados y recibió `60px`. Son 92 archivos aprobados y uno fallido; no se marca
como corregida ni como aceptación global satisfactoria. El resultado del 29/10
con 1.271 aprobadas no oculta esta nueva reproducción. La suite no toca BD real.

Resultados anteriores: [67 API](../../api/Arquitectura/67-Plan-QA-Regresiones-20261029.md)
y [68 notas](../../api/Arquitectura/68-Plan-Notas-Vinculos-Clientes-y-Ordenes.md).
Son cortes solapados y fechados. El fallo intermitente previo de movimiento y la
repetición posterior se conservan en68; fixtures de viewport y mockReset aíslan
las pruebas sin convertir una ejecución posterior en éxito retroactivo.

## Vigencia documental - 2026-10-22, corte f2dc4f1

Estrategia y checklist de aceptacion; las listas siguientes no son resultados ejecutados ni autorizan el alcance comercial. Ultima evidencia previa a `f2dc4f1`: 428 pruebas frontend y 84.77% de lineas; no reejecutadas en esta auditoria documental. Fuente y limites: [reauditoria](../../api/Arquitectura/Reauditoria-54-Plan-y-Resultados.md). Playwright, Lighthouse y pruebas de dispositivos aqui propuestos requieren su propia evidencia.

## Estrategia

Usar pruebas por riesgo:

- Unit/component tests para componentes criticos.
- Hook tests para logica reutilizable.
- Integration tests para formularios.
- Playwright para flujos principales.

## Prioridad P0

- Login.
- Lista de leads.
- Busqueda/filtros.
- Crear lead.
- Editar lead.
- Registrar actividad.
- Permisos visibles.
- Dashboard basico.

## Principio

Probar lo que el usuario ve y hace, no detalles internos.

## Accesibilidad

Los tests de componentes criticos deben validar:

- labels;
- botones accesibles;
- mensajes de error;
- foco en modales;
- estados disabled/loading.

## Checklist QA enterprise para login

Para mantener el login real conectado al BFF, el componente debe pasar este checklist en cada cambio relevante:

### Estados de interaccion

- Focus visible en input, checkbox, ojo, enlaces y botones, con anillo perceptible.
- Hover, active, disabled y loading definidos para Microsoft y login local.
- Loading evita doble submit.
- Credenciales invalidas muestran mensaje neutral sin borrar el correo.
- Error de red o servidor usa mensaje distinto al de credenciales.
- Cuenta bloqueada o rate limit muestra tiempo de espera cuando el API lo envie.
- Error SSO contempla cancelacion, consentimiento denegado y tenant no permitido.
- Correo vacio y correo invalido tienen mensajes distintos.
- Errores no aparecen mientras el usuario escribe por primera vez; aparecen al perder foco o al enviar.
- Errores ya visibles se limpian en tiempo real cuando el campo queda valido.
- No hay salto de layout al aparecer o desaparecer errores.
- Si `navigator.onLine` es `false`, se muestra estado `Sin conexion a Internet`.

### Accesibilidad WCAG

- Contraste minimo 4.5:1 en labels, placeholders, divisor, recordarme, footer y errores.
- Cada input tiene label real; el placeholder no sustituye al label.
- Campos invalidos exponen `aria-invalid` y el error queda asociado al campo.
- Mensajes de error usan `role="alert"` o `aria-live="polite"`.
- El boton de mostrar/ocultar contrasena tiene nombre accesible y estado entendible.
- Iconos decorativos usan `aria-hidden="true"`.
- Hay un solo `h1`.
- El error no depende solo del color.
- Reflow a 320px y zoom 200% sin scroll horizontal.
- Respeta `prefers-reduced-motion`.
- Objetivos tactiles minimos de 24px; ideal 44px en movil.

### Teclado y flujo

- Orden de tabulacion: Microsoft, correo, contrasena, ojo, recordarme, recuperacion, ingresar.
- Enter envia desde los inputs.
- Espacio activa checkbox; Enter/Espacio activan botones.
- Submit invalido enfoca el primer campo con error.
- No hay trampas de foco.

### HTML y autofill

- Correo usa `type="email"`, `autocomplete="username"`, `inputmode="email"`, `autocapitalize="off"` y `spellcheck="false"`.
- Contrasena usa `autocomplete="current-password"`.
- Pegar en contrasena esta permitido.
- Inputs mantienen al menos 16px si el corte movil lo requiere para evitar zoom automatico en iOS.
- Campos de un solo uso o canales no credenciales usan `autocomplete="off"`.

### Seguridad visual y de flujo

- Mensaje de credenciales invalidas no revela si existe el correo.
- La pantalla publica de login no expone version del sistema ni datos utiles para fingerprinting.
- No hay tokens en `localStorage`, `sessionStorage`, URL, logs ni analytics.
- Login local usa CSRF contra el API.
- Microsoft se inicia siempre contra el API/BFF, no desde componentes.
- `returnUrl` o `next` no permiten open redirect.
- Recuperacion de contrasena no enumera usuarios.
- Si se restringen sesiones simultaneas, existe flujo/modal para cerrar la sesion anterior.
- Proteccion anti-bot debe ser invisible o de baja friccion, por ejemplo honeypot o Turnstile, antes de declarar produccion si el riesgo lo exige.

### Contenido

- Usar un solo termino: `Contrasena` en label, placeholder, enlace y errores.
- Textos visibles y aria-labels tienen tildes y `ñ` correctas.
- Errores usan tono neutral y accionable.
- El texto queda preparado para i18n si se aprueban otros idiomas.

### Rendimiento y pruebas

- El login no carga dashboard ni modulos comerciales antes de autenticar.
- El logo esta optimizado y con dimensiones declaradas.
- Bundle inicial del login debe tener presupuesto definido antes de publicar; si Ant Design supera el presupuesto, dividir por carga diferida antes de produccion.
- axe DevTools o equivalente sin violaciones criticas.
- Lighthouse movil con accesibilidad y buenas practicas altas.
- Pruebas E2E cubren login valido, invalido, campos vacios, doble submit, bloqueo, SSO cancelado y red caida.
- Prueba visual cubre estado normal, hover, focus, error, loading, bloqueado y responsive.

## Mocks

Mockear API en capa de servicio, no dentro de componentes visuales base.
