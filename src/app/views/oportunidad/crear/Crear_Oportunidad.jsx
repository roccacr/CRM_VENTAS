import { useEffect, useState } from "react";
import Select from "react-select"; // Importar el Select de react-select
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import { getLeadsComplete, getSpecificLead } from "../../../../store/leads/thunksLeads";
import { useDispatch } from "react-redux";
import Swal from "sweetalert2"; // Importa SweetAlert2 para mostrar alertas
import { crearOportunidad, crearReoporteLead, getfetch_Clases, getfetch_Ubicaciones } from "../../../../store/oportuinidad/thunkOportunidad";
import { getFileList } from "../../../../store/expedientes/thunksExpedientes";

/**
 * Devuelve una fecha formateada en el formato "dd/MM/yyyy" para la región de Costa Rica ("es-CR").
 * La fecha resultante es la fecha actual más la cantidad de días especificada como parámetro.
 *
 * @param {number} suma - Número de días a sumar a la fecha actual (puede ser positivo o negativo).
 * @returns {string} - Fecha formateada como "dd/MM/yyyy".
 */
const getFormattedDate = (suma) => {
    const today = new Date(); // Obtiene la fecha actual.

    // Suma la cantidad de días especificada al día actual.
    today.setDate(today.getDate() + suma);

    // Formatea la fecha resultante según el formato "es-CR" (día/mes/año).
    return new Intl.DateTimeFormat("es-CR", {
        day: "2-digit", // Muestra el día con dos dígitos.
        month: "2-digit", // Muestra el mes con dos dígitos.
        year: "numeric", // Muestra el año completo con cuatro dígitos.
    }).format(today); // Retorna la fecha formateada como cadena.
};

