import { useDispatch, useSelector } from "react-redux";
import { startLogout } from "../../store/auth/thunks";


export const SideBar = ({ toggleSidebar }) => {
  const dispatch = useDispatch();
  const { name_admin } = useSelector((state) => state.auth);

  const onLogout = () => {
    dispatch(startLogout());
  };

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
