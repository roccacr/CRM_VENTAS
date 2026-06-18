import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { startLogout } from "../../store/auth/thunks";
import { getNotificationsHome } from "../../store/Home/Api_Home_Providers";

const getNotificationRoute = (notification) => {
   if (notification.notification_type === "ordenventa") {
      return `/orden/view?data=${notification.lead_id}&data2=${notification.transaction_id}`;
   }

   return `/estimaciones/view?data=${notification.lead_id}&data2=${notification.transaction_id}`;
};

const getNotificationAccent = (notificationType) => {
   return notificationType === "ordenventa"
      ? {
           badge: "bg-light-warning border border-warning text-warning",
           border: "#f59e0b",
           background: "linear-gradient(135deg, #fff9ec 0%, #ffffff 100%)",
        }
      : {
           badge: "bg-light-danger border border-danger text-danger",
           border: "#dc2626",
           background: "linear-gradient(135deg, #fff1f2 0%, #ffffff 100%)",
        };
};

const formatDate = (value) => {
   if (!value) {
      return "N/A";
   }

   const date = new Date(`${value}T00:00:00`);

   if (Number.isNaN(date.getTime())) {
      return value;
   }

   return new Intl.DateTimeFormat("es-CR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
   }).format(date);
};

const getDisplayValue = (value) => {
   if (value == null) {
      return "--";
   }

   const normalizedValue = String(value).trim();

   return normalizedValue === "" ? "--" : normalizedValue;
};

const getStatusText = (notification) => {
   if (notification.notification_type === "estimacion") {
      return `Sin reserva por ${notification.age_days} días`;
   }

   if ((notification.days_to_due ?? 0) < 0) {
      return `Vencida hace ${notification.overdue_days} días`;
   }

   if ((notification.days_to_due ?? 0) === 0) {
      return "Vence hoy";
   }

   return `Vence en ${notification.days_to_due} días`;
};

