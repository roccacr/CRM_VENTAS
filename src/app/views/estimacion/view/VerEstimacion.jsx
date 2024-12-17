import { useEffect, useState } from "react";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import { useDispatch } from "react-redux";
import { getSpecificLead } from "../../../../store/leads/thunksLeads";
import { extarerEstimacion } from "../../../../store/estimacion/thunkEstimacion";
import Swal from "sweetalert2";
import { cleanAndParseFloat } from "../../../../hook/useInputFormatter";



export const VerEstimacion = () => {
    // Estado para almacenar los detalles del lead.
    const [leadDetails, setLeadDetails] = useState({});
    // Estado para almacenar los datos de la estimación.
    const [datosEstimacion, setDatosEstimacion] = useState({});
    const [datosCrm, setDatosCrm] = useState({});
    
    // Hook para despachar acciones de Redux.
    const dispatch = useDispatch();

    /**
     * Obtiene el valor de un parámetro específico de la URL.
     * @param {string} param - Nombre del parámetro a extraer.
     * @returns {string|number|null} - Retorna el valor del parámetro (convertido a número si es posible) o null si no existe.
     */
    const getQueryParam = (param) => {
        const value = new URLSearchParams(window.location.search).get(param);
        return value && !isNaN(value) && !isNaN(parseFloat(value)) ? Number(value) : value;
    };

    /**
     * Solicita los detalles de un lead desde el backend.
     * @param {number} idLead - ID del lead a buscar.
     */
    const fetchLeadDetails = async (idLead) => {
        try {
            const leadData = await dispatch(getSpecificLead(idLead));
            setLeadDetails(leadData);
        } catch (error) {
            console.error("Error al obtener los detalles del lead:", error);
        }
    };

    /**
     * Solicita los detalles de una estimación desde el backend.
     * @param {number} idEstimacion - ID de la estimación a buscar.
     */
    const fetchEstimacionDetails = async (idEstimacion) => {
        try {
            const estimacionData = await dispatch(extarerEstimacion(idEstimacion));
          setDatosEstimacion(estimacionData.netsuite.Detalle);
          setDatosCrm(estimacionData.crm);
        } catch (error) {
            console.error("Error al obtener los detalles de la estimación:", error);
        }
    };

  
  const formatoMoneda = (valor) => {
      return new Intl.NumberFormat("en-US", {
          minimumFractionDigits: 2, // Asegura al menos 2 decimales.
          maximumFractionDigits: 5, // Limita a un máximo de 5 decimales.
      }).format(valor);
  };

  
const CalculoPvtaNeto = (custbody13, custbody132, custbody46, custbodyix_salesorder_cashback, custbody16) => {
    // Conversión de los parámetros a números, asegurando que sean válidos
    const precio_de_lista = cleanAndParseFloat(custbody13) || 0;
    const descuento_directo = cleanAndParseFloat(custbody132) || 0;
    const extrasPagadasPorelcliente = cleanAndParseFloat(custbody46) || 0;
    const cashback = cleanAndParseFloat(custbodyix_salesorder_cashback) || 0;
    const monto_de_cortecias = cleanAndParseFloat(custbody16) || 0;

    // Cálculo del monto total del precio de venta neto
    const monto_total_precio_venta_neto = precio_de_lista - descuento_directo + extrasPagadasPorelcliente - cashback - monto_de_cortecias;

    // Validación para retornar 0 o null si el resultado no es válido
    if (isNaN(monto_total_precio_venta_neto) || monto_total_precio_venta_neto === 0) {
        return null; // Retorna null si es vacío o inválido
    }

    // Formateo del resultado como moneda en colones costarricenses
    return formatoMoneda(monto_total_precio_venta_neto);
};


    


    // Efecto que se ejecuta al montar el componente.
    useEffect(() => {
        // Muestra un indicador de carga con SweetAlert.
        Swal.fire({
            title: "Cargando datos...",
            text: "Por favor espera.",
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => Swal.showLoading(),
        });

        // Obtiene los IDs de la URL para lead y estimación.
        const leadId = getQueryParam("data");
        const estimacionId = getQueryParam("data2");

        // Si el ID del lead es válido, solicita los datos correspondientes.
        if (leadId && leadId > 0) {
            Promise.all([fetchLeadDetails(leadId), fetchEstimacionDetails(estimacionId)]).finally(() => Swal.close()); // Cierra el indicador de carga cuando se completen las solicitudes.
        } else {
            Swal.close(); // Cierra el SweetAlert en caso de que no haya IDs válidos.
        }
    }, [dispatch]); // El efecto depende de 'dispatch'.

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
                                    <p className="mb-0">{datosEstimacion.cli || ""}</p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-archway"></i> UNIDAD EXPEDIENTE LIGADO VTA
                                    </p>
                                    <p className="mb-0">{datosEstimacion.Exp || ""}</p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-archway"></i> SUBSIDIARIA
                                    </p>
                                    <p className="mb-0">{datosEstimacion.Subsidaria || ""}</p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-certificate"></i> ESTADO
                                    </p>
                                    <p className="mb-0">{datosEstimacion.Estado || ""}</p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-chevron-circle-up"></i> OPORTUNIDAD
                                    </p>
                                    <p className="mb-0">{datosEstimacion.opportunity_name || ""}</p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-calendar-plus"></i> CIERRE DE PREVISTO
                                    </p>
                                    <p className="mb-0">{datosCrm.caduca || ""}</p>
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
                                    <p className="mb-0">{formatoMoneda(datosEstimacion.data.fields.custbody13 || "")}</p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-money-bill-wave"></i> MONTO DESCUENTO DIRECTO
                                    </p>
                                    <p className="mb-0">{formatoMoneda(datosEstimacion.data.fields.custbody132 || "")}</p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-money-bill-wave"></i> MONTO EXTRAS SOBRE EL PRECIO DE LISTA
                                    </p>
                                    <p className="mb-0">{formatoMoneda(datosEstimacion.data.fields.custbody46 || "")}</p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-list-ul"></i> DESCRIPCIÓN EXTRAS
                                    </p>
                                    <p className="mb-0">{datosEstimacion.data.fields.custbody47 || ""}</p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-money-bill-wave"></i> CASHBACK
                                    </p>
                                    <p className="mb-0">{formatoMoneda(datosEstimacion.data.fields.custbodyix_salesorder_cashback || "")}</p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-money-bill-wave"></i> MONTO RESERVA
                                    </p>
                                    <p className="mb-0">{formatoMoneda(datosEstimacion.data.fields.custbody52 || "")}</p>
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
                                    <p className="mb-0">{formatoMoneda(datosEstimacion.data.fields.custbody16 || "")}</p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-list-ul"></i> DESCRIPCIÓN DE LAS CORTESIAS
                                    </p>
                                    <p className="mb-0">{datosEstimacion.data.fields.custbody35 || ""}</p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-money-bill-wave"></i> PREC. DE VENTA MÍNIMO:
                                    </p>
                                    <p className="mb-0">{formatoMoneda(datosEstimacion.data.fields.custbody_precio_vta_min || "")}</p>
                                </div>
                                <div className="col-md-2">
                                    <p className="mb-1 text-muted">
                                        {" "}
                                        <i className="fas fa-money-bill-wave"></i> PEC. DE VENTA NETO:
                                    </p>
                                    <p className="mb-0">
                                        {formatoMoneda(
                                            CalculoPvtaNeto(
                                                datosEstimacion.data.fields.custbody13,
                                                datosEstimacion.data.fields.custbody132,
                                                datosEstimacion.data.fields.custbody46,
                                                datosEstimacion.data.fields.custbodyix_salesorder_cashback,
                                                datosEstimacion.data.fields.custbody16,
                                            ) || "",
                                        )}
                                    </p>
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
