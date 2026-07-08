import { useEffect, useMemo, useRef, useState } from "react";
import $ from "jquery";
import "datatables.net";
import "datatables.net-bs5";
import "datatables.net-searchpanes-bs5";
import "datatables.net-select-bs5";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

import SticNotesContainer from "../../../../components/sticknotes/SticNotesContainer";
import { getSpecificLead } from "../../../../store/leads/thunksLeads";
import {
  AplicarComicion,
  bitacoraOrdenDeventa,
  bitacoraOrdenDeventaCierre,
  enviarCierreFirmando,
  enviarReservaCaida,
  enviarReservaN,
  modificarCierrreFirmandoThinks,
  modifcarOrdenVenta,
  obtenerOrdendeventa,
} from "../../../../store/ordenVenta/thunkOrdenVenta";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import {
  getDisplayText,
  PROFILE_PANEL_STYLES,
  PROFILE_THEME_STYLES,
  ProfileSection,
} from "../../leads/perfil/profileTheme";
import { ModalOrdenVenta } from "../../estimacion/ModalOrdenVenta";
import { OneDrive } from "./OneDrive";

const ORDER_VIEW_STYLES = `
  ${PROFILE_THEME_STYLES}

  .order-view-shell {
    display: grid;
    gap: 14px;
  }

  .order-view-notes {
    position: relative;
    z-index: 999;
    margin-bottom: 12px;
  }

  .order-view-hero-card,
  .order-view-sidebar-card,
  .order-view-main-card {
    border: 1px solid #d9dde3;
    border-radius: 18px;
    background: #ffffff;
    box-shadow: 0 14px 32px rgba(15, 23, 42, 0.06);
    overflow: hidden;
  }

  .order-view-hero-body {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 18px 20px;
  }

  .order-view-hero-kicker {
    display: inline-block;
    margin-bottom: 6px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #4b5563;
  }

  .order-view-hero-title {
    margin: 0 0 6px;
    font-size: 19px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: #111827;
  }

  .order-view-hero-copy {
    margin: 0;
    max-width: 620px;
    font-size: 11px;
    line-height: 1.5;
    color: #4b5563;
  }

  .order-view-hero-copy,
  .order-view-sidebar-copy,
  .lead-profile-section-copy,
  .lead-profile-page-copy,
  .order-view-summary-banner-copy,
  .order-view-table-head p {
    display: none;
  }

  .order-view-hero-figure {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 88px;
  }

  .order-view-hero-figure img {
    width: 72px;
    height: 72px;
    object-fit: contain;
    filter: drop-shadow(0 12px 20px rgba(15, 23, 42, 0.1));
  }

  .order-view-layout {
    display: grid;
    grid-template-columns: minmax(290px, 340px) minmax(0, 1fr);
    gap: 14px;
    align-items: start;
  }

  .order-view-sidebar-body {
    padding: 16px 16px 14px;
  }

  .order-view-sidebar-top {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding-bottom: 12px;
    border-bottom: 1px solid #eceff3;
  }

  .order-view-sidebar-avatar {
    width: 72px;
    height: 72px;
    border-radius: 20px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(180deg, #ffffff 0%, #f4f6f8 100%);
    border: 1px solid #e5e7eb;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  }

  .order-view-sidebar-avatar img {
    width: 48px;
    height: 48px;
    object-fit: contain;
  }

  .order-view-sidebar-title {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: #111827;
  }

  .order-view-sidebar-copy {
    margin: 0;
    font-size: 11px;
    line-height: 1.45;
    color: #6b7280;
  }

  .order-view-actions-card,
  .order-view-sidebar-panel {
    margin-top: 12px;
    padding: 12px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
  }

  .order-view-button-group {
    display: grid;
    gap: 7px;
    margin-top: 10px;
  }

  .order-view-button-group .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 38px;
    border-radius: 11px;
    font-size: 11px;
    font-weight: 700;
    box-shadow: none;
    transition: transform 160ms ease-out, box-shadow 160ms ease-out;
  }

  .order-view-button-group .btn:active {
    transform: scale(0.98);
  }

  .order-view-button-group .btn.btn-outline-dark {
    border-color: #d1d5db;
    color: #111827;
    background: #ffffff;
  }

  .order-view-button-group .btn.btn-outline-dark:hover {
    border-color: #111827;
    background: #f9fafb;
  }

  .order-view-button-group .btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .order-view-meta-grid {
    display: grid;
    gap: 8px;
    margin-top: 12px;
  }

  .order-view-meta-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 11px;
    background: #fbfbfc;
  }

  .order-view-meta-label {
    margin: 0;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #6b7280;
  }

  .order-view-meta-value {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: #111827;
    text-align: right;
  }

  .order-view-main-card .lead-profile-panel {
    padding: 16px;
  }

  .order-view-main-card .lead-profile-hero {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }

  .order-view-summary-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 12px;
    padding: 12px 14px;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
  }

  .order-view-summary-banner-label {
    display: inline-block;
    margin-bottom: 4px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6b7280;
  }

  .order-view-summary-banner-title {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: #111827;
  }

  .order-view-summary-banner-copy {
    margin: 0;
    font-size: 11px;
    line-height: 1.45;
    color: #4b5563;
  }

  .order-view-metric-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }

  .order-view-metric-card {
    min-height: 100%;
    padding: 14px 16px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
  }

  .order-view-metric-label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 8px;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #6b7280;
  }

  .order-view-metric-value {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.35;
    color: #111827;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .order-view-table-shell {
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: #ffffff;
    overflow: hidden;
  }

  .order-view-table-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid #eceff3;
    background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
  }

  .order-view-table-head h5 {
    margin: 0 0 4px;
    font-size: 13px;
    font-weight: 700;
    color: #111827;
  }

  .order-view-table-head p {
    margin: 0;
    font-size: 11px;
    line-height: 1.45;
    color: #6b7280;
  }

  .order-view-shell .dataTables_wrapper {
    padding: 14px 16px 16px;
  }

  .order-view-shell table.dataTable {
    margin-top: 0 !important;
    border-collapse: separate !important;
    border-spacing: 0;
  }

  .order-view-shell table.dataTable thead th {
    padding: 10px 12px !important;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #6b7280;
    background: #f8fafc;
    border-bottom: 1px solid #e5e7eb !important;
  }

  .order-view-shell table.dataTable tbody td {
    padding: 10px 12px !important;
    font-size: 11px;
    color: #111827;
    vertical-align: middle;
    border-top: 1px solid #eef2f7 !important;
  }

  .order-view-shell .dataTables_wrapper .dataTables_filter input,
  .order-view-shell .dataTables_wrapper .dataTables_length select {
    min-height: 34px;
    border: 1px solid #d1d5db;
    border-radius: 9px;
    box-shadow: none;
  }

  .order-view-shell .dataTables_wrapper .dataTables_paginate .paginate_button {
    border-radius: 10px !important;
  }

  .order-view-progress-shell {
    display: grid;
    gap: 12px;
  }

  .order-view-progress-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
  }

  .order-view-progress-head h6 {
    margin: 0 0 4px;
    font-size: 13px;
    font-weight: 700;
    color: #111827;
  }

  .order-view-progress-head p {
    margin: 0;
    font-size: 11px;
    color: #6b7280;
  }

  .order-view-progress-pill {
    min-width: 78px;
    padding: 8px 10px;
    border: 1px solid #dbe2ea;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    text-align: center;
    color: #111827;
    background: #ffffff;
  }

  .order-view-progress-grid {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    overflow-x: auto;
    padding: 4px 2px 6px;
  }

  .order-view-progress-card {
    position: relative;
    flex: 1 1 0;
    min-width: 145px;
    padding: 0 6px;
    border: none;
    background: transparent;
    overflow: visible;
    text-align: center;
  }

  .order-view-progress-card::before {
    display: none;
  }

  .order-view-progress-card.is-loading {
    animation: order-view-pulse 1.4s ease-in-out infinite;
  }

  .order-view-progress-card.is-complete {
    border-color: transparent;
  }

  .order-view-progress-card.is-active {
    box-shadow: none;
  }

  .order-view-progress-node {
    position: relative;
    z-index: 2;
    width: 46px;
    height: 46px;
    margin: 0 auto 10px;
    border-radius: 999px;
    border: 3px solid var(--progress-color, #d1d5db);
    background: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    color: #111827;
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
  }

  .order-view-progress-card:not(:last-child)::after {
    content: "";
    position: absolute;
    top: 22px;
    left: calc(50% + 26px);
    width: calc(100% - 52px);
    height: 3px;
    border-radius: 999px;
    background: var(--connector-color, #e5e7eb);
    z-index: 1;
  }

  .order-view-progress-label {
    margin: 0 0 4px;
    font-size: 10.5px;
    font-weight: 700;
    color: #111827;
    line-height: 1.35;
  }

  .order-view-progress-percentage {
    margin: 0 0 5px;
    font-size: 12px;
    font-weight: 700;
    color: #374151;
  }

  .order-view-progress-requirement {
    margin: 0;
    font-size: 10px;
    line-height: 1.45;
    color: #6b7280;
  }

  .order-view-approval-grid {
    display: grid;
    gap: 10px;
  }

  .order-view-approval-card {
    padding: 12px 14px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
  }

  .order-view-approval-card h6 {
    margin: 0 0 10px;
    font-size: 12px;
    font-weight: 700;
    color: #111827;
  }

  .order-view-approval-list {
    display: grid;
    gap: 8px;
  }

  .order-view-approval-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 10px;
    background: #ffffff;
    border: 1px solid #edf1f5;
  }

  .order-view-approval-item span {
    font-size: 10.5px;
    line-height: 1.4;
    color: #374151;
  }

  .order-view-approval-badge {
    min-width: 68px;
    padding: 5px 8px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    text-align: center;
    border: 1px solid #d1d5db;
    background: #f8fafc;
    color: #6b7280;
  }

  .order-view-approval-badge.is-yes {
    border-color: #cdd7df;
    background: #eef3f7;
    color: #111827;
  }

  .order-view-onedrive-shell > * {
    width: 100%;
  }

  @keyframes order-view-pulse {
    0% {
      opacity: 0.55;
    }
    50% {
      opacity: 0.85;
    }
    100% {
      opacity: 0.55;
    }
  }

  @media (max-width: 1199px) {
    .order-view-layout {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 767px) {
    .order-view-hero-body,
    .order-view-summary-banner,
    .order-view-table-head,
    .order-view-progress-head {
      flex-direction: column;
      align-items: flex-start;
    }

    .order-view-main-card .lead-profile-panel {
      padding: 12px;
    }

    .order-view-shell .dataTables_wrapper {
      padding: 12px;
    }

    .order-view-progress-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      overflow: visible;
      gap: 12px;
    }

    .order-view-progress-card {
      min-width: 0;
      padding: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
    }

    .order-view-progress-card:not(:last-child)::after {
      display: none;
    }
  }
`;

