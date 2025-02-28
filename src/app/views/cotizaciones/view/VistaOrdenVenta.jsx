import { useEffect, useState } from "react";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import Swal from "sweetalert2";
import { useDispatch } from "react-redux";
import { getSpecificLead } from "../../../../store/leads/thunksLeads";
import { obtenerOrdendeventa } from "../../../../store/ordenVenta/thunkOrdenVenta";

/**
 * Renders a button with an icon and text for actions in the sales order view.
 * @param {Object} props - Component properties.
 * @param {string} props.icon - Icon class to display.
 * @param {string} props.text - Button text.
 * @param {Function} props.onClick - Function to execute on click.
 */
const ActionButton = ({ icon, text, onClick }) => (
    <div className="col-3">
        <div className="d-grid">
            <button className="btn btn-dark" onClick={onClick}>
                <i className={`ti ${icon}`}></i> {text}
            </button>
        </div>
    </div>
);

/**
 * Renders a panel of action buttons.
 * @param {Object} props - Component properties.
 * @param {Object} props.actions - Object containing action functions.
 * @param {Array} buttonConfigs - Array of button configurations.
 */
const ActionPanel = ({ actions, buttonConfigs }) => (
    <div className="row">
        {buttonConfigs.map(({ icon, text, action }, index) => (
            <ActionButton
                key={index}
                icon={icon}
                text={text}
                onClick={() => actions[action](true)}
            />
        ))}
    </div>
);

/**
 * Renders a card with a list of approval states.
 * @param {string} title - Title of the card.
 * @param {Array} labels - Array of labels for the approval states.
 */
const ApprovalCard = ({ title, approvals }) => (
    <div className="card">
        <div className="card-header">
            <h5>{title}</h5>
        </div>
        <div className="card-body">
            {approvals.map(({ label, checked }, index) => (
                <ApprovalCheckboxItem key={index} label={label} checked={checked} />
            ))}
        </div>
    </div>
);

/**
 * Renders a single approval checkbox item with a divider.
 * @param {Object} props - Component properties
 * @param {string} props.label - Checkbox label text
 * @returns {JSX.Element} A checkbox with label and horizontal line
 */
const ApprovalCheckboxItem = ({ label, checked }) => (
    <div>
        <div className="form-check">
            <input
                type="checkbox"
                id={label.toLowerCase().replace(/\s+/g, "")}
                className="form-check-input"
                disabled
                checked={checked}
            />
            <p>{label}</p>
        </div>
        <hr />
    </div>
);

/**
 * Renders an information field with icon and value.
 * @param {Object} props - Component properties
 * @param {string} props.icon - Icon class name
 * @param {string} props.label - Field label
 * @param {string|number} props.value - Field value
 * @returns {JSX.Element} A formatted information field
 */
const InfoField = ({ icon, label, value }) => (
    <div className="col-sm-4 col-6">
        <div className="mt-4">
            <h6 className="font-size-14">
                <i className={`ti ${icon}`}></i> {label}
            </h6>
            <p className="text-muted mb-0">{value}</p>
        </div>
    </div>
);

/**
 * Displays a loading indicator using SweetAlert2.
 * @returns {void}
 */
const showLoadingIndicator = () => {
    Swal.fire({
        title: "Cargando datos...",
        text: "Por favor espera.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
    });
};

/**
 * Formats a number as currency with specified decimal places.
 * @param {number} valor - The number to format
 * @returns {string} Formatted currency string
 */
const formatoMoneda = (valor) => {
    return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 5,
    }).format(valor);
};

/**
 * Extracts and parses URL query parameters.
 * @param {string} param - Parameter name to extract
 * @returns {string|number|null} Parsed parameter value
 */
const getQueryParam = (param) => {
    const value = new URLSearchParams(window.location.search).get(param);
    return value && !isNaN(value) && !isNaN(parseFloat(value)) ? Number(value) : value;
};

/**
 * Renders the primary information section of the sales order.
 * @param {Object} datosOrdenVenta - Sales order data
 * @returns {JSX.Element} Primary information section
 */
const PrimaryInformation = ({ datosOrdenVenta }) => (
    <div className="row">
        <div className="alert alert-dark" role="alert">INFORMACIÓN PRIMARIA</div>
        <InfoField
            icon="ti-file-invoice"
            label="N.º DE PEDIDO"
            value={datosOrdenVenta?.data?.fields?.tranid || ""}
        />
        <InfoField
            icon="ti-calendar-time"
            label="FECHA"
            value={datosOrdenVenta?.data?.fields?.trandate || ""}
        />
        <InfoField
            icon="ti-blockquote"
            label="NOTA"
            value={datosOrdenVenta?.data?.fields?.memo || ""}
        />
    </div>
);

