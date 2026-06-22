import React from "react";

const ACTION_BUTTONS_STYLES = `
.lead-actions-panel {
   padding: 12px 14px 14px;
   border: 1px solid #e7ebf1;
   border-radius: 16px;
   background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
   box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.76);
}

.lead-actions-panel__header {
   margin-bottom: 10px;
   padding-bottom: 8px;
   border-bottom: 1px solid #edf1f5;
   text-align: center;
}

.lead-actions-panel__kicker {
   display: inline-block;
   margin-bottom: 2px;
   font-size: 9px;
   font-weight: 700;
   letter-spacing: 0.1em;
   text-transform: uppercase;
   color: #6b7280;
}

.lead-actions-panel__title {
   margin: 0 0 2px;
   font-size: 14px;
   font-weight: 700;
   line-height: 1.12;
   color: #111827;
}

.lead-actions-panel__copy {
   margin: 0;
   font-size: 11px;
   line-height: 1.35;
   color: #6b7280;
}

.lead-actions-panel__grid {
   display: flex;
   justify-content: center;
   flex-wrap: wrap;
   gap: 8px;
   padding: 0;
   margin: 0;
   list-style: none;
}

.lead-action-button {
   display: inline-flex !important;
   align-items: center;
   justify-content: center;
   gap: 7px;
   min-height: 38px;
   padding: 0 13px;
   margin: 0 !important;
   border: 1px solid var(--lead-action-color, #111827) !important;
   border-radius: 11px !important;
   background: var(--lead-action-color, #111827) !important;
   color: #ffffff !important;
   box-shadow: 0 8px 18px rgba(15, 23, 42, 0.1);
   font-size: 11px;
   font-weight: 700;
   letter-spacing: 0.01em;
   text-align: center;
   cursor: pointer;
   transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
}

.lead-action-button:hover {
   transform: translateY(-1px);
   box-shadow: 0 10px 20px rgba(15, 23, 42, 0.12);
   filter: brightness(0.98);
}

.lead-action-button i {
   font-size: 12px;
}

.lead-actions-panel__mobile {
   display: flex;
   justify-content: center;
}

.lead-actions-panel__mobile .btn-group {
   width: 100%;
   max-width: 320px;
}

.lead-actions-panel__toggle {
   display: inline-flex;
   align-items: center;
   justify-content: center;
   gap: 7px;
   min-height: 40px;
   border: 1px solid #d6dde7;
   border-radius: 11px;
   background: #ffffff;
   color: #111827;
   box-shadow: 0 8px 18px rgba(15, 23, 42, 0.07);
   font-size: 11px;
   font-weight: 700;
   letter-spacing: 0.02em;
}

.lead-actions-panel__menu {
   width: 100%;
   min-width: 0;
   margin-top: 8px !important;
   padding: 7px;
   border: 1px solid #e5e7eb;
   border-radius: 13px;
   box-shadow: 0 16px 30px rgba(15, 23, 42, 0.14);
}

.lead-action-dropdown-item {
   display: flex !important;
   align-items: center;
   gap: 9px;
   min-height: 38px;
   margin: 0 !important;
   border-radius: 9px;
   color: #111827;
   font-size: 11px;
   font-weight: 600;
   cursor: pointer;
}

.lead-action-dropdown-item + .lead-action-dropdown-item {
   margin-top: 3px !important;
}

.lead-action-dropdown-item i {
   width: 14px;
   text-align: center;
   color: var(--lead-action-color, #111827);
}

@media (max-width: 991.98px) {
   .lead-actions-panel {
      padding: 11px 12px 12px;
      border-radius: 14px;
   }

   .lead-actions-panel__title {
      font-size: 13px;
   }

   .lead-actions-panel__copy {
      font-size: 10px;
   }
}
`;

export const ActionButtons = ({ renderButtons }) => (
   <div className="lead-actions-panel">
      <style>{ACTION_BUTTONS_STYLES}</style>

      <div className="lead-actions-panel__header">
         <span className="lead-actions-panel__kicker">Acciones</span>
         <h4 className="lead-actions-panel__title">Gestión inmediata del lead</h4>
         <p className="lead-actions-panel__copy">
            Ejecute la siguiente acción comercial sin salir de esta vista.
         </p>
      </div>

      <div className="d-none d-lg-block">
         <ul className="lead-actions-panel__grid">{renderButtons()}</ul>
      </div>

      <div className="d-lg-none lead-actions-panel__mobile">
         <div className="btn-group" onClick={(event) => event.stopPropagation()}>
            <button
               type="button"
               className="btn dropdown-toggle lead-actions-panel__toggle"
               data-bs-toggle="dropdown"
               aria-expanded="false"
            >
               <i className="fas fa-bolt" aria-hidden="true" />
               Opciones del lead
            </button>

            <ul
               className="dropdown-menu dropdown-menu-end lead-actions-panel__menu"
               onClick={(event) => event.stopPropagation()}
            >
               {renderButtons(true)}
            </ul>
         </div>
      </div>
   </div>
);
