export const InformacionBasicaOportunidad = ({ oportuinidadId, cliente }) => {
    // Opciones de formato de fecha para mostrar año, mes, día y hora en formato de 12 horas
    const dateOptions = {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
    };

    // Formatea una fecha, validando si existe y reemplazando las barras por guiones
    const formatDate = (dateString, options = dateOptions) => (dateString ? new Date(dateString).toLocaleString("en-US", options).replace(/\//g, "-") : "Fecha no disponible");

    // Fechas formateadas para creación, modificación y condición de la oportunidad
    const fechaCreacion = formatDate(oportuinidadId?.fecha_creada_oport);
    const fechaModificacion = formatDate(oportuinidadId?.update_fecha_oport);
    const fechaCondicion = formatDate(oportuinidadId?.fecha_Condicion, { year: "numeric", month: "2-digit", day: "2-digit" });

    // Datos de la oportunidad en un arreglo de objetos para visualización
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
            value: new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format((oportuinidadId?.rangelow_oport || 0) / 100),
        },
        {
            label: "Hasta",
            value: new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format((oportuinidadId?.rangehigh_oport || 0) / 100),
        },
        {
            label: "Total Previsto",
            value: new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format((oportuinidadId?.projectedtotal_oport || 0) / 100),
        },
        { label: "Detalle", value: oportuinidadId?.memo_oport || "No disponible" },
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
                    {
                        // Itera en bloques de tres elementos para crear filas de datos
                        oportunidadData.map(
                            (item, index) =>
                                index % 3 === 0 && (
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
                        )
                    }
                </ul>
            </div>
        </div>
    );
};
