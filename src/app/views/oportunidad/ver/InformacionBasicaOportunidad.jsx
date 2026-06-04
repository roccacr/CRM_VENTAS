import { formatDate as formatCostaRicaDate } from "../../../../hook/useFormatDate";

const INACTIVATION_REASON_LABELS = {
    MANUAL: "Manual",
    SISTEMA_OTRO: "Sistema",
    LEAD_PERDIDO: "Lead perdido",
    LEAD_SEGUIMIENTO: "Lead en seguimiento",
    LEAD_PRE_RESERVA: "Lead en pre-reserva",
    LEAD_RESERVA: "Lead en reserva",
    MENOS_PROBABLE_3_MESES: "Menos probable por 3 meses",
};

/**
 * Renderiza el bloque principal con informacion detallada de la oportunidad.
 *
 * @param {Object} props - Propiedades del componente.
 * @param {Object} props.oportuinidadId - Detalle de la oportunidad consultada.
 * @param {string} props.cliente - Nombre del cliente relacionado.
 * @returns {JSX.Element} Tarjeta con informacion de la oportunidad.
 */
export const InformacionBasicaOportunidad = ({ oportuinidadId, cliente }) => {
    const formatDateTime = (dateString) => {
        if (!dateString) {
            return "Fecha no disponible";
        }

        const { formattedDate, formattedTime } = formatCostaRicaDate(dateString);

        return [formattedDate, formattedTime].filter(Boolean).join(" ") || "Fecha no disponible";
    };

    const formatDateOnly = (dateString) => {
        if (!dateString) {
            return "Fecha no disponible";
        }

        return formatCostaRicaDate(dateString).formattedDate || "Fecha no disponible";
    };

    const getInactivationReasonLabel = (reason) => (
        INACTIVATION_REASON_LABELS[reason] || "No disponible"
    );

    const fechaCreacion = formatDateTime(oportuinidadId?.fecha_creada_oport);
    const fechaModificacion = formatDateTime(oportuinidadId?.update_fecha_oport);
    const fechaCondicion = formatDateOnly(oportuinidadId?.fecha_Condicion);

    const oportunidadData = [
        { label: "ID de la Oportunidad NetSuite", value: oportuinidadId?.tranid_oport || "No disponible" },
        { label: "Cliente Relacionado", value: cliente },
        { label: "Estado", value: oportuinidadId?.nombre_estado_oportuindad || "No disponible" },
        { label: "Tipo de Pronóstico", value: oportuinidadId?.nombre_pronostico || "No disponible" },
        { label: "Probabilidad", value: oportuinidadId?.probability_oport || "No disponible" },
        { label: "Cierre Previsto", value: fechaCondicion },
        { label: "Subsidiaria", value: oportuinidadId?.subsidiaria_oport || "No disponible" },
        { label: "Motivo de Compra", value: oportuinidadId?.nombre_motivo_compra || "No disponible" },
        { label: "Método de Pago", value: oportuinidadId?.nombre_motivo_pago || "No disponible" },
        {
            label: "Desde",
            value: new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 })
                .format((oportuinidadId?.rangelow_oport || 0) / 100),
        },
        {
            label: "Hasta",
            value: new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 })
                .format((oportuinidadId?.rangehigh_oport || 0) / 100),
        },
        {
            label: "Total Previsto",
            value: new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 })
                .format((oportuinidadId?.projectedtotal_oport || 0) / 100),
        },
        { label: "Detalle", value: oportuinidadId?.memo_oport || "No disponible" },
        ...(oportuinidadId?.estatus_oport === 0
            ? [{
                label: "Motivo de Inactivación",
                value: getInactivationReasonLabel(oportuinidadId?.motivo_inactivacion_oport),
            }]
            : []),
        { label: "Motivo de Condición", value: oportuinidadId?.Motico_Condicion || "No disponible" },
        { label: "Fecha de Creación", value: fechaCreacion },
        { label: "Fecha de Modificación", value: fechaModificacion },
    ];

    return (
        <div className="card">
            <div className="card-header">
                <h5>Información de la Oportunidad</h5>
            </div>
            <div className="card-body">
                <ul className="list-group list-group-flush">
                    {oportunidadData.map(
                        (item, index) => item && index % 3 === 0 && (
                            <li className="list-group-item px-0" key={index}>
                                <div className="row">
                                    {[0, 1, 2].map((offset) => {
                                        const field = oportunidadData[index + offset];

                                        return field ? (
                                            <div className="col-md-4" key={offset}>
                                                <p className="mb-1 text-muted">{field.label}</p>
                                                <p className="mb-0">{field.value}</p>
                                            </div>
                                        ) : null;
                                    })}
                                </div>
                            </li>
                        ),
                    )}
                </ul>
            </div>
        </div>
    );
};
