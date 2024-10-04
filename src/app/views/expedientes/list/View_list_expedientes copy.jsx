import axios from "axios";
import React, { useState, useEffect, useRef } from "react";

// Componente para mostrar el modal
const Modal = ({ show, onClose, mediaType, mediaSrc }) => {
    if (!show) return null;

    // Función para cerrar el modal si se hace clic fuera de él
    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose(); // Cierra el modal si se hace clic fuera del contenido
        }
    };

    const renderMedia = () => {
        switch (mediaType) {
            case "image":
                return <img src={mediaSrc} alt="Preview" style={{ maxWidth: "100%", maxHeight: "80vh" }} />;
            case "video":
                return <video controls src={mediaSrc} style={{ maxWidth: "100%", maxHeight: "80vh" }} />;
            case "audio":
                return <audio controls src={mediaSrc} style={{ width: "100%" }} />;
            case "document":
                return (
                    <iframe src={mediaSrc} title="Document" style={{ width: "100%", height: "80vh" }}>
                        Tu navegador no soporta iframes.
                    </iframe>
                );
            default:
                return <span>Tipo de medio no soportado</span>;
        }
    };

    return (
        <div style={styles.overlay} onClick={handleOverlayClick}>
            <div style={styles.modal}>
                <button onClick={onClose} style={styles.closeButton}>
                    X
                </button>
                {renderMedia()}
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
    },
    modal: {
        position: "relative",
        backgroundColor: "#fff",
        padding: "20px",
        borderRadius: "8px",
        maxWidth: "90vw",
        maxHeight: "90vh",
        overflow: "auto",
    },
    closeButton: {
        position: "absolute",
        top: "10px",
        right: "10px",
        backgroundColor: "transparent",
        border: "none",
        fontSize: "20px",
        cursor: "pointer",
    },
};

