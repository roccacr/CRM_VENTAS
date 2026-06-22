import React from "react";

const MODAL_HEADER_STYLES = `
.lead-modal-header {
   align-items: flex-start;
   gap: 14px;
   padding: 18px 22px 16px;
   border-bottom: 1px solid #e8ecf2;
   background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
}

.lead-modal-header__content {
   flex: 1;
   min-width: 0;
}

.lead-modal-header__topline {
   display: flex;
   align-items: center;
   gap: 10px;
   margin-bottom: 8px;
}

.lead-modal-header__name {
   display: inline-flex;
   align-items: center;
   gap: 6px;
   margin: 0;
   font-size: 15px;
   font-weight: 700;
   line-height: 1.15;
   color: #111827;
   cursor: pointer;
}

.lead-modal-header__copy {
   display: inline-flex;
   align-items: center;
   justify-content: center;
   width: 22px;
   height: 22px;
   border: 1px solid #d7dde6;
   border-radius: 8px;
   color: #475569;
   background: #ffffff;
   transition: background-color 0.18s ease, border-color 0.18s ease;
}

.lead-modal-header__copy:hover {
   background: #f8fafc;
   border-color: #c9d2de;
}

.lead-modal-header__copy .material-icons-two-tone {
   font-size: 14px;
}

.lead-modal-header__phone {
   display: inline-flex;
   align-items: center;
   gap: 6px;
   margin: 0 0 10px;
   padding: 6px 10px;
   border: 1px solid #e5e7eb;
   border-radius: 999px;
   background: #f8fafc;
   font-size: 12px;
   font-weight: 700;
   color: #0f172a;
   cursor: pointer;
}

.lead-modal-header__grid {
   display: grid;
   grid-template-columns: repeat(3, minmax(0, 1fr));
   gap: 8px;
}

.lead-modal-header__item {
   min-width: 0;
   padding: 8px 10px;
   border: 1px solid #eef2f6;
   border-radius: 12px;
   background: #ffffff;
}

.lead-modal-header__label {
   display: block;
   margin-bottom: 3px;
   font-size: 9px;
   font-weight: 700;
   letter-spacing: 0.08em;
   text-transform: uppercase;
   color: #64748b;
}

.lead-modal-header__value {
   margin: 0;
   font-size: 12px;
   line-height: 1.35;
   color: #1f2937;
   white-space: nowrap;
   overflow: hidden;
   text-overflow: ellipsis;
}

.lead-modal-header .btn-close {
   margin: 2px 0 0;
   padding: 0.35rem;
   border-radius: 10px;
   opacity: 0.75;
}

@media (max-width: 767.98px) {
   .lead-modal-header {
      padding: 14px 16px 14px;
   }

   .lead-modal-header__grid {
      grid-template-columns: 1fr;
      gap: 6px;
   }

   .lead-modal-header__item {
      padding: 7px 9px;
   }

   .lead-modal-header__name {
      font-size: 14px;
   }
}
`;

const getDisplayValue = (value) => value || "N/A";

export const ModalHeader = ({
   leadData,
   handleClose,
   handleCopy,
   handleCopyPhone,
}) => (
   <div className="modal-header lead-modal-header">
      <style>{MODAL_HEADER_STYLES}</style>

      <div className="lead-modal-header__content">
         <div className="lead-modal-header__topline">
            <h4 className="lead-modal-header__name" onClick={handleCopy}>
               {leadData?.nombre_lead || "..."}
               <span className="lead-modal-header__copy" onClick={handleCopy}>
                  <i className="material-icons-two-tone">content_copy</i>
               </span>
            </h4>
         </div>

         <div className="lead-modal-header__phone" onClick={handleCopyPhone}>
            <span>Teléfono: {leadData?.telefono_lead || "..."}</span>
            <span className="lead-modal-header__copy" onClick={handleCopyPhone}>
               <i className="material-icons-two-tone">content_copy</i>
            </span>
         </div>

         <div className="lead-modal-header__grid">
            <div className="lead-modal-header__item">
               <span className="lead-modal-header__label">Proyecto</span>
               <p className="lead-modal-header__value">
                  {getDisplayValue(leadData?.proyecto_lead)}
               </p>
            </div>

            <div className="lead-modal-header__item">
               <span className="lead-modal-header__label">Campaña</span>
               <p className="lead-modal-header__value">
                  {getDisplayValue(leadData?.campana_lead)}
               </p>
            </div>

            <div className="lead-modal-header__item">
               <span className="lead-modal-header__label">Asesor</span>
               <p className="lead-modal-header__value">
                  {getDisplayValue(leadData?.name_admin)}
               </p>
            </div>
         </div>
      </div>

      <button
         type="button"
         className="btn-close"
         data-bs-dismiss="modal"
         aria-label="Close"
         onClick={handleClose}
      ></button>
   </div>
);
