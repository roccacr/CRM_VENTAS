import { NavLink } from "react-router-dom";

export const TableroHome = ({ image, icons, nombre, cantidad, url, outlookCount, hasOutlook }) => {
    return (
        <div className="col-md-12 col-xxl-4">
            <div className="card statistics-card-1">
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
                                        <a href={url} style={{ textDecoration: "none", color: "inherit" }}>
                                            <div className="text-center">
                                                <h4 className="mb-0 f-w-500" style={{ fontSize: "1.3rem", cursor: "pointer" }}>
                                                    {cantidad !== undefined && cantidad !== null ? cantidad : "..."}
                                                </h4>
                                                <p className="mb-0 text-muted" style={{ fontSize: "0.8rem" }}>CRM</p>
                                            </div>
                                        </a>
                                        <span className="text-muted">/</span>
                                        <a href="/calendar" style={{ textDecoration: "none", color: "inherit" }}>
                                            <div className="text-center">
                                                <h4 className="mb-0 f-w-500" style={{ color: "#6c757d", fontWeight: "600", fontSize: "1.3rem", cursor: "pointer" }}>
                                                    {outlookCount !== undefined && outlookCount !== null ? outlookCount : "..."}
                                                </h4>
                                                <p className="mb-0 text-muted" style={{ fontSize: "0.8rem" }}>Outlook</p>
                                            </div>
                                        </a>
                                    </div>
                                ) : (
                                    // Mostrar cantidad normal para otros items con enlace general
                                    <a href={url} style={{ textDecoration: "none", color: "inherit" }}>
                                        {cantidad !== undefined && cantidad !== null ? (
                                            <h2 className="mb-0 f-w-500" style={{ cursor: "pointer" }}>{cantidad}</h2>
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
