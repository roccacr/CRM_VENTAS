import { useEffect, useState, useMemo } from "react";
import { getExpediente } from "../../../../store/expedientes/thunksExpedientes";
import { useDispatch } from "react-redux";
import CircularProgress from "@mui/material/CircularProgress";

export const InformacionBasicaExpedienteUnidad = ({ idExpediente }) => {
    const dispatch = useDispatch();
    const [expedienteDetails, setExpedienteDetails] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchExpedienteDetails = async (idExpediente) => {
        try {
            setIsLoading(true);
            const expedienteData = await dispatch(getExpediente(idExpediente));
            setExpedienteDetails(expedienteData);
        } catch (error) {
            console.error("Error al obtener los detalles del expediente:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (idExpediente) {
            fetchExpedienteDetails(idExpediente);
        }
    }, [idExpediente]);

    const displayedData = useMemo(() => {
        return [
            { label: "Código Expediente", value: expedienteDetails?.codigo_exp || "--" },
            { label: "Proyecto Principal", value: expedienteDetails?.proyectoPrincipal_exp || "--" },
            { label: "Tipo de Vivienda", value: expedienteDetails?.tipoDeVivienda_exp || "--" },
            { label: "Precio Venta Único", value: expedienteDetails?.precioVentaUncio_exp || "--" },
            { label: "Estado", value: expedienteDetails?.estado_exp || "--" },
            { label: "Entrega Estimada", value: expedienteDetails?.entregaEstimada || "--" },
            { label: "Área Total M²", value: expedienteDetails?.areaTotalM2_exp || "--" },
            { label: "M² Habitables", value: expedienteDetails?.m2Habitables_exp || "--" },
            { label: "Lote M²", value: expedienteDetails?.loteM2_exp || "--" },
            { label: "Área de Parqueo Aprox.", value: expedienteDetails?.areaDeParqueoAprox || "--" },
            { label: "Área de Bodega M²", value: expedienteDetails?.areaDeBodegaM2_exp || "--" },
            { label: "Área de Mezzanine M²", value: expedienteDetails?.areaDeMezzanieM2_exp || "--" },
            { label: "Área Común Libre", value: expedienteDetails?.areacomunLibe_exp || "--" },
            { label: "Precio de Venta Mínimo", value: expedienteDetails?.precioDeVentaMinimo || "--" },
            {
                label: "Planos de Unidad",
                value: expedienteDetails?.planosDeUnidad_exp ? (
                    <a href={expedienteDetails.planosDeUnidad_exp} target="_blank" rel="noopener noreferrer">
                        Ver Planos
                    </a>
                ) : (
                    "--"
                ),
            },
            { label: "Cuota Mantenimiento Aproximada", value: expedienteDetails?.cuotaMantenimientoAprox_exp || "--" },
            { label: "Área de Balcón M²", value: expedienteDetails?.areaDeBalconM2_exp || "--" },
            { label: "Fecha de Modificación", value: expedienteDetails?.fecha_mod || "--" },
        ];
    }, [expedienteDetails]);

    return (
        <div className="card">
            <div className="card-header">
                <h5>Información del Expediente</h5>
            </div>
            <div className="card-body">
                {isLoading ? (
                    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "100px" }}>
                        <CircularProgress />
                    </div>
                ) : (
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
                )}
            </div>
        </div>
    );
};