const formatoMoneda = (valor) => {
  if (!valor || Number.isNaN(Number(valor)) || Number(valor) === 0) {
    return 0;
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 5,
  }).format(valor);
};

const getQueryParam = (param) => {
  const value = new URLSearchParams(window.location.search).get(param);
  return value && !Number.isNaN(Number(value)) ? Number(value) : value;
};

const normalizeText = (value) => getDisplayText(String(value ?? "").replace(/"/g, ""));

const showLoadingIndicator = () => {
  Swal.fire({
    title: "Cargando datos...",
    text: "Por favor espera.",
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: () => Swal.showLoading(),
  });
};

const fetchData = async ({
  leadId,
  transaccion,
  dispatch,
  setLeadDetails,
  setDatosOrdenVenta,
  setValidarOrdenVenta,
}) => {
  try {
    const [leadData, ordenData] = await Promise.all([
      dispatch(getSpecificLead(leadId)),
      dispatch(obtenerOrdendeventa(transaccion)),
    ]);

    setLeadDetails(leadData);

    if (ordenData?.data?.Detalle) {
      setDatosOrdenVenta(ordenData.data.Detalle);
    }

    if (ordenData?.data?.validarOrdenVenta?.data?.[0]) {
      setValidarOrdenVenta(ordenData.data.validarOrdenVenta.data[0]);
    }
  } catch (error) {
    console.error("Error fetching data:", error);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Error al cargar los datos. Por favor, intente nuevamente.",
    });
  }
};