// Componente memoizado para mostrar cada mensaje
const Message = React.memo(({ msg, openModal, apiBaseUrl }) => {
    const renderMessageContent = (msg) => {
        if (msg.mediaPath) {
            // Reemplazar la ruta del sistema de archivos por la URL relativa a /media
            const relativeMediaPath = msg.mediaPath.replace(
                "C:\\Users\\RobertoCarlosZuñigaA\\Desktop\\Api Whatsapp\\media\\", // Ruta absoluta del sistema de archivos
                "/media/", // Ruta relativa para acceder desde el servidor
            );

            const extension = relativeMediaPath.split(".").pop().toLowerCase();
            switch (extension) {
                case "jpg":
                case "jpeg":
                case "png":
                    return <img src={`${apiBaseUrl}${relativeMediaPath}`} alt="Imagen" style={{ maxWidth: "150px", maxHeight: "150px", cursor: "pointer" }} onClick={() => openModal("image", `${apiBaseUrl}${relativeMediaPath}`)} />;
                case "mp4":
                    return <video controls src={`${apiBaseUrl}${relativeMediaPath}`} style={{ maxWidth: "150px", maxHeight: "150px", cursor: "pointer" }} onClick={() => openModal("video", `${apiBaseUrl}${relativeMediaPath}`)} />;
                case "ogg":
                    return (
                        <div style={{ cursor: "pointer" }} onClick={() => openModal("audio", `${apiBaseUrl}${relativeMediaPath}`)}>
                            <audio controls src={`${apiBaseUrl}${relativeMediaPath}`} style={{ maxWidth: "150px" }} />
                        </div>
                    );
                case "pdf":
                    return (
                        <a
                            href={`${apiBaseUrl}${relativeMediaPath}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                                e.preventDefault();
                                openModal("document", `${apiBaseUrl}${relativeMediaPath}`);
                            }}
                        >
                            Ver documento
                        </a>
                    );
                default:
                    return <span>Formato no soportado</span>;
            }
        } else {
            return <span>{msg.message || "Mensaje vacío"}</span>;
        }
    };

    return (
        <div
            style={{
                textAlign: msg.sender === "Yo" ? "left" : "right",
                margin: "10px 0",
                display: "flex",
                flexDirection: msg.sender === "Yo" ? "row" : "row-reverse",
                alignItems: "center",
            }}
        >
            <div style={{ maxWidth: "60%" }}>
                <div
                    style={{
                        backgroundColor: msg.sender === "Yo" ? "#e0e0e0" : "#007bff",
                        color: msg.sender === "Yo" ? "#000" : "#fff",
                        padding: "10px",
                        borderRadius: "10px",
                        wordWrap: "break-word",
                        display: "inline-block",
                    }}
                >
                    {renderMessageContent(msg)}
                </div>
                <small style={{ display: "block", marginTop: "5px" }}>{new Date(msg.timestamp).toLocaleString()}</small>
            </div>
        </div>
    );
});

export const View_list_expedientes = () => {
    const [to, setTo] = useState(""); // Número de teléfono seleccionado
    const [message, setMessage] = useState(""); // Mensaje a enviar
    const [conversations, setConversations] = useState([]); // Mensajes de la conversación actual
    const [contacts, setContacts] = useState([]); // Lista de contactos
    const [loading, setLoading] = useState(false); // Estado de carga
    const [showModal, setShowModal] = useState(false); // Estado del modal
    const [mediaType, setMediaType] = useState(""); // Tipo de media para el modal
    const [mediaSrc, setMediaSrc] = useState(""); // Fuente de media para el modal
    const messagesContainerRef = useRef(null); // Referencia al contenedor de mensajes
    const [allConversations, setAllConversations] = useState({}); // Todas las conversaciones
    const [prevAllConversations, setPrevAllConversations] = useState({}); // Estado anterior de todas las conversaciones
    const [unreadMessages, setUnreadMessages] = useState({}); // Mensajes no leídos por chat

    // Base URL para la API que corre en el puerto 3000
    const apiBaseUrl = "http://localhost:3000"; // Cambia localhost por el dominio si estás en producción

    // URL del sonido de notificación
    const notificationSoundUrl = "/notification.mp3";

    // Sonido de notificación
    const notificationSound = useRef(null);

    // Bandera para saber si el usuario ha interactuado con la página
    const [userInteracted, setUserInteracted] = useState(false);

    // Función para manejar la interacción del usuario
    const handleUserInteraction = () => {
        if (!userInteracted) {
            setUserInteracted(true);
            // Inicializar el objeto Audio después de la interacción del usuario
            notificationSound.current = new Audio(notificationSoundUrl);
        }
    };

    // Añadir el listener de interacción al montar el componente
    useEffect(() => {
        window.addEventListener("click", handleUserInteraction);
        window.addEventListener("keydown", handleUserInteraction);

        return () => {
            window.removeEventListener("click", handleUserInteraction);
            window.removeEventListener("keydown", handleUserInteraction);
        };
    }, [userInteracted]);

    // Función para obtener todas las conversaciones
    const fetchAllConversations = async () => {
        try {
            const res = await axios.get(`${apiBaseUrl}/conversations/all`);
            if (res.data.success) {
                const newConversations = res.data.conversations;

                // Detectar nuevos mensajes
                detectNewMessages(prevAllConversations, newConversations);

                setAllConversations(newConversations);
                setPrevAllConversations(newConversations);
            }
        } catch (error) {
            console.error("Error al obtener todas las conversaciones:", error.response?.data || error.message);
        }
    };

    // Función para detectar nuevos mensajes y reproducir sonido
    const detectNewMessages = (prevConvs, newConvs) => {
        const updatedUnreadMessages = { ...unreadMessages };

        for (const phoneNumber in newConvs) {
            const prevMessages = prevConvs[phoneNumber] || [];
            const newMessages = newConvs[phoneNumber];

            // Obtener los IDs de los mensajes anteriores y nuevos
            const prevMessageIds = prevMessages.map((msg) => msg.id);
            const newReceivedMessages = newMessages.filter((msg) => msg.type === "received" && !prevMessageIds.includes(msg.id));

            if (newReceivedMessages.length > 0) {
                // Hay nuevos mensajes recibidos que antes no teníamos
                // Si el chat no está abierto, reproducir sonido y actualizar los mensajes no leídos
                if (to !== phoneNumber) {
                    if (notificationSound.current) {
                        notificationSound.current.play().catch((error) => {
                            console.error("Error al reproducir el sonido:", error);
                        });
                    }
                    if (!updatedUnreadMessages[phoneNumber]) {
                        updatedUnreadMessages[phoneNumber] = 0;
                    }
                    updatedUnreadMessages[phoneNumber] += newReceivedMessages.length;
                } else {
                    // Si el chat está abierto, no hay mensajes no leídos
                    updatedUnreadMessages[phoneNumber] = 0;
                }
            }
        }

        setUnreadMessages(updatedUnreadMessages);
    };

    // Función para obtener la lista de contactos
    const fetchContacts = async () => {
        try {
            const res = await axios.get(`${apiBaseUrl}/conversations`);
            if (res.data.success) {
                setContacts(res.data.phoneNumbers); // Guardar los contactos obtenidos
            }
        } catch (error) {
            console.error("Error al obtener los contactos:", error.response?.data || error.message);
        }
    };

    // Función para obtener los mensajes según el número de teléfono
    const fetchConversation = async (phoneNumber) => {
        if (!phoneNumber) return;

        try {
            const res = await axios.get(`${apiBaseUrl}/conversation/${phoneNumber}/messages`);
            if (res.data.success) {
                const newMessages = res.data.messages;

                // Ordenar los mensajes del más antiguo al más reciente
                newMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                setConversations(newMessages);

                // Marcar los mensajes como leídos
                setUnreadMessages((prevUnread) => ({
                    ...prevUnread,
                    [phoneNumber]: 0,
                }));
            }
        } catch (error) {
            console.error("Error al obtener conversación:", error.response?.data || error.message);
        }
    };

    useEffect(() => {
        fetchContacts(); // Obtener la lista de contactos al montar el componente
    }, []);

    useEffect(() => {
        if (messagesContainerRef.current) {
            // Establece la posición de desplazamiento al final (abajo)
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
    }, [conversations]);

    // Función para enviar un mensaje personalizado
    const sendCustomMessage = async () => {
        if (!to || !message.trim()) {
            alert("Por favor, completa ambos campos: número y mensaje");
            return;
        }

        setLoading(true);
        try {
            const res = await axios.post(`${apiBaseUrl}/send-custom-message`, { to: `whatsapp:${to}`, message });
            if (res.data.success) {
                // Añade el nuevo mensaje directamente al estado sin volver a obtener toda la conversación
                const newMsg = {
                    id: res.data.messageId || Date.now(), // Asume que tu API devuelve el ID del mensaje
                    sender: "Yo",
                    message: message,
                    timestamp: new Date().toISOString(),
                };
                setConversations((prevConversations) => [...prevConversations, newMsg]);
                setMessage(""); // Reinicia el campo de mensaje
            }
        } catch (error) {
            console.error("Error al enviar mensaje:", error.response?.data || error.message);
        } finally {
            setLoading(false);
        }
    };

    // Función para abrir el modal con la media seleccionada
    const openModal = (mediaType, mediaSrc) => {
        setMediaType(mediaType);
        setMediaSrc(mediaSrc);
        setShowModal(true);
    };

    // Función para cerrar el modal
    const closeModal = () => {
        setShowModal(false);
        setMediaType("");
        setMediaSrc("");
    };

    // Polling para actualizar todas las conversaciones y detectar nuevos mensajes
    useEffect(() => {
        fetchAllConversations(); // Obtener todas las conversaciones al montar el componente

        const interval = setInterval(() => {
            fetchAllConversations();
        }, 5000); // Actualiza cada 5 segundos

        return () => clearInterval(interval);
    }, []);

    // Polling para actualizar la conversación actual
    useEffect(() => {
        if (to) {
            fetchConversation(to); // Cargar la conversación al seleccionar un contacto
            const interval = setInterval(() => {
                fetchConversation(to);
            }, 1000); // Actualiza cada 5 segundos
            return () => clearInterval(interval);
        }
    }, [to]);

    return (
        <div style={{ padding: "20px", display: "flex", flexDirection: "row", height: "90vh" }}>
            {/* Lista de contactos a la izquierda */}
            <div style={{ width: "25%", borderRight: "1px solid #ccc", paddingRight: "20px" }}>
                <h3>Contactos:</h3>
                <div style={{ display: "flex", flexDirection: "column" }}>
                    {contacts.length > 0 ? (
                        contacts.map((phoneNumber, index) => (
                            <button
                                key={index}
                                onClick={() => {
                                    setTo(phoneNumber); // Establecer el número de teléfono seleccionado
                                    fetchConversation(phoneNumber); // Cargar la conversación al hacer clic
                                    // Marcar mensajes como leídos
                                    setUnreadMessages((prevUnread) => ({
                                        ...prevUnread,
                                        [phoneNumber]: 0,
                                    }));
                                }}
                                style={{
                                    margin: "5px 0",
                                    padding: "10px",
                                    textAlign: "left",
                                    backgroundColor: to === phoneNumber ? "#007bff" : "#f1f1f1",
                                    color: to === phoneNumber ? "#fff" : "#000",
                                    border: "none",
                                    cursor: "pointer",
                                    position: "relative",
                                }}
                            >
                                {phoneNumber}
                                {/* Indicador de nuevos mensajes */}
                                {unreadMessages[phoneNumber] > 0 && to !== phoneNumber && (
                                    <span
                                        style={{
                                            position: "absolute",
                                            right: "10px",
                                            top: "50%",
                                            transform: "translateY(-50%)",
                                            backgroundColor: "red",
                                            color: "#fff",
                                            borderRadius: "50%",
                                            width: "20px",
                                            height: "20px",
                                            display: "flex",
                                            justifyContent: "center",
                                            alignItems: "center",
                                            fontSize: "12px",
                                        }}
                                    >
                                        {unreadMessages[phoneNumber]}
                                    </span>
                                )}
                            </button>
                        ))
                    ) : (
                        <p>No hay contactos disponibles.</p>
                    )}
                </div>
            </div>

            {/* Conversación a la derecha */}
            <div style={{ flex: 1, paddingLeft: "20px", display: "flex", flexDirection: "column" }}>
                <div
                    ref={messagesContainerRef}
                    style={{
                        flex: 1,
                        overflowY: "auto",
                        border: "1px solid #ccc",
                        padding: "10px",
                        marginBottom: "20px",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {loading && conversations.length === 0 ? <p>Cargando conversación...</p> : conversations.length > 0 ? conversations.map((msg, index) => <Message key={msg.id || index} msg={msg} openModal={openModal} apiBaseUrl={apiBaseUrl} />) : <p>No se encontraron mensajes para este número.</p>}
                </div>

                {/* Campo para escribir y enviar mensaje */}
                <div style={{ display: "flex", alignItems: "center" }}>
                    <input
                        type="text"
                        placeholder="Escribe tu mensaje"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                sendCustomMessage();
                            }
                        }}
                        style={{ flex: 1, marginRight: "10px", padding: "10px", borderRadius: "5px", border: "1px solid #ccc" }}
                    />
                    <button
                        onClick={sendCustomMessage}
                        disabled={loading || !to}
                        style={{
                            backgroundColor: "#28a745",
                            color: "#fff",
                            padding: "10px 20px",
                            border: "none",
                            borderRadius: "5px",
                            cursor: loading || !to ? "not-allowed" : "pointer",
                            position: "relative",
                        }}
                    >
                        {loading ? "Enviando..." : "Enviar"}
                        {loading && (
                            <span
                                style={{
                                    position: "absolute",
                                    right: "-30px",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                }}
                            >
                                {/* Indicador de carga simple */}
                                <div
                                    className="spinner"
                                    style={{
                                        width: "20px",
                                        height: "20px",
                                        border: "3px solid #f3f3f3",
                                        borderTop: "3px solid #fff",
                                        borderRadius: "50%",
                                        animation: "spin 1s linear infinite",
                                    }}
                                ></div>
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Modal para previsualizar medios */}
            <Modal show={showModal} onClose={closeModal} mediaType={mediaType} mediaSrc={mediaSrc} />
        </div>
    );
};

// Añade este estilo global para el spinner
const globalStyle = document.createElement("style");
globalStyle.innerHTML = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(globalStyle);
