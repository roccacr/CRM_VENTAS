import { NavBar } from "../components/NavBar"
import { SideBar } from "../components/SideBar"





export const AppLayout = ({ children }) => {
  return (
    <>
      <NavBar />
      <SideBar />
      {children}
    </>
  );
};
