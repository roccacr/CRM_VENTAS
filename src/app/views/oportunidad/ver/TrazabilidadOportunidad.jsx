const REASON_LABELS = {
    MANUAL: "Manual",
    SISTEMA_OTRO: "Sistema",
    LEAD_PERDIDO: "Lead perdido",
    LEAD_SEGUIMIENTO: "Lead en seguimiento",
    LEAD_PRE_RESERVA: "Lead en pre-reserva",
    LEAD_RESERVA: "Lead en reserva",
    MENOS_PROBABLE_3_MESES: "Menos probable por 3 meses",
    REACTIVACION_MANUAL: "Reactivación manual",
    REACTIVACION_SISTEMA: "Reactivación sistema",
    REACTIVACION_CRON: "Reactivación cron",
};

const STATUS_LABELS = {
    0: "Inactiva",
    1: "Activa",
};

const formatDateTime = (value) => (
    value
        ? new Date(value).toLocaleString("es-CR", {
            timeZone: "America/Costa_Rica",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
        })
        : "No disponible"
);

const getReasonLabel = (reason) => REASON_LABELS[reason] || reason || "No disponible";

const getActorLabel = (name, type, id) => {
    if (name) {
        return name;
    }

    if (type === "CRON") {
        return "Cron";
    }

    if (type === "SISTEMA") {
        return "Sistema";
    }

    if (type === "BACKFILL") {
        return "Backfill";
    }

    if (id) {
        return `Usuario #${id}`;
    }

    return "No disponible";
};

/**
 * Renderiza snapshot e historial de trazabilidad de una oportunidad.
 *
 * @param {object} props - Propiedades del componente.
 * @param {object | null} props.traceability - Datos de trazabilidad cargados desde API.
 * @returns {JSX.Element | null} Tarjeta de trazabilidad.
 */
export const TrazabilidadOportunidad = ({ traceability }) => {
    if (!traceability?.traceabilityEnabled) {
        return null;
    }

    const current = traceability.current;
    const history = traceability.history || [];

    const currentData = current
        ? [
            {
                label: "Estado actual",
                value: STATUS_LABELS[current.estatus_oport] || "No disponible",
            },
            {
                label: "Fecha de inactivación",
                value: formatDateTime(current.fecha_inactivacion_oport),
            },
            {
                label: "Inactivada por",
                value: getActorLabel(
                    current.nombre_inactivo_admin,
                    current.tipo_actor_inactivacion_oport,
                    current.id_usuario_inactivo_oport,
                ),
            },
            {
                label: "Motivo de inactivación",
                value: getReasonLabel(current.motivo_inactivacion_oport),
            },
            {
                label: "Fuente de inactivación",
                value: current.fuente_inactivacion_oport || "No disponible",
            },
            {
                label: "Tiempo inactiva actual",
                value: current.tiempo_inactividad_actual_label || "No disponible",
            },
            {
                label: "Fecha de reactivación",
                value: formatDateTime(current.fecha_reactivacion_oport),
            },
            {
                label: "Reactivada por",
                value: getActorLabel(
                    current.nombre_reactivo_admin,
                    current.tipo_actor_reactivacion_oport,
                    current.id_usuario_reactivo_oport,
                ),
            },
            {
                label: "Última duración inactiva",
                value: current.duracion_ultima_inactividad_label || "No disponible",
            },
        ]
        : [];

    return (
        <>
            <div className="card">
                <div className="card-header">
                    <h5>Trazabilidad de Estado</h5>
                </div>
                <div className="card-body">
                    <ul className="list-group list-group-flush">
                        {currentData.map((item, index) => item && index % 3 === 0 && (
                            <li className="list-group-item px-0" key={index}>
                                <div className="row">
                                    {[0, 1, 2].map((offset) => {
                                        const field = currentData[index + offset];

                                        return field ? (
                                            <div className="col-md-4" key={offset}>
                                                <p className="mb-1 text-muted">{field.label}</p>
                                                <p className="mb-0">{field.value}</p>
                                            </div>
                                        ) : null;
                                    })}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            <div className="card">
                <div className="card-header">
                    <h5>Historial de Estado</h5>
                </div>
                <div className="card-body">
                    {history.length ? history.map((entry) => (
                        <div className="border-bottom pb-3 mb-3" key={entry.id_historial_oport}>
                            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                                <span className="badge bg-dark">
                                    {STATUS_LABELS[entry.estado_anterior_oport] || entry.estado_anterior_oport}
                                    {" -> "}
                                    {STATUS_LABELS[entry.estado_nuevo_oport] || entry.estado_nuevo_oport}
                                </span>
                                <span className="text-muted">{formatDateTime(entry.fecha_evento_oport)}</span>
                            </div>
                            <p className="mb-1">
                                <strong>Motivo:</strong> {getReasonLabel(entry.motivo_oport)}
                            </p>
                            <p className="mb-1">
                                <strong>Quién:</strong> {getActorLabel(entry.nombre_actor_admin, entry.tipo_actor_oport, entry.id_usuario_actor_oport)}
                            </p>
                            <p className="mb-1">
                                <strong>Fuente:</strong> {entry.fuente_oport || "No disponible"}
                            </p>
                            <p className="mb-1">
                                <strong>Detalle:</strong> {entry.detalle_oport || "No disponible"}
                            </p>
                            {entry.duracion_inactividad_label ? (
                                <p className="mb-0">
                                    <strong>Duración:</strong> {entry.duracion_inactividad_label}
                                </p>
                            ) : null}
                        </div>
                    )) : (
                        <p className="mb-0">No hay historial de estado para esta oportunidad.</p>
                    )}
                </div>
            </div>
        </>
    );
};
