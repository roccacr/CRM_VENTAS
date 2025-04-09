export const InfromacionCompleta = ({ leadDetails }) => {


    const informacionBasica = [
        { label: "Nombre Completo", value: leadDetails.nombre_lead },
        { label: "Proyecto", value: leadDetails.proyecto_lead },
        { label: "Campaña", value: leadDetails.campana_lead },
        { label: "Correo", value: leadDetails.email_lead },
        { label: "Teléfono", value: leadDetails.telefono_lead },
        { label: "Subsidiaria", value: leadDetails.subsidiaria_lead },
        { label: "Seguimiento", value: leadDetails.segimineto_lead },
    ];

    const informacionExtra = [
        { label: "Cédula", value: leadDetails.cedula_lead },
        { label: "Nacionalidad", value: leadDetails.Nacionalidad_lead },
        { label: "Estado Civil", value: leadDetails.Estado_ciLead },
        { label: "Edad", value: leadDetails.Edad_lead },
        { label: "Profesión", value: leadDetails.Profesion_lead },
        { label: "Hijos", value: leadDetails.Hijos_lead },
        { label: "Teléfono Alternativo", value: leadDetails.TelefonoAlternatovo_lead },
        { label: "Dirección", value: leadDetails.Direccion },
        { label: "Corredor", value: leadDetails.nombre_corredor  },
        { label: "Nombre Extra", value: leadDetails.nombre_extra_lead },
        { label: "Cédula Extra", value: leadDetails.cedula_extra_lead },
        { label: "Profesión Extra", value: leadDetails.profesion_extra_lead },
        { label: "Estado Civil Extra", value: leadDetails.estado_civil_extra_lead },
        { label: "Teléfono Extra", value: leadDetails.telefono_extra_lead },
        { label: "Nacionalidad Extra", value: leadDetails.nacionalidad_extra_lead },
        { label: "Email Extra", value: leadDetails.email_extra_lead },
        { label: "Ingresos Extra", value: leadDetails.info_extra_ingresos },
        { label: "Motivo de Compra", value: leadDetails.info_extra_MotivoCompra },
        { label: "Momento de Compra", value: leadDetails.info_extra_MomentodeCompra },
        { label: "Lugar de Trabajo", value: leadDetails.info_extra_Trabajo },
        { label: "Origen de Fondo", value: leadDetails.info_extra_OrigenFondo },
        { label: "Zona de Residencia", value: leadDetails.info_extra_ZonaRecidencia },
    ];


    const renderInfoRows = (infoArray) =>
        infoArray.reduce((result, item, index) => {
            if (index % 2 === 0) {
                result.push(
                    <li className="list-group-item px-0" key={index}>
                        <div className="row">
                            <div className="col-md-6">
                                <p className="mb-1 text-muted">{infoArray[index].label}</p>
                                <p className="mb-0">{infoArray[index].value || "N/A"}</p>
                            </div>
                            {infoArray[index + 1] && (
                                <div className="col-md-6">
                                    <p className="mb-1 text-muted">{infoArray[index + 1].label}</p>
                                    <p className="mb-0">{infoArray[index + 1].value || "N/A"}</p>
                                </div>
                            )}
                        </div>
                    </li>,
                );
            }
            return result;
        }, []);

    return (
        <>
            <div className="card">
                <div className="card-header">
                    <h5>Información Completa</h5>
                </div>
                <div className="card-body">
                    <p className="mb-0">Desglose de información relacionada al cliente</p>
                </div>
            </div>
            <div className="card">
                <div className="card-header">
                    <h5>Resumen de Información</h5>
                </div>
                <div className="card-body">
                    <ul className="list-group list-group-flush">{renderInfoRows(informacionBasica)}</ul>
                    <hr />
                    <h5>Información Extra</h5>
                    <ul className="list-group list-group-flush">{renderInfoRows(informacionExtra)}</ul>
                </div>
            </div>
        </>
    );
};
