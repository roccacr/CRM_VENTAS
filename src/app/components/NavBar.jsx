import { useEffect, useState } from "react";
import { Divider, Drawer } from "@mui/material";
import { styled } from "@mui/material/styles";
import { NavLink, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

const NAVBAR_THEME_STYLES = `
.crm-navbar-drawer .MuiDrawer-paper {
   width: 278px;
   border-right: 1px solid #d9dde3;
   background:
      radial-gradient(circle at top left, rgba(15, 23, 42, 0.04), transparent 30%),
      linear-gradient(180deg, #f8fafc 0%, #ffffff 24%, #ffffff 100%);
   box-shadow: 18px 0 42px rgba(15, 23, 42, 0.08);
}

.crm-navbar {
   display: flex;
   flex-direction: column;
   height: 100%;
   padding: 10px;
   color: #111827;
}

.crm-navbar-header {
   display: flex;
   align-items: center;
   justify-content: center;
   min-height: 66px;
   padding: 8px 6px 12px;
}

.crm-brand-link {
   display: flex;
   align-items: center;
   justify-content: center;
   width: 100%;
   padding: 10px 12px;
   border: 1px solid #e5e7eb;
   border-radius: 16px;
   background: rgba(255, 255, 255, 0.92);
   box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.crm-brand-link img {
   width: 150px;
   height: 48px;
   object-fit: contain;
}

.crm-navbar-divider {
   margin: 0 4px 10px;
   border-color: #e5e7eb;
}

.crm-navbar-content {
   flex: 1;
   overflow-y: auto;
   padding: 0 4px 2px;
   scrollbar-width: none;
   -ms-overflow-style: none;
}

.crm-navbar-content::-webkit-scrollbar {
   width: 0;
   height: 0;
}

.crm-navbar-list {
   display: grid;
   gap: 5px;
   margin: 0;
   padding: 0;
   list-style: none;
}

.crm-navbar-caption {
   margin: 8px 0 1px;
   padding: 0 8px;
}

.crm-navbar-caption:first-child {
   margin-top: 0;
}

.crm-navbar-caption label {
   display: block;
   margin: 0;
   font-size: 8px;
   font-weight: 700;
   letter-spacing: 0.08em;
   text-transform: uppercase;
   color: #6b7280;
}

.crm-nav-item {
   list-style: none;
}

.crm-nav-link,
.crm-submenu-toggle,
.crm-external-link,
.crm-user-link {
   display: flex;
   align-items: center;
   gap: 10px;
   width: 100%;
   min-height: 38px;
   padding: 8px 10px;
   border: 1px solid transparent;
   border-radius: 12px;
   background: transparent;
   color: #374151;
   text-decoration: none;
   transition:
      background-color 0.18s ease,
      border-color 0.18s ease,
      box-shadow 0.18s ease,
      transform 0.18s ease,
      color 0.18s ease;
}

.crm-nav-link:hover,
.crm-submenu-toggle:hover,
.crm-external-link:hover,
.crm-user-link:hover {
   border-color: #e5e7eb;
   background: rgba(255, 255, 255, 0.92);
   color: #111827;
   transform: translateX(1px);
}

.crm-nav-link.active {
   border-color: #d1d5db;
   background: #ffffff;
   box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
   color: #111827;
}

.crm-submenu-toggle {
   justify-content: space-between;
   cursor: pointer;
}

.crm-submenu-toggle.crm-open {
   border-color: #d1d5db;
   background: #ffffff;
   box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
   color: #111827;
   border-bottom-left-radius: 10px;
   border-bottom-right-radius: 10px;
}

.crm-nav-link-main,
.crm-submenu-main {
   display: flex;
   align-items: center;
   gap: 10px;
   min-width: 0;
}

.crm-nav-icon {
   display: inline-flex;
   align-items: center;
   justify-content: center;
   width: 28px;
   height: 28px;
   border-radius: 9px;
   background: #f8fafc;
   border: 1px solid #eceff3;
   color: #374151;
   font-size: 13px;
   flex-shrink: 0;
}

.crm-nav-link.active .crm-nav-icon,
.crm-submenu-toggle.crm-open .crm-nav-icon,
.crm-user-dropdown-toggle:hover .crm-nav-icon,
.crm-user-link:hover .crm-nav-icon {
   background: #111827;
   border-color: #111827;
   color: #ffffff;
}

.crm-nav-text {
   font-size: 11px;
   font-weight: 600;
   line-height: 1.35;
}

.crm-nav-arrow {
   display: inline-flex;
   align-items: center;
   justify-content: center;
   width: 16px;
   height: 16px;
   color: #6b7280;
   font-size: 16px;
   flex-shrink: 0;
   transition: transform 0.18s ease, color 0.18s ease;
}

.crm-submenu-toggle:hover .crm-nav-arrow,
.crm-submenu-toggle.crm-open .crm-nav-arrow {
   color: #111827;
}

.crm-submenu {
   display: grid;
   gap: 5px;
   margin: -2px 0 0;
   margin-left: 16px;
   padding: 8px 0 0 12px;
   border: 0;
   border-left: 1px solid #e5e7eb;
   border-radius: 0;
   background: transparent;
   box-shadow: none;
   list-style: none;
}

.crm-submenu .crm-nav-link,
.crm-submenu .crm-external-link {
   min-height: 36px;
   padding: 7px 10px;
   border-radius: 10px;
   font-size: 11px;
}

.crm-submenu .crm-nav-link {
   border-color: #eceff3;
   background: rgba(255, 255, 255, 0.92);
   box-shadow: none;
}

.crm-submenu .crm-nav-icon {
   width: 24px;
   height: 24px;
   border-radius: 8px;
   font-size: 11px;
}

.crm-submenu .crm-nav-link:hover,
.crm-submenu .crm-nav-link.active,
.crm-external-link:hover {
   border-color: #d9dde3;
   background: #ffffff;
}

.crm-submenu .crm-nav-link.active {
   box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
}

.crm-submenu-divider {
   margin: 2px 0;
   border: 0;
   border-top: 1px solid #eceff3;
}

.crm-external-link {
   justify-content: center;
   flex-direction: column;
   gap: 5px;
   border-color: #f1f5f9;
   background: #fbfbfc;
   text-align: center;
}

.crm-external-link.crm-external-link--compact {
   flex-direction: row;
   gap: 6px;
}

.crm-external-link img {
   max-height: 28px;
   object-fit: contain;
}

.crm-user-card {
   margin-top: 12px;
   padding: 12px;
   border: 1px solid #d9dde3;
   border-radius: 18px;
   background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(248, 250, 252, 0.98) 100%);
   box-shadow: 0 14px 32px rgba(15, 23, 42, 0.06);
}

.crm-user-card-top {
   display: flex;
   align-items: center;
   gap: 10px;
}

.crm-user-avatar {
   display: inline-flex;
   align-items: center;
   justify-content: center;
   width: 36px;
   height: 36px;
   border-radius: 12px;
   border: 1px solid #e5e7eb;
   background: #111827;
   color: #ffffff;
   font-size: 15px;
   flex-shrink: 0;
}

.crm-user-meta {
   min-width: 0;
   flex: 1;
}

.crm-user-label {
   display: block;
   margin-bottom: 2px;
   font-size: 8px;
   font-weight: 700;
   letter-spacing: 0.08em;
   text-transform: uppercase;
   color: #6b7280;
}

.crm-user-name {
   margin: 0;
   font-size: 12px;
   font-weight: 700;
   line-height: 1.3;
   color: #111827;
   word-break: break-word;
}

.crm-user-role {
   margin: 2px 0 0;
   font-size: 10px;
   color: #6b7280;
}

.crm-user-dropdown {
   flex-shrink: 0;
}

.crm-user-dropdown-toggle {
   display: inline-flex;
   align-items: center;
   justify-content: center;
   width: 36px;
   height: 36px;
   padding: 0;
   border: 1px solid #e5e7eb;
   border-radius: 12px;
   background: #ffffff;
   box-shadow: none;
}

.crm-user-dropdown-toggle::after {
   display: none;
}

.crm-user-dropdown-menu {
   min-width: 220px;
   margin-top: 12px !important;
   padding: 8px;
   border: 1px solid #d9dde3;
   border-radius: 16px;
   box-shadow: 0 18px 42px rgba(15, 23, 42, 0.12);
}

.crm-user-dropdown-menu ul {
   display: grid;
   gap: 5px;
   margin: 0;
   padding: 0;
   list-style: none;
}

.crm-user-link {
   min-height: 36px;
   padding: 8px 10px;
   border-radius: 10px;
   border-color: #f1f5f9;
   background: #fbfbfc;
}

.crm-user-link i,
.crm-user-link .crm-nav-icon {
   font-size: 13px;
}

@media (max-width: 1024px) {
   .crm-navbar-drawer .MuiDrawer-paper {
      width: min(278px, calc(100vw - 20px));
   }
}
`;

const DrawerHeader = styled("div")(({ theme }) => ({
   display: "flex",
   alignItems: "center",
   padding: theme.spacing(0, 1),
   ...theme.mixins.toolbar,
   justifyContent: "center",
}));

const NavbarContent = styled("div")({
   overflowY: "auto",
   height: "calc(100vh - 64px)",
   msOverflowStyle: "none",
   scrollbarWidth: "none",
   "&::-webkit-scrollbar": {
      width: "0px",
   },
});

const LEADS_ITEMS = [
   { to: "/leads/lista?data=1", text: "Leads Activos", icon: "ti ti-user-check" },
   { to: "/leads/lista?data=2", text: "Leads Nuevos", icon: "ti ti-user-plus" },
   { to: "/leads/lista?data=3", text: "Leads Requieren Atencion", icon: "ti ti-alert-circle" },
   { to: "/leads/lista?data=5", text: "Leads Totales", icon: "ti ti-users" },
];

const OPPORTUNITY_ITEMS = [
   {
      to: "/oportunidad/lista?oportuinidad=2&idLead=0",
      text: "Lista de Oportunidades",
      icon: "ti ti-list-details",
   },
   {
      to: "/oportunidad/crear?idExpediente=0&idLead=0",
      text: "Crear Oportunidad",
      icon: "ti ti-circle-plus",
   },
];

const SALES_ORDER_ITEMS = [
   { to: "/orden/lista?data=4", text: "Cotizaciones", icon: "ti ti-file-invoice" },
   { to: "/orden/cierre-firmado", text: "Cliente cierre firmado", icon: "ti ti-file-check" },
];

const TICKET_ITEMS = [
   {
      to: "https://form.jotform.com/232835580708866",
      image: "/assets/Ticket.jpg",
      external: true,
   },
   {
      to: "https://4552704.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=3095&deploy=1&compid=4552704&ns-at=AAEJ7tMQF_Q_ZaKM6OXzzIKOWmL076kq0-mT2kWoeSkSzjZzqfk",
      image: "/assets/rocca2.jpg",
      external: true,
      alt: "",
      tooltip: "Generar ticket",
      text: "",
      imageStyle: { maxHeight: "24px" },
   },
];

const isOpportunityListUrl = (url) =>
   typeof url === "string" && url.startsWith("/oportunidad/lista");

const getClassName = (sidebarVisible, sidebarStatus) =>
   `pc-sidebar ${sidebarVisible ? "pc-trigger" : "pc-sidebar-hide"} ${
      sidebarStatus === "mobile-active" ? "mob-sidebar-active" : ""
   }`;

const handleOutsideClick = (sidebarVisible, sidebarStatus, closeSidebar) => {
   const handleClick = (event) => {
      const nav = document.querySelector(".pc-sidebar");

      if (
         nav &&
         !nav.contains(event.target) &&
         sidebarVisible &&
         (sidebarStatus === "mobile-active" || window.innerWidth <= 1024)
      ) {
         closeSidebar();
      }
   };

   document.addEventListener("mousedown", handleClick);
   return () => document.removeEventListener("mousedown", handleClick);
};

const BrandLogo = () => (
   <NavLink to="/" className="crm-brand-link" aria-label="Ir al inicio">
      <img src="/assets/logo2.jpg" alt="StudioCinemas" className="logo-lg" />
   </NavLink>
);

const MenuItem = ({ to, icon, text }) => (
   <li className="crm-nav-item">
      <NavLink
         to={to}
         className={({ isActive }) => `crm-nav-link${isActive ? " active" : ""}`}
         onClick={() => {
            if (isOpportunityListUrl(to)) {
               localStorage.removeItem("previousUrl");
            }

            localStorage.setItem("previousUrl", to);
         }}
      >
         <span className="crm-nav-link-main">
            {icon ? (
               <span className="crm-nav-icon">
                  <i className={icon}></i>
               </span>
            ) : null}
            <span className="crm-nav-text">{text}</span>
         </span>
      </NavLink>
   </li>
);

const ExternalMenuItem = ({ item }) => {
   const compactClassName = item.text ? "" : " crm-external-link--compact";

   return (
      <a
         href={item.to}
         target="_blank"
         rel="noopener noreferrer"
         className={`crm-external-link${compactClassName}`}
         title={item.tooltip || ""}
         aria-label={item.tooltip || item.alt || "Link externo"}
      >
         {item.image ? (
            <img
               src={item.image}
               alt={item.alt || "Ticket"}
               style={{ maxHeight: "32px", objectFit: "contain", ...item.imageStyle }}
            />
         ) : null}
         {item.text ? <span className="crm-nav-text">{item.text}</span> : null}
      </a>
   );
};

const SubMenu = ({ title, icon, isOpen, toggle, items }) => (
   <li className="crm-nav-item">
      <button
         type="button"
         className={`crm-submenu-toggle${isOpen ? " crm-open" : ""}`}
         onClick={toggle}
      >
         <span className="crm-submenu-main">
            {icon ? (
               <span className="crm-nav-icon">
                  <i className={icon}></i>
               </span>
            ) : null}
            <span className="crm-nav-text">{title}</span>
         </span>
         <span className="crm-nav-arrow">
            <i className={isOpen ? "ti ti-angle-up" : "ti ti-angle-down"}></i>
         </span>
      </button>

      {isOpen ? (
         <ul className="crm-submenu">
            {items.map((item, index) => (
               <li key={`${title}-${index}`} className="crm-nav-item">
                  {item.divider ? (
                     <hr className="crm-submenu-divider" />
                  ) : item.external ? (
                     <ExternalMenuItem item={item} />
                  ) : (
                     <MenuItem to={item.to} icon={item.icon} text={item.text} />
                  )}
               </li>
            ))}
         </ul>
      ) : null}
   </li>
);

const MenuItems = ({ openMenu, toggleMenu, rol_admin }) => {
return (
<ul className="crm-navbar-list">
         <li className="crm-navbar-caption">
            <label>Menú Principal</label>
         </li>

         <MenuItem to="/" icon="ti ti-home" text="Inicio" />
         <MenuItem to="/buscador" icon="ti ti-search" text="Buscador General" />

         <li className="crm-navbar-caption">
            <label>Modulos</label>
         </li>

         <SubMenu
            icon="ti ti-user"
            title="Leads"
            isOpen={openMenu.leadsMenu}
            toggle={() => toggleMenu("leadsMenu")}
            items={LEADS_ITEMS}
         />

         <MenuItem
            to="/calendar/outlook"
            icon="ti ti-calendar"
            text="Calendario Outlook"
         />
         <MenuItem to="/expedientes/list" icon="ti ti-file-text" text="Expedientes" />
         <MenuItem to="/events/list" icon="ti ti-calendar" text="Lista de eventos" />

         <SubMenu
            icon="ti ti-file-text"
            title="Oportunidades"
            isOpen={openMenu.opportunitiesMenu}
            toggle={() => toggleMenu("opportunitiesMenu")}
            items={OPPORTUNITY_ITEMS}
         />

         <SubMenu
            icon="ti ti-vocabulary"
            title="Ordenes de Venta"
            isOpen={openMenu.salesOrdersMenu}
            toggle={() => toggleMenu("salesOrdersMenu")}
            items={SALES_ORDER_ITEMS}
         />

<SubMenu
icon="ti ti-link"
title="Tickets"
isOpen={openMenu.linksExternosMenu}
toggle={() => toggleMenu("linksExternosMenu")}
items={TICKET_ITEMS}
/>
{rol_admin === 1 && (
<MenuItem
to="/configuracion/kapso"
icon="ti ti-brand-whatsapp"
text="Configuración Kapso"
/>
)}
</ul>
);
};

const UserDropdown = ({ CreatedEvents }) => (
   <div className="dropdown crm-user-dropdown">
      <a
         href="#"
         className="btn btn-icon btn-link-secondary arrow-none dropdown-toggle crm-user-dropdown-toggle"
         data-bs-toggle="dropdown"
         aria-expanded="false"
         data-bs-offset="0,20"
         onClick={(event) => event.preventDefault()}
      >
         <span className="crm-nav-icon">
            <i className="ph-duotone ph-windows-logo"></i>
         </span>
      </a>

      <div className="dropdown-menu crm-user-dropdown-menu">
         <ul>
            <li>
               <NavLink to="/leads/consultar" className="crm-user-link">
                  <i className="ph-duotone ph-user"></i>
                  <span>Consultar Lead</span>
               </NavLink>
            </li>
            <li>
               <a
                  href="#"
                  onClick={(event) => {
                     event.preventDefault();
                     CreatedEvents();
                  }}
                  className="crm-user-link"
               >
                  <i className="ti ti-calendar"></i>
                  <span>Crear evento</span>
               </a>
            </li>
            <li>
               <NavLink to="/leads/crear" className="crm-user-link">
                  <i className="ph-duotone ph-user"></i>
                  <span>Crear Lead</span>
               </NavLink>
            </li>
            <li>
               <NavLink to="/" className="crm-user-link">
                  <i className="ph-duotone ph-house"></i>
                  <span>Inicio</span>
               </NavLink>
            </li>
         </ul>
      </div>
   </div>
);

const UserCard = ({ name_admin, CreatedEvents }) => (
   <div className="crm-user-card">
      <div className="crm-user-card-top">
         <div className="crm-user-avatar">
            <i className="ph-duotone ph-buildings"></i>
         </div>

         <div className="crm-user-meta">
            <span className="crm-user-label">Sesión activa</span>
            <h6 className="crm-user-name">{name_admin || "Administrador"}</h6>
            <p className="crm-user-role">Administrator</p>
         </div>

         <UserDropdown CreatedEvents={CreatedEvents} />
      </div>
   </div>
);

export const NavBar = ({ sidebarVisible, sidebarStatus, closeSidebar }) => {
   const navigate = useNavigate();
   const { name_admin, rol_admin } = useSelector((state) => state.auth);
   const [openMenu, setOpenMenu] = useState({
      leadsMenu: false,
      salesOrdersMenu: false,
      opportunitiesMenu: false,
      linksExternosMenu: false,
   });

   const className = getClassName(sidebarVisible, sidebarStatus);

   const toggleMenu = (menu) => {
      setOpenMenu((prev) => {
         const nextValue = !prev[menu];

         return {
            leadsMenu: false,
            salesOrdersMenu: false,
            opportunitiesMenu: false,
            linksExternosMenu: false,
            [menu]: nextValue,
         };
      });
   };

   const CreatedEvents = () => {
      const today = new Date().toISOString().split("T")[0];
      navigate(`/events/actions?idCalendar=0&idLead=0&idDate=${today}`);
   };

   useEffect(() => handleOutsideClick(sidebarVisible, sidebarStatus, closeSidebar), [
      sidebarVisible,
      sidebarStatus,
      closeSidebar,
   ]);

   return (
      <>
         <style>{NAVBAR_THEME_STYLES}</style>

         <Drawer
            variant="persistent"
            anchor="left"
            open={sidebarVisible}
            onClose={closeSidebar}
            className={`crm-navbar-drawer ${className}`}
            PaperProps={{ className: `crm-navbar-drawer ${className}` }}
         >
            <div className="crm-navbar">
               <DrawerHeader className="crm-navbar-header">
                  <BrandLogo />
               </DrawerHeader>

               <Divider className="crm-navbar-divider" />

               <NavbarContent className="crm-navbar-content">
                  <MenuItems
                     openMenu={openMenu}
                     toggleMenu={toggleMenu}
                     rol_admin={rol_admin}
                  />

                  <UserCard name_admin={name_admin} CreatedEvents={CreatedEvents} />
               </NavbarContent>
            </div>
         </Drawer>
      </>
   );
};
