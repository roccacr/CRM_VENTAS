import { useState } from "react";
import { useLocation } from "react-router-dom";

import { formatDate } from "../../../hook/useFormatDate";
import { useLeadActions } from "../../../hooks/useLeadActions";
import { useModalLeads } from "../../../hooks/useModalLeads";
import { ActionButtons } from "./components/ActionButtons";
import { LeadOutlookCreateEventModal } from "./components/LeadOutlookCreateEventModal";
import { ModalHeader } from "./components/ModalHeader";
import { RecentActions } from "./components/RecentActions";
import { BUTTON_DATA } from "./constants";

export const ModalLeads = ({ leadData, onClose }) => {
   const { showModal, isMobile, showPreload, bitacora, setShowModal } =
      useModalLeads(leadData);
   const [isInlineCreateEventOpen, setIsInlineCreateEventOpen] = useState(false);
   const [selectedLeadForEvent, setSelectedLeadForEvent] = useState(null);
   const {
      handleWhatsappClick,
      handleNote,
      handleEvents,
      handleWhatsappAndNote,
      handleLoss,
      handfollow_up,
      crearOportunidad,
      handleOpportunityList,
      handleCallClient,
      PerfilUsuario,
      handleBck,
      handedit,
   } = useLeadActions();
   const location = useLocation();

   const filteredButtonData = BUTTON_DATA.filter((button) => {
      if (button.action === "handleWhatsappAndNote") {
         return (
            location.pathname === "/leads/lista" &&
            location.search === "?data=2"
         );
      }

      return true;
   });

   const handleClose = () => {
      setShowModal(false);
      setTimeout(() => onClose && onClose(), 100);
   };

   const handleOpenInlineCreateEvent = (currentLeadData) => {
      setSelectedLeadForEvent(currentLeadData);
      setShowModal(false);

      setTimeout(() => {
         setIsInlineCreateEventOpen(true);
      }, 120);
   };

   const handleCloseInlineCreateEvent = () => {
      setIsInlineCreateEventOpen(false);
      setSelectedLeadForEvent(null);
      onClose && onClose();
   };

   const handleCopy = () => {
      const leadName = leadData?.nombre_lead || "No cuenta con nombre de cliente";
      navigator.clipboard.writeText(leadName);
   };

   const handleCopyPhone = () => {
      const leadPhone = leadData?.telefono_lead || "No cuenta con telefono";
      navigator.clipboard.writeText(leadPhone);
   };

   const sortedBitacora = [...bitacora].sort(
      (a, b) =>
         new Date(b.fecha_creado_bit) - new Date(a.fecha_creado_bit)
   );

   const renderButtons = (forDropdown = false) =>
      filteredButtonData.map((button, index) => {
         const actionMap = {
            handleWhatsappClick: () =>
               handleWhatsappClick(leadData?.telefono_lead),
            handleNote: () => handleNote(leadData),
            handleEvents: () =>
               handleEvents(leadData, handleOpenInlineCreateEvent),
            handleWhatsappAndNote: () => handleWhatsappAndNote(leadData),
            handleLoss: () => handleLoss(leadData),
            handfollow_up: () => handfollow_up(leadData),
            crearOportunidad: () => crearOportunidad(leadData),
            handleOpportunityList: () => handleOpportunityList(leadData),
            handleCallClient: () => handleCallClient(leadData?.telefono_lead),
            PerfilUsuario: () => PerfilUsuario(leadData),
            handleBck: () => handleBck(),
            handedit: () => handedit(leadData),
         };

         return (
            <li
               key={index}
               className={
                  forDropdown
                     ? "dropdown-item lead-action-dropdown-item"
                     : "btn btn-shadow lead-action-button"
               }
               style={
                  forDropdown
                     ? { "--lead-action-color": button.color }
                     : {
                          backgroundColor: button.color,
                          color: "#fff",
                          borderColor: button.color,
                          marginBottom: "0px",
                          "--lead-action-color": button.color,
                       }
               }
               onClick={() => {
                  const action = actionMap[button.action];

                  if (action) {
                     action();
                  }
               }}
            >
               <i className={button.icon}></i>
               {button.text}
            </li>
         );
      });

   return (
      <>
         <div
            className={`modal fade bd-example-modal-lg ${showModal ? "show" : ""}`}
            tabIndex="-1"
            aria-labelledby="myLargeModalLabel"
            style={{ display: showModal ? "block" : "none" }}
            aria-modal="true"
            role="dialog"
            onClick={handleClose}
         >
            <div
               className="modal-dialog modal-lg"
               style={{
                  maxWidth: isMobile ? "98%" : "68%",
                  margin: "4.99rem auto",
                  maxHeight: "calc(100vh - 7rem)",
                  display: "flex",
                  flexDirection: "column",
               }}
               onClick={(event) => event.stopPropagation()}
            >
               <div className="modal-content">
                  <ModalHeader
                     leadData={leadData}
                     handleClose={handleClose}
                     handleCopy={handleCopy}
                     handleCopyPhone={handleCopyPhone}
                  />

                  <div className="modal-body">
                     <ActionButtons
                        buttonData={filteredButtonData}
                        renderButtons={renderButtons}
                     />
                  </div>

                  <RecentActions
                     showPreload={showPreload}
                     sortedBitacora={sortedBitacora}
                     formatDate={formatDate}
                  />
               </div>
            </div>
         </div>

         {isInlineCreateEventOpen && selectedLeadForEvent ? (
            <LeadOutlookCreateEventModal
               initialLead={selectedLeadForEvent}
               isOpen={isInlineCreateEventOpen}
               onClose={handleCloseInlineCreateEvent}
            />
         ) : null}
      </>
   );
};
