const CARD_STYLES = {
   borderRadius: "20px",
   background: "#ffffff",
   border: "1px solid #d9dde3",
   boxShadow: "0 14px 32px rgba(15, 23, 42, 0.06)",
   overflow: "hidden",
};

const PROFILE_VIEW_STYLES = `
   .lead-edit-shell {
      padding: 0;
   }

   .lead-edit-panel {
      padding: 16px;
   }

   .lead-edit-hero {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid #e5e7eb;
   }

   .lead-edit-eyebrow {
      display: inline-block;
      margin-bottom: 4px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #4b5563;
   }

   .lead-edit-page-title {
      margin-bottom: 4px;
      font-size: 18px;
      font-weight: 700;
      line-height: 1.15;
      letter-spacing: -0.02em;
      color: #111827;
   }

   .lead-edit-page-copy {
      max-width: 620px;
      margin: 0;
      font-size: 12px;
      line-height: 1.45;
      color: #4b5563;
   }

   .lead-edit-section {
      margin-top: 12px;
      padding: 14px;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      background: #ffffff;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
   }

   .lead-edit-section-head {
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid #eceff3;
   }

   .lead-edit-kicker {
      display: inline-block;
      margin-bottom: 4px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #6b7280;
   }

   .lead-edit-section-title {
      margin: 0 0 4px;
      font-size: 14px;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.01em;
      color: #111827;
   }

   .lead-edit-section-copy {
      margin: 0;
      max-width: 620px;
      font-size: 11px;
      line-height: 1.45;
      color: #4b5563;
   }

   .lead-edit-shell .row {
      --bs-gutter-x: 0.75rem;
      --bs-gutter-y: 0.75rem;
   }

   .lead-profile-card {
      height: 100%;
      padding: 11px 13px;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      background: #fbfbfc;
   }

   .lead-profile-label {
      margin: 0 0 4px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: #6b7280;
   }

   .lead-profile-value {
      margin: 0;
      font-size: 13px;
      line-height: 1.35;
      color: #111827;
      white-space: pre-wrap;
      word-break: break-word;
   }

   .lead-profile-value.is-empty {
      color: #9ca3af;
      font-style: italic;
   }

   @media (max-width: 991px) {
      .lead-edit-panel {
         padding: 12px;
      }

      .lead-edit-hero {
         flex-direction: column;
      }
   }
`;

const getDisplayValue = (value) => {
   if (value === null || value === undefined || value === "" || value === "null" || value === "--") {
      return "N/A";
   }

   return value;
};

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
      const value = getDisplayValue(item.value);

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
      <div className="container-fluid lead-edit-shell">
         <style>{PROFILE_VIEW_STYLES}</style>
         <div className="row">
            <div className="col-12">
               <div className="card border-0 bg-transparent shadow-none">
                  <div className="card-body lead-edit-panel" style={CARD_STYLES}>
                     <div className="lead-edit-hero">
                        <div>
                           <span className="lead-edit-eyebrow">Vista consolidada</span>
                           <h4 className="card-title lead-edit-page-title">Información completa del lead</h4>
                           <p className="lead-edit-page-copy">
                              Consulte en una sola vista la información comercial, personal y
                              cualitativa del cliente para facilitar el seguimiento y la toma de
                              decisiones.
                           </p>
                        </div>
                     </div>

                     <section className="lead-edit-section">
                        <div className="lead-edit-section-head">
                           <span className="lead-edit-kicker">Resumen principal</span>
                           <h5 className="lead-edit-section-title">Información base del lead</h5>
                           <p className="lead-edit-section-copy">
                              Datos generales del registro, campaña, contacto y trazabilidad
                              comercial del cliente.
                           </p>
                        </div>
                        <div className="row">{renderInfoCards(informacionBasica)}</div>
                     </section>

                     <section className="lead-edit-section">
                        <div className="lead-edit-section-head">
                           <span className="lead-edit-kicker">Contexto comercial</span>
                           <h5 className="lead-edit-section-title">Información complementaria</h5>
                           <p className="lead-edit-section-copy">
                              Perfil ampliado del comprador, datos adicionales y contexto
                              cualitativo útil para operación y análisis posterior.
                           </p>
                        </div>
                        <div className="row">{renderInfoCards(informacionExtra)}</div>
                     </section>
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
};
