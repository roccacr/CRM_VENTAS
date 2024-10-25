import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import Select from "react-select";
import makeAnimated from "react-select/animated";
import { getDataInformationsLead, getDataSelectCampaing, getDataSelectCorredor, getDataSelectProyect, getDataSelectSubsidiaria } from "../../../../store/leads/thunksLeads";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";

const animatedComponents = makeAnimated();

export const View_edit_lead = () => {
    const dispatch = useDispatch();
    const [projectOptions, setProjectOptions] = useState([]);
    const [campaignOptions, setCampaignOptions] = useState([]);
    const [subsidiaryOptions, setSubsidiaryOptions] = useState([]);
    const [corredor_lead_options, setcorredor_lead] = useState([]);
    const [leadDetails, setLeadDetails] = useState({}); // Almacena los detalles generales del lead.
    const [formData, setFormData] = useState({
        firstnames: "",
        entitynumber: "",
        emails: "",
        phones: "",
        comentario_clientes: "",
        campana_new_edit: "",
        proyecto_new_edit: "",
        subsidiary_new_edit: "1",
        id_estadointeresado_cliente: "CLIENTE POTENCIAL-Exploratorio",
        empresa_cliente: "ROCCA DEV. GRU.",
        referencia_cliente: "Instagram",
        rango_edad: "",
        ingresos: "",
        motivo_compra: "",
        cantidad_hijos: "",
        momento_compra: "",
        lugar_trabajo: "",
        origen_fondos: "",
        zona_residencia: "",
        vatregnumber: "",
        custentity1: "",
        custentityestado_civil: "",
        custentity11: "",
        custentityhijos_cliente: "",
        corredor_lead_edit: "",
        defaultaddress: "",
        altphone: "00000000",
        custentity_ix_customer_profession: "",
        custentity77: "",
        custentity81: "",
        custentityestado_civil_extra: "",
        custentity82: "00000000",
        custentity78: "",
        custentity84: "",
        custentity79: "",
    });

    // Función para obtener los parámetros de la URL.
    // Extrae el valor del parámetro proporcionado desde la URL utilizando 'location.search'.
    // Si el valor es un número válido, lo convierte a número; de lo contrario, retorna el valor tal cual.
    const getQueryParam = (param) => {
        const value = new URLSearchParams(location.search).get(param); // Obtiene el valor del parámetro de la URL.
        if (value && !isNaN(value) && !isNaN(parseFloat(value))) {
            return Number(value); // Si el valor es un número válido, lo retorna como número.
        }
        return value; // Si no es un número, retorna el valor tal cual (cadena de texto).
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const leadId = getQueryParam("id");
                const resultInfolead = await dispatch(getDataInformationsLead(leadId));
                setLeadDetails(resultInfolead);

                setFormData((prevState) => ({
                    ...prevState,
                    firstnames: resultInfolead.nombre_lead,
                    phones: resultInfolead.telefono_lead,
                    emails: resultInfolead.email_lead,
                    entitynumber: resultInfolead.idinterno_lead,
                }));

                // Obtener datos para Proyectos
                const resultProyect = await dispatch(getDataSelectProyect(1));
                const projects = resultProyect.map((p) => ({ value: p.id_ProNetsuite, label: p.Nombre_proyecto }));
                setProjectOptions(projects);

                // Establecer el valor por defecto en formData.proyecto_new_edit
                const defaultProject = projects.find((p) => p.value === resultInfolead.idproyecto_lead);
                if (defaultProject) {
                    setFormData((prevData) => ({ ...prevData, proyecto_new_edit: defaultProject }));
                }

                // Obtener datos para Campañas
                const resultCampaing = await dispatch(getDataSelectCampaing(1));
                const campaigns = resultCampaing.map((c) => ({ value: c.id_NetsauiteCampana, label: c.Nombre_Campana }));
                setCampaignOptions(campaigns);

                // Establecer el valor por defecto en formData.campana_new_edit
                const defaultCampaign = campaigns.find((c) => c.value === Number(resultInfolead.idcampana_lead));
                if (defaultCampaign) {
                    setFormData((prevData) => ({ ...prevData, campana_new_edit: defaultCampaign }));
                }

                // Obtener datos para Subsidiarias
                const resultSubsidiaria = await dispatch(getDataSelectSubsidiaria(1));
                const subsidiaries = resultSubsidiaria.map((s) => ({ value: s.id_NetsuiteSub, label: s.Nombre_Subsidiaria }));
                setSubsidiaryOptions(subsidiaries);

                // Establecer el valor por defecto en formData.subsidiary_new_edit
                const defaultSubsidiary = subsidiaries.find((s) => s.value === resultInfolead.idsubsidaria_lead);
                if (defaultSubsidiary) {
                    setFormData((prevData) => ({ ...prevData, subsidiary_new_edit: defaultSubsidiary }));
                }

                // Obtener datos para Corredores
                const resultCorredor = await dispatch(getDataSelectCorredor(1));
                const corredor = resultCorredor.map((v) => ({ value: v.id_netsuiteCorredor, label: v.nombre_corredor }));
                setcorredor_lead(corredor);

                // Establecer el valor por defecto en formData.corredor_lead_edit
                const defaultCorredor = corredor.find((v) => v.value === resultInfolead.Corredor_lead || 0);
                if (defaultCorredor) {
                    setFormData((prevData) => ({ ...prevData, corredor_lead_edit: defaultCorredor }));
                }
            } catch (error) {
                console.error("Error al cargar los datos:", error);
            }
        };

        fetchData();
    }, [dispatch]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prevData) => ({ ...prevData, [name]: value }));
    };

    const handleSubmit = () => {
        console.log("Datos del formulario:", formData);
    };

    const handleSelectChange = (selectedOption, action) => {
        setFormData((prevState) => ({ ...prevState, [action.name]: selectedOption }));
        // Remover borde rojo al seleccionar una opción
        document.getElementById(action.name).style.border = "1px solid #ced4da";
    };

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-12">
                    <div className="card">
                        <div
                            className="card-body"
                            style={{
                                borderRadius: "27px",
                                background: "#ffffff",
                                boxShadow: "-26px -26px 79px #bababa, 26px 26px 79px #ffffff",
                            }}
                        >
                            <h4 className="card-title">Información recolectada de NetSuite (LEAD)</h4>
                            <ButtonActions leadData={leadDetails} className="mb-4" />
                            <br />
                            <br />
                            <br />
                            <div className="row ticket">
                                <div className="col-sm-6">
                                    <div className="mb-3">
                                        <label htmlFor="firstnames">Nombre Completo</label>
                                        <input type="text" name="firstnames" id="firstnames" value={formData.firstnames} onChange={handleInputChange} className="form-control mb-2" />
                                    </div>
                                    <div className="mb-3" hidden>
                                        <label className="required form-label">ID Lead</label>
                                        <input type="text" name="entitynumber" id="entitynumber" value={formData.entitynumber} readOnly className="form-control mb-2" />
                                    </div>
                                    <div className="mb-3">
                                        <label className="required form-label">Correo</label>
                                        <input type="text" name="emails" id="emails" value={formData.emails} onChange={handleInputChange} className="form-control mb-2" />
                                    </div>
                                    <div className="mb-3">
                                        <label className="required form-label">Número de teléfono</label>
                                        <input type="text" name="phones" id="phones" value={formData.phones} onChange={handleInputChange} className="form-control mb-2" />
                                    </div>
                                    <div className="mb-3">
                                        <label className="required form-label">Comentarios</label>
                                        <input type="text" name="comentario_clientes" id="comentario_clientes" value={formData.comentario_clientes} onChange={handleInputChange} className="form-control mb-2" />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Dirección cliente</label>
                                        <textarea id="defaultaddress" name="defaultaddress" value={formData.defaultaddress} onChange={handleInputChange} className="form-control" maxLength="225" rows="3" placeholder="Introduzca una dirección"></textarea>
                                    </div>
                                </div>
                                <div className="col-sm-6">
                                    <div className="mb-3">
                                        <label className="required form-label">Subsidiaria</label>
                                        <br />
                                        <Select id="subsidiary_new_edit" name="subsidiary_new_edit" components={animatedComponents} options={subsidiaryOptions} value={formData.subsidiary_new_edit} onChange={handleSelectChange} isSearchable required />
                                    </div>
                                    <div className="mb-3">
                                        <label className="required form-label">Proyectos</label>
                                        <br />
                                        <Select id="proyecto_new_edit" name="proyecto_new_edit" components={animatedComponents} options={projectOptions} value={formData.proyecto_new_edit} onChange={handleSelectChange} isSearchable required />
                                    </div>
                                    <div className="mb-3">
                                        <label className="required form-label">Campaña Marketing</label>
                                        <br />
                                        <Select id="campana_new_edit" name="campana_new_edit" components={animatedComponents} options={campaignOptions} value={formData.campana_new_edit} onChange={handleSelectChange} isSearchable required />
                                    </div>

                                    <div className="mb-3" hidden>
                                        <label className="required form-label">Estado del LEAD Interesado</label>
                                        <input type="text" name="id_estadointeresado_cliente" id="id_estadointeresado_cliente" value={formData.id_estadointeresado_cliente} readOnly className="form-control mb-2" />
                                    </div>
                                    <div className="mb-3" hidden>
                                        <label className="required form-label">Nombre de la empresa</label>
                                        <input type="text" name="empresa_cliente" id="empresa_cliente" value={formData.empresa_cliente} readOnly className="form-control mb-2" />
                                    </div>
                                    <div className="mb-3" hidden>
                                        <label className="required form-label">¿Dónde escuchó de nosotros?</label>
                                        <input type="text" name="referencia_cliente" id="referencia_cliente" value={formData.referencia_cliente} readOnly className="form-control mb-2" />
                                    </div>
                                    <div className="mb-3">
                                        <label className="required form-label">Corredor Cliente</label>
                                        <br />
                                        <Select id="corredor_lead_edit" name="corredor_lead_edit" components={animatedComponents} options={corredor_lead_options} value={formData.corredor_lead_edit} onChange={handleSelectChange} isSearchable required />
                                    </div>
                                </div>
                            </div>
                            <hr style={{ border: "2px solid #000" }} />
                            <h4 className="card-title">Datos Adicionales</h4> <br />
                            <div className="row">
                                <div className="col-sm-6">
                                    <div className="mb-3">
                                        <label className="required form-label">Rango de Edad</label>
                                        <select id="rango_edad" name="rango_edad" value={formData.rango_edad} onChange={handleInputChange} className="form-control select2" required>
                                            <option value="">Seleccionar un rango</option>
                                            <option value="25-34">25 a 34 años</option>
                                            <option value="35-44">35 a 44 años</option>
                                            <option value="45-54">45 a 54 años</option>
                                            <option value="55+">55 o más años</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="required form-label">Ingresos</label>
                                        <select id="ingresos" name="ingresos" value={formData.ingresos} onChange={handleInputChange} className="form-control select2" required>
                                            <option value="">Seleccionar rango de ingresos</option>
                                            <option value="0-2000">0 a 2,000 dólares</option>
                                            <option value="2000-3000">2,000 a 3,000 dólares</option>
                                            <option value="3000-5000">3,000 a 5,000 dólares</option>
                                            <option value="5000-10000">5,000 a 10,000 dólares</option>
                                            <option value="10000+">Más de 10,000 dólares</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="required form-label">Motivo de Compra</label>
                                        <select id="motivo_compra" name="motivo_compra" value={formData.motivo_compra} onChange={handleInputChange} className="form-control select2" required>
                                            <option value="">Seleccionar un motivo</option>
                                            <option value="invertir">Invertir</option>
                                            <option value="vivir">Vivir</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="required form-label">Cantidad de Hijos</label>
                                        <select id="cantidad_hijos" name="cantidad_hijos" value={formData.cantidad_hijos} onChange={handleInputChange} className="form-control select2" required>
                                            <option value="">Seleccionar cantidad</option>
                                            <option value="0">0</option>
                                            <option value="1">1</option>
                                            <option value="2">2</option>
                                            <option value="3+">3 o más</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="required form-label">Momento de compra</label>
                                        <select id="momento_compra" name="momento_compra" value={formData.momento_compra} onChange={handleInputChange} className="form-control select2" required>
                                            <option value="">Seleccionar momento compra</option>
                                            <option value="Pre-venta">Pre-venta</option>
                                            <option value="Proyecto iniciado">Proyecto iniciado</option>
                                            <option value="En obra gris">En obra gris</option>
                                            <option value="Entrega inmediata">Entrega inmediata</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Origen de los dondos</label>
                                        <input type="text" name="origen_fondos" id="origen_fondos" value={formData.origen_fondos} onChange={handleInputChange} className="form-control mb-2" placeholder="origen_fondos" required />
                                    </div>
                                </div>
                                <div className="col-sm-6">
                                    <div className="mb-3">
                                        <label className="form-label">Cedula cliente</label>
                                        <input type="text" name="vatregnumber" id="vatregnumber" value={formData.vatregnumber} onChange={handleInputChange} className="form-control mb-2" placeholder="Cedula Cliente" />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Nacionalidad cliente</label>
                                        <input type="text" name="custentity1" id="custentity1" value={formData.custentity1} onChange={handleInputChange} className="form-control mb-2" placeholder="Nacionalidad del Cliente" required />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Profesión Cliente</label>
                                        <input type="text" name="custentity_ix_customer_profession" id="custentity_ix_customer_profession" value={formData.custentity_ix_customer_profession} onChange={handleInputChange} className="form-control mb-2" placeholder="Profesión del cliente" required />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Estado Civil</label>
                                        <select required name="custentityestado_civil" id="custentityestado_civil" value={formData.custentityestado_civil} onChange={handleInputChange} className="form-control">
                                            <option value="">Seleccionar</option>
                                            <option value="Casado/a">Casado/a</option>
                                            <option value="Soltero/a">Soltero/a</option>
                                            <option value="Unión Libre">Unión Libre</option>
                                            <option value="Viudo">Viudo</option>
                                            <option value="Divorciado/a">Divorciado/a</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">Lugar de trabajo</label>
                                        <input type="text" name="lugar_trabajo" id="lugar_trabajo" value={formData.lugar_trabajo} onChange={handleInputChange} className="form-control mb-2" placeholder="Lugar de trabajo" required />
                                    </div>
                                    <div className="mb-3">
                                        <label className="required form-label">Zona de recidencia</label>
                                        <select id="momento_compra" name="momento_compra" value={formData.momento_compra} onChange={handleInputChange} className="form-control select2" required>
                                            <option value="">Seleccionar recidencia</option>
                                            {/* <option value="Pre-venta">Pre-venta</option>
                                            <option value="Proyecto iniciado">Proyecto iniciado</option>
                                            <option value="En obra gris">En obra gris</option>
                                            <option value="Entrega inmediata">Entrega inmediata</option> */}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <hr style={{ border: "2px solid #000" }} />
                            <h4 className="card-title">Información Extra Segundo Cliente</h4> <br />
                            <div className="row">
                                <div className="col-sm-6">
                                    <div className="mb-3">
                                        <label className="form-label">NOMBRE CLIENTE 2</label>
                                        <input type="text" name="custentity77" id="custentity77" value={formData.custentity77} onChange={handleInputChange} className="form-control mb-2" placeholder="NOMBRE CLIENTE 2" />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">NACIONALIDAD 2</label>
                                        <input type="text" name="custentity81" id="custentity81" value={formData.custentity81} onChange={handleInputChange} className="form-control mb-2" placeholder="NACIONALIDAD 2" required />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">ESTADO CIVIL 2</label>
                                        <select required name="custentityestado_civil_extra" id="custentityestado_civil_extra" value={formData.custentityestado_civil_extra} onChange={handleInputChange} className="form-control">
                                            <option value="">Seleccionar</option>
                                            <option value="Casado/a">Casado/a</option>
                                            <option value="Soltero/a">Soltero/a</option>
                                            <option value="Unión Libre">Unión Libre</option>
                                            <option value="Viudo">Viudo</option>
                                            <option value="Divorciado/a">Divorciado/a</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">TELEFONO 2</label>
                                        <input type="text" name="custentity82" id="custentity82" value={formData.custentity82} onChange={handleInputChange} className="form-control mb-2" placeholder="TELEFONO 2" required />
                                    </div>
                                </div>
                                <div className="col-sm-6">
                                    <div className="mb-3">
                                        <label className="form-label">N° CEDULA 2</label>
                                        <input type="text" name="custentity78" id="custentity78" value={formData.custentity78} onChange={handleInputChange} className="form-control mb-2" placeholder="N° CEDULA 2" required />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">E-MAIL 2</label>
                                        <input type="text" name="custentity84" id="custentity84" value={formData.custentity84} onChange={handleInputChange} className="form-control mb-2" placeholder="E-MAIL 2" required />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label">PROFESIÓN 2</label>
                                        <input type="text" name="custentity79" id="custentity79" value={formData.custentity79} onChange={handleInputChange} className="form-control mb-2" placeholder="PROFESIÓN 2" required />
                                    </div>
                                </div>
                            </div>
                            <button type="button" onClick={handleSubmit} className="btn btn-dark waves-effect waves-light">
                                Editar en el sistema
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
