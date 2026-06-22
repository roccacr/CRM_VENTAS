export const HeaderContent = ({ leadInformations }) => (
   <div className="lead-profile-header-card">
      <div className="lead-profile-header-body">
         <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap">
            <div>
               <h3 className="lead-profile-header-name">{leadInformations.nombre_lead || "Cliente"}</h3>
               <p className="lead-profile-header-copy">Perfil consolidado del cliente</p>
            </div>
            <div className="flex-shrink-0">
               <img
                  alt="Indicador del perfil"
                  loading="lazy"
                  width="72"
                  height="72"
                  className="img-fluid"
                  src="https://light-able-react-light.vercel.app/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fimg-accout-alert.a2294f08.png&w=96&q=75"
                  style={{ color: "transparent" }}
               />
            </div>
         </div>
      </div>
   </div>
);
