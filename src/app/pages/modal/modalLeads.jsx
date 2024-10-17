import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { getBitacoraLeads, WhatsappAndNote } from "../../../store/leads/thunksLeads";
import { useNavigate } from "react-router-dom";
import { setleadActive } from "../../../store/leads/leadSlice";
import Swal from "sweetalert2";

export const ModalLeads = ({ leadData, onClose }) => {
    // Hooks de React y Redux
    const navigate = useNavigate(); // Hook para navegar entre rutas en React.
    const dispatch = useDispatch(); // Hook para despachar acciones a Redux.
    const [showModal, setShowModal] = useState(false); // Estado para mostrar u ocultar el modal.
    const [isMobile, setIsMobile] = useState(window.matchMedia("(max-width: 768px)").matches); // Estado para detectar si es un dispositivo móvil.
    const [showPreload, setShowPreload] = useState(true); // Estado para mostrar u ocultar el preload (cargando).
    const [bitacora, setBitacora] = useState([]); // Estado para almacenar los datos de la bitácora.

    // Hook para manejar el cambio de tamaño de pantalla y detectar si es móvil o no.
    useEffect(() => {
        const mediaQuery = window.matchMedia("(max-width: 768px)");
        const handleMediaQueryChange = (e) => setIsMobile(e.matches); // Actualiza isMobile cuando el tamaño cambia.
        mediaQuery.addEventListener("change", handleMediaQueryChange); // Escucha cambios en el tamaño de pantalla.
        return () => mediaQuery.removeEventListener("change", handleMediaQueryChange); // Limpia el evento al desmontar.
    }, []);

    // Hook para mostrar el modal después de 100ms cuando leadData cambia.
    useEffect(() => {
        const timer = setTimeout(() => setShowModal(true), 100); // Temporizador para mostrar el modal.
        return () => clearTimeout(timer); // Limpia el temporizador al desmontar o cuando leadData cambia.
    }, [leadData]);

    // Hook para obtener la bitácora cuando cambia el leadData.
    useEffect(() => {
        const fetchBitacora = async () => {
            try {
                const result = await dispatch(getBitacoraLeads(leadData?.idinterno_lead)); // Llama a la acción de Redux para obtener la bitácora del lead.
                setBitacora(result); // Almacena los resultados en el estado.
                setShowPreload(false); // Oculta el preload cuando los datos son cargados.
            } catch (error) {
                console.error("Error fetching bitacora:", error); // Maneja cualquier error.
                setShowPreload(false); // Asegura que el preload se oculte incluso en caso de error.
            }
        };
        fetchBitacora(); // Ejecuta la función de carga de bitácora.
    }, [dispatch, leadData]);

    // Función para cerrar el modal.
    const handleClose = () => {
        setShowModal(false); // Oculta el modal.
        setTimeout(() => onClose && onClose(), 100); // Llama a la función onClose si existe después de 100ms.
    };

    // Función para copiar el nombre del lead al portapapeles.
    const handleCopy = () => {
        const leadName = leadData?.nombre_lead || "No cuenta con nombre de cliente"; // Nombre del lead, con valor por defecto.
        navigator.clipboard.writeText(leadName).then(() => {
            console.log("Texto copiado al portapapeles:", leadName); // Copia el texto al portapapeles y lo registra en la consola.
        });
    };

    // Función para copiar el teléfono del lead al portapapeles.
    const handleCopyPhone = () => {
        const leadPhone = leadData?.telefono_lead || "No cuenta con teléfono"; // Teléfono del lead, con valor por defecto.
        navigator.clipboard.writeText(leadPhone).then(() => {
            console.log("Texto copiado al portapapeles:", leadPhone); // Copia el texto al portapapeles y lo registra en la consola.
        });
    };

    // Función para abrir WhatsApp con el número del lead.
    const handleWhatsappClick = () => {
        let telefono = leadData?.telefono_lead; // Obtiene el teléfono del lead.

        if (telefono) {
            // Limpia el número de caracteres no numéricos, manteniendo el '+' inicial.
            telefono = telefono.trim().replace(/[^0-9+]/g, "");

            // Si el teléfono no comienza con '+', lo añade.
            if (!telefono.startsWith("+")) {
                telefono = `+${telefono}`;
            }

            // Verifica que el número tenga al menos 8 dígitos para ser válido internacionalmente.
            if (telefono.length > 8) {
                const whatsappUrl = `https://wa.me/${telefono}`; // Construye la URL de WhatsApp.
                window.open(whatsappUrl, "_blank"); // Abre la URL de WhatsApp en una nueva ventana.
            } else {
                alert("El número de teléfono no es válido para WhatsApp."); // Muestra un mensaje de error si el número no es válido.
            }
        } else {
            alert("Este lead no tiene un número de teléfono."); // Muestra un mensaje de error si el lead no tiene teléfono.
        }
    };

    // Función para realizar una llamada al número del lead.
    const handleCallClient = () => {
        const leadPhone = leadData?.telefono_lead; // Obtiene el teléfono del lead.
        if (leadPhone) {
            const callUrl = `tel:${leadPhone}`; // Construye la URL para la llamada.
            window.open(callUrl, "_self"); // Abre la URL en la misma ventana para realizar la llamada.
        } else {
            alert("Este lead no tiene un número de teléfono."); // Muestra un mensaje si no hay teléfono.
        }
    };

    // Función para abrir la vista de notas de un lead.
    const handleNote = (leadData) => {
        const idLead = leadData?.idinterno_lead; // Obtiene el ID del lead.
        dispatch(setleadActive(leadData)); // Despacha una acción para marcar el lead como activo.
        navigate(`/leads/note?id=${idLead}`); // Navega a la ruta de notas del lead.
    };

    // Función para abrir la vista de eventos de un lead.
    const handleEvents = (leadData) => {
        const idLead = leadData?.idinterno_lead; // Obtiene el ID del lead.
        dispatch(setleadActive(leadData)); // Despacha una acción para marcar el lead como activo.
        navigate(`/events/actions?idCalendar=0&idLead=${idLead}&idDate=0`); // Navega a la ruta de eventos del lead.
    };

    const handleWhatsappAndNote = () => {
        const leadPhone = leadData?.telefono_lead;
        const leadDat = leadData?.idinterno_lead;
        const valueStatus = leadData?.segimineto_lead;
        if (leadPhone) {
            // Mostrar el SweetAlert
            Swal.fire({
                title: "¿Está seguro?",
                text: "¿abrir WhatsApp y generar una nota?",
                icon: "warning",
                iconHtml: "؟",
                width: "55em",
                padding: "0 0 1.30em",
                showCancelButton: true,
                confirmButtonText: "Sí, quiero hacerlo",
                cancelButtonText: "No",
            }).then(async (result) => {
                if (result.isConfirmed) {
                    const note = "Contacto generadon desde el boton de whatsapp";
                    await dispatch(WhatsappAndNote(note, leadDat, valueStatus));
                    handleWhatsappClick();
                    window.location.reload();
                }
            });
        } else {
            alert("Este lead no tiene un número de teléfono.");
        }
    };
    const handleBck = () => {
        navigate(-1); // Esto regresa a la página anterior
    };

    // ir a la vista de perdidos
    const handleLoss = (leadData) => {
        const idLead = leadData?.idinterno_lead; // Obtiene el ID del lead.

        navigate(`/leads/loss?id=${idLead}`); // Navega a la ruta de eventos del lead.
    };

    const handfollow_up = (leadData) => {
        const idLead = leadData?.idinterno_lead; // Obtiene el ID del lead.

        navigate(`/leads/follow_up?id=${idLead}`); // Navega a la ruta de eventos del lead.
    };
    const handedit = (leadData) => {
        const idLead = leadData?.idinterno_lead; // Obtiene el ID del lead.

        navigate(`/leads/edit?id=${idLead}`); // Navega a la ruta de eventos del lead.
    };


    const crearOportunidad = (leadData) => {
        const idLead = leadData?.idinterno_lead; // Obtiene el ID del lead.

        navigate(`/oportunidad/crear?idExpediente=0&idLead=${idLead}`); // Navega a la ruta de eventos del lead.
    };
    let buttonData = [
        { text: "Ir a Whatsapp", icon: "fab fa-whatsapp", color: "#25d366", action: handleWhatsappClick },
        { text: "Whatsapp y Contacto", icon: "fab fa-whatsapp", color: "#25d366", action: () => handleWhatsappAndNote() },
        { text: "Nota de Contacto", icon: "fab fa-wpforms", color: "#c0392b", action: () => handleNote(leadData) },
        { text: "Crear un evento", icon: "fas fa-calendar-check", color: "#2c3e50", action: () => handleEvents(leadData) },
        { text: "Dar como perdido", icon: "fas fa-window-close", color: "#78281f", action: () => handleLoss(leadData) },
        { text: "Colocar en seguimiento", icon: "fas fa-location-arrow", color: "#f1c40f", action: () => handfollow_up(leadData) },
        { text: "Crear Oportunidad", icon: "fas fa-level-up-alt", color: "#af7ac5", action: () => crearOportunidad(leadData) },
        { text: "Lista Oportunidades", icon: "fas fa-stream", color: "#2471a3" },
        { text: "Llamar cliente", icon: "fas fa-phone", color: "#2e86c1", action: handleCallClient }, // Añadimos la acción de llamada
        { text: "Ver Perfil", icon: "fas fa-user-circle", color: "#7b7d7d" },
        { text: "Volver", icon: "fas fa-backspace", color: "#000", action: handleBck },
        { text: "Edit lead", icon: "fas fa-location-arrow", color: "#2ec1bd", action: () => handedit(leadData) },
    ];

    // Verificamos si el valor de dataValue es diferente a "2"
    if (leadData?.segimineto_lead !== "01-LEAD-INTERESADO") {
        // Filtramos el botón "Whatsapp y Contacto" si dataValue no es igual a 2
        buttonData = buttonData.filter((button) => button.text !== "Whatsapp y Contacto");
    }

    const renderButtons = (forDropdown = false) =>
        buttonData.map((btn, idx) => (
            <li
                key={idx}
                className={forDropdown ? "dropdown-item" : "btn btn-shadow"}
                style={!forDropdown ? { backgroundColor: btn.color, color: "#fff", borderColor: btn.color, marginBottom: "0px" } : { marginBottom: "5px" }}
                onClick={btn.action || (() => {})} // Si tiene una acción asignada, la ejecuta.
            >
                <i className={btn.icon}></i> {btn.text}
            </li>
        ));

    const formatDate = (dateString) => {
        const date = new Date(dateString);

        // Ajustar la fecha a la zona horaria de Costa Rica (UTC-6)
        const localDate = new Date(date.getTime() - 6 * 60 * 60 * 1000);

        // Extraer año, mes y día
        const year = localDate.getFullYear();
        const month = String(localDate.getMonth() + 1).padStart(2, "0");
        const day = String(localDate.getDate()).padStart(2, "0");

        // Extraer horas, minutos y segundos, ajustando al formato de 12 horas
        let hours = localDate.getHours();
        const minutes = String(localDate.getMinutes()).padStart(2, "0");
        const seconds = String(localDate.getSeconds()).padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        hours = hours ? hours : 12; // Si la hora es '0', que sea '12'
        hours = String(hours).padStart(2, "0");

        const formattedDate = `${year}-${month}-${day}`;
        const formattedTime = `${hours}:${minutes}:${seconds} ${ampm}`;

        return { formattedDate, formattedTime };
    };

    const sortedBitacora = [...bitacora].sort((a, b) => new Date(b.fecha_creado_bit) - new Date(a.fecha_creado_bit));

    return (
        <div className={`modal fade bd-example-modal-lg ${showModal ? "show" : ""}`} tabIndex="-1" aria-labelledby="myLargeModalLabel" style={{ display: showModal ? "block" : "none" }} aria-modal="true" role="dialog" onClick={handleClose}>
            <div className="modal-dialog modal-lg" style={{ maxWidth: isMobile ? "98%" : "68%", margin: "4.99rem auto" }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-content">
                    <div className="modal-header">
                        <div className="d-inline-block">
                            <h4 onClick={handleCopy} style={{ cursor: "pointer" }}>
                                {leadData?.nombre_lead || "..."}{" "}
                                <i className="material-icons-two-tone" onClick={handleCopy} style={{ cursor: "pointer" }}>
                                    content_copy
                                </i>
                            </h4>
                            <h5 onClick={handleCopyPhone} style={{ cursor: "pointer" }}>
                                Telefono: {leadData?.telefono_lead || "..."}{" "}
                                <i className="material-icons-two-tone" onClick={handleCopyPhone} style={{ cursor: "pointer" }}>
                                    content_copy
                                </i>
                            </h5>
                            <p className="m-b-0">Proyecto: {leadData?.proyecto_lead}</p>
                            <p className="m-b-0">Campaña: {leadData?.campana_lead}</p>
                            <p className="m-b-0">Asesor: {leadData?.name_admin}</p>
                        </div>
                        <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" onClick={handleClose}></button>
                    </div>

                    <div className="modal-body">
                        <p style={{ textAlign: "center" }}>¿Qué deseas hacer con este lead?</p>

                        <div className="d-none d-lg-flex justify-content-center text-center flex-wrap gap-2">{renderButtons()}</div>

                        <div className="d-lg-none d-flex justify-content-center">
                            <div className="btn-group" onClick={(e) => e.stopPropagation()}>
                                <button type="button" className="btn btn-secondary dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                                    Opciones de Lead
                                </button>
                                <ul className="dropdown-menu dropdown-menu-end" onClick={(e) => e.stopPropagation()}>
                                    {renderButtons(true)}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card latest-activity-card">
                    <div className="card-header">
                        <h5>
                            {" "}
                            <i className="fas fa-drafting-compass"></i> Últimas Acciones Realizadas a este lead{" "}
                        </h5>
                    </div>
                    {showPreload ? (
                        <div className="preload-content" style={{ textAlign: "center", padding: "20px" }}>
                            <p>Cargando últimas acciones...</p>
                        </div>
                    ) : (
                        <div className="card-body">
                            {sortedBitacora.length > 0 ? (
                                sortedBitacora.map((entry, idx) => {
                                    const { formattedDate, formattedTime } = formatDate(entry.fecha_creado_bit);
                                    return (
                                        <div className="latest-update-box" key={idx}>
                                            <div className="row p-t-20 p-b-30">
                                                <div className="col-auto text-end update-meta">
                                                    <p className="text-muted m-b-0 d-inline-flex">{formattedTime}</p>
                                                    <div className="border border-2 border-success text-success update-icon">
                                                        <i className="ph-duotone ph-rocket"></i>
                                                    </div>
                                                </div>
                                                <div className="col">
                                                    <span className="badge bg-dark m-b-0" style={{ marginBottom: "10px" }}>
                                                        {" "}
                                                        {entry.estado_bit}
                                                    </span>

                                                    <p className="text-muted m-b-0">Accion: {entry.detalle_bit}</p>
                                                    <p className="text-muted m-b-0">Motivo: {entry.nombre_caida}</p>
                                                    <h6 className="mb-0 me-2"> {formattedDate} </h6>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p>No hay acciones recientes para este lead.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
