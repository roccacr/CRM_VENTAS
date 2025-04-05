import { useState } from "react";
import { useSelector } from "react-redux";
import Attached from "../../../components/common/sharepoint/Attached";


export const OneDrive = () => {
    const { microsoftUser } = useSelector((state) => state.auth); 
  
   return (
      <>
         <div className="card">
            <div className="card-header">
               <h5>OneDrive Subida de archivos</h5>
            </div>
            <div className="card-body">
              <div className="row">
               {microsoftUser ? (
                  <Attached />
               ) : (
                  <div className="col-12 text-center">
                    <p className="alert alert-warning">
                      Para poder ver esta vista debe iniciar sesión con su cuenta de Microsoft. 
                      Por favor, cierre sesión y vuelva a intentarlo volviendo a esta vista.
                    </p>
                  </div>
               )}
              </div>
            </div>
         </div>
      </>
   );
};
