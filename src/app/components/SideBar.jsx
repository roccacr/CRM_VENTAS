import { useDispatch, useSelector } from "react-redux";
import { startLogout } from "../../store/auth/thunks";
import { useEffect, useState } from "react";
import { getLeadsRepit } from "../../store/leads/thunksLeads";


export const SideBar = ({ toggleSidebar }) => {
  const dispatch = useDispatch();
    const { name_admin } = useSelector((state) => state.auth);
    const [leadItems, setLeadItems] = useState([]);
    const [leadCount, setLeadCount] = useState(0);

  const onLogout = () => {
    dispatch(startLogout());
    };

const fetchData = async () => {
    const result = await dispatch(getLeadsRepit());

    // Agrupamos los leads por email
    const groupedLeads = result.reduce((acc, lead) => {
        // Si el email aún no existe en el acumulador, lo agregamos
        if (!acc[lead.email_lead]) {
            acc[lead.email_lead] = {
                email: lead.email_lead,
                tipoDuplicado: lead.tipoLead,
                names: [lead.nombre_lead], // Guardamos el primer nombre
            };
        } else {
            // Si ya existe el email, agregamos el nombre al array
            acc[lead.email_lead].names.push(lead.nombre_lead);
        }
        return acc;
    }, {});


    // Convertimos el objeto agrupado en una lista de elementos <li>
    const leadListItems = Object.values(groupedLeads).map((lead, index) => (
        <li className="list-group-item" key={index}>
            {/* Mostrar el tipo de duplicado (Correo, Teléfono o ambos) */}
            <p className="text-span">{lead.tipoDuplicado}</p>
            <div className="d-flex">
                <div className="flex-grow-1 ms-3">
                    <div className="d-flex">
                        <div className="flex-shrink-0">
                            {/* Iteramos sobre todos los nombres asociados al mismo email */}
                            {lead.names.map((name, i) => (
                                <div key={i}>
                                    <span className="text-sm">
                                        {i + 1} : {name} : {lead.email}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Botón para ver detalles del cliente */}
                    <span className="badge bg-light-primary border border-primary me-1 mt-1">Ver clientes</span>
                </div>
            </div>
        </li>
    ));

    setLeadItems(leadListItems);

    setLeadCount(leadListItems.length);
};






    useEffect(() => {
        fetchData();
    }, []);

  return (
      <>
          {/* 2. Renderiza el encabezado de la barra lateral */}
          <header className="pc-header">
              <div className="header-wrapper">
                  <div className="me-auto pc-mob-drp">
                      <ul className="list-unstyled">
                          <li className="pc-h-item pc-sidebar-collapse">
                              {/* 3. Enlace para colapsar el sidebar */}
                              <a href="#" className="pc-head-link ms-0" id="sidebar-hide" onClick={() => toggleSidebar("hide")}>
                                  <i className="ti ti-menu-2"></i>
                              </a>
                          </li>
                          <li className="pc-h-item pc-sidebar-popup">
                              {/* 4. Enlace para activar el sidebar en modo móvil */}
                              <a href="#" className="pc-head-link ms-0" id="mobile-collapse" onClick={() => toggleSidebar("mobile-active")}>
                                  <i className="ti ti-menu-2"></i>
                              </a>
                          </li>
                      </ul>
                  </div>

                  <div className="ms-auto">
                      <ul className="list-unstyled">
                          <li className="pc-h-item dropdown">
                              <a className="pc-head-link arrow-none me-0 dropdown-toggle" id="react-aria-:Rr56:" aria-expanded="true" data-bs-toggle="dropdown" href="#" aria-haspopup="false">
                                  <i className="ph-duotone ph-bell"></i>
                                  <span className="badge bg-success pc-h-badge">{leadCount}</span>
                              </a>
                              <div
                                  aria-labelledby="react-aria-:Rr56:"
                                  className="dropdown-notification dropdown-menu-end pc-h-dropdown dropdown-menu "
                                  style={{
                                      position: "absolute",
                                      inset: "0px 0px auto auto",
                                      transform: "translate(85px, 54px)",
                                  }}
                              >
                                  <div className="dropdown-header d-flex align-items-center justify-content-between">
                                      <h4 className="m-0">Notificaciones</h4>
                                  </div>
                                  <div data-simplebar className="dropdown-body text-wrap header-notification-scroll position-relative h-100 simplebar-scrollable-y" style={{ maxHeight: "calc(-235px + 100vh)" }}>
                                      <div className="simplebar-wrapper" style={{ margin: "0px" }}>
                                          <div className="simplebar-height-auto-observer-wrapper">
                                              <div className="simplebar-height-auto-observer"></div>
                                          </div>
                                          <div className="simplebar-mask">
                                              <div className="simplebar-offset" style={{ right: "0px", bottom: "0px" }}>
                                                  <div className="simplebar-content-wrapper" tabIndex="0" role="region" aria-label="scrollable content" style={{ height: "auto", overflow: "hidden scroll" }}>
                                                      <div className="simplebar-content" style={{ padding: "0px" }}>
                                                          <ul className="list-group list-group-flush">{leadItems}</ul>
                                                      </div>
                                                  </div>
                                              </div>
                                          </div>
                                          <div className="simplebar-placeholder" style={{ width: "453px", height: "779px" }}></div>
                                      </div>
                                      <div className="simplebar-track simplebar-horizontal" style={{ visibility: "hidden" }}>
                                          <div className="simplebar-scrollbar" style={{ width: "0px", display: "none" }}></div>
                                      </div>
                                      <div className="simplebar-track simplebar-vertical" style={{ visibility: "visible" }}>
                                          <div className="simplebar-scrollbar" style={{ height: "496px", transform: "translate3d(0px, 0px, 0px)", display: "block" }}></div>
                                      </div>
                                  </div>
                                  <div className="dropdown-footer">
                                      <div className="row g-3">
                                          <div className="col-6">
                                              <div className="d-grid">
                                                  <button className="btn btn-outline-secondary">Cerrar</button>
                                              </div>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          </li>

                          <li className="dropdown pc-h-item header-user-profile">
                              {/* 7. Enlace y menú desplegable del perfil del usuario */}
                              <a className="pc-head-link dropdown-toggle arrow-none me-0" data-bs-toggle="dropdown" href="#" role="button" aria-haspopup="false" data-bs-auto-close="outside" aria-expanded="false">
                                  <img src="/assets/images/user/avatar-2.jpg" alt="user-image" className="user-avtar" />
                              </a>
                              <div className="dropdown-menu dropdown-user-profile dropdown-menu-end pc-h-dropdown">
                                  <div className="dropdown-header d-flex align-items-center justify-content-between">
                                      <h5 className="m-0">Perfil</h5>
                                  </div>
                                  <div className="dropdown-body">
                                      <div className="profile-notification-scroll position-relative" style={{ maxHeight: "calc(100vh - 225px)" }}>
                                          <ul className="list-group list-group-flush w-100">
                                              <li className="list-group-item">
                                                  <div className="d-flex align-items-center">
                                                      <div className="flex-shrink-0">
                                                          <img src="/assets/images/user/avatar-2.jpg" alt="user-image" className="wid-50 rounded-circle" />
                                                      </div>
                                                      <div className="flex-grow-1 mx-3">
                                                          <h5 className="mb-0">{name_admin}</h5>
                                                      </div>
                                                  </div>
                                              </li>
                                              <li className="list-group-item">
                                                  <button onClick={onLogout} className="dropdown-item">
                                                      <span className="d-flex align-items-center">
                                                          <i className="ph-duotone ph-power"></i>
                                                          <span>Cerrar Sesión</span>
                                                      </span>
                                                  </button>
                                              </li>
                                          </ul>
                                      </div>
                                  </div>
                              </div>
                          </li>
                      </ul>
                  </div>
              </div>
          </header>
      </>
  );
};
