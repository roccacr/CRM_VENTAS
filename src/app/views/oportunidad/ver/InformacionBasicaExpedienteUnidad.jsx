import { useEffect, useState } from "react";
import { getExpediente } from "../../../../store/expedientes/thunksExpedientes";
import { useDispatch } from "react-redux";

export const InformacionBasicaExpedienteUnidad = ({ idExpediente }) => {
    const dispatch = useDispatch();
    const [expedienteDetails, setExpedienteDetails] = useState(null);

    // Datos de expediente por defecto
    const defaultExpedienteData = [
        { label: "Código Expediente", value: "AVIVA-L Edif #1 FF001" },
        { label: "Proyecto Principal", value: "AVIVA" },
        { label: "Tipo de Vivienda", value: "A" },
        { label: "Precio Venta Único", value: "166,000.00" },
        { label: "Estado", value: "3. Reservado" },
        { label: "Entrega Estimada", value: "1/1/2025" },
        { label: "Área Total M²", value: "66.00" },
        { label: "M² Habitables", value: "51.5" },
        { label: "Lote M²", value: "N" },
        { label: "Área de Parqueo Aprox.", value: "14.5" },
        { label: "Área de Bodega M²", value: "0.0" },
        { label: "Área de Mezzanine M²", value: "N" },
        { label: "Área Común Libre", value: "1.0" },
        { label: "Precio de Venta Mínimo", value: "157,700.00" },
        { label: "Planos de Unidad", value: "Ver Planos" },
        { label: "Cuota Mantenimiento Aproximada", value: "$2 /m2" },
        { label: "Área de Balcón M²", value: "N" },
        { label: "Área de Planta Baja", value: "N" },
        { label: "Área de Planta Alta", value: "N" },
        { label: "Área de Ampliación", value: "N" },
        { label: "Área de Terraza", value: "N" },
        { label: "Precio por M²", value: "2,515.00" },
        { label: "Tercer Nivel Sótano", value: "N" },
        { label: "Área Externa Jardín", value: "N" },
        { label: "Jardín con Talud", value: "N" },
        { label: "Fecha de Modificación", value: "2024-10-23T12:00:00.000Z" },
    ];

    // Función asíncrona para obtener los detalles de un expediente específico.
    const fetchExpedienteDetails = async (idExpediente) => {
        try {
            const expedienteData = await dispatch(getExpediente(idExpediente));

            setExpedienteDetails(expedienteData);
        } catch (error) {
            console.error("Error al obtener los detalles del expediente:", error);
        }
    };

    // Cargar detalles del expediente al montar el componente o cuando idExpediente cambie
    useEffect(() => {
        if (idExpediente) {
            fetchExpedienteDetails(idExpediente);
        }
    }, [idExpediente]);

    // Verificación para asegurar que displayedData sea siempre un array
    const displayedData = Array.isArray(expedienteDetails) ? expedienteDetails : defaultExpedienteData;

    return (
        <div className="card">
            <div className="card-header">
                <h5>Información del Expediente</h5>
            </div>
            <div className="card-body">
                <ul className="list-group list-group-flush">
                    {displayedData.map((item, index) =>
                        index % 3 === 0 ? (
                            <li className="list-group-item px-0" key={index}>
                                <div className="row">
                                    {[0, 1, 2].map((offset) => {
                                        const field = displayedData[index + offset];
                                        return field ? (
                                            <div className="col-md-4" key={offset}>
                                                <p className="mb-1 text-muted">{field.label}</p>
                                                <p className="mb-0">{field.value}</p>
                                            </div>
                                        ) : null;
                                    })}
                                </div>
                            </li>
                        ) : null,
                    )}
                </ul>
            </div>
        </div>
    );
};
