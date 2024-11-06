export const InformacionBasicaOportunidad = () => {
    // Arreglo de datos para los campos y sus valores
    const oportunidadData = [
        { label: "Fecha de Creación", value: "08-21-2024, 3:14 PM" },
        { label: "Fecha de Modificación", value: "08-21-2024, 3:22 PM" },
        { label: "ID de la Oportunidad NetSuite", value: "OPORTUNIDAD # : RDR1035" },
        { label: "Cliente Relacionado", value: "PRUEBA CAPACITACIN" },
        { label: "Estado", value: "B- Firme" },
        { label: "Tipo de Pronóstico", value: "A- Muy Probable" },
        { label: "Probabilidad", value: "80.0%" },
        { label: "Cierre Previsto", value: "2026-08-04" },
        { label: "Subsidiaria", value: "Rocca Desarrollos Residenciales" },
        { label: "Motivo de Compra", value: "Inversión" },
        { label: "Método de Pago", value: "Contra Entrega" },
        { label: "Desde", value: "$291,175,000" },
        { label: "Hasta", value: "$306,500,000" },
        { label: "Total Previsto", value: "$291,175,000" },
        { label: "Detalle", value: "PRUEBA" },
        { label: "Motivo de Condición", value: "Firme 80.0%" },
    ];

    return (
        <>
            <div className="card">
                <div className="card-header">
                    <h5>Información de la Oportunidad</h5>
                </div>
                <div className="card-body">
                    <ul className="list-group list-group-flush">
                        {
                            // Recorremos los datos en bloques de tres
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
        </>
    );
};