const TABLE_CONFIG = {
  responsive: true,
  language: {
    decimal: "",
    emptyTable: "No hay información disponible",
    info: "Mostrando _START_ a _END_ de _TOTAL_ registros",
    infoEmpty: "Mostrando 0 a 0 de 0 registros",
    infoFiltered: "(filtrado de _MAX_ registros totales)",
    infoPostFix: "",
    thousands: ",",
    lengthMenu: "Mostrar _MENU_ registros",
    loadingRecords: "Cargando...",
    processing: "Procesando...",
    search: "Buscar:",
    zeroRecords: "No se encontraron registros coincidentes",
    paginate: {
      first: "Primero",
      last: "Último",
      next: "Siguiente",
      previous: "Anterior",
    },
    aria: {
      sortAscending: ": activar para ordenar la columna ascendente",
      sortDescending: ": activar para ordenar la columna descendente",
    },
  },
  columns: [
    { data: "numero", title: "#" },
    { data: "articulo", title: "Artículo" },
    { data: "monto", title: "Monto" },
    { data: "fechaPago", title: "Fecha de pago proyectado" },
    { data: "cantidad", title: "Cantidad" },
    { data: "descripcion", title: "Descripción" },
  ],
};

const handleCommissionAction = async (dispatch, orderId) => {
  const result = await Swal.fire({
    title: "Gestión de Comisión",
    text: "¿Qué acción desea realizar con la comisión?",
    icon: "question",
    showDenyButton: true,
    showCancelButton: true,
    confirmButtonText: "Aplicar Comisión",
    denyButtonText: "Anular Comisión",
    cancelButtonText: "Cancelar",
  });

  if (result.isConfirmed) {
    await dispatch(AplicarComicion(1, orderId));
    Swal.fire("¡Aplicada!", "La comisión ha sido aplicada.", "success");
  } else if (result.isDenied) {
    await dispatch(AplicarComicion(0, orderId));
    Swal.fire("¡Anulada!", "La comisión ha sido anulada.", "info");
  }
};

const processTableData = (datosOrdenVenta) => {
  if (!datosOrdenVenta?.data?.sublists?.item) {
    return [];
  }

  return Object.entries(datosOrdenVenta.data.sublists.item)
    .filter(([key]) => key !== "currentline")
    .map(([, linea], index) => ({
      numero: index + 1,
      articulo: linea.item_display || linea.item || "N/A",
      monto: formatoMoneda(linea.amount || 0),
      fechaPago: linea.custcolfecha_pago_proyectado || "No aplica",
      cantidad: getDisplayText(linea.quantity),
      descripcion: getDisplayText(linea.description),
    }));
};