export const Crear_Oportunidad = () => {
    // Estado para almacenar los detalles generales del lead.
    const [leadDetails, setLeadDetails] = useState({});

    // Inicializa el hook 'useDispatch' para permitir el envío de acciones a Redux desde este componente.
    const dispatch = useDispatch();

    // Estado para almacenar las opciones disponibles para los leads.
    const [leadsOptions, setClasesOptions] = useState([]);

    // Estado para almacenar las opciones de ubicaciones.
    const [ubicacionOptions, setUbicacionOptions] = useState([]);

    // Estado para almacenar las opciones de expedientes.
    const [expedienteOptions, setExpedienteOptions] = useState([]);

    // Estado para almacenar las opciones de clientes.
    const [clientesOptions, setClientesOptions] = useState([]);

    // Estado para almacenar todos los valores del formulario, con valores iniciales definidos.
    const [formValues, setFormValues] = useState({
        clientesPoyrecto: 0, // ID del cliente.
        clientes: "", // ID del cliente.
        clienteAsignado: "", // Cliente asignado al expediente.
        probabilidad: "80.0%", // Porcentaje de probabilidad de éxito.
        nombreValor: "Firme", // Estado del valor (por ejemplo, "Firme" o "Pendiente").
        subsidiaria: "", // Subsidiaria relacionada con el cliente o proyecto.
        proyecto: "", // Proyecto asociado.
        memo: "SIN DETALLE", // Comentarios adicionales.
        estado: "22", // Estado del lead o expediente (por ejemplo, "Activo", "Completado").
        motivoCondicion: "", // Motivo de una condición especial.
        motivoCompra: "", // Motivo principal de la compra.
        metodoPago: "", // Método de pago seleccionado.
        ubicacion: "", // Ubicación relacionada con el expediente.
        clase: "", // Clase del expediente o lead.
        expediente: "", // ID del expediente asociado.
        idInternoExpediente: "", // ID interno del expediente.
        estadoExpediente: "", // Estado actual del expediente.
        nombreExpediente: "", // Nombre del expediente.
        precioLista: "", // Precio de lista del proyecto o producto.
        precioMinimo: "", // Precio mínimo permitido.
        salesRep: "", // Representante de ventas asignado.
        currency: "1", // Moneda utilizada (por ejemplo, 1 = local).
        fechaCierrePrevista: getFormattedDate(7), // Fecha estimada de cierre (7 días desde hoy).
        fechaActual: new Date().toLocaleDateString(), // Fecha actual formateada para mostrar.
    });

    // Estado para controlar si se habilita el select de motivo de condición.
    const [isMotivoCondicionEnabled, setIsMotivoCondicionEnabled] = useState(false);

    // Estado para almacenar la fecha actual para comparaciones.
    const [fechaActualComparar, setFechaActualComparar] = useState(getFormattedDate(0)); // Fecha de hoy formateada.

    // Función asíncrona para obtener los detalles específicos de un lead basado en su ID.
    const fetchLeadDetails = async (idEvent) => {
        try {
            // Llama a la acción 'getSpecificLead' y actualiza el estado 'leadDetails'.
            const leadData = await dispatch(getSpecificLead(idEvent));

            // Actualiza los valores del formulario con los detalles específicos del lead.
            setFormValues((prevState) => ({
                ...prevState, // Mantiene los valores anteriores del estado.
                clienteAsignado: `${leadData.nombre_lead} - ${leadData.proyecto_lead} `, // Asigna el nombre del lead al campo correspondiente.
                subsidiaria: leadData.subsidiaria_lead, // Actualiza la subsidiaria del lead.
                proyecto: leadData.proyecto_lead, // Asigna el proyecto asociado al lead.
                clientes: idEvent, // Almacena el ID del lead como cliente.
                clientesPoyrecto: leadData.idproyecto_lead, // Almacena el ID del lead como cliente.
            }));
            // Guarda todos los detalles del lead en el estado 'leadDetails' para su uso posterior.
            setLeadDetails(leadData);
            const idExpediente = getQueryParam("idExpediente"); // Extrae el ID del lead desde la URL.
            fetchExpedientes(idExpediente, leadData.idproyecto_lead);
        } catch (error) {
            console.error("Error al obtener los detalles del lead:", error); // Manejo de errores.
        }
    };

    // Función asíncrona para obtener las ubicaciones disponibles basadas en un ID específico.
    const fetchUbicaciones = async (idUbicacion) => {
        try {
            // Llama a la acción 'getfetch_Ubicaciones' y obtiene las ubicaciones.
            const data = await dispatch(getfetch_Ubicaciones(idUbicacion));

            // Mapea los datos recibidos para generar opciones adecuadas para los selects.
            const options = data.map((item) => ({
                value: item.idNetsuite_ubicaciones, // ID de la ubicación.
                label: item.nombre_ubicaciones, // Nombre descriptivo de la ubicación.
            }));

            // Actualiza el estado con las opciones de ubicaciones disponibles.
            setUbicacionOptions(options);
        } catch (error) {
            console.error("Error al obtener las ubicaciones:", error); // Manejo de errores.
        }
    };

    // Función asíncrona para obtener las ubicaciones disponibles basadas en un ID específico.
    const fetchClases = async (idClases) => {
        try {
            // Llama a la acción 'getfetch_Ubicaciones' y obtiene las ubicaciones.
            const data = await dispatch(getfetch_Clases(idClases));

            // Mapea los datos recibidos para generar opciones adecuadas para los selects.
            const options = data.map((item) => ({
                value: item.idNetsuite_clase, // ID de la ubicación.
                label: item.nombre_clase, // Nombre descriptivo de la ubicación.
            }));

            // Actualiza el estado con las opciones de ubicaciones disponibles.
            setClasesOptions(options);
        } catch (error) {
            console.error("Error al obtener las ubicaciones:", error); // Manejo de errores.
        }
    };

    const fetchClientes = async (idLeads) => {
        try {
            // Llama a la acción 'getfetch_Ubicaciones' y obtiene las ubicaciones.
            const data = await dispatch(getLeadsComplete("2024-01-01", "2055-01-01", 0));

            // Mapea los datos recibidos para generar opciones adecuadas para los selects.
            const options = data.map((item) => ({
                value: item.idinterno_lead, // ID de la ubicación.
                label: `${item.nombre_lead} -${item.proyecto_lead}`, // Nombre descriptivo de la ubicación.
            }));

            // Actualiza el estado con las opciones de ubicaciones disponibles.
            setClientesOptions(options);
            if (idLeads > 0) {
                setFormValues((prevValues) => ({
                    ...prevValues,
                    clientes: idLeads,
                }));
            }
        } catch (error) {
            console.error("Error al obtener los clientes:", error); // Manejo de errores.
        }
    };

    const fetchExpedientes = async (idExpediente, filtro) => {
        try {
            // Llama a la acción 'getfetch_Ubicaciones' y obtiene las ubicaciones.
            const data = await dispatch(getFileList());

            // Si el filtro no está vacío, aplica el filtrado basado en coincidencias parciales.
            const arrayPendiente = [30, 4, 16, 39, 19];

            // Si el filtro es mayor que 0, aplica el filtrado basado en el arrayPendiente o el filtro.
            // Si no, usa todos los datos.
            const filteredData = filtro > 0 ? (arrayPendiente.includes(filtro) ? data.filter((item) => arrayPendiente.includes(item.idProyectoPrincipal_exp)) : data.filter((item) => item.idProyectoPrincipal_exp === filtro)) : data; // Si el filtro es 0 o menor, usa todos los datos.

            // Mapea los datos filtrados para generar opciones adecuadas para los selects.
            const options = filteredData.map((item) => ({
                value: item.ID_interno_expediente, // ID de la ubicación.
                label: `${item.codigo_exp} - ${item.estado_exp}   `, // Nombre descriptivo de la ubicación.
            }));

            // Actualiza el estado con las opciones de ubicaciones disponibles.
            setExpedienteOptions(options);

            if (idExpediente > 0) {
                const expedienteEncontrado = data.find((item) => item.ID_interno_expediente === idExpediente);
                setFormValues((prevValues) => ({
                    ...prevValues,
                    expediente: idExpediente,
                    idInternoExpediente: expedienteEncontrado.ID_interno_expediente,
                    estadoExpediente: expedienteEncontrado.estado_exp,
                    nombreExpediente: expedienteEncontrado.codigo_exp,
                    precioLista: parseFloat(expedienteEncontrado.precioVentaUncio_exp.replace(/[,.]/g, "")), // Elimina comas y puntos
                    precioMinimo: parseFloat(expedienteEncontrado.precioDeVentaMinimo.replace(/[,.]/g, "")), // Elimina comas y puntos
                }));
            } else {
                setFormValues((prevValues) => ({
                    ...prevValues,
                    expediente: "",
                    idInternoExpediente: "",
                    estadoExpediente: "",
                    nombreExpediente: "",
                    precioLista: 0,
                    precioMinimo: 0,
                }));
            }
        } catch (error) {
            console.error("Error al obtener los expedientes:", error); // Manejo de errores.
        }
    };

    // Función para obtener el valor de un parámetro específico de la URL.
    const getQueryParam = (param) => {
        // Crea una instancia de 'URLSearchParams' con los parámetros de la URL.
        const value = new URLSearchParams(location.search).get(param);

        // Verifica si el valor es numérico. Si lo es, lo convierte a un número.
        if (value && !isNaN(value) && !isNaN(parseFloat(value))) {
            return Number(value); // Retorna el valor como número.
        }
        return value; // Si no es numérico, retorna el valor original como cadena de texto.
    };

    useEffect(() => {
        // Obtiene los parámetros 'idLead', 'idCalendar', y 'idDate' desde la URL.
        const leadId = getQueryParam("idLead"); // Extrae el ID del lead desde la URL.

        // Si 'leadId' es válido (mayor que 0), llama a la función para obtener los detalles del lead.
        if (leadId && leadId > 0) {
            fetchLeadDetails(leadId); // Ejecuta la solicitud para obtener los detalles del lead.
        }

        // Llama a la función para obtener las ubicaciones con ID 1 por defecto. que es stauts activos
        fetchUbicaciones(1);

        // Llama a la función para obtener las clases con ID 1 por defecto. que es stauts activos
        fetchClases(1);

        fetchClientes(leadId);

        if (leadId === 0) {
            const idExpediente = getQueryParam("idExpediente"); // Extrae el ID del lead desde la URL.
            fetchExpedientes(idExpediente, formValues.clientesPoyrecto);
        }
    }, [location.search]); // El efecto se ejecuta nuevamente si 'location.search' cambia.

    // Estado para almacenar los errores del formulario.
    const [errors, setErrors] = useState({});

    // Función para manejar los cambios en los campos del formulario.
    const handleInputChange = (e) => {
        const { name, value } = e.target; // Extrae el nombre y valor del campo que se modificó.

        if (name === "estado") {
            // Verifica si el estado seleccionado es "11" (Condicional) para habilitar el select de motivoCondicion.
            const isCondicional = value === "11";
            setIsMotivoCondicionEnabled(isCondicional); // Habilita o deshabilita el select según el estado.

            // Actualiza los valores del formulario según si el estado es "Condicional" o no.
            setFormValues((prevState) => ({
                ...prevState, // Mantiene los valores anteriores del formulario.
                estado: value, // Actualiza el estado seleccionado.
                probabilidad: isCondicional ? "50.0%" : "80.0%", // Ajusta la probabilidad según el estado.
                nombreValor: isCondicional ? "Condicional" : "Firme", // Define el nombre del valor.
                fechaCierrePrevista: isCondicional ? getFormattedDate(22) : getFormattedDate(7), // Establece la fecha de cierre prevista.
            }));
        } else {
            // Si no es el campo 'estado', actualiza el valor del formulario normalmente.
            setFormValues({ ...formValues, [name]: value });
        }

        if (name === "clientes") {
            // Llama a la función para obtener los detalles del lead cuando se selecciona un cliente.
            fetchLeadDetails(value);
        }

        if (name === "expediente") {
            // Llama a la función para obtener los detalles del lead cuando se selecciona un cliente.
            fetchExpedientes(value, formValues.clientesPoyrecto);
        }

        // Si hay un error relacionado con el campo que se modificó, lo elimina del estado de errores.
        if (errors[name]) {
            setErrors((prevErrors) => ({
                ...prevErrors, // Mantiene los errores anteriores.
                [name]: false, // Elimina el error del campo actual.
            }));
        }
    };
    // Función para validar los campos del formulario.
    const validateForm = () => {
        // Lista de campos requeridos que deben tener un valor.
        const requiredFields = ["clienteAsignado", "subsidiaria", "proyecto", "motivoCondicion", "motivoCompra", "metodoPago", "ubicacion", "clase", "expediente", "idInternoExpediente"];

        const errors = {}; // Objeto para almacenar los errores detectados.
        let isValid = true; // Variable para determinar si el formulario es válido.

        // Itera sobre los campos requeridos y verifica si tienen valor.
        requiredFields.forEach((field) => {
            if (!formValues[field]) {
                errors[field] = true; // Marca el campo como erróneo si está vacío.
                isValid = false; // El formulario no es válido si falta un campo requerido.
            }
        });

        // Validación adicional: si el estado es "11", 'motivoCondicion' es obligatorio.
        if (formValues.estado === "11" && !formValues.motivoCondicion) {
            errors.motivoCondicion = true; // Marca el campo como erróneo si falta.
            isValid = false; // El formulario no es válido.
        }

        if (formValues.estado === "22") {
            errors.motivoCondicion = false; // Marca el campo como erróneo si falta.
            isValid = true;
        }

         if (!formValues.idInternoExpediente) {
             isValid = false;
         }

        setErrors(errors); // Actualiza el estado de errores con los errores detectados.
        return isValid; // Retorna si el formulario es válido o no.
    };

    // Función para manejar la generación de una nueva oportunidad.
    // Función para manejar la creación de una oportunidad
    const handleGenerateOpportunity = async () => {
        // Validar formulario antes de proceder
        if (validateForm()) {
            // Mostrar alerta de confirmación antes de crear la oportunidad
            Swal.fire({
                title: "¿Está seguro de crear la oportunidad?",
                text: "No se podrá revertir esta acción, por favor confirme.",
                icon: "warning",
                showCancelButton: true,
                confirmButtonColor: "#3085d6",
                cancelButtonColor: "#d33",
                confirmButtonText: "Sí, crear!",
            }).then(async (result) => {
                // Si el usuario confirma la creación
                if (result.isConfirmed) {
                    // Mostrar alerta de carga mientras se crea la oportunidad
                    Swal.fire({
                        title: "Creando oportunidad...",
                        html: "Por favor espere...",
                        allowOutsideClick: false,
                        didOpen: () => Swal.showLoading(),
                    });

                    try {
                        // Ejecutar acción para crear la oportunidad y obtener el resultado
                        const response = await dispatch(crearOportunidad(formValues, leadDetails));
                        const detalleOportunidad = response.data["Detalle"];

                        // Si la respuesta es exitosa (código 200)
                        if (detalleOportunidad.status === 200) {
                            // Crear el reporte del lead relacionado a la oportunidad
                            await dispatch(crearReoporteLead(leadDetails));

                            // Mostrar notificación de éxito y redirigir a la página de detalles de la oportunidad
                            Swal.fire({
                                position: "top-end",
                                icon: "success",
                                title: "Oportunidad creada exitosamente",
                                showConfirmButton: false,
                                timer: 2500,
                            }).then(() => {
                                window.location.href = `/oportunidad/ver?data=${leadDetails.idinterno_lead}&data2=${detalleOportunidad.id}`;
                            });
                        }
                        // Si hay un error en el servidor (código 500)
                        else if (detalleOportunidad.status === 500) {
                            let error = JSON.parse(detalleOportunidad.Error); // Parsear el error
                            Swal.fire({
                                html: `
                                <h4>Detalle de error:</h4>
                                <p>${error.details}, <br> Lo sentimos, por favor contacte a su administrador.</p>
                            `,
                                icon: "error",
                                confirmButtonText: "OK",
                                cancelButtonText: "CORREGIR",
                                showCancelButton: true,
                                showCloseButton: true,
                            });
                        }
                    } catch (error) {
                        // Manejo de cualquier error inesperado
                        Swal.fire({
                            icon: "error",
                            title: "Error inesperado",
                            text: "Ocurrió un error al crear la oportunidad. Intente nuevamente.",
                        });
                    }
                }
            });
        } else {
            // Mostrar mensaje de error si la validación del formulario falla
            Swal.fire({
                icon: "error",
                title: "Campos obligatorios",
                text: "Por favor, complete todos los campos requeridos.",
            });
        }
    };

    return (
        <>
            <div className="card">
                <div className="card-body" style={{ borderRadius: "13px", background: "#fcfcfc" }}>
                    <h4 className="card-title">
                        <strong>Generar una nueva oportunidad</strong>
                    </h4>
                    <div className="col-xl-6">
                        <div className="mt-4 mt-lg-0">
                            <blockquote className="blockquote  blockquote-reverse font-size-16 mb-0">{Object.keys(leadDetails).length > 0 && <ButtonActions leadData={leadDetails} className="mb-4" />}</blockquote>
                        </div>
                    </div>

                    <div className="row">
                        <div className="col-xl-6">
                            <h4 className="card-title">
                                <span>Información principal</span>
                            </h4>
                            <div className="mb-3">
                                <label className="form-label">CLIENTE ASIGNADO </label>
                                <Select
                                    name="clientes"
                                    options={clientesOptions}
                                    value={clientesOptions.find((option) => option.value === formValues.clientes)}
                                    onChange={(selectedOption) =>
                                        handleInputChange({
                                            target: { name: "clientes", value: selectedOption ? selectedOption.value : "" },
                                        })
                                    }
                                    placeholder="Seleccione un Cliente"
                                    isClearable
                                    classNamePrefix="react-select"
                                />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">CLIENTE ASIGNADO </label>
                                <input value={formValues.clienteAsignado} onChange={handleInputChange} type="text" name="clienteAsignado" className={`form-control ${errors.clienteAsignado ? "is-invalid" : ""}`} disabled />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">PROBABILIDAD </label>
                                <input type="text" value={formValues.probabilidad} onChange={handleInputChange} name="probabilidad" className="form-control" disabled />
                                <input type="text" value={formValues.nombreValor} onChange={handleInputChange} name="nombreValor" className="form-control" disabled />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">SUBSIDIARIA </label>
                                <input value={formValues.subsidiaria} onChange={handleInputChange} name="subsidiaria" type="text" className={`form-control ${errors.subsidiaria ? "is-invalid" : ""}`} disabled />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">ROYECTO </label>
                                <input value={formValues.proyecto} onChange={handleInputChange} name="proyecto" type="text" className={`form-control ${errors.proyecto ? "is-invalid" : ""}`} disabled />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">DETALLES </label>
                                <textarea id="memo" className="form-control" value={formValues.memo} onChange={handleInputChange} name="memo" rows="8"></textarea>
                            </div>
                        </div>
                        <div className="col-xl-6">
                            <h4 className="card-title">
                                <span>Información obligatoria</span>
                            </h4>
                            <div className="mb-3">
                                <label>ESTADO</label>
                                <select className="form-control" value={formValues.estado} onChange={handleInputChange} name="estado">
                                    <option value="11">Condicional</option>
                                    <option value="22">Firme</option>
                                </select>
                            </div>
                            <div className="mb-3">
                                <label className="form-label">MOTIVO DE CONDICION</label>
                                <select
                                    className={`form-control ${errors.motivoCondicion ? "is-invalid" : ""}`}
                                    name="motivoCondicion"
                                    value={formValues.motivoCondicion}
                                    onChange={handleInputChange}
                                    required
                                    disabled={!isMotivoCondicionEnabled} // Deshabilitado si isMotivoCondicionEnabled es false
                                >
                                    <option value="">Escoger ...</option>
                                    <option value="Esperando un negocio">Esperando un negocio</option>
                                    <option value="Viendo opciones">Viendo opciones</option>
                                    <option value="Depende la venta de la casa">Depende la venta de la casa</option>
                                    <option value="Definiendo Prima">Definiendo Prima</option>
                                    <option value="Análisis de banco">Análisis de banco</option>
                                </select>
                            </div>
                            <div className="mb-3">
                                <label className="form-label">CIERRE PREVISTO SEGUN EL ESTADO</label>
                                <br />
                                <p>
                                    FECHA ACTUAL A COMPARAR: <span id="fechaActual">{fechaActualComparar}</span>
                                </p>
                                <div className="docs-datepicker">
                                    <div className="input-group">
                                        <input type="text" name="fechaCierrePrevista" value={formValues.fechaCierrePrevista} onChange={handleInputChange} className="form-control docs-date" disabled />
                                    </div>
                                    <div className="docs-datepicker-container"></div>
                                </div>
                            </div>
                            <div className="mb-3">
                                <label className="form-label" data-bs-toggle="tooltip" data-bs-placement="right" title="" data-bs-original-title="Motivo de Compra">
                                    MOTIVO DE COMPRA{" "}
                                </label>
                                <select className={`form-control ${errors.motivoCompra ? "is-invalid" : ""}`} name="motivoCompra" value={formValues.motivoCompra} onChange={handleInputChange} required>
                                    <option value="" required>
                                        Selecionar..
                                    </option>
                                    <option value="1">Primera Casa</option>
                                    <option value="4">Inversión</option>
                                </select>
                            </div>
                            <div className="mb-3">
                                <label className="form-label" data-bs-toggle="tooltip" data-bs-placement="right" data-bs-original-title="Avance o contra entrega">
                                    METODO DE PAGO{" "}
                                </label>
                                <select className={`form-control ${errors.metodoPago ? "is-invalid" : ""}`} name="metodoPago" value={formValues.metodoPago} onChange={handleInputChange} required>
                                    <option value="">Seleccionar</option>
                                    <option value="2">Avance De Obra</option>
                                    <option value="7">Avance Diferenciado</option>
                                    <option value="1">Contra Entrega</option>
                                </select>
                            </div>
                            <div className="col">
                                <label className="col-form-label">
                                    {" "}
                                    <span>UBICACION</span>
                                </label>
                                <Select
                                    name="ubicacion"
                                    className={`form-control ${errors.ubicacion ? "is-invalid" : ""}`}
                                    options={ubicacionOptions}
                                    value={ubicacionOptions.find((option) => option.value === formValues.ubicacion)}
                                    onChange={(selectedOption) =>
                                        handleInputChange({
                                            target: { name: "ubicacion", value: selectedOption ? selectedOption.value : "" },
                                        })
                                    }
                                    placeholder="Seleccione una Ubicación"
                                    isClearable
                                    classNamePrefix="react-select"
                                />
                            </div>
                            <div className="col">
                                <label className="col-form-label">
                                    {" "}
                                    <span>CLASE</span>
                                </label>
                                <Select
                                    name="clase"
                                    options={leadsOptions}
                                    value={leadsOptions.find((option) => option.value === formValues.clase)}
                                    onChange={(selectedOption) =>
                                        handleInputChange({
                                            target: { name: "clase", value: selectedOption ? selectedOption.value : "" },
                                        })
                                    }
                                    placeholder="Seleccione una Clase"
                                    className={`form-control ${errors.clase ? "is-invalid" : ""}`}
                                    isClearable
                                    classNamePrefix="react-select"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="row">
                    <div className="col-lg-12">
                        <div className="card">
                            <div className="card-body">
                                <h4 className="card-title">UNIDAD EXPEDIENTE LIGADO VTA</h4>
                                <p className="card-title-desc">Este es un campo personalizado creado para su cuenta. Comuníquese con el administrador para obtener detalles.</p>
                                <div className="row">
                                    <div className="col-lg-6">
                                        <div className="mb-3">
                                            <label className="ol-form-label col-lg-2">Buscar Expediente (Ayuda)</label>
                                            <div className="col-lg-10">
                                                <Select
                                                    name="expediente"
                                                    options={expedienteOptions}
                                                    value={expedienteOptions.find((option) => option.value === formValues.expediente)}
                                                    onChange={(selectedOption) =>
                                                        handleInputChange({
                                                            target: { name: "expediente", value: selectedOption ? selectedOption.value : "" },
                                                        })
                                                    }
                                                    className={`form-control ${errors.expediente ? "is-invalid" : ""}`}
                                                    placeholder="Escoger Expediente"
                                                    isClearable
                                                    classNamePrefix="react-select"
                                                />
                                            </div>
                                        </div>

                                        <div className="mb-3">
                                            <label className="col-form-label col-lg-2">ID INTERNO EXPEDIENTE</label>
                                            <div className="col-lg-10">
                                                <input type="number" className={`form-control ${errors.idInternoExpediente ? "is-invalid" : ""}`} name="idInternoExpediente" value={formValues.idInternoExpediente} disabled />
                                            </div>
                                        </div>

                                        <div className="mb-3">
                                            <label className="col-form-label col-lg-2">ESTADO EXPEDIENTE</label>
                                            <div className="col-lg-10">
                                                <input type="text" name="estadoExpediente" className="form-control" value={formValues.estadoExpediente} disabled />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-lg-6">
                                        <div className="mb-3 ajax-select mt-3 mt-lg-0">
                                            <label className="form-label">NOMBRE DE EXPEDIENTE</label>
                                            <input name="nombreExpediente" className="form-control" value={formValues.nombreExpediente} disabled />
                                        </div>

                                        <div className="mb-3 ajax-select mt-3 mt-lg-0">
                                            <div className="templating-select">
                                                <label className="form-label">PRECIO DE LISTA</label>
                                                <input
                                                    name="precioLista"
                                                    className="form-control"
                                                    value={new Intl.NumberFormat("en-US", {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2,
                                                    }).format(formValues.precioLista / 100)}
                                                    disabled
                                                />
                                            </div>
                                        </div>

                                        <div className="mb-3 ajax-select mt-3 mt-lg-0">
                                            <div className="templating-select">
                                                <label className="form-label">PRECIO DE VENTA MÍNIMO</label>

                                                <input
                                                    name="precioMinimo"
                                                    className="form-control"
                                                    value={new Intl.NumberFormat("en-US", {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2,
                                                    }).format(formValues.precioMinimo / 100)}
                                                    disabled
                                                />
                                            </div>

                                            <input name="salesRep" id="salesrep" className="form-control" value={formValues.salesRep} hidden required />

                                            <input name="currency" id="currency" className="form-control" value={formValues.currency} hidden disabled />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <button onClick={handleGenerateOpportunity} className="btn btn-dark">
                                Generar Oportunidad
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
