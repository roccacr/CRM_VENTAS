import React, { useState, useEffect } from "react";
import { Drawer, Divider } from "@mui/material";
import { styled } from "@mui/material/styles";
import { NavLink } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { startLogout } from "../../store/auth/thunks";

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
    "&::-webkit-scrollbar": {
        width: "0px",
        background: "transparent",
    },
    msOverflowStyle: "none",
    scrollbarWidth: "none",
});

export const NavBar = ({ sidebarVisible, sidebarStatus, closeSidebar }) => {
    const dispatch = useDispatch();
    const { name_admin } = useSelector((state) => state.auth);

    // Estado para manejar el menú desplegable de Leads
    const [isLeadsMenuOpen, setIsLeadsMenuOpen] = useState(false);

    useEffect(() => {
        const handleOutsideClick = (event) => {
            const nav = document.querySelector(".pc-sidebar");
            if (nav && !nav.contains(event.target) && sidebarVisible && (sidebarStatus === "mobile-active" || window.innerWidth <= 1024)) {
                closeSidebar();
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);

        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
        };
    }, [sidebarVisible, sidebarStatus, closeSidebar]);

    const onLogout = () => {
        dispatch(startLogout());
    };

    // Función para alternar el menú Leads
    const toggleLeadsMenu = () => {
        setIsLeadsMenuOpen((prev) => !prev);
    };

    return (
        <>
            <div className="loader-bg">
                <div className="loader-track">
                    <div className="loader-fill"></div>
                </div>
            </div>

            <Drawer variant="persistent" anchor="left" open={sidebarVisible} onClose={closeSidebar} className={sidebarVisible ? (sidebarStatus === "mobile-active" ? "pc-sidebar pc-trigger mob-sidebar-active" : "pc-sidebar pc-trigger") : "pc-sidebar pc-sidebar-hide"}>
                <DrawerHeader>
                    <a href="/" className="b-brand text-dark">
                        <img src="/assets/logo2.jpg" style={{ width: "165px", height: "60px" }} alt="StudioCinemas" className="logo-lg" />
                    </a>
                </DrawerHeader>
                <Divider />
                <NavbarContent>
                    <ul className="pc-navbar" style={{ display: "block" }}>
                        <li className="pc-item pc-caption">
                            <label>Menú Principal</label>
                        </li>

                        <li className="pc-item">
                            <NavLink to="/" className="pc-link active">
                                <span className="pc-micon">
                                    <i className="ti ti-home"></i>
                                </span>
                                <span className="pc-mtext">Inicio</span>
                            </NavLink>
                        </li>

                        <li className="pc-item">
                            <NavLink to="/Movies/list" className="pc-link active">
                                <span className="pc-micon">
                                    <i className="ti ti-search"></i>
                                </span>
                                <span className="pc-mtext">Buscador General</span>
                            </NavLink>
                        </li>

                        <li className="pc-item pc-caption">
                            <label>Modulos</label>
                        </li>

                        <li className={`pc-item pc-hashmenu pc-trigger ${isLeadsMenuOpen ? "active" : ""}`}>
                            <a className="pc-link" onClick={toggleLeadsMenu}>
                                <span className="pc-micon">
                                    <i className="ti ti-users"></i>
                                </span>
                                <span className="pc-mtext">Leads</span>
                            </a>
                            <ul className={`pc-submenu ${isLeadsMenuOpen ? "open" : ""}`} style={{ display: isLeadsMenuOpen ? "block" : "none" }}>
                                <li className="pc-item">
                                    <NavLink to="/leads/lista?data=1" className="pc-link">
                                        <span className="pc-mtext">Leads</span>
                                    </NavLink>
                                </li>
                                <li className="pc-item">
                                    <NavLink to="/leads/lista?data=2" className="pc-link">
                                        <span className="pc-mtext">Leads Nuevos</span>
                                    </NavLink>
                                </li>
                                <li className="pc-item">
                                    <NavLink to="/leads/lista?data=3" className="pc-link">
                                        <span className="pc-mtext">Leads Requieren Atención</span>
                                    </NavLink>
                                </li>
                                <li className="pc-item">
                                    <NavLink to="/leads/lista?data=4" className="pc-link">
                                        <span className="pc-mtext">Leads Rezagados</span>
                                    </NavLink>
                                </li>
                            </ul>
                        </li>

                        <li className="pc-item">
                            <NavLink to="/calendar" className="pc-link active">
                                <span className="pc-micon">
                                    <i className="ti ti-calendar"></i>
                                </span>
                                <span className="pc-mtext">Calendario</span>
                            </NavLink>
                        </li>

                        <li className="pc-item">
                            <NavLink to="/events" className="pc-link active">
                                <span className="pc-micon">
                                    <i className="ti ti-calendar-event"></i>
                                </span>
                                <span className="pc-mtext">Lista Eventos</span>
                            </NavLink>
                        </li>

                        <li className="pc-item">
                            <NavLink to="/Movies/list" className="pc-link active">
                                <span className="pc-micon">
                                    <i className="ti ti-trending-up"></i>
                                </span>
                                <span className="pc-mtext">Oportunidades</span>
                            </NavLink>
                        </li>

                        <li className="pc-item">
                            <NavLink to="/Movies/list" className="pc-link active">
                                <span className="pc-micon">
                                    <i className="ti ti-file-text"></i>
                                </span>
                                <span className="pc-mtext">Expedientes</span>
                            </NavLink>
                        </li>

                        <li className="pc-item">
                            <NavLink to="/Movies/list" className="pc-link active">
                                <span className="pc-micon">
                                    <i className="ti ti-chart-infographic"></i>
                                </span>
                                <span className="pc-mtext">Cotizaciones</span>
                            </NavLink>
                        </li>
                    </ul>

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
                                <div className="dropdown">
                                    <a href="#" className="btn btn-icon btn-link-secondary avtar arrow-none dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false" data-bs-offset="0,20">
                                        <i className="ph-duotone ph-windows-logo"></i>
                                    </a>
                                    <div className="dropdown-menu">
                                        <ul>
                                            <li>
                                                <NavLink to="/Movies/list" className="pc-user-links">
                                                    <i className="ph-duotone ph-user"></i>
                                                    <span>Mi perfil</span>
                                                </NavLink>
                                            </li>
                                            <li>
                                                <a className="pc-user-links">
                                                    <i className="ph-duotone ph-gear"></i>
                                                    <span>Settings</span>
                                                </a>
                                            </li>
                                            <li>
                                                <a className="pc-user-links">
                                                    <i className="ph-duotone ph-lock-key"></i>
                                                    <span>Lock Screen</span>
                                                </a>
                                            </li>
                                            <li>
                                                <a onClick={onLogout} className="pc-user-links">
                                                    <i className="ph-duotone ph-power"></i>
                                                    <span>Logout</span>
                                                </a>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </NavbarContent>
            </Drawer>
        </>
    );
};
