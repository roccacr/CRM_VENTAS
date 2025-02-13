import { useState, useEffect } from "react";
import { Drawer, Divider } from "@mui/material";
import { styled } from "@mui/material/styles";
import { NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { startLogout } from "../../store/auth/thunks";

/**
 * Estilos personalizados para el header del drawer
 */
const DrawerHeader = styled("div")(({ theme }) => ({
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(0, 1),
    ...theme.mixins.toolbar,
    justifyContent: "center",
}));

/**
 * Estilos personalizados para el contenido del navbar
 */
const NavbarContent = styled("div")({
    overflowY: "auto",
    height: "calc(100vh - 64px)",
    "&::-webkit-scrollbar": { width: "0px" },
    msOverflowStyle: "none",
    scrollbarWidth: "none",
});

/**
 * Componente NavBar - Barra de navegación lateral
 * @param {Object} props - Propiedades del componente
 * @param {boolean} props.sidebarVisible - Estado de visibilidad del sidebar
 * @param {string} props.sidebarStatus - Estado del sidebar ('mobile-active' o '')
 * @param {function} props.closeSidebar - Función para cerrar el sidebar
 */
export const NavBar = ({ sidebarVisible, sidebarStatus, closeSidebar }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { name_admin } = useSelector((state) => state.auth);

    // Estado para controlar los menús desplegables
    const [openMenu, setOpenMenu] = useState({
        leadsMenu: false,
        opportunitiesMenu: false,
    });

    // Obtiene la clase CSS dinámica para el sidebar
    const className = getClassName(sidebarVisible, sidebarStatus);

    /**
     * Maneja el estado de apertura/cierre de los menús desplegables
     * @param {string} menu - Nombre del menú a togglear
     */
    const toggleMenu = (menu) => {
        setOpenMenu((prev) => ({ ...prev, [menu]: !prev[menu] }));
    };

    /**
     * Efecto para cerrar el sidebar al hacer clic fuera de él
     */
    useEffect(() => {
        handleOutsideClick(sidebarVisible, sidebarStatus, closeSidebar);
    }, [sidebarVisible, sidebarStatus, closeSidebar]);

    /**
     * Cierra la sesión del usuario
     */
    const onLogout = () => {
        dispatch(startLogout());
    };

    /**
     * Navega a la página de creación de eventos con la fecha actual
     */
    const CreatedEvents = () => {
        const today = new Date().toISOString().split("T")[0];
        navigate(`/events/actions?idCalendar=0&idLead=0&idDate=${today}`);
    };

    return (
        <Drawer
            variant="persistent"
            anchor="left"
            open={sidebarVisible}
            onClose={closeSidebar}
            className={className}
            PaperProps={{ className }}
        >
            <DrawerHeader>
                <BrandLogo />
            </DrawerHeader>
            <Divider />
            <NavbarContent>
                <MenuItems openMenu={openMenu} toggleMenu={toggleMenu} />
                <UserCard name_admin={name_admin} CreatedEvents={CreatedEvents} />
            </NavbarContent>
        </Drawer>
    );
};

/**
 * Obtiene la clase CSS dinámica para el sidebar
 * @param {boolean} sidebarVisible - Visibilidad del sidebar
 * @param {string} sidebarStatus - Estado del sidebar ('mobile-active' o '')
 * @returns {string} Clase CSS generada
 */
const getClassName = (sidebarVisible, sidebarStatus) => {
    return `pc-sidebar ${sidebarVisible ? "pc-trigger" : "pc-sidebar-hide"} 
        ${sidebarStatus === "mobile-active" ? "mob-sidebar-active" : ""}`;
};

/**
 * Maneja clics fuera del sidebar para cerrarlo
 * @param {boolean} sidebarVisible - Visibilidad del sidebar
 * @param {string} sidebarStatus - Estado del sidebar
 * @param {function} closeSidebar - Función para cerrar el sidebar
 */
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

/**
 * Componente para el logo de la marca
 */
const BrandLogo = () => (
    <a href="" className="b-brand text-dark">
        <img
            src="/assets/logo2.jpg"
            style={{ width: "165px", height: "60px" }}
            alt="StudioCinemas"
            className="logo-lg"
        />
    </a>
);

/**
 * Componente para los elementos del menú
 * @param {Object} props - Propiedades del componente
 * @param {Object} props.openMenu - Estado de apertura de los menús desplegables
 * @param {function} props.toggleMenu - Función para alternar el estado de los menús
 */
const MenuItems = ({ openMenu, toggleMenu }) => (
    <ul className="pc-navbar" style={{ display: "block" }}>
        <li className="pc-item pc-caption">
            <label>Menú Principal</label>
        </li>
        <MenuItem to="/" icon="ti ti-home" text="Inicio" />
        <MenuItem to="/Movies/list" icon="ti ti-search" text="Buscador General" />
        <li className="pc-item pc-caption">
            <label>Modulos</label>
        </li>
        <SubMenu
            icon="ti ti-user"
            title="Leads"
            isOpen={openMenu.leadsMenu}
            toggle={() => toggleMenu("leadsMenu")}
            items={[
                { to: "/leads/lista?data=1", text: "Leads Activos" },
                { to: "/leads/lista?data=2", text: "Leads Nuevos" },
                { to: "/leads/lista?data=3", text: "Leads Requieren Atencion" },
                { to: "/leads/lista?data=4", text: "Leads Rezagados" },
                { to: "/leads/lista?data=5", text: "Leads Totales" },
            ]}
        />
        <MenuItem to="/calendar" icon="ti ti-calendar" text="Calendario" />
        <MenuItem to="/expedientes/list" icon="ti ti-file-text" text="Expedientes" />
        <MenuItem to="/events/list" icon="ti ti-calendar" text="Lista de eventos" />
        <SubMenu
            icon="ti ti-file-text"
            title="Oportunidades"
            isOpen={openMenu.opportunitiesMenu}
            toggle={() => toggleMenu("opportunitiesMenu")}
            items={[
                { to: "/oportunidad/lista?oportuinidad=1&idLead=0", text: "Lista de Oportunidades" },
                { to: "/oportunidad/crear?idExpediente=0&idLead=0", text: "Crear Oportunidad" },
            ]}
        />
    </ul>
);

/**
 * Componente para un elemento de menú
 * @param {Object} props - Propiedades del componente
 * @param {string} props.to - Ruta de navegación
 * @param {string} [props.icon] - Clase del ícono (opcional)
 * @param {string} props.text - Texto del menú
 */
const MenuItem = ({ to, icon, text }) => (
    <li className="pc-item">
        <NavLink to={to} className="pc-link active">
            {icon && (
                <span className="pc-micon">
                    <i className={icon}></i>
                </span>
            )}
            <span className="pc-mtext">{text}</span>
        </NavLink>
    </li>
);

/**
 * Componente para un submenú desplegable
 * @param {Object} props - Propiedades del componente
 * @param {string} props.title - Título del submenú
 * @param {string} props.icon - Clase del ícono
 * @param {boolean} props.isOpen - Estado de apertura del submenú
 * @param {function} props.toggle - Función para alternar el estado del submenú
 * @param {Array} props.items - Lista de elementos del submenú
 */
const SubMenu = ({ title, icon, isOpen, toggle, items }) => (
    <li className="pc-item" onClick={toggle}>
        <a className="pc-link">
            {icon && (
                <span className="pc-micon">
                    <i className={icon}></i>
                </span>
            )}
            <span className="pc-mtext">{title}</span>
            <span className="pc-arrow">
                <i className={isOpen ? "ti ti-angle-up" : "ti ti-angle-down"}></i>
            </span>
        </a>
        {isOpen && (
            <ul className="pc-submenu">
                {items.map((item, index) => (
                    <MenuItem key={index} to={item.to} text={item.text} />
                ))}
            </ul>
        )}
    </li>
);

/**
 * Componente para la tarjeta de usuario en el navbar
 * @param {Object} props - Propiedades del componente
 * @param {string} props.name_admin - Nombre del administrador
 * @param {function} props.CreatedEvents - Función para crear un evento
 */
const UserCard = ({ name_admin, CreatedEvents }) => (
    <div className="card pc-user-card">
        <div className="card-body">
            <div className="d-flex align-items-center">
                <div className="avtar avtar-s btn-light-dark">
                    <i className="ph-duotone ph-buildings f-22"></i>
                </div>
                <div className="flex-grow-1 ms-3 me-2">
                    <h6 className="mb-0">{name_admin}</h6>
                    <small>Administrator</small>
                </div>
                <UserDropdown CreatedEvents={CreatedEvents} />
            </div>
        </div>
    </div>
);

/**
 * Componente para el dropdown de usuario
 * @param {Object} props - Propiedades del componente
 * @param {function} props.CreatedEvents - Función para crear un evento
 */
const UserDropdown = ({ CreatedEvents }) => (
    <div className="dropdown">
        <a
            href="#"
            className="btn btn-icon btn-link-secondary avtar arrow-none dropdown-toggle"
            data-bs-toggle="dropdown"
            aria-expanded="false"
            data-bs-offset="0,20"
        >
            <i className="ph-duotone ph-windows-logo"></i>
        </a>
        <div className="dropdown-menu">
            <ul>
                <li>
                    <NavLink to="/leads/consultar" className="pc-user-links">
                        <i className="ph-duotone ph-user"></i>
                        <span>Consultar Lead</span>
                    </NavLink>
                </li>
                <li>
                    <a onClick={CreatedEvents} className="pc-user-links">
                        <i className="ti ti-calendar"></i>
                        <span>Crear evento</span>
                    </a>
                </li>
                <li>
                    <NavLink to="/leads/crear" className="pc-user-links">
                        <i className="ph-duotone ph-user"></i>
                        <span>Crear Lead</span>
                    </NavLink>
                </li>
                <li>
                    <NavLink to="/" className="pc-user-links">
                        <i className="ph-duotone ph-user"></i>
                        <span>Inicio</span>
                    </NavLink>
                </li>
            </ul>
        </div>
    </div>
);
