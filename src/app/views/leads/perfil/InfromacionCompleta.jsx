import {
   ProfileSection,
   getDisplayText,
} from "./profileTheme";

const getEstadoCivilName = (estadoCivilId) => {
   if (!estadoCivilId || estadoCivilId === "null" || estadoCivilId === "--") {
      return "N/A";
   }

   const estadoCivilMap = {
      "1": "Casado/a",
      "2": "Soltero/a",
      "3": "Unión Libre",
      "4": "Viudo",
      "5": "Divorciado/a",
   };

   return estadoCivilMap[String(estadoCivilId)] || estadoCivilId;
};

const renderInfoCards = (infoArray) =>
   infoArray.map((item) => {
      const value = getDisplayText(item.value);

      return (
         <div className="col-md-6" key={item.label}>
            <article className="lead-profile-card">
               <p className="lead-profile-label">{item.label}</p>
               <p className={`lead-profile-value${value === "N/A" ? " is-empty" : ""}`}>{value}</p>
            </article>
         </div>
      );
   });

export const InfromacionCompleta = ({ leadDetails }) => {
   const informacionBasica = [
      { label: "Nombre Completo", value: leadDetails.nombre_lead },
      { label: "Proyecto", value: leadDetails.proyecto_lead },
      { label: "Campaña", value: leadDetails.campana_lead },
      { label: "Anuncio", value: leadDetails.custentityaccion_campana },
      { label: "Correo", value: leadDetails.email_lead },
      { label: "Teléfono", value: leadDetails.telefono_lead },
      { label: "Subsidiaria", value: leadDetails.subsidiaria_lead },
      { label: "Seguimiento", value: leadDetails.segimineto_lead },
      { label: "Comentario", value: leadDetails.comentario_lead },
   ];

   const informacionExtra = [
      { label: "Cédula", value: leadDetails.cedula_lead },
      { label: "Nacionalidad", value: leadDetails.Nacionalidad_lead },
      { label: "Estado Civil", value: getEstadoCivilName(leadDetails.Estado_ciLead) },
      { label: "Edad", value: leadDetails.Edad_lead },
      { label: "Profesión", value: leadDetails.Profesion_lead },
      { label: "Hijos", value: leadDetails.Hijos_lead },
      { label: "Teléfono Alternativo", value: leadDetails.TelefonoAlternatovo_lead },
      { label: "Dirección", value: leadDetails.Direccion },
      { label: "Corredor", value: leadDetails.nombre_corredor },
      { label: "Nombre Extra", value: leadDetails.nombre_extra_lead },
      { label: "Cédula Extra", value: leadDetails.cedula_extra_lead },
      { label: "Profesión Extra", value: leadDetails.profesion_extra_lead },
      { label: "Estado Civil Extra", value: getEstadoCivilName(leadDetails.estado_civil_extra_lead) },
      { label: "Teléfono Extra", value: leadDetails.telefono_extra_lead },
      { label: "Nacionalidad Extra", value: leadDetails.nacionalidad_extra_lead },
      { label: "Email Extra", value: leadDetails.email_extra_lead },
      { label: "Ingresos Extra", value: leadDetails.info_extra_ingresos },
      { label: "Motivo de Compra", value: leadDetails.info_extra_MotivoCompra },
      { label: "Momento de Compra", value: leadDetails.info_extra_MomentodeCompra },
      { label: "Lugar de Trabajo", value: leadDetails.info_extra_Trabajo },
      { label: "Origen de Fondo", value: leadDetails.info_extra_OrigenFondo },
      { label: "Zona de Residencia", value: leadDetails.info_extra_ZonaRecidencia },
      { label: "Perfil del Cliente Comprador", value: leadDetails.info_extra_PerfilClienteComprador },
   ];

   return (
      <div className="lead-profile-shell">
         <div className="lead-profile-hero">
            <div>
               <span className="lead-profile-eyebrow">Vista consolidada</span>
               <h4 className="card-title lead-profile-page-title">Información completa del lead</h4>
               <p className="lead-profile-page-copy">
                  Consulte en una sola vista la información comercial, personal y cualitativa
                  del cliente para facilitar el seguimiento y la toma de decisiones.
               </p>
            </div>
         </div>

         <ProfileSection
            eyebrow="Resumen principal"
            title="Información base del lead"
            description="Datos generales del registro, campaña, contacto y trazabilidad comercial del cliente."
         >
            <div className="row">{renderInfoCards(informacionBasica)}</div>
         </ProfileSection>

         <ProfileSection
            eyebrow="Contexto comercial"
            title="Información complementaria"
            description="Perfil ampliado del comprador, datos adicionales y contexto cualitativo útil para operación y análisis posterior."
         >
            <div className="row">{renderInfoCards(informacionExtra)}</div>
         </ProfileSection>
      </div>
   );
};