export const SideBar = ({ toggleSidebar }) => {
   const dispatch = useDispatch();
   const navigate = useNavigate();
   const { idnetsuite_admin, rol_admin, name_admin, microsoftUser } = useSelector((state) => state.auth);
   const [notifications, setNotifications] = useState([]);

   const onLogout = () => {
      dispatch(startLogout());
   };

   useEffect(() => {
      const loadNotifications = async () => {
         if (idnetsuite_admin == null || rol_admin == null) {
            setNotifications([]);
            return;
         }

         const response = await getNotificationsHome({ idnetsuite_admin, rol_admin });
         const notificationRows = response?.data?.data ?? [];

         setNotifications(Array.isArray(notificationRows) ? notificationRows : []);
      };

      loadNotifications();
   }, [idnetsuite_admin, rol_admin]);

   return (
      <>
         <header className="pc-header">
            <div className="header-wrapper">
               <div className="me-auto pc-mob-drp">
                  <ul className="list-unstyled">
                     <li className="pc-h-item pc-sidebar-collapse">
                        <a href="#" className="pc-head-link ms-0" id="sidebar-hide" onClick={() => toggleSidebar("hide")}>
                           <i className="ti ti-menu-2"></i>
                        </a>
                     </li>
                     <li className="pc-h-item pc-sidebar-popup">
                        <a href="#" className="pc-head-link ms-0" id="mobile-collapse" onClick={() => toggleSidebar("mobile-active")}>
                           <i className="ti ti-menu-2"></i>
                        </a>
                     </li>
                  </ul>
               </div>

               <div className="ms-auto">
                  <ul className="list-unstyled">
                     <li className="pc-h-item dropdown">
                        <a
                           className="pc-head-link arrow-none me-0 dropdown-toggle"
                           id="crm-notifications-dropdown"
                           aria-expanded="true"
                           data-bs-toggle="dropdown"
                           href="#"
                           aria-haspopup="false"
                        >
                           <i className="ph-duotone ph-bell"></i>
                           <span className="badge bg-success pc-h-badge">{notifications.length}</span>
                        </a>
                        <div
                           aria-labelledby="crm-notifications-dropdown"
                           className="dropdown-notification dropdown-menu-end pc-h-dropdown dropdown-menu p-0 overflow-hidden"
                           style={{
                              position: "absolute",
                              inset: "0px 0px auto auto",
                              transform: "translate(85px, 54px)",
                              width: "min(92vw, 540px)",
                              minWidth: "420px",
                              borderRadius: "18px",
                           }}
                        >
                           <div className="dropdown-header d-flex align-items-center justify-content-between py-3 px-4 border-bottom">
                              <div>
                                 <h4 className="m-0">Notificaciones</h4>
                                 <span className="text-muted small">{notifications.length} pendientes activas</span>
                              </div>
                           </div>
                           <div
                              data-simplebar
                              className="dropdown-body text-wrap header-notification-scroll position-relative h-100 simplebar-scrollable-y"
                              style={{ maxHeight: "70vh" }}
                           >
                              <div className="simplebar-wrapper" style={{ margin: "0px" }}>
                                 <div className="simplebar-height-auto-observer-wrapper">
                                    <div className="simplebar-height-auto-observer"></div>
                                 </div>
                                 <div className="simplebar-mask">
                                    <div className="simplebar-offset" style={{ right: "0px", bottom: "0px" }}>
                                       <div
                                          className="simplebar-content-wrapper"
                                          tabIndex="0"
                                          role="region"
                                          aria-label="scrollable content"
                                          style={{ height: "auto", overflow: "hidden scroll" }}
                                       >
                                          <div className="simplebar-content p-3">
                                             <div className="d-flex flex-column gap-3">
                                                {notifications.length === 0 ? (
                                                   <div className="card border-0 shadow-sm mb-0">
                                                      <div className="card-body text-center py-4">
                                                         <span className="text-muted">Sin notificaciones pendientes.</span>
                                                      </div>
                                                   </div>
                                                ) : (
                                                   notifications.map((notification) => {
                                                      const accent = getNotificationAccent(notification.notification_type);

                                                      return (
                                                         <button
                                                            key={notification.notification_id}
                                                            type="button"
                                                            className="btn text-start border-0 shadow-sm w-100 p-0 overflow-hidden"
                                                            style={{
                                                               background: accent.background,
                                                               borderLeft: `4px solid ${accent.border}`,
                                                               borderRadius: "16px",
                                                            }}
                                                            onClick={() => navigate(getNotificationRoute(notification))}
                                                         >
                                                            <div className="card-body p-3">
                                                               <div className="d-flex justify-content-between align-items-start gap-3 mb-2">
                                                                  <div className="d-flex align-items-center flex-wrap gap-2">
                                                                     <span className={`badge ${accent.badge}`}>{notification.notification_type === "ordenventa" ? "OV" : "PRE-RESERVA"}</span>
                                                                     <strong className="fs-6">{notification.reference_code}</strong>
                                                                     <span className="text-muted small">{notification.stage_label}</span>
                                                                  </div>
                                                                  <span className="badge bg-dark text-white">{getStatusText(notification)}</span>
                                                               </div>

                                                               <div className="mb-2">
                                                                  <div className="fw-semibold">{getDisplayValue(notification.customer_name)}</div>
                                                                  <div className="text-muted small">Asesor: {getDisplayValue(notification.advisor_name)}</div>
                                                                  <div className="text-muted small">{notification.message}</div>
                                                               </div>

                                                               <div className="row g-2 text-muted small mb-2">
                                                                  <div className="col-12 col-md-4">
                                                                     <span className="fw-semibold d-block">Proyecto</span>
                                                                     <span>{getDisplayValue(notification.project_name)}</span>
                                                                  </div>
                                                                  <div className="col-12 col-md-4">
                                                                     <span className="fw-semibold d-block">Campaña</span>
                                                                     <span>{getDisplayValue(notification.campaign_name)}</span>
                                                                  </div>
                                                                  <div className="col-12 col-md-4">
                                                                     <span className="fw-semibold d-block">Acción campaña</span>
                                                                     <span>{getDisplayValue(notification.campaign_action)}</span>
                                                                  </div>
                                                               </div>

                                                               <div className="row g-2 text-muted small">
                                                                  <div className="col-6">
                                                                     <span className="fw-semibold d-block">Fecha base</span>
                                                                     <span>{formatDate(notification.source_date)}</span>
                                                                  </div>
                                                                  <div className="col-6">
                                                                     <span className="fw-semibold d-block">Fecha objetivo</span>
                                                                     <span>{formatDate(notification.due_date)}</span>
                                                                  </div>
                                                               </div>
                                                            </div>
                                                         </button>
                                                      );
                                                   })
                                                )}
                                             </div>
                                          </div>
                                       </div>
                                    </div>
                                 </div>
                                 <div className="simplebar-placeholder" style={{ width: "100%", height: "100%" }}></div>
                              </div>
                              <div className="simplebar-track simplebar-horizontal" style={{ visibility: "hidden" }}>
                                 <div className="simplebar-scrollbar" style={{ width: "0px", display: "none" }}></div>
                              </div>
                              <div className="simplebar-track simplebar-vertical" style={{ visibility: "visible" }}>
                                 <div className="simplebar-scrollbar" style={{ display: "block" }}></div>
                              </div>
                           </div>
                           <div className="dropdown-footer border-top p-3">
                              <div className="d-grid">
                                 <button className="btn btn-outline-secondary">Cerrar</button>
                              </div>
                           </div>
                        </div>
                     </li>

                     <li className="dropdown pc-h-item header-user-profile">
                        <a
                           className="pc-head-link dropdown-toggle arrow-none me-0"
                           data-bs-toggle="dropdown"
                           href="#"
                           role="button"
                           aria-haspopup="false"
                           data-bs-auto-close="outside"
                           aria-expanded="false"
                        >
                           <img
                              src={microsoftUser?.profilePicture && microsoftUser.profilePicture !== "" ? microsoftUser.profilePicture : "/assets/images/user/avatar-2.jpg"}
                              alt="user-image"
                              className="user-avtar"
                              onError={(event) => {
                                 event.target.onerror = null;
                                 event.target.src = "/assets/images/user/avatar-2.jpg";
                              }}
                           />
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
                                             <img
                                                src={microsoftUser?.profilePicture && microsoftUser.profilePicture !== "" ? microsoftUser.profilePicture : "/assets/images/user/avatar-2.jpg"}
                                                alt="user-image"
                                                className="wid-50 rounded-circle"
                                                onError={(event) => {
                                                   event.target.onerror = null;
                                                   event.target.src = "/assets/images/user/avatar-2.jpg";
                                                }}
                                             />
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