const useSalesOrderActions = ({
  navigate,
  dispatch,
  datosOrdenVenta,
  setIsModalOpen,
  email_admin,
  validarOrdenVenta,
}) => ({
  actions: {
    EnviarReserva: async () => {
      const idTrannsaccion = getQueryParam("data");
      const idTrannsaccion2 = getQueryParam("data2");
      const fechaPrereserva = datosOrdenVenta?.data?.fields?.custbody208;

      const result = await Swal.fire({
        title: "¿Está seguro?",
        text: "¿Desea enviar la reserva?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Sí, enviar",
      });

      if (!result.isConfirmed) {
        return;
      }

      showLoadingIndicator();
      const response = await dispatch(enviarReservaN(idTrannsaccion2));
      const detalle = response?.data?.Detalle;

      if (detalle?.status === 200) {
        await dispatch(bitacoraOrdenDeventa(idTrannsaccion));
        await dispatch(modifcarOrdenVenta(idTrannsaccion2, fechaPrereserva));
        Swal.fire("¡Enviado!", "La reserva ha sido enviada.", "success").then(() => {
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        });
      } else {
        Swal.fire("¡Error!", "La reserva no ha sido enviada.", "error");
      }

      setTimeout(() => {
        Swal.close();
      }, 2000);
    },

    EnviarCierre: async () => {
      const idTrannsaccion = getQueryParam("data2");
      const idTrannsaccion2 = getQueryParam("data");

      const result = await Swal.fire({
        title: "¿Está seguro?",
        text: "¿Desea enviar el correo de CIERRE FIRMADO?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Sí, enviar",
      });

      if (!result.isConfirmed) {
        return;
      }

      showLoadingIndicator();
      await dispatch(enviarCierreFirmando(idTrannsaccion));
      await dispatch(modificarCierrreFirmandoThinks(idTrannsaccion));
      await dispatch(bitacoraOrdenDeventaCierre(idTrannsaccion2));

      Swal.fire("¡Enviado!", "El cierre firmado ha sido enviado.", "success").then(() => {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      });
    },

    EnviarReservaCaida: async () => {
      const expCorreo = datosOrdenVenta?.Expediente;
      const idTrannsaccion = getQueryParam("data2");

      const result = await Swal.fire({
        title: "¿Está seguro?",
        text: "¿Desea enviar el correo de RESERVA CAÍDA?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Sí, enviar",
      });

      if (!result.isConfirmed) {
        return;
      }

      const { value: formValues } = await Swal.fire({
        width: "900px",
        title: `Reserva Caída: ${expCorreo}`,
        html:
          '<label for="swal-textarea">Comentario de caída</label>' +
          '<textarea id="swal-textarea" class="swal2-textarea" style="width: 100%; padding: 10px; box-sizing: border-box;"></textarea>',
        focusConfirm: false,
        preConfirm: () => document.getElementById("swal-textarea").value,
      });

      Swal.close();

      if (!formValues) {
        return;
      }

      showLoadingIndicator();
      Swal.close();

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile) {
        const respuesta = window.confirm(
          "No se puede enviar la reserva caída desde un dispositivo móvil. Solo se puede enviar desde una computadora.\nPresiona 'Aceptar' para recordarlo más tarde.",
        );

        if (!respuesta) {
          window.alert("Recuerda enviar el correo más tarde.");
        }
      } else {
        const destinatario = "Formalizacion@roccacr.com";
        const copia = email_admin;
        const asunto = `Reserva Caida: ${expCorreo}`;
        const mensajeCorreo = `Buen día compañeras,\n\nEspero que se encuentren bien. Les comento que la siguiente venta, ${expCorreo} ha sido cancelada debido a ${formValues}.\n\nSaludos cordiales,`;
        const mailtoLink = `mailto:${destinatario}?cc=${copia}&subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensajeCorreo)}`;
        window.location.href = mailtoLink;
      }

      const confirmacion = window.confirm(
        "¿Has enviado el correo?\n\nHaz clic en 'Aceptar' si lo enviaste o en 'Cancelar' si aún no lo has enviado.",
      );

      if (confirmacion) {
        window.alert(`Correo enviado y reserva caída con éxito. ${expCorreo}`);
        dispatch(enviarReservaCaida(idTrannsaccion));
        Swal.fire("¡Enviado!", "La reserva caída ha sido enviada.", "success").then(() => {
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        });
      } else {
        window.alert(`Recuerda enviar el correo más tarde. ${expCorreo}`);
      }

      setTimeout(() => {
        Swal.close();
      }, 2000);
    },

    verPdf: () => {
      const goURL = `https://4552704.app.netsuite.com/app/accounting/print/hotprint.nl?regular=T&sethotprinter=T&formnumber=136&trantype=salesord&&id=${getQueryParam("data2")}&label=Orden+de+venta&printtype=transaction`;
      window.open(goURL, "PopupWindow", "width=900,height=800,scrollbars=yes");
    },

    verOportunidad: () => {
      navigate(
        `/oportunidad/ver?data=${getQueryParam("data")}&data2=${datosOrdenVenta?.data?.fields?.opportunity}&whence=`,
      );
    },

    verEstimacion: () => {
      navigate(
        `/estimaciones/view?data=${getQueryParam("data")}&data2=${datosOrdenVenta?.data?.fields?.createdfrom}&whence=`,
      );
    },

    editarOV: () => {
      setIsModalOpen(true);
    },

    aplicarComision: () => {
      handleCommissionAction(dispatch, getQueryParam("data2"));
    },
  },

  configs: {
    primary: [
      { icon: "ti-pencil", text: "Editar OV", action: "editarOV", variant: "dark" },
      { icon: "ti-eye", text: "Ver estimación", action: "verEstimacion", variant: "outline-dark" },
      { icon: "ti-eye", text: "Ver oportunidad", action: "verOportunidad", variant: "outline-dark" },
      { icon: "ti-file-type-pdf", text: "PDF OV", action: "verPdf", variant: "outline-dark" },
    ],
    secondary: [
      {
        icon: "ti-flag-3",
        text: "Enviar reserva",
        action: "EnviarReserva",
        variant: "dark",
        disabled:
          validarOrdenVenta?.reserva_ov === 1 ||
          !datosOrdenVenta?.data?.fields?.custbody207 ||
          !datosOrdenVenta?.data?.fields?.custbody189 ||
          !datosOrdenVenta?.data?.fields?.custbody208 ||
          !datosOrdenVenta?.data?.fields?.custbody190 ||
          !datosOrdenVenta?.data?.fields?.custbody188,
      },
      {
        icon: "ti-send",
        text: "Cierre firmado",
        action: "EnviarCierre",
        variant: "outline-dark",
        disabled: validarOrdenVenta?.reserva_ov !== 1,
      },
      {
        icon: "ti-trending-down",
        text: "Reserva caída",
        action: "EnviarReservaCaida",
        variant: "outline-dark",
        disabled: validarOrdenVenta?.caida_ov === 1,
      },
      {
        icon: "ti-brand-paypal",
        text: "Aplicar comisión",
        action: "aplicarComision",
        variant: "outline-dark",
        disabled: true,
      },
    ],
  },
});

const APPROVAL_GROUPS = [
  {
    title: "Aprobaciones de estado",
    items: [
      { label: "Contrato firmado", field: "custbody90" },
      { label: "Cierre firmado", field: "custbody51" },
      { label: "Unidad entregada", field: "custbody91" },
      { label: "Unidad traspasada", field: "custbody105" },
      { label: "Venta caída", field: "custbody43" },
      { label: "Comisión aprobada", field: "custbody103" },
      { label: "Comisión cancelada", field: "custbody_ix_comision_pagada" },
    ],
  },
  {
    title: "Aprobaciones de pago",
    items: [
      { label: "No paga traspaso S.A", field: "custbody141" },
      { label: "No paga cesión de acciones", field: "custbody157" },
    ],
  },
  {
    title: "Aprobaciones comerciales",
    items: [
      { label: "Aprobación jefe de ventas", field: "custbody_aprueba_jefe_ventas" },
      { label: "Aprobación formalización", field: "custbodyid_firma_rc" },
      { label: "Aprobación RDR", field: "custbodyid_firma_rocca" },
      { label: "Cálculo comisión asesor", field: "custbody74" },
      { label: "Cálculo comisión corredor", field: "custbody73" },
    ],
  },
];

const loadingSteps = [
  { label: "OV creada", percentage: 10, color: "#d1d5db", requirement: "OV creada" },
  { label: "OV con reserva", percentage: 20, color: "#d1d5db", requirement: "Reserva aplicada" },
  { label: "OV con cierre firmado", percentage: 30, color: "#d1d5db", requirement: "Cierre firmado" },
  { label: "Aprobación jefe ventas", percentage: 50, color: "#d1d5db", requirement: "Aprobación jefatura" },
  { label: "Aprobación RDR", percentage: 70, color: "#d1d5db", requirement: "Aprobación RDR" },
  { label: "Aprobación formalizaciones", percentage: 80, color: "#d1d5db", requirement: "Aprobación formalización" },
  { label: "Contrato firmado", percentage: 100, color: "#d1d5db", requirement: "Contrato firmado" },
];

