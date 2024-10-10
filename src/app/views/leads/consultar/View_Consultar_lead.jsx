import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { getDataLeadNetsuite } from "../../../../store/leads/thunksLeads";

export const View_Consultar_lead = () => {
    const [loading, setLoading] = useState(false); // Estado para el preloader
    const dispatch = useDispatch();

    const [leadData, setLeadData] = useState({
        firstnames: "", // Nombre completo
        entitynumber: "", // ID Lead
        emails: "", // Correo
        phones: "", // Número de teléfono
        comentario_clientes: "", // Este campo no existe en la respuesta
        campana_clientes: "", // Campaña Marketing
        proyecto_cliente: "", // Proyecto
        subsidiaria_cliente: "", // Subsidiaria
        empresa_cliente: "", // Nombre de la empresa
        referencia_cliente: "", // Referencia
        customer: "", // ID Cliente
        employees: "", // ID Empleado
        contribucion_cliente: "", // Contribución del vendedor
    });

  const [DataLead, setDataLead] = useState({});

    const consultarLeadNetsuite = async () => {
        const valor = document.getElementById("valor").value;

        if (!valor) {
            alert("Por favor, ingresa un ID de usuario");
            return;
        }

        setLoading(true); // Mostrar el preloader mientras se cargan los datos
        try {
            // Llamada al thunk para obtener los datos
            const response = await dispatch(getDataLeadNetsuite(valor));

            // Verificar si la respuesta fue exitosa
            const isSuccessful = response.data?.Detalle?.status === 200;

            // Extraer los datos necesarios, o valores vacíos en caso de error
            const data = response.data?.Detalle?.data?.fields || {};
            const dataInfo = response.data?.Detalle || {};
          const salesteamLine1 = response.data?.Detalle?.data?.sublists?.salesteam?.["line 1"] || {};
          

          setDataLead(response);

            // Asignar los valores obtenidos de la API o valores por defecto si no se encontró
            setLeadData({
                firstnames: data.firstname || "", // Nombre completo
                entitynumber: data.entitynumber || "", // ID Lead
                emails: data.email || "", // Correo
                phones: data.phone || "", // Número de teléfono
                comentario_clientes: data.comments || "", // Este campo no existe en la respuesta, pero lo dejamos
                campana_clientes: dataInfo.Marketing || "", // Campaña Marketing
                proyecto_cliente: dataInfo.Proyecto || "", // Proyecto
                subsidiaria_cliente: dataInfo.Subsidaria || "", // Subsidiaria
                empresa_cliente: data.entityid || "", // Nombre de la empresa
                referencia_cliente: dataInfo.Referido || "", // Referencia
                customer: salesteamLine1.customer || "", // ID Cliente
                employees: salesteamLine1.employee || "", // ID Empleado
                contribucion_cliente: salesteamLine1.contribution || "", // Contribución del vendedor
            });

            // Mostrar el div solo si la respuesta es exitosa
            if (isSuccessful) {
                document.getElementById("miDivConsulta").style.display = "block";
            } else {
                alert("No se encontraron datos para el ID ingresado");
            }
        } catch (error) {
            console.error("Error consultando los datos del lead:", error);
        } finally {
            setLoading(false); // Ocultar el preloader
        }

    };

    const Guardar_Lead = () => {
      console.log("Datos del lead:", DataLead);
      alert("Datos guardados correctamente");``
    };

    return (
        <div className="card">
            <div
                className="card-body"
                style={{
                    borderRadius: "13px",
                    background: "#fcfcfc",
                    boxShadow: "5px 5px 100px #656565,-5px -5px 100px #ffffff",
                }}
            >
                <h5 className="modal-title" id="ConsultarLeadLabel">
                    Consultar lead desde netsuite
                </h5>

                <p className="mb-0">
                    <i className="mdi mdi-circle-medium align-middle text-primary me-1"></i>
                    Brinda la mayor información para consultar el lead.
                </p>
                <p className="mb-0">
                    <i className="mdi mdi-circle-medium align-middle text-primary me-1"></i>
                    Ingresa el id a buscar
                </p>

                <br />

                <div className="col-sm-12">
                    <div className="mb-3">
                        <input required type="number" name="valor" id="valor" className="form-control mb-2" placeholder="Ingrese un dato" />
                        <div style={{ marginTop: "15px" }}>
                            <button onClick={consultarLeadNetsuite} className="btn btn-dark waves-effect waves-light">
                                Consultar Lead
                            </button>
                        </div>
                    </div>
                </div>

                {/* Preloader mientras se cargan los datos */}
                {loading && <div className="preloader">Cargando...</div>}

                <div className="row" id="miDivConsulta" style={{ display: "none" }}>
                    <div className="row">
                        <div className="col-sm-6">
                            <div className="mb-3">
                                <label htmlFor="productname">Nombre Completo</label>
                                <input type="text" name="firstnames" id="firstnames" className="form-control mb-2" value={leadData.firstnames} readOnly disabled />
                            </div>
                            <div className="mb-3">
                                <label className="required form-label">ID Lead</label>
                                <input type="text" name="entitynumber" id="entitynumber" className="form-control mb-2" value={leadData.entitynumber} readOnly disabled />
                            </div>
                            <div className="mb-3">
                                <label className="required form-label">Correo</label>
                                <input type="text" name="emails" id="emails" className="form-control mb-2" value={leadData.emails} readOnly disabled />
                            </div>
                            <div className="mb-3">
                                <label className="required form-label">Número de teléfono</label>
                                <input type="text" name="phones" id="phones" className="form-control mb-2" value={leadData.phones} readOnly disabled />
                            </div>
                            <div className="mb-3">
                                <label className="required form-label">Comentarios</label>
                                <input type="text" name="comentario_clientes" id="comentario_clientes" className="form-control mb-2" value={leadData.comentario_clientes} readOnly disabled />
                            </div>
                            <div className="mb-3">
                                <label className="required form-label">Campaña Marketing</label>
                                <input type="text" name="campana_clientes" id="campana_clientes" className="form-control mb-2" value={leadData.campana_clientes} readOnly disabled />
                            </div>
                        </div>

                        <div className="col-sm-6">
                            <div className="mb-3">
                                <label className="required form-label">Proyecto</label>
                                <input type="text" name="proyecto_cliente" id="proyecto_cliente" className="form-control mb-2" value={leadData.proyecto_cliente} readOnly disabled />
                            </div>
                            <div className="mb-3">
                                <label className="required form-label">Subsidiaria</label>
                                <input type="text" name="subsidiaria_cliente" id="subsidiaria_cliente" className="form-control mb-2" value={leadData.subsidiaria_cliente} readOnly disabled />
                            </div>
                            <div className="mb-3">
                                <label className="required form-label">Nombre de la empresa</label>
                                <input type="text" name="empresa_cliente" id="empresa_cliente" className="form-control mb-2" value={leadData.empresa_cliente} readOnly disabled />
                            </div>
                            <div className="mb-10 fv-row">
                                <label className="required form-label">Donde escuchó de nosotros?</label>
                                <input type="text" name="referencia_cliente" id="referencia_cliente" className="form-control mb-2" value={leadData.referencia_cliente} readOnly disabled />
                            </div>
                        </div>

                        <div className="card-body">
                            <h4 className="card-title">Vendedor</h4>
                            <p className="card-title-desc">Información del vendedor asociado</p>
                            <div className="row">
                                <div className="col-sm-6">
                                    <div className="mb-3">
                                        <label className="required form-label">Id Relacionado con el Lead</label>
                                        <input type="text" name="customer" id="customer" className="form-control mb-2" value={leadData.customer} readOnly disabled />
                                    </div>
                                </div>

                                <div className="col-sm-6">
                                    <div className="mb-3">
                                        <label className="required form-label">Id Empleado</label>
                                        <input type="text" name="employees" id="employees" className="form-control mb-2" value={leadData.employees} readOnly disabled />
                                    </div>
                                </div>

                                <div className="col-sm-6">
                                    <div className="mb-3">
                                        <label className="required form-label">Contribución</label>
                                        <input type="text" name="contribucion_cliente" id="contribucion_cliente" className="form-control mb-2" value={leadData.contribucion_cliente} readOnly disabled />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button onClick={Guardar_Lead} id="boton" className="btn btn-dark waves-effect waves-light">
                                Guardar en el sistema
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
