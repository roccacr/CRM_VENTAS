import { NavBar } from "../components/NavBar";
import { SideBar } from "../components/SideBar";
import { useState, useEffect } from "react";

const dimension = 1080;

export const AppLayout = ({ children }) => {
  // Estado para controlar la visibilidad de la barra lateral
  const [sidebarVisible, setSidebarVisible] = useState(() => {
    const isPhoneOrTablet = window.innerWidth <= dimension;
    return isPhoneOrTablet ? false : true;
  });

  // Estado para controlar el estado de la barra lateral
  const [sidebarStatus, setSidebarStatus] = useState("default");

  // Función para alternar la visibilidad de la barra lateral
  const toggleSidebar = (status) => {
    setSidebarVisible(!sidebarVisible);
    setSidebarStatus(status);
  };

  // Función para cerrar la barra lateral
  const closeSidebar = () => {
    setSidebarVisible(false);
    setSidebarStatus("default");
  };

  // Efecto para manejar el redimensionamiento de la ventana
  useEffect(() => {
    const handleResize = () => {
      const isPhoneOrTablet = window.innerWidth <= dimension;
      if (isPhoneOrTablet) {
        setSidebarVisible(false);
      } else {
        setSidebarVisible(true);
        setSidebarStatus("default");
      }
    };

    // Llama a la función de manejo de redimensionamiento
    handleResize();

    // Agrega un event listener para el redimensionamiento de la ventana
    window.addEventListener("resize", handleResize);

    // Limpia el event listener cuando el componente se desmonta
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []); // Dependencia vacía para ejecutar el efecto solo una vez al montar el componente

  // Renderizado del componente
  return (
    <>
      <NavBar
        sidebarVisible={sidebarVisible}
        sidebarStatus={sidebarStatus}
        closeSidebar={closeSidebar}
      />
      <SideBar toggleSidebar={toggleSidebar} />
      {children}
      {sidebarVisible && sidebarStatus === "mobile-active" && (
        <div className="pc-menu-overlay" onClick={closeSidebar}></div>
      )}
    </>
  );
};