const calculateProgress = (validarOrdenVenta) => {
  if (!validarOrdenVenta) {
    return {
      percentage: 10,
      activeStep: 0,
      steps: loadingSteps.map((step, index) => ({
        ...step,
        completed: index === 0,
      })),
    };
  }

  const steps = [
    {
      label: "OV creada",
      percentage: 10,
      completed: true,
      color: "#4caf50",
      requirement: "OV creada",
    },
    {
      label: "OV con reserva",
      percentage: 20,
      completed: validarOrdenVenta.reserva_ov === 1,
      color: "#2196f3",
      requirement: "Reserva registrada",
    },
    {
      label: "OV con cierre firmado",
      percentage: 30,
      completed: validarOrdenVenta.cierre_firmado_ov === 1,
      color: "#ff9800",
      requirement: "Cierre firmado completado",
    },
    {
      label: "Aprobación jefe ventas",
      percentage: 50,
      completed: validarOrdenVenta.chekJefeVenta === 1,
      color: "#9c27b0",
      requirement: "Aprobación del jefe de ventas",
    },
    {
      label: "Aprobación RDR",
      percentage: 70,
      completed: validarOrdenVenta.aprobacion__rdr_ov === 1,
      color: "#f44336",
      requirement: "Aprobación RDR confirmada",
    },
    {
      label: "Aprobación formalizaciones",
      percentage: 80,
      completed: validarOrdenVenta.aprobacion_forma_ov === 1,
      color: "#00bcd4",
      requirement: "Aprobación de formalizaciones",
    },
    {
      label: "Contrato firmado",
      percentage: 100,
      completed: validarOrdenVenta.contrado_frima_ov === 1,
      color: "#4caf50",
      requirement: "Contrato firmado completado",
    },
  ];

  let percentage = 10;
  let activeStep = 0;

  for (let i = 0; i < steps.length; i += 1) {
    const allCompleted = steps.slice(0, i + 1).every((step) => step.completed);

    if (!allCompleted) {
      break;
    }

    percentage = steps[i].percentage;
    activeStep = i;
  }

  return { percentage, activeStep, steps };
};

const MetricCards = ({ items }) =>
  items.map((item) => (
    <article className="order-view-metric-card" key={item.label}>
      <p className="order-view-metric-label">
        <i className={item.icon}></i>
        <span>{item.label}</span>
      </p>
      <p className="order-view-metric-value">{item.value}</p>
    </article>
  ));

const ApprovalCardGroup = ({ title, approvals }) => (
  <article className="order-view-approval-card">
    <h6>{title}</h6>
    <div className="order-view-approval-list">
      {approvals.map((item) => (
        <div className="order-view-approval-item" key={item.label}>
          <span>{item.label}</span>
          <span className={`order-view-approval-badge ${item.checked ? "is-yes" : ""}`}>
            {item.checked ? "Sí" : "No"}
          </span>
        </div>
      ))}
    </div>
  </article>
);

