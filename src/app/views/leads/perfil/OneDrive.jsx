import { useSelector } from "react-redux";
import Attached from "../../../components/common/sharepoint/Attached";
import { ProfileSection } from "./profileTheme";

export const OneDrive = () => {
   const { microsoftUser } = useSelector((state) => state.auth);

   return (
      <ProfileSection
         eyebrow="Documentación"
         title="OneDrive y archivos"
         description="Gestione los archivos vinculados al cliente desde la integración con Microsoft."
      >
         {microsoftUser ? (
            <Attached />
         ) : (
            <div className="lead-profile-empty">
               Para ver esta sección debe iniciar sesión con su cuenta de Microsoft y
               volver a ingresar a esta vista.
            </div>
         )}
      </ProfileSection>
   );
};
