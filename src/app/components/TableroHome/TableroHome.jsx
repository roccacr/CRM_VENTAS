export const TableroHome = ({ image, icons, nombre, cantidad, url, outlookCount, hasOutlook, alertStatus, leftLabel, rightLabel, leftColor, rightColor, leftUrl, rightUrl }) => {
    const updatePreviousUrlIfOpportunity = (targetUrl) => {
        if (!targetUrl) return;
        if (targetUrl.startsWith("/oportunidad/lista")) {
            localStorage.removeItem("previousUrl");
            localStorage.setItem("previousUrl", targetUrl);
        }
    };

    // Función para obtener los estilos según el estado de alerta
    const getAlertStyles = () => {
        if (!alertStatus) return {};
        
        switch (alertStatus) {
            case "ok":
                return {
                    borderLeft: "4px solid #28a745", // Verde
                    backgroundColor: "#f8fff9",
                };
            case "warning":
                return {
                    borderLeft: "4px solid #dc3545", // Rojo
                    backgroundColor: "#fff5f5",
                };
            case "alert":
                return {
                    borderLeft: "4px solid #c82333", // Rojo más intenso
                    backgroundColor: "#ffe6e6",
                    boxShadow: "0 0 10px rgba(220, 53, 69, 0.3)", // Sombra roja para destacar
                };
            default:
                return {};
        }
    };

    // Función para obtener el color del número según el estado de alerta
    const getQuantityColor = () => {
        if (!alertStatus) return "inherit";
        
        switch (alertStatus) {
            case "ok":
                return "#28a745"; // Verde
            case "warning":
                return "#dc3545"; // Rojo
            case "alert":
                return "#c82333"; // Rojo más intenso
            default:
                return "inherit";
        }
    };

    const alertStyles = getAlertStyles();
    const quantityColor = getQuantityColor();

    return (
        <div className="col-md-12 col-xxl-4">
            <div className="card statistics-card-1" style={alertStyles}>
                <div className="card-body">
                    <img src={image} alt="img" className="img-fluid img-bg" />
                    <div className="d-flex align-items-center">
                        <div className="avtar" style={{ backgroundColor: "#000000", color: "#FFFFFF", marginRight: "1rem" }}>
                            <i className={icons}></i>
                        </div>
                        <div>
                            <p className="text-muted mb-0">{nombre}</p>
                            <div className="d-flex align-items-end">
                                {hasOutlook ? (
                                    // Mostrar formato con números arriba y etiquetas abajo
                                    <div className="d-flex align-items-center gap-3">
                                        <a
                                            href={leftUrl || url}
                                            onClick={() => updatePreviousUrlIfOpportunity(leftUrl || url)}
                                            style={{ textDecoration: "none", color: "inherit" }}
                                        >
                                            <div className="text-center">
                                                <h2 className="mb-0 f-w-500" style={{ fontSize: "1.3rem", cursor: "pointer", color: leftColor || quantityColor }}>
                                                    {cantidad !== undefined && cantidad !== null ? cantidad : "..."}
                                                </h2>
                                                <p className="mb-0 text-muted" style={{ fontSize: "0.65rem", fontWeight: "500" }}>{leftLabel || "CRM"}</p>
                                            </div>
                                        </a>
                                        <span className="text-muted">/</span>
                                        <a
                                            href={rightUrl || "/calendar"}
                                            onClick={() => updatePreviousUrlIfOpportunity(rightUrl || "/calendar")}
                                            style={{ textDecoration: "none", color: "inherit" }}
                                        >
                                            <div className="text-center">
                                                <h2 className="mb-0 f-w-500" style={{ color: rightColor || "#6c757d", fontWeight: "600", fontSize: "1.3rem", cursor: "pointer" }}>
                                                    {outlookCount !== undefined && outlookCount !== null ? outlookCount : "..."}
                                                </h2>
                                                <p className="mb-0 text-muted" style={{ fontSize: "0.65rem", fontWeight: "500" }}>{rightLabel || "Outlook"}</p>
                                            </div>
                                        </a>
                                    </div>
                                ) : (
                                    // Mostrar cantidad normal para otros items con enlace general
                                    <a
                                        href={url}
                                        onClick={() => updatePreviousUrlIfOpportunity(url)}
                                        style={{ textDecoration: "none", color: "inherit" }}
                                    >
                                        {cantidad !== undefined && cantidad !== null ? (
                                            <h2 className="mb-0 f-w-500" style={{ cursor: "pointer", color: quantityColor }}>{cantidad}</h2>
                                        ) : (
                                            "..."
                                        )}
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