const OrderProgress = ({ validarOrdenVenta, isLoading = false }) => {
  const [loadingStep, setLoadingStep] = useState(0);
  const animationRef = useRef(null);

  useEffect(() => {
    if (!isLoading) {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
      return undefined;
    }

    setLoadingStep(0);
    let currentStep = 0;

    const animate = () => {
      if (currentStep < loadingSteps.length) {
        setLoadingStep(currentStep);
        currentStep += 1;
        animationRef.current = setTimeout(animate, 400);
      }
    };

    animate();

    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [isLoading]);

  const progressData = isLoading
    ? {
        percentage: loadingSteps[loadingStep]?.percentage || 10,
        activeStep: loadingStep,
        steps: loadingSteps.map((step, index) => ({
          ...step,
          completed: index <= loadingStep,
        })),
      }
    : calculateProgress(validarOrdenVenta);

  return (
    <div className="order-view-progress-shell">
      <div className="order-view-progress-head">
        <div className="order-view-progress-pill">{progressData.percentage}%</div>
      </div>

      <div className="order-view-progress-grid">
        {progressData.steps.map((step, index) => {
          const nextStep = progressData.steps[index + 1];
          const connectorColor =
            step.completed && nextStep?.completed ? nextStep.color : "#e5e7eb";

          return (
            <article
              className={[
                "order-view-progress-card",
                step.completed ? "is-complete" : "",
                index === progressData.activeStep ? "is-active" : "",
                isLoading ? "is-loading" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={step.label}
              style={{
                "--progress-color": step.color,
                "--connector-color": connectorColor,
              }}
            >
              <div className="order-view-progress-node">
                {step.completed ? (
                  <i className="ti ti-check"></i>
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <p className="order-view-progress-label">{step.label}</p>
              <p className="order-view-progress-percentage">{step.percentage}%</p>
              <p className="order-view-progress-requirement">{step.requirement}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export const VistaOrdenVenta = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [leadDetails, setLeadDetails] = useState({});
  const [datosOrdenVenta, setDatosOrdenVenta] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [validarOrdenVenta, setValidarOrdenVenta] = useState({});

  const { email_admin } = useSelector((state) => state.auth);
  const leadId = getQueryParam("data");
  const transaccion = getQueryParam("data2");

  const { actions, configs } = useSalesOrderActions({
    navigate,
    dispatch,
    datosOrdenVenta,
    setIsModalOpen,
    email_admin,
    validarOrdenVenta,
  });

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      setLeadDetails({});
      setDatosOrdenVenta({});
      setValidarOrdenVenta({});
      showLoadingIndicator();

      if (leadId && leadId > 0) {
        await fetchData({
          leadId,
          transaccion,
          dispatch,
          setLeadDetails,
          setDatosOrdenVenta,
          setValidarOrdenVenta,
        });
      }

      Swal.close();

      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    };

    loadInitialData();
  }, [dispatch, leadId, transaccion, location.search]);

  useEffect(() => {
    if (!datosOrdenVenta?.data?.sublists?.item) {
      return undefined;
    }

    if ($.fn.DataTable.isDataTable("#condicionesPrimaTable")) {
      $("#condicionesPrimaTable").DataTable().destroy();
      $("#condicionesPrimaTable").empty();
    }

    const table = $("#condicionesPrimaTable").DataTable({
      ...TABLE_CONFIG,
      data: processTableData(datosOrdenVenta),
    });

    return () => {
      table.destroy();
    };
  }, [datosOrdenVenta]);

  const fields = datosOrdenVenta?.data?.fields || {};

  const sidebarSummary = useMemo(
    () => [
      {
        label: "Cliente relacionado",
        value: normalizeText(datosOrdenVenta?.cli),
      },
      {
        label: "Expediente ligado",
        value: normalizeText(datosOrdenVenta?.Expediente),
      },
      {
        label: "Oportunidad",
        value: normalizeText(datosOrdenVenta?.Oportunidad),
      },
      {
        label: "Reserva enviada",
        value: validarOrdenVenta?.reserva_ov === 1 ? "Sí" : "No",
      },
      {
        label: "Cierre firmado",
        value: validarOrdenVenta?.cierre_firmado_ov === 1 ? "Sí" : "No",
      },
    ],
    [
      datosOrdenVenta?.Expediente,
      datosOrdenVenta?.Oportunidad,
      datosOrdenVenta?.cli,
      validarOrdenVenta?.cierre_firmado_ov,
      validarOrdenVenta?.reserva_ov,
    ],
  );

  const resumenPrincipal = useMemo(
    () => [
      {
        label: "N.º de pedido",
        value: getDisplayText(fields?.tranid),
        icon: "fas fa-file-invoice",
      },
      {
        label: "Fecha",
        value: getDisplayText(fields?.trandate),
        icon: "fas fa-calendar-day",
      },
      {
        label: "Nota",
        value: getDisplayText(fields?.memo),
        icon: "fas fa-note-sticky",
      },
      {
        label: "Cliente",
        value: normalizeText(datosOrdenVenta?.cli),
        icon: "fas fa-user",
      },
      {
        label: "Unidad expediente ligado",
        value: normalizeText(datosOrdenVenta?.Expediente),
        icon: "fas fa-archway",
      },
      {
        label: "Oportunidad",
        value: normalizeText(datosOrdenVenta?.Oportunidad),
        icon: "fas fa-chevron-circle-up",
      },
    ],
    [
      datosOrdenVenta?.Expediente,
      datosOrdenVenta?.Oportunidad,
      datosOrdenVenta?.cli,
      fields?.memo,
      fields?.trandate,
      fields?.tranid,
    ],
  );

  const ventaMetrics = useMemo(
    () => [
      {
        label: "Precio de venta",
        value: formatoMoneda(fields?.custbody_ix_total_amount),
        icon: "fas fa-money-bill-wave",
      },
      {
        label: "Entrega estimada",
        value: getDisplayText(fields?.custbody114),
        icon: "fas fa-calendar-check",
      },
      {
        label: "Método de pago",
        value: normalizeText(datosOrdenVenta?.METODO_PAGO),
        icon: "fas fa-credit-card",
      },
      {
        label: "Fondos de compra",
        value: normalizeText(datosOrdenVenta?.FONDOS),
        icon: "fas fa-wallet",
      },
      {
        label: "Fecha vigencia de venta",
        value: getDisplayText(fields?.saleseffectivedate),
        icon: "fas fa-calendar-plus",
      },
      {
        label: "Campaña de marketing",
        value: normalizeText(datosOrdenVenta?.CAMPANA),
        icon: "fas fa-bullhorn",
      },
      {
        label: "Creado",
        value: getDisplayText(fields?.createddate),
        icon: "fas fa-clock-rotate-left",
      },
      {
        label: "Clase",
        value: normalizeText(datosOrdenVenta?.Clase),
        icon: "fas fa-layer-group",
      },
      {
        label: "Departamento",
        value: normalizeText(datosOrdenVenta?.Departamento),
        icon: "fas fa-building",
      },
      {
        label: "Motivo compra",
        value: normalizeText(datosOrdenVenta?.MOTIVO_COMPRA),
        icon: "fas fa-lightbulb",
      },
      {
        label: "Motivo cancelación",
        value: normalizeText(datosOrdenVenta?.MOTIVO_CANCE),
        icon: "fas fa-ban",
      },
      {
        label: "Comentario cancelación reserva",
        value: getDisplayText(fields?.custbody116),
        icon: "fas fa-comment-dots",
      },
      {
        label: "Subsidiaria",
        value: normalizeText(datosOrdenVenta?.Subsidaria),
        icon: "fas fa-city",
      },
      {
        label: "Ubicación",
        value: normalizeText(datosOrdenVenta?.Ubi),
        icon: "fas fa-location-dot",
      },
      {
        label: "Representante de ventas",
        value: normalizeText(datosOrdenVenta?.vendedor),
        icon: "fas fa-user-tie",
      },
      {
        label: "Socio",
        value: normalizeText(datosOrdenVenta?.socio),
        icon: "fas fa-handshake",
      },
    ],
    [datosOrdenVenta, fields],
  );

  const autorizacionMetrics = useMemo(
    () => [
      {
        label: "Precio de lista",
        value: formatoMoneda(fields?.custbody13),
        icon: "fas fa-money-check-dollar",
      },
      {
        label: "Monto descuento directo",
        value: formatoMoneda(fields?.custbody132),
        icon: "fas fa-tags",
      },
      {
        label: "Monto extras sobre precio lista",
        value: formatoMoneda(fields?.custbody46),
        icon: "fas fa-square-plus",
      },
      {
        label: "Descripción de extras",
        value: getDisplayText(fields?.custbody47),
        icon: "fas fa-list-ul",
      },
      {
        label: "Monto total de cortesías",
        value: formatoMoneda(fields?.custbody16),
        icon: "fas fa-gift",
      },
      {
        label: "Descripción de cortesías",
        value: getDisplayText(fields?.custbody35),
        icon: "fas fa-receipt",
      },
      {
        label: "Prima total",
        value: formatoMoneda(fields?.custbody39),
        icon: "fas fa-sack-dollar",
      },
      {
        label: "Monto reserva",
        value: formatoMoneda(fields?.custbody52),
        icon: "fas fa-piggy-bank",
      },
      {
        label: "Cashback",
        value: formatoMoneda(fields?.custbodyix_salesorder_cashback),
        icon: "fas fa-money-bill-transfer",
      },
      {
        label: "% comisión corredor",
        value: getDisplayText(fields?.custbody14),
        icon: "fas fa-percent",
      },
      {
        label: "Precio de venta neto",
        value: formatoMoneda(fields?.custbody17),
        icon: "fas fa-file-invoice-dollar",
      },
      {
        label: "Precio de venta mínimo",
        value: formatoMoneda(fields?.custbody18),
        icon: "fas fa-arrow-down-short-wide",
      },
      {
        label: "Comisión asesor %",
        value: getDisplayText(fields?.custbody20),
        icon: "fas fa-user-check",
      },
      {
        label: "Monto comisión asesor",
        value: formatoMoneda(fields?.custbody21),
        icon: "fas fa-coins",
      },
      {
        label: "Precio cálculo comisión corredor",
        value: formatoMoneda(fields?.custbody22),
        icon: "fas fa-calculator",
      },
      {
        label: "Monto comisión segundo asesor",
        value: formatoMoneda(fields?.custbody71),
        icon: "fas fa-users",
      },
      {
        label: "Monto comisión corredor",
        value: formatoMoneda(fields?.custbody15),
        icon: "fas fa-money-check",
      },
      {
        label: "Diferencia PVN y PVM",
        value: getDisplayText(fields?.custbody19),
        icon: "fas fa-scale-balanced",
      },
    ],
    [fields],
  );

  const reservaMetrics = useMemo(
    () => [
      {
        label: "Medio de pago",
        value: normalizeText(datosOrdenVenta?.METODO_PAGO),
        icon: "fas fa-credit-card",
      },
      {
        label: "Número de transacción",
        value: getDisplayText(fields?.custbody189),
        icon: "fas fa-hashtag",
      },
      {
        label: "Monto reserva aplicada",
        value: formatoMoneda(fields?.custbody207),
        icon: "fas fa-piggy-bank",
      },
      {
        label: "Fecha reserva aplicada",
        value: getDisplayText(fields?.custbody208),
        icon: "fas fa-calendar-check",
      },
      {
        label: "Monto pre-reserva",
        value: formatoMoneda(fields?.custbody191),
        icon: "fas fa-hourglass-half",
      },
      {
        label: "Fecha pre-reserva",
        value: getDisplayText(fields?.custbody206),
        icon: "fas fa-calendar-day",
      },
      {
        label: "Observaciones confirma reserva",
        value: getDisplayText(fields?.custbody190),
        icon: "fas fa-comment",
      },
    ],
    [datosOrdenVenta?.METODO_PAGO, fields],
  );

  const mezzanineMetrics = useMemo(() => {
    const mezzanineEnabled = fields?.custbody_mezzanine_verifica === "T";

    return [
      {
        label: "Mezzanine",
        value: mezzanineEnabled ? "Sí" : "No",
        icon: "fas fa-ruler-combined",
      },
      {
        label: "Área del mezzanine m²",
        value: getDisplayText(fields?.custbody_mezzanine_area || "No aplica"),
        icon: "fas fa-expand",
      },
      {
        label: "Monto del mezzanine",
        value: mezzanineEnabled
          ? formatoMoneda(fields?.custbody_mezzanine_monto) || "No aplica"
          : "No aplica",
        icon: "fas fa-money-bill-trend-up",
      },
    ];
  }, [fields]);

  const approvalGroups = useMemo(
    () =>
      APPROVAL_GROUPS.map((group) => ({
        title: group.title,
        approvals: group.items.map((item) => ({
          label: item.label,
          checked: fields?.[item.field] === "T",
        })),
      })),
    [fields],
  );

  return (
    <>
      <style>{ORDER_VIEW_STYLES}</style>

      <div className="order-view-notes">
        <SticNotesContainer
          idinternoLead={leadDetails?.idinterno_lead}
          transactionType="ordersale"
          transactionId={transaccion}
          sourceUrl={window.location.href}
        />
      </div>

      <div className="order-view-shell">
        <section className="order-view-hero-card">
          <div className="order-view-hero-body">
            <div>
              <span className="order-view-hero-kicker">Gestión comercial</span>
              <h1 className="order-view-hero-title">
                Vista ejecutiva de la orden de venta
              </h1>
              <p className="order-view-hero-copy">
                Consulte la operación comercial, el estado de aprobaciones y los
                datos financieros de la orden usando el mismo lenguaje visual
                aplicado en la vista de estimación.
              </p>
            </div>

            <div className="order-view-hero-figure">
              <img src="/opt.png" alt="Orden de venta" />
            </div>
          </div>
        </section>

        <div className="order-view-layout">
          <aside className="order-view-sidebar-card">
            <div className="order-view-sidebar-body">
              <div className="order-view-sidebar-top">
                <div className="order-view-sidebar-avatar">
                  <img src="/opt.png" alt="Orden de venta" />
                </div>
                <div>
                  <h3 className="order-view-sidebar-title">
                    #{getDisplayText(fields?.tranid)}
                  </h3>
                  <p className="order-view-sidebar-copy">
                    Accesos rápidos, validaciones y trazabilidad de la orden de
                    venta dentro de una estructura más clara y compacta.
                  </p>
                </div>
              </div>

              <div className="order-view-actions-card">
                <div className="lead-profile-section-head">
                  <span className="lead-profile-kicker">Lead vinculado</span>
                  <h5 className="lead-profile-section-title">
                    Acciones del cliente
                  </h5>
                  <p className="lead-profile-section-copy">
                    Mantenga a mano las acciones comerciales disponibles sobre el
                    lead asociado esta orden.
                  </p>
                </div>

                {Object.keys(leadDetails).length > 0 ? (
                  <ButtonActions leadData={leadDetails} className="mb-0" />
                ) : null}
              </div>

              <div className="order-view-sidebar-panel">
                <div className="lead-profile-section-head">
                  <span className="lead-profile-kicker">Acciones rápidas</span>
                  <h5 className="lead-profile-section-title">
                    Operación sobre la orden
                  </h5>
                  <p className="lead-profile-section-copy">
                    Edite, consulte documentos y ejecute transiciones sin salir
                    de esta vista.
                  </p>
                </div>

                <div className="order-view-button-group">
                  {[...configs.primary, ...configs.secondary].map((button) => (
                    <button
                      key={button.text}
                      type="button"
                      className={`btn btn-${button.variant || "dark"}`}
                      onClick={() => actions[button.action]()}
                      disabled={button.disabled}
                    >
                      <i className={`ti ${button.icon}`}></i>
                      {button.text}
                    </button>
                  ))}
                </div>
              </div>

              <div className="order-view-meta-grid">
                {sidebarSummary.map((item) => (
                  <div className="order-view-meta-item" key={item.label}>
                    <p className="order-view-meta-label">{item.label}</p>
                    <p className="order-view-meta-value">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="order-view-sidebar-panel">
                <div className="lead-profile-section-head">
                  <span className="lead-profile-kicker">Estados internos</span>
                  <h5 className="lead-profile-section-title">
                    Aprobaciones
                  </h5>
                  <p className="lead-profile-section-copy">
                    Visualización rápida de checks operativos y comerciales.
                  </p>
                </div>

                <div className="order-view-approval-grid">
                  {approvalGroups.map((group) => (
                    <ApprovalCardGroup
                      key={group.title}
                      title={group.title}
                      approvals={group.approvals}
                    />
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <section className="order-view-main-card">
            <div className="lead-profile-panel" style={PROFILE_PANEL_STYLES}>
              <div className="lead-profile-hero">
                <div>
                  <span className="lead-profile-eyebrow">Resumen</span>
                  <h2 className="lead-profile-page-title">
                    Información integral de la orden
                  </h2>
                  <p className="lead-profile-page-copy">
                    Revise el contexto comercial, las condiciones de venta, la
                    reserva y las aprobaciones en una sola lectura más ordenada y
                    consistente con el resto del CRM.
                  </p>
                </div>
              </div>

              <div className="order-view-summary-banner">
                <div>
                  <span className="order-view-summary-banner-label">
                    Código de referencia
                  </span>
                  <h3 className="order-view-summary-banner-title">
                    #{getDisplayText(fields?.tranid)}
                  </h3>
                  <p className="order-view-summary-banner-copy">
                    Punto de control principal para revisar avance, estatus de
                    reserva y documentos asociados a la orden.
                  </p>
                </div>

                <div className="order-view-meta-item">
                  <p className="order-view-meta-label">Cliente</p>
                  <p className="order-view-meta-value">
                    {normalizeText(datosOrdenVenta?.cli)}
                  </p>
                </div>
              </div>

              <ProfileSection
                eyebrow="Estado"
                title="Estado de avance de la orden"
                description="Secuencia comercial y administrativa desde la creación de la orden hasta el contrato firmado."
              >
                <OrderProgress
                  validarOrdenVenta={validarOrdenVenta}
                  isLoading={isLoading}
                />
              </ProfileSection>

              <ProfileSection
                eyebrow="Base"
                title="Información base de la orden"
                description="Datos generales del pedido, cliente, expediente y oportunidad relacionada."
              >
                <div className="order-view-metric-grid">
                  <MetricCards items={resumenPrincipal} />
                </div>
              </ProfileSection>

              <ProfileSection
                eyebrow="Operación comercial"
                title="Contexto y condiciones de venta"
                description="Información de campaña, fondos, vigencia, responsables y motivo de compra del negocio."
              >
                <div className="order-view-metric-grid">
                  <MetricCards items={ventaMetrics} />
                </div>
              </ProfileSection>

              <ProfileSection
                eyebrow="Autorización financiera"
                title="Montos, descuentos y comisiones"
                description="Consolidado de precio, cortesías, cashback, prima y cálculos comerciales de la orden."
              >
                <div className="order-view-metric-grid">
                  <MetricCards items={autorizacionMetrics} />
                </div>
              </ProfileSection>

              <ProfileSection
                eyebrow="Reserva"
                title="Datos de reserva y pre-reserva"
                description="Montos, fechas, referencia de pago y observaciones registradas para la confirmación."
              >
                <div className="order-view-metric-grid">
                  <MetricCards items={reservaMetrics} />
                </div>
              </ProfileSection>

              <ProfileSection
                eyebrow="Configuración adicional"
                title="Información de mezzanine"
                description="Datos complementarios de área y monto aplicados al mezzanine cuando corresponde."
              >
                <div className="order-view-metric-grid">
                  <MetricCards items={mezzanineMetrics} />
                </div>
              </ProfileSection>

              <ProfileSection
                eyebrow="Detalle"
                title="Condiciones de la prima"
                description="Líneas registradas en la orden con artículo, monto, fecha proyectada y descripción."
              >
                <div className="order-view-table-shell">
                  <div className="order-view-table-head">
                    <div>
                      <h5>Detalle de partidas</h5>
                      <p>
                        Tabla consolidada de los artículos y proyecciones de pago
                        asociadas a la orden de venta.
                      </p>
                    </div>
                  </div>

                  <table
                    id="condicionesPrimaTable"
                    className="table table-striped table-bordered dt-responsive nowrap"
                  >
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Artículo</th>
                        <th>Monto</th>
                        <th>Fecha de pago proyectado</th>
                        <th>Cantidad</th>
                        <th>Descripción</th>
                      </tr>
                    </thead>
                  </table>
                </div>
              </ProfileSection>

              <ProfileSection
                eyebrow="Documentación"
                title="Archivos y soporte relacionados"
                description="Acceso al bloque documental asociado a la orden de venta."
              >
                <div className="order-view-onedrive-shell">
                  <OneDrive />
                </div>
              </ProfileSection>
            </div>
          </section>
        </div>
      </div>

      {isModalOpen ? (
        <ModalOrdenVenta
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          idEstimacion={transaccion}
        />
      ) : null}
    </>
  );
};
