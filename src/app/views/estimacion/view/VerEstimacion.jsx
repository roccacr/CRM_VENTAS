import { useEffect, useState } from "react";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import { useDispatch } from "react-redux";
import { getSpecificLead } from "../../../../store/leads/thunksLeads";

export const VerEstimacion = () => {
    const [leadDetails, setLeadDetails] = useState({});
    const dispatch = useDispatch(); // Función para despachar acciones de Redux.

    // Función para obtener el valor de un parámetro específico de la URL.
    const getQueryParam = (param) => {
        // Crea una instancia de 'URLSearchParams' con los parámetros de la URL.
        const value = new URLSearchParams(location.search).get(param);

        // Verifica si el valor es numérico; si lo es, lo convierte a número.
        if (value && !isNaN(value) && !isNaN(parseFloat(value))) {
            return Number(value); // Retorna el valor como número si es posible.
        }
        return value; // Si no es numérico, retorna el valor original como cadena de texto.
    };

    const fetchLeadDetails = async (idLead) => {
        try {
            // Llama a la acción 'getSpecificLead' pasando el 'idLead' y espera su resultado.
            const leadData = await dispatch(getSpecificLead(idLead));

            // Almacena los detalles obtenidos en el estado 'leadDetails' para su uso en la vista.
            setLeadDetails(leadData);
        } catch (error) {
            // Manejo de errores en caso de que la solicitud falle.
            console.error("Error al obtener los detalles del lead:", error);
        }
    };

    useEffect(() => {
        // Obtiene los parámetros 'data' (para lead) y 'data2' (para oportunidad) desde la URL.
        const leadId = getQueryParam("data"); // Extrae el ID del lead desde la URL.
        if (leadId && leadId > 0) {
            fetchLeadDetails(leadId); // Solicita los detalles del lead.
        }
    }, []); // El efecto se ejecuta al montar el componente.

    return (
        <>
            <div className="col-xl-12 col-sm-12">
                <div className="card">
                    <div className="card-body">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <blockquote className="blockquote blockquote-reverse font-size-16 mb-0">
                                {Object.keys(leadDetails).length > 0 && <ButtonActions leadData={leadDetails} className="mb-4" />}
                            </blockquote>
                        </div>
                        <div className="row">
                            <div className="col-3">
                                <div className="d-grid">
                                    <button className="btn btn-dark">
                                        {" "}
                                        <i className="ti ti-pencil"></i> Editar estimacion
                                    </button>
                                </div>
                            </div>
                            <div className="col-3">
                                <div className="d-grid">
                                    <button className="btn btn-dark">
                                        {" "}
                                        <i className="ti ti-color-swatch"></i> ORDEN DE VENTA
                                    </button>
                                </div>
                            </div>
                            <div className="col-3">
                                <div className="d-grid">
                                    <button className="btn btn-dark">
                                        {" "}
                                        <i className="ti ti-ad-2"></i> PDF ESTIMACION
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="card">
                <div className="card-header">
                    <h5>Resumen de Información</h5>
                </div>
                <div className="alert alert-success" role="alert">
                    <h5 className="text-truncate font-size-15">
                        ID ESTIMACION:<p className="text-muted mb-0" id="train_id"></p>
                    </h5>
                </div>
                <div className="card-body">
                    <ul className="list-group list-group-flush">
                        <li className="list-group-item px-0">
                            <div className="row">
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        <i className="fas fa-user"></i> CLIENTE:
                                    </p>
                                    <p className="mb-0"></p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-archway"></i> UNIDAD EXPEDIENTE LIGADO VTA
                                    </p>
                                    <p className="mb-0"></p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-archway"></i> SUBSIDIARIA
                                    </p>
                                    <p className="mb-0"></p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-certificate"></i> ESTADO
                                    </p>
                                    <p className="mb-0"></p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-chevron-circle-up"></i> OPORTUNIDAD
                                    </p>
                                    <p className="mb-0"></p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-calendar-plus"></i> CIERRE DE PREVISTO
                                    </p>
                                    <p className="mb-0"></p>
                                </div>
                            </div>
                        </li>
                    </ul>
                    <ul className="list-group list-group-flush">
                        <li className="list-group-item px-0">
                            <div className="row">
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        <i className="fas fa-money-bill-wave"></i> PRECIO DE LISTA:
                                    </p>
                                    <p className="mb-0"></p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-money-bill-wave"></i> MONTO DESCUENTO DIRECTO
                                    </p>
                                    <p className="mb-0"></p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-money-bill-wave"></i> MONTO EXTRAS SOBRE EL PRECIO DE LISTA
                                    </p>
                                    <p className="mb-0"></p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-list-ul"></i> DESCRIPCIÓN EXTRAS
                                    </p>
                                    <p className="mb-0"></p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-money-bill-wave"></i> CASHBACK
                                    </p>
                                    <p className="mb-0"></p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-money-bill-wave"></i> MONTO RESERVA
                                    </p>
                                    <p className="mb-0"></p>
                                </div>
                            </div>
                        </li>
                    </ul>
                    <ul className="list-group list-group-flush">
                        <li className="list-group-item px-0">
                            <div className="row">
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        <i className="fas fa-money-bill-wave"></i> MONTO TOTAL DE CORTESÍAS
                                    </p>
                                    <p className="mb-0"></p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-list-ul"></i> DESCRIPCIÓN DE LAS CORTESIAS
                                    </p>
                                    <p className="mb-0"></p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-money-bill-wave"></i> PREC. DE VENTA MÍNIMO:
                                    </p>
                                    <p className="mb-0"></p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-money-bill-wave"></i> PEC. DE VENTA NETO:
                                    </p>
                                    <p className="mb-0"></p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-money-bill-wave"></i> EXTRAS SOBRE EL PRECIO DE LISTA
                                    </p>
                                    <p className="mb-0"></p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-money-bill-wave"></i> MONTO TOTAL
                                    </p>
                                    <p className="mb-0"></p>
                                </div>
                            </div>
                        </li>
                    </ul>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h5>Resumen de Información</h5>
                </div>
                <div className="alert alert-dark" role="alert">
                    <h5 className="text-truncate font-size-15">CONDICIONES DE LA PRIMA</h5>
                </div>
                <div className="card-body">
                    <ul className="list-group list-group-flush">
                        <li className="list-group-item px-0">
                            <div className="row">
                                <div className="col-md-3">
                                    <p className="mb-1 text-muted">
                                        <i className="fas fa-money-bill-alt"></i> PRIMA TOTAL
                                    </p>
                                    <p className="mb-0"></p>
                                </div>
                                <div className="col-md-3">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-money-bill-alt"></i> PRIMA%
                                    </p>
                                    <p className="mb-0"></p>
                                </div>
                                <div className="col-md-3">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-money-bill-alt"></i> MONTO PRIMA NETA
                                    </p>
                                    <p className="mb-0"></p>
                                </div>
                                <div className="col-md-3">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-money-bill-alt"></i> MONTO ASIGNABLE PRIMA NETA:
                                    </p>
                                    <p className="mb-0"></p>
                                </div>
                            </div>
                        </li>
                    </ul>
                </div>
            </div>
            <div className="card">
                <div className="card-header">
                    <h5>Resumen de Información</h5>
                </div>
                <div className="alert alert-danger" role="alert">
                    <h5 className="text-truncate font-size-15">CONDICIONES DE LA PRIMA</h5>
                </div>
                <div className="card-body">
                    <table
                        className="table table-striped table dt-responsive w-100 display text-left"
                        style={{ fontSize: "15px", width: "100%", textAlign: "left" }}
                    >
                        <thead>
                            <tr>
                                <th style={{ border: "1px solid #ddd", padding: "8px" }}>#</th>
                                <th style={{ border: "1px solid #ddd", padding: "8px" }}>ARTÍCULO</th>
                                <th style={{ border: "1px solid #ddd", padding: "8px" }}>MONTO</th>
                                <th style={{ border: "1px solid #ddd", padding: "8px" }}>FECHA DE PAGO PROYECTADO </th>
                                <th style={{ border: "1px solid #ddd", padding: "8px" }}>CANTIDAD</th>
                                <th style={{ border: "1px solid #ddd", padding: "8px" }}>DESCRIPCIÓN</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        </>
    );
};
