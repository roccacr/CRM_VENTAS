import { useEffect, useState } from "react";
import { InformacionBasicaOportunidad } from "./InformacionBasicaOportunidad";
import { InformacionBasicaExpedienteUnidad } from "./InformacionBasicaExpedienteUnidad";
import { EstimacionesOportunidad } from "./EstimacionesOportunidad";
import { getSpecificLead } from "../../../../store/leads/thunksLeads";
import { useDispatch } from "react-redux";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import { getSpecificOportunidad } from "../../../../store/oportuinidad/thunkOportunidad";

export const View_oportuinidad_ver = () => {
    const dispatch = useDispatch();
    const [activeTab, setActiveTab] = useState("infoPot");

    const handleTabClick = (tabKey) => {
        setActiveTab(tabKey); // Actualiza el estado con la pestaña seleccionada
    };
    const [leadDetails, setLeadDetails] = useState({});
    const [OportunidadDetails, setOportunidadDetails] = useState({});




     const fetchLeadDetails = async (idLead) => {
         try {
             // Llama a la acción 'getSpecificLead' y actualiza el estado 'leadDetails'.
             const leadData = await dispatch(getSpecificLead(idLead));

             // Guarda todos los detalles del lead en el estado 'leadDetails' para su uso posterior.
             setLeadDetails(leadData);
         } catch (error) {
             console.error("Error al obtener los detalles del lead:", error); // Manejo de errores.
         }
    };
    
      const fetchOportunidadDetails = async (idOportunidad) => {
          try {
              // Llama a la acción 'getSpecificOportunidad' y actualiza el estado 'oportunidadDetails'.
              const oportunidadData = await dispatch(getSpecificOportunidad(idOportunidad));

              console.log("🚀 -----------------------------------------------------------------------------------------------------🚀");
              console.log("🚀 ~ file: View_oportuinidad_ver.jsx:40 ~ fetchOportunidadDetails ~ oportunidadData:", oportunidadData);
              console.log("🚀 -----------------------------------------------------------------------------------------------------🚀");


              // Guarda todos los detalles de la oportunidad en el estado 'oportunidadDetails' para su uso posterior.
              setOportunidadDetails(oportunidadData);
          } catch (error) {
              console.error("Error al obtener los detalles de la oportunidad:", error); // Manejo de errores.
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
        const leadId = getQueryParam("data"); // Extrae el ID del lead desde la URL.
        const oportuinidadId = getQueryParam("data2"); // Extrae el ID del lead desde la URL.

        // Si 'leadId' es válido (mayor que 0), llama a la función para obtener los detalles del lead.
        if (leadId && leadId > 0) {
            fetchLeadDetails(leadId); // Ejecuta la solicitud para obtener los detalles del lead.
            fetchOportunidadDetails(oportuinidadId); // Ejecuta la solicitud para obtener los detalles del lead.
        }
    }, []); // El efecto se ejecuta nuevamente si 'location.search' cambia.

    return (
        <>
            {" "}
            <div className="bg-dark card">
                <div className="card-body">
                    <div className="d-flex align-items-center">
                        <div className="flex-grow-1 me-3">
                            <h3 className="text-white">Vista general de la oportunidad </h3>
                            <p className="text-white text-opacity-75 text-opa mb-0">#RDR1548</p>
                        </div>
                        <div className="flex-shrink-0">
                            <img alt="img" loading="lazy" width="92" height="90" decoding="async" data-nimg="1" className="img-fluid wid-80" srcSet="" src="https://light-able-react-light.vercel.app/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fimg-accout-alert.a2294f08.png&w=96&q=75" style={{ color: "transparent" }} />
                        </div>
                    </div>
                </div>
            </div>{" "}
            <div className="row">
                <div className="col-xxl-3 col-lg-5">
                    <div className="overflow-hidden card">
                        <div className="position-relative card-body">
                            <div className="text-center mt-3">
                                <div className="chat-avtar d-inline-flex mx-auto">
                                    <img alt="User image" loading="lazy" width="100" height="100" decoding="async" data-nimg="1" className="rounded-circle img-fluid wid-90 img-thumbnail" src="/opt.png" style={{ color: "transparent" }} />
                                    <i className="chat-badge bg-success me-2 mb-2"></i>
                                </div>
                                <h5 className="mb-0">1</h5>
                                <p className="text-muted text-sm">1</p>
                                <ul className="list-inline mx-auto my-4">
                                    <blockquote className="blockquote  blockquote-reverse font-size-16 mb-0">{Object.keys(leadDetails).length > 0 && <ButtonActions leadData={leadDetails} className="mb-4" />}</blockquote>

                                    <ul className="list-inline mx-auto my-4">
                                        <li className="list-inline-item">
                                            <button className="btn btn-sm btn-dark">
                                                {" "}
                                                <i className="ti ti-edit-circle f-24"></i> Editar Oportunidad{" "}
                                            </button>
                                        </li>
                                        <li className="list-inline-item">
                                            <button className="btn btn-sm btn-danger">
                                                {" "}
                                                <i className="ti ti-x f-24"></i> Oportunidades + probable{" "}
                                            </button>
                                        </li>
                                        <li className="list-inline-item">
                                            <button className="btn btn-sm btn-success">
                                                {" "}
                                                <i className="ti ti-checks f-24"></i> Oportunidades - probable{" "}
                                            </button>
                                        </li>
                                    </ul>
                                </ul>
                            </div>
                        </div>
                        <div className="flex-column list-group list-group-flush account-pills mb-0 nav nav-pills" id="user-set-tab" aria-orientation="vertical" role="tablist">
                            <a onClick={() => handleTabClick("infoPot")} role="tab" className={`list-group-item list-group-item-action nav-link ${activeTab === "infoPot" ? "active" : ""}`}>
                                <span className="f-w-500">
                                    <i className="ph-duotone ph-user-circle m-r-10"></i>Informacion Oportunidad
                                </span>
                            </a>
                            <a onClick={() => handleTabClick("Expediente")} role="tab" className={`list-group-item list-group-item-action nav-link ${activeTab === "Expediente" ? "active" : ""}`}>
                                <span className="f-w-500">
                                    <i className="ph-duotone ph-calendar m-r-10"></i> Expediente de unidad
                                </span>
                            </a>
                            <a onClick={() => handleTabClick("Estimaciones")} role="tab" className={`list-group-item list-group-item-action nav-link ${activeTab === "Estimaciones" ? "active" : ""}`}>
                                <span className="f-w-500">
                                    <i className="ph-duotone ph-notebook m-r-10"></i> Estimaciones
                                </span>
                            </a>
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-header">
                            <h5>Informacion Basica</h5>
                        </div>
                        <div className="position-relative card-body">
                            <div className="d-inline-flex align-items-center justify-content-between w-100 mb-3">
                                <p className="mb-0 text-muted me-1">Codigo Oportunidad</p>
                                <p className="mb-0">#asasasas</p>
                            </div>
                            <div className="d-inline-flex align-items-center justify-content-between w-100 mb-3">
                                <p className="mb-0 text-muted me-1">Cliente Relacionado</p>
                                <p className="mb-0">{leadDetails.nombre_lead}</p>
                            </div>
                            <div className="d-inline-flex align-items-center justify-content-between w-100 mb-3">
                                <p className="mb-0 text-muted me-1">Estado Oportunidad</p>
                                <p className="mb-0">1</p>
                            </div>
                            <div className="d-inline-flex align-items-center justify-content-between w-100">
                                <p className="mb-0 text-muted me-1">Metodo de Pago</p>
                                <p className="mb-0">1</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-xxl-9 col-lg-7">
                    <div className="tab-content" id="user-set-tabContent">
                        {activeTab === "infoPot" && (
                            <div id="react-aria8348725315-:r6:-tabpane-infoPot" role="tabpanel" aria-labelledby="react-aria8348725315-:r6:-tab-infoPot" className="fade fade tab-pane active show">
                                <InformacionBasicaOportunidad />
                            </div>
                        )}
                        {activeTab === "Expediente" && (
                            <div id="react-aria8348725315-:r6:-tabpane-Expediente" role="tabpanel" aria-labelledby="react-aria8348725315-:r6:-tab-Expediente" className="fade fade tab-pane active show">
                                <InformacionBasicaExpedienteUnidad />
                            </div>
                        )}
                        {activeTab === "Estimaciones" && (
                            <div id="react-aria8348725315-:r6:-tabpane-Estimaciones" role="tabpanel" aria-labelledby="react-aria8348725315-:r6:-tab-Estimaciones" className="fade fade tab-pane active show">
                                <EstimacionesOportunidad />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
