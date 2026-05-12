/**
 * `BUTTON_DATA`
 *
 * Contiene un arreglo de objetos que representan las acciones disponibles para un lead. Cada objeto incluye
 * el texto, icono, color y la accion asociada que se ejecutara al seleccionar el boton.
 *
 * @type {Array<Object>}
 * @property {string} text - El texto que se mostrara en el boton.
 * @property {string} icon - Clase CSS que representa el icono del boton (compatible con Font Awesome).
 * @property {string} color - Codigo hexadecimal que define el color principal del boton.
 * @property {string} action - Nombre de la funcion o accion que se ejecutara al hacer clic en el boton.
 */
export const BUTTON_DATA = [
    { text: "Ir a Whatsapp", icon: "fab fa-whatsapp", color: "#25d366", action: "handleWhatsappClick" },
    { text: "Whatsapp y Contacto", icon: "fab fa-whatsapp", color: "#25d366", action: "handleWhatsappAndNote" },
    { text: "Nota de Contacto", icon: "fab fa-wpforms", color: "#c0392b", action: "handleNote" },
    { text: "Crear un evento", icon: "fas fa-calendar-check", color: "#2c3e50", action: "handleEvents" },
    { text: "Dar como perdido", icon: "fas fa-window-close", color: "#78281f", action: "handleLoss" },
    { text: "Colocar en seguimiento", icon: "fas fa-location-arrow", color: "#f1c40f", action: "handfollow_up" },
    { text: "Crear Oportunidad", icon: "fas fa-level-up-alt", color: "#af7ac5", action: "crearOportunidad" },
    { text: "Lista Oportunidades", icon: "fas fa-stream", color: "#2471a3", action: "handleOpportunityList" },
    { text: "Llamar cliente", icon: "fas fa-phone", color: "#2e86c1", action: "handleCallClient" },
    { text: "Ver Perfil", icon: "fas fa-user-circle", color: "#7b7d7d", action: "PerfilUsuario" },
    { text: "Volver", icon: "fas fa-backspace", color: "#000", action: "handleBck" },
    { text: "Edit lead", icon: "fas fa-location-arrow", color: "#2ec1bd", action: "handedit" }
];

/**
 * `MODAL_TEXTS`
 *
 * Contiene textos predefinidos que se muestran en los cuadros de dialogo (modales) de confirmacion para acciones
 * especificas del lead.
 *
 * @type {Object}
 * @property {string} WHATSAPP_CONFIRM - Texto de confirmacion para abrir WhatsApp y generar una nota.
 * @property {string} NO_PHONE - Mensaje que se muestra cuando el lead no tiene un numero de telefono.
 * @property {string} CONFIRM_LOSS - Confirmacion para marcar el lead como perdido.
 * @property {string} CONFIRM_FOLLOW_UP - Confirmacion para colocar al lead en seguimiento.
 * @property {string} CONFIRM_FOLLOW_UP_NOTE - Nota aclaratoria sobre cuando corresponde usar seguimiento.
 * @property {string} CONFIRM_OPPORTUNITY - Confirmacion para crear una oportunidad con el lead.
 */
export const MODAL_TEXTS = {
    WHATSAPP_CONFIRM: "¿abrir WhatsApp y generar una nota?",
    NO_PHONE: "Este lead no tiene un numero de telefono.",
    CONFIRM_LOSS: "¿Esta seguro de marcar este lead como perdido?",
    CONFIRM_FOLLOW_UP: "Esto cambiara el estado del lead.",
    CONFIRM_FOLLOW_UP_NOTE: "Use seguimiento solo si el lead sigue activo, pero aun no es oportunidad ni corresponde enviarlo a perdido. Si solo necesita agendar una llamada o recordatorio, cree un evento.",
    CONFIRM_OPPORTUNITY: "¿Esta seguro de crear una oportunidad con este lead?"
};
