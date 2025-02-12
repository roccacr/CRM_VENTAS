import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setleadActive } from '../store/leads/leadSlice';
import { WhatsappAndNote } from '../store/leads/thunksLeads';
import Swal from 'sweetalert2';
import { MODAL_TEXTS } from '../app/pages/modal/constants';

/**
 * Hook `useLeadActions`
 *
 * Este hook encapsula todas las acciones relacionadas con un lead, como navegar a vistas específicas,
 * interactuar con APIs externas (WhatsApp), mostrar mensajes de confirmación y manejar datos asociados.
 *
 * @returns {Object} - Funciones para manejar acciones relacionadas con el lead.
 */
export const useLeadActions = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    /**
     * Abre WhatsApp con el número proporcionado.
     * Si el número no es válido o no está definido, muestra un mensaje de error.
     *
     * @param {string} telefono - Número de teléfono del lead.
     */
    const handleWhatsappClick = (telefono) => {
        if (!telefono) {
            Swal.fire('Error', MODAL_TEXTS.NO_PHONE, 'error');
            return;
        }

        const cleanedPhone = telefono.trim().replace(/[^0-9+]/g, "");
        const formattedPhone = cleanedPhone.startsWith("+") ? cleanedPhone : `+${cleanedPhone}`;

        if (formattedPhone.length > 8) {
            window.open(`https://wa.me/${formattedPhone}`, "_blank");
        } else {
            Swal.fire('Error', 'El número de teléfono no es válido para WhatsApp.', 'error');
        }
    };

    /**
     * Navega a la pantalla para agregar una nota asociada al lead.
     *
     * @param {Object} leadData - Datos del lead.
     */
    const handleNote = (leadData) => {
        dispatch(setleadActive(leadData));
        navigate(`/leads/note?id=${leadData?.idinterno_lead}`);
    };

    /**
     * Navega a la pantalla para crear o ver eventos asociados al lead.
     *
     * @param {Object} leadData - Datos del lead.
     */
    const handleEvents = (leadData) => {
        dispatch(setleadActive(leadData));
        navigate(`/events/actions?idCalendar=0&idLead=${leadData?.idinterno_lead}&idDate=0`);
    };

    /**
     * Abre WhatsApp y genera una nota asociada al lead después de confirmar la acción.
     *
     * @param {Object} leadData - Datos del lead.
     */
    const handleWhatsappAndNote = async (leadData) => {
        const result = await Swal.fire({
            title: '¿Está seguro?',
            text: MODAL_TEXTS.WHATSAPP_CONFIRM,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, quiero hacerlo',
            cancelButtonText: 'No',
        });

        if (result.isConfirmed) {
            const note = "Contacto generado desde el botón de WhatsApp";
            await dispatch(WhatsappAndNote(note, leadData?.idinterno_lead, leadData?.segimineto_lead));
            handleWhatsappClick(leadData?.telefono_lead);
            window.location.reload();
        }
    };

    /**
     * Marca un lead como perdido después de confirmar la acción.
     *
     * @param {Object} leadData - Datos del lead.
     */
    const handleLoss = (leadData) => {
        Swal.fire({
            title: '¿Está seguro?',
            text: MODAL_TEXTS.CONFIRM_LOSS,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, marcar como perdido',
            cancelButtonText: 'Cancelar',
        }).then((result) => {
            if (result.isConfirmed) {
                navigate(`/leads/loss?id=${leadData?.idinterno_lead}`);
            }
        });
    };

    /**
     * Coloca un lead en seguimiento después de confirmar la acción.
     *
     * @param {Object} leadData - Datos del lead.
     */
    const handfollow_up = (leadData) => {
        Swal.fire({
            title: '¿Está seguro?',
            text: MODAL_TEXTS.CONFIRM_FOLLOW_UP,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, colocar en seguimiento',
            cancelButtonText: 'Cancelar',
        }).then((result) => {
            if (result.isConfirmed) {
                navigate(`/leads/follow_up?id=${leadData?.idinterno_lead}`);
            }
        });
    };

    /**
     * Crea una oportunidad asociada al lead después de confirmar la acción.
     *
     * @param {Object} leadData - Datos del lead.
     */
    const crearOportunidad = (leadData) => {
        Swal.fire({
            title: '¿Está seguro?',
            text: MODAL_TEXTS.CONFIRM_OPPORTUNITY,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, crear oportunidad',
            cancelButtonText: 'Cancelar',
        }).then((result) => {
            if (result.isConfirmed) {
                navigate(`/oportunidad/crear?idExpediente=0&idLead=${leadData?.idinterno_lead}`);
            }
        });
    };

    /**
     * Navega a la lista de oportunidades asociadas al lead.
     *
     * @param {Object} leadData - Datos del lead.
     */
    const handleOpportunityList = (leadData) => {
        navigate(`/oportunidad/list?idLead=${leadData?.idinterno_lead}`);
    };

    /**
     * Realiza una llamada al número proporcionado.
     * Si el número no está definido, muestra un mensaje de error.
     *
     * @param {string} telefono - Número de teléfono del lead.
     */
    const handleCallClient = (telefono) => {
        if (telefono) {
            window.open(`tel:${telefono}`, "_self");
        } else {
            Swal.fire('Error', MODAL_TEXTS.NO_PHONE, 'error');
        }
    };

    /**
     * Navega al perfil del usuario asociado al lead.
     *
     * @param {Object} leadData - Datos del lead.
     */
    const PerfilUsuario = (leadData) => {
        navigate(`/leads/perfil?data=${leadData?.idinterno_lead}`);
    };

    /**
     * Navega hacia atrás en el historial de navegación.
     */
    const handleBck = () => {
        navigate(-1);
    };

    /**
     * Navega a la pantalla de edición del lead.
     *
     * @param {Object} leadData - Datos del lead.
     */
    const handedit = (leadData) => {
        navigate(`/leads/edit?id=${leadData?.idinterno_lead}`);
    };

    return {
        handleWhatsappClick,
        handleNote,
        handleEvents,
        handleWhatsappAndNote,
        handleLoss,
        handfollow_up,
        crearOportunidad,
        handleOpportunityList,
        handleCallClient,
        PerfilUsuario,
        handleBck,
        handedit,
    };
};
