import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setleadActive } from '../store/leads/leadSlice';
import { WhatsappAndNote } from '../store/leads/thunksLeads';
import Swal from 'sweetalert2';
import { MODAL_TEXTS } from '../app/pages/modal/constants';

export const useLeadActions = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();

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

    const handleNote = (leadData) => {
        dispatch(setleadActive(leadData));
        navigate(`/leads/note?id=${leadData?.idinterno_lead}`);
    };

    const handleEvents = (leadData) => {
        dispatch(setleadActive(leadData));
        navigate(`/events/actions?idCalendar=0&idLead=${leadData?.idinterno_lead}&idDate=0`);
    };

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

    const handleOpportunityList = (leadData) => {
        navigate(`/oportunidad/list?idLead=${leadData?.idinterno_lead}`);
    };

    const handleCallClient = (telefono) => {
        if (telefono) {
            window.open(`tel:${telefono}`, "_self");
        } else {
            Swal.fire('Error', MODAL_TEXTS.NO_PHONE, 'error');
        }
    };

    const PerfilUsuario = (leadData) => {
        navigate(`/leads/perfil?data=${leadData?.idinterno_lead}`);
    };

    const handleBck = () => {
        navigate(-1);
    };

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
        handedit
    };
}; 