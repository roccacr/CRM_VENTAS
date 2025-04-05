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
               <Attached />
              </div>
            </div>
         </div>
      </>
   );
};