/**
 * Renders the sales information section.
 * @param {Object} datosOrdenVenta - Sales order data
 * @returns {JSX.Element} Sales information section
 */
const SalesInformation = ({ datosOrdenVenta }) => {
    const fields = [
        { label: "UNIDAD EXPEDIENTE LIGADO", value: datosOrdenVenta?.Expediente?.replace(/"/g, '') },
        { label: "PRECIO DE VENTA", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody_ix_total_amount) },
        { label: "ENTREGA ESTIMADA", value: datosOrdenVenta?.data?.fields?.custbody114 },
        { label: "MÉTODO DE PAGO", value: datosOrdenVenta?.METODO_PAGO?.replace(/"/g, '') },
        { label: "FONDOS DE COMPRA", value: datosOrdenVenta?.FONDOS?.replace(/"/g, '') },
        { label: "FECHA DE VIGENCIA DE LA VENTA", value: datosOrdenVenta?.data?.fields?.saleseffectivedate },
        { label: "CAMPAÑA DE MARKETING", value: datosOrdenVenta?.CAMPANA?.replace(/"/g, '') },
        { label: "REPRESENTANTE DE VENTAS", value: datosOrdenVenta?.vendedor?.replace(/"/g, '') },
        { label: "SOCIO", value: datosOrdenVenta?.socio?.replace(/"/g, '') },
        { label: "MOTI. DE CANCEL. DE RESER. O VENTA CAÍDA", value: datosOrdenVenta?.MOTIVO_CANCE?.replace(/"/g, '') },
        { label: "COMENTAR. CANCEL. DE RESERVA", value: datosOrdenVenta?.data?.fields?.custbody116 },

    ];

    return (
        <div className="row">
            <div className="alert alert-dark" role="alert">INFORMACIÓN DE VENTA</div>
            {fields.map(({ label, value }, index) => (
                <InfoField key={index} icon="ti-file-invoice" label={label} value={value ?? ''} />
            ))}
        </div>
    );
};


/**
 * Renders the sales information section.
 * @param {Object} datosOrdenVenta - Sales order data
 * @returns {JSX.Element} AUTORIZACION DE VENTA
 */
const AutorizacionVenta = ({ datosOrdenVenta }) => {
    const fields = [
        { label: "PRECIO DE LISTA", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody13) },
        { label: "MONTO DESCUENTO DIRECTO", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody132) },
        { label: "MONTO EXTRAS SOBRE EL PRECIO DE LISTA", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody46) },
        { label: "DESCRIPCIÓN DE EXTRAS SOBRE EL PRECIO DE LISTA", value: datosOrdenVenta?.data?.fields?.custbody47 },
        { label: "MONTO TOTAL DE CORTESÍAS", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody16) },
        { label: "DESCRIPCIÓN DE CORTESÍAS", value: datosOrdenVenta?.data?.fields?.custbody35 },
        { label: "PRIMA TOTAL", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody39) },
        { label: "MONTO RESERVA", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody52) },
        { label: "CASHBACK", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbodyix_salesorder_cashback) },
        { label: "% COMISIÓN DEL CORREDOR", value: datosOrdenVenta?.data?.fields?.custbody14 },
        { label: "PRECIO DE VENTA NETO", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody17) },
        { label: "PRECIO DE VENTA MÍNIMO", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody18) },
        { label: "COMISIÓN DEL ASESOR %", value: datosOrdenVenta?.data?.fields?.custbody20 },
        { label: "MONTO DE COMISIÓN DEL ASESOR", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody21) },
        { label: "PRECIO CÁLCULO COMISIÓN CORREDOR", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody22) },
        { label: "MONTO DE COMISIÓN SEGUNDO ASESOR", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody71) },
        { label: "MONTO DE COMISIÓN DE CORREDOR", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody15) },
        { label: "DIFERENCIA ENTRE EL PVN Y EL PVM", value: datosOrdenVenta?.data?.fields?.custbody19 },
    ];

    return (
        <div className="row">
            <div className="alert alert-dark" role="alert">AUTORIZACIÓN DE VENTA</div>
            {fields.map(({ label, value }, index) => (
                <InfoField key={index} icon="ti-file-invoice" label={label} value={value} />
            ))}
        </div>
    );
};

/**
 * Renders the sales information section.
 * @param {Object} datosOrdenVenta - Sales order data
 * @returns {JSX.Element} Sales information section
 */
const Reserva = ({ datosOrdenVenta }) => {
    const fields = [
        { label: "MEDIO DE PAGO", value: datosOrdenVenta?.METODO_PAGO?.replace(/"/g, '') },
        { label: "NÚMERO DE TRANSACCIÓN", value: datosOrdenVenta?.data?.fields?.custbody189 },
        { label: "MONTO RESERVA APLICADA", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody207) },
        { label: "FECHA DE RESERVA APLICADA", value: datosOrdenVenta?.data?.fields?.custbody208 },
        { label: "MONTO PRE-RESERVA", value: datosOrdenVenta?.data?.fields?.custbody191 },
        { label: "FECHA DE PRE-RESERVA", value: datosOrdenVenta?.data?.fields?.custbody206 },
        { label: "OBSERVACIONES CONFIRMA RESERVA", value: datosOrdenVenta?.data?.fields?.custbody190 },
    ];

    return (
        <div className="row">
            <div className="alert alert-dark" role="alert">INFORMACIÓN DE RESERVA</div>
            {fields.map(({ label, value }, index) => (
                <InfoField key={index} icon="ti-file-invoice" label={label} value={value} />
            ))}
        </div>
    );
};



/**
 * Main component for displaying sales order information.
 * Manages data fetching, state, and renders all sub-components.
 * @returns {JSX.Element} Complete sales order view
 */
/**
 * Fetches lead details from the backend.
 * @param {number} idLead - ID of the lead to fetch.
 * @param {Function} dispatch - Redux dispatch function.
 * @param {Function} setLeadDetails - Function to set lead details state.
 * @returns {Promise<Object>} The fetched lead data
 */
const fetchLeadDetails = async (idLead, dispatch, setLeadDetails) => {
    try {
        const leadData = await dispatch(getSpecificLead(idLead));
        setLeadDetails(leadData);
        return leadData;
    } catch (error) {
        console.error("Error fetching lead details:", error);
        throw error;
    }
};

/**
 * Fetches transaction details from the backend.
 * @param {number} transaccion - ID of the transaction to fetch.
 * @param {Function} dispatch - Redux dispatch function.
 * @param {Function} setDatosOrdenVenta - Function to set order details state.
 * @returns {Promise<void>}
 */
const fetchTransaccionDetails = async (transaccion, dispatch, setDatosOrdenVenta) => {
    try {
        const resultado = await dispatch(obtenerOrdendeventa(transaccion));
        if (resultado?.data?.Detalle) {
            setDatosOrdenVenta(resultado.data.Detalle);
        }
    } catch (error) {
        console.error("Error fetching transaction details:", error);
        throw error;
    }
};

export const VistaOrdenVenta = () => {
    const dispatch = useDispatch();
    const [leadDetails, setLeadDetails] = useState({});
    const [datosOrdenVenta, setDatosOrdenVenta] = useState({});
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Action configurations
    const actionConfigs = {
        primary: [
            { icon: "ti-pencil", text: "EDITAR OV", action: "editarOV" },
            { icon: "ti-eye", text: "VER ESTIMACIÓN", action: "verEstimacion" },
            { icon: "ti-eye", text: "VER OPORTUNIDAD", action: "verOportunidad" },
            { icon: "ti-eye", text: "PDF OV", action: "verPdf" },
        ],
        secondary: [
            { icon: "ti-flag-3", text: "ENVIAR RESERVA", action: "EnviarReserva" },
            { icon: "ti-send", text: "CIERRE FIRMADO", action: "EnviarCierre" },
            { icon: "ti-trending-down", text: "RESERVA CAÍDA", action: "EnviarReservaCaida" },
        ]
    };

    // Action handlers
    const actions = {
        EnviarReserva: () => { },
        EnviarCierre: () => { },
        EnviarReservaCaida: () => { },
        verPdf: () => { },
        verOportunidad: () => { },
        verEstimacion: () => { },
        editarOV: () => { },
    };

    useEffect(() => {
        const fetchData = async () => {
            showLoadingIndicator();
            const leadId = getQueryParam("data");
            const transaccion = getQueryParam("data2");

            if (leadId && leadId > 0) {
                try {
                    await Promise.all([
                        fetchLeadDetails(leadId, dispatch, setLeadDetails),
                        fetchTransaccionDetails(transaccion, dispatch, setDatosOrdenVenta)
                    ]);
                } catch (error) {
                    console.error("Error fetching data:", error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Error al cargar los datos. Por favor, intente nuevamente.',
                    });
                } finally {
                    Swal.close();
                }
            } else {
                Swal.close();
            }
        };

        fetchData();
    }, [dispatch]);

    return (
        <>
            {/* Action Buttons Section */}
            <div className="col-xl-12 col-sm-12">
                <div className="card">
                    <div className="card-body">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                            <blockquote className="blockquote blockquote-reverse font-size-16 mb-0">
                                {Object.keys(leadDetails).length > 0 &&
                                    <ButtonActions leadData={leadDetails} className="mb-4" />
                                }
                            </blockquote>
                        </div>
                        <ActionPanel actions={actions} buttonConfigs={actionConfigs.primary} />
                        <br />
                        <ActionPanel actions={actions} buttonConfigs={actionConfigs.secondary} />
                    </div>
                </div>
            </div>

            {/* Main Content Section */}
            <div className="row">
                {/* Left Column - Order Information */}
                <div className="col-xl-9">
                    <div className="card">
                        <div className="card-header">
                            <h5>Resumen de Información</h5>
                        </div>
                        <div className="card-header">
                            <h5>Cliente Relacioando: {datosOrdenVenta?.cli?.replace(/"/g, '') ?? ''}</h5>
                        </div>
                        <div className="card-body">
                            <PrimaryInformation datosOrdenVenta={datosOrdenVenta} />
                            <br />
                            <SalesInformation datosOrdenVenta={datosOrdenVenta} />
                            <br />
                            <AutorizacionVenta datosOrdenVenta={datosOrdenVenta} />
                            <br />
                            <Reserva datosOrdenVenta={datosOrdenVenta} />
                        </div>
                    </div>
                </div>

                {/* Right Column - Approval Cards */}
                <div className="col-xl-3">
                    <ApprovalCard
                        title="APROBACIONES ESTADOS"
                        approvals={[
                            { label: "CONTRATO FIRMADO", checked: datosOrdenVenta?.data?.fields?.custbody90 === "T" },
                            { label: "CIERRE FIRMADO", checked: datosOrdenVenta?.data?.fields?.custbody51 === "T" },
                            { label: "UNIDAD ENTREGADA", checked: datosOrdenVenta?.data?.fields?.custbody91 === "T" },
                            { label: "UNIDAD TRASPASADA", checked: datosOrdenVenta?.data?.fields?.custbody105 === "T" },
                            { label: "VENTA CAÍDA", checked: datosOrdenVenta?.data?.fields?.custbody43 === "T" },
                            { label: "COMISIÓN APROBADA", checked: datosOrdenVenta?.data?.fields?.custbody103 === "T" },
                            { label: "COMISIÓN CANCELADA", checked: datosOrdenVenta?.data?.fields?.custbody_ix_comision_pagada === "T" },
                        ]}
                    />
                    <ApprovalCard
                        title="APROBACIONES PAGOS"
                        approvals={[
                            { label: "NO PAGA TRASPASO S.A", checked: datosOrdenVenta?.data?.fields?.custbody141 === "T" },
                            { label: "NO PAGA CESIÓN DE ACCIONES", checked: datosOrdenVenta?.data?.fields?.custbody157 === "T" },
                        ]}
                    />
                    <ApprovalCard
                        title="APROBACIONES ESTADOS"
                        approvals={[
                            { label: "APROBACION FORMALIZACIÓN", checked: datosOrdenVenta?.data?.fields?.custbodyid_firma_rc === "T" },
                            { label:  "APROBACION RDR", checked: datosOrdenVenta?.data?.fields?.custbodyid_firma_rocca === "T" },
                            { label: "CÁLCULO COMISIÓN ASESOR(AUTO)", checked: datosOrdenVenta?.data?.fields?.custbody74 === "T" },
                            { label: "CALCULO COMISIÓN CORREDOR(AUTO)", checked: datosOrdenVenta?.data?.fields?.custbody73 === "T" },

                        ]}
                    />
                </div>
            </div>
        </>
    );
};
