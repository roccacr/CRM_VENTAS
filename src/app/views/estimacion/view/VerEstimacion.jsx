import { useEffect, useMemo, useState } from "react";
import $ from "jquery";
import "datatables.net";
import "datatables.net-bs5";
import "datatables.net-searchpanes-bs5";
import "datatables.net-select-bs5";
import { useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

import SticNotesContainer from "../../../../components/sticknotes/SticNotesContainer";
import { crearOrdenVenta } from "../../../../store/ordenVenta/thunkOrdenVenta";
import { getSpecificLead } from "../../../../store/leads/thunksLeads";
import {
  caidaReserva,
  crearBitacoraEstimacionCaida,
  enviarEstimacionComoPreReserva,
  extarerEstimacion,
  ModificarEstimacion,
} from "../../../../store/estimacion/thunkEstimacion";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import {
  getDisplayText,
  PROFILE_PANEL_STYLES,
  PROFILE_THEME_STYLES,
  ProfileSection,
} from "../../leads/perfil/profileTheme";
import { ModalEstimacionEdit } from "../ModalEstimacionEdit";

const ESTIMATION_VIEW_STYLES = `
  ${PROFILE_THEME_STYLES}

  .estimation-view-shell {
    display: grid;
    gap: 14px;
  }

  .estimation-view-notes {
    position: relative;
    z-index: 999;
    margin-bottom: 12px;
  }

  .estimation-view-hero-card,
  .estimation-view-sidebar-card,
  .estimation-view-main-card {
    border: 1px solid #d9dde3;
    border-radius: 18px;
    background: #ffffff;
    box-shadow: 0 14px 32px rgba(15, 23, 42, 0.06);
    overflow: hidden;
  }

  .estimation-view-hero-body {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 18px 20px;
  }

  .estimation-view-hero-kicker {
    display: inline-block;
    margin-bottom: 6px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #4b5563;
  }

  .estimation-view-hero-title {
    margin: 0 0 6px;
    font-size: 19px;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: #111827;
  }

  .estimation-view-hero-copy {
    margin: 0;
    max-width: 620px;
    font-size: 11px;
    line-height: 1.5;
    color: #4b5563;
  }

  .estimation-view-hero-copy,
  .estimation-view-sidebar-copy,
  .lead-profile-section-copy,
  .lead-profile-page-copy,
  .estimation-view-summary-banner-copy,
  .estimation-view-table-head p {
    display: none;
  }

  .estimation-view-hero-figure {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 88px;
  }

  .estimation-view-hero-figure img {
    width: 72px;
    height: 72px;
    object-fit: contain;
    filter: drop-shadow(0 12px 20px rgba(15, 23, 42, 0.1));
  }

  .estimation-view-layout {
    display: grid;
    grid-template-columns: minmax(290px, 340px) minmax(0, 1fr);
    gap: 14px;
    align-items: start;
  }

  .estimation-view-sidebar-body {
    padding: 16px 16px 14px;
  }

  .estimation-view-sidebar-top {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding-bottom: 12px;
    border-bottom: 1px solid #eceff3;
  }

  .estimation-view-sidebar-avatar {
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

  .estimation-view-sidebar-avatar img {
    width: 48px;
    height: 48px;
    object-fit: contain;
  }

  .estimation-view-sidebar-title {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: #111827;
  }

  .estimation-view-sidebar-copy {
    margin: 0;
    font-size: 11px;
    line-height: 1.45;
    color: #6b7280;
  }

  .estimation-view-lead-actions,
  .estimation-view-button-panel {
    margin-top: 12px;
    padding: 12px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
  }

  .estimation-view-button-group {
    display: grid;
    gap: 7px;
    margin-top: 10px;
  }

  .estimation-view-button-group .btn {
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

  .estimation-view-button-group .btn:active {
    transform: scale(0.98);
  }

  .estimation-view-button-group .btn.btn-outline-dark {
    border-color: #d1d5db;
    color: #111827;
    background: #ffffff;
  }

  .estimation-view-button-group .btn.btn-outline-dark:hover {
    border-color: #111827;
    background: #f9fafb;
  }

  .estimation-view-meta-grid {
    display: grid;
    gap: 8px;
    margin-top: 12px;
  }

  .estimation-view-meta-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 11px;
    background: #fbfbfc;
  }

  .estimation-view-meta-label {
    margin: 0;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #6b7280;
  }

  .estimation-view-meta-value {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: #111827;
    text-align: right;
  }

  .estimation-view-main-card .lead-profile-panel {
    padding: 16px;
  }

  .estimation-view-main-card .lead-profile-hero {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }

  .estimation-view-summary-banner {
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

  .estimation-view-summary-banner-label {
    display: inline-block;
    margin-bottom: 4px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6b7280;
  }

  .estimation-view-summary-banner-title {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: #111827;
  }

  .estimation-view-summary-banner-copy {
    margin: 0;
    font-size: 11px;
    line-height: 1.45;
    color: #4b5563;
  }

.estimation-view-metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 12px;
}

.estimation-view-metric-card {
  min-height: 100%;
  padding: 14px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
}

.estimation-view-metric-label {
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

.estimation-view-metric-value {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
  color: #111827;
  white-space: pre-wrap;
    word-break: break-word;
  }

  .estimation-view-table-shell {
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: #ffffff;
    overflow: hidden;
  }

  .estimation-view-table-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    padding: 14px 16px;
    border-bottom: 1px solid #eceff3;
    background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
  }

  .estimation-view-table-head h5 {
    margin: 0 0 4px;
    font-size: 13px;
    font-weight: 700;
    color: #111827;
  }

  .estimation-view-table-head p {
    margin: 0;
    font-size: 11px;
    line-height: 1.45;
    color: #6b7280;
  }

  .estimation-view-shell .dataTables_wrapper {
    padding: 14px 16px 16px;
  }

  .estimation-view-shell table.dataTable {
    margin-top: 0 !important;
    border-collapse: separate !important;
    border-spacing: 0;
  }

  .estimation-view-shell table.dataTable thead th {
    padding: 10px 12px !important;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #6b7280;
    background: #f8fafc;
    border-bottom: 1px solid #e5e7eb !important;
  }

  .estimation-view-shell table.dataTable tbody td {
    padding: 10px 12px !important;
    font-size: 11px;
    color: #111827;
    vertical-align: middle;
    border-top: 1px solid #eef2f7 !important;
  }

  .estimation-view-shell .dataTables_wrapper .dataTables_filter input,
  .estimation-view-shell .dataTables_wrapper .dataTables_length select {
    min-height: 34px;
    border: 1px solid #d1d5db;
    border-radius: 9px;
    box-shadow: none;
  }

  .estimation-view-shell .dataTables_wrapper .dataTables_paginate .paginate_button {
    border-radius: 10px !important;
  }

  @media (max-width: 1199px) {
    .estimation-view-layout {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 767px) {
    .estimation-view-hero-body,
    .estimation-view-summary-banner,
    .estimation-view-table-head {
      flex-direction: column;
      align-items: flex-start;
    }

    .estimation-view-main-card .lead-profile-panel {
      padding: 12px;
    }

    .estimation-view-shell .dataTables_wrapper {
      padding: 12px;
    }
  }
`;

const getQueryParamValue = (search, param) => {
  const value = new URLSearchParams(search).get(param);
  return value && !Number.isNaN(Number(value)) ? Number(value) : value;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 5,
  }).format(Number(value) || 0);

const calculateNetSalePrice = (
  listPrice,
  directDiscount,
  extrasAmount,
  cashback,
  courtesiesAmount,
) => {
  const parseNumber = (value) => {
    if (typeof value === "string") {
      return parseFloat(value.replace(/[^0-9.-]/g, "")) || 0;
    }

    return Number(value) || 0;
  };

  return (
    parseNumber(listPrice) -
    Math.abs(parseNumber(directDiscount)) +
    parseNumber(extrasAmount) -
    parseNumber(cashback) -
    parseNumber(courtesiesAmount)
  );
};

const getDataTableConfig = () => ({
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
});

const processTableData = (estimationData) =>
  Object.entries(estimationData?.data?.sublists?.item || {})
    .filter(([key]) => key !== "currentline")
    .map(([, line], index) => ({
      numero: index + 1,
      articulo: line.item_display || line.item || "N/A",
      monto: formatCurrency(line.rate || 0),
      fechaPago: line.custcolfecha_pago_proyectado || "N/A",
      cantidad: getDisplayText(line.quantity),
      descripcion: getDisplayText(line.description),
    }));

const getMetricCards = (items) =>
  items.map((item) => (
    <article className="estimation-view-metric-card" key={item.label}>
      <p className="estimation-view-metric-label">
        <i className={item.icon}></i>
        <span>{item.label}</span>
      </p>
      <p className="estimation-view-metric-value">{item.value}</p>
    </article>
  ));

export const VerEstimacion = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [leadDetails, setLeadDetails] = useState({});
  const [datosEstimacion, setDatosEstimacion] = useState({});
  const [totalOredenes, setTotalOredenes] = useState([]);
  const [datosCrm, setDatosCrm] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);

  const leadId = getQueryParamValue(location.search, "data");
  const estimacionId = getQueryParamValue(location.search, "data2");

  const fetchLeadDetails = async (idLead) => {
    try {
      const leadData = await dispatch(getSpecificLead(idLead));
      setLeadDetails(leadData);
    } catch (error) {
      console.error("Error al obtener los detalles del lead:", error);
    }
  };

  const fetchEstimacionDetails = async (id) => {
    try {
      const estimacionData = await dispatch(extarerEstimacion(id));
      setDatosEstimacion(estimacionData?.netsuite?.Detalle || {});
      setDatosCrm(estimacionData?.crm || {});
      setTotalOredenes(estimacionData?.totalOredenes?.data || []);
    } catch (error) {
      console.error("Error al obtener los detalles de la estimación:", error);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLeadDetails({});
      setDatosEstimacion({});
      setDatosCrm({});
      setTotalOredenes([]);

      Swal.fire({
        title: "Cargando datos...",
        text: "Por favor espera.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      if (leadId && Number(leadId) > 0) {
        await Promise.all([
          fetchLeadDetails(leadId),
          fetchEstimacionDetails(estimacionId),
        ]);
      }

      Swal.close();
    };

    loadInitialData();
  }, [dispatch, estimacionId, leadId, location.search]);

  useEffect(() => {
    if (!datosEstimacion?.data?.sublists?.item) {
      return undefined;
    }

    if ($.fn.DataTable.isDataTable("#estimacionTable")) {
      $("#estimacionTable").DataTable().destroy();
      $("#estimacionTable").empty();
    }

    const table = $("#estimacionTable").DataTable({
      ...getDataTableConfig(),
      data: processTableData(datosEstimacion),
      columns: [
        { data: "numero", title: "#" },
        { data: "articulo", title: "Artículo" },
        { data: "monto", title: "Monto" },
        { data: "fechaPago", title: "Fecha de pago proyectado" },
        { data: "cantidad", title: "Cantidad" },
        { data: "descripcion", title: "Descripción" },
      ],
    });

    return () => {
      table.destroy();
    };
  }, [datosEstimacion]);

  const refreshAfterSuccess = () => {
    Swal.fire({
      title: "Refrescando...",
      text: "Por favor, espere un momento.",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });

    setTimeout(() => {
      window.location.reload();
    }, 3000);
  };

  const vistaDePdf = () => {
    window.open(
      `https://4552704.app.netsuite.com/app/accounting/print/hotprint.nl?regular=T&sethotprinter=T&formnumber=342&trantype=estimate&id=${estimacionId}`,
      "_blank",
    );
  };

  const EnviarReserva = async () => {
    try {
      const result = await Swal.fire({
        title: "¿Estás seguro?",
        text: "Esta acción enviará la estimación como una Pre-reserva.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Sí, enviar Pre-reserva",
      });

      if (!result.isConfirmed) {
        return;
      }

      Swal.fire({
        title: "Enviando...",
        text: "Por favor, espere un momento.",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      await dispatch(
        enviarEstimacionComoPreReserva(
          estimacionId,
          leadId,
          datosEstimacion?.data?.fields?.custbody206,
        ),
      );

      Swal.close();
      await Swal.fire(
        "Enviado",
        "La estimación ha sido enviada como Pre-reserva.",
        "success",
      );
      refreshAfterSuccess();
    } catch (error) {
      console.error(
        "Error al enviar la estimación como Pre-reserva:",
        error,
      );
      Swal.close();
      Swal.fire("Error", "Hubo un problema al enviar la estimación.", "error");
    }
  };

  const EnviarTransaccionCaida = async () => {
    const confirmation = await Swal.fire({
      title: "¿Está seguro?",
      text: "¿Desea enviar la pre-reserva caída?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, enviar",
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    const { value: formValues } = await Swal.fire({
      title: "Estimación caída",
      html: `
        <label for="swal-input1">Comentario de caída</label>
        <input id="swal-input1" class="swal2-input" required>
        <label for="swal-select">Seleccione el motivo</label>
        <select id="swal-select" class="swal2-select" required>
          <option value="">Escoger</option>
          <option value="2">Inconformidad - Cambios en proyecto</option>
          <option value="3">Inconformidad - Distribución</option>
          <option value="1">Inconformidad - Fecha de entrega</option>
          <option value="12">Incumplimiento contractual</option>
          <option value="10">Mejor Oferta</option>
          <option value="13">Motivo de empresa - Proyecto pospuesto</option>
          <option value="9">Motivo Financiero - Condiciones bancarias</option>
          <option value="8">Motivo Financiero - Venta de propiedad</option>
          <option value="14">Motivo Laboral</option>
          <option value="6">Motivo Personal - Económico</option>
          <option value="5">Motivo Personal - Familiar</option>
          <option value="4">Motivo Personal - Salud</option>
          <option value="7">Motivo Personal - Sin Especificar</option>
          <option value="11">No sujeto crédito</option>
          <option value="15">Traslado de FF/proyecto</option>
        </select>
      `,
      preConfirm: () => {
        const input1Value = document.getElementById("swal-input1").value;
        const selectValue = document.getElementById("swal-select").value;
        return [input1Value, selectValue];
      },
    });

    if (!formValues?.[0] || !formValues?.[1]) {
      Swal.fire(
        "Error",
        "Debe ingresar un comentario y seleccionar un motivo para continuar.",
        "error",
      );
      return;
    }

    Swal.fire({
      title: "Enviando...",
      text: "Por favor, espere un momento.",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });

    const motivo = formValues[1];
    const comentario = formValues[0];
    const result = await dispatch(caidaReserva(estimacionId, motivo, comentario));
    const detalle = result?.data?.Detalle;

    if (detalle?.status !== 200) {
      Swal.close();
      Swal.fire(
        "Algo no está bien.",
        "No se pudo hacer la pre reserva caída.",
        "question",
      );
      return;
    }

    const markAsLost = await Swal.fire({
      title: "¿Quiere enviar como perdido este cliente?",
      text: "Al perder el cliente se perderán todas sus transacciones.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, perder",
    });

    await dispatch(crearBitacoraEstimacionCaida(leadId, comentario));
    await dispatch(
      ModificarEstimacion(estimacionId, leadId, markAsLost.isConfirmed ? 1 : 0),
    );

    Swal.close();
    await Swal.fire(
      "Enviado",
      "La estimación ha sido enviada como Pre-reserva.",
      "success",
    );
    refreshAfterSuccess();
  };

  const crearOrdenVentas = async () => {
    const { isConfirmed } = await Swal.fire({
      title: "¿Está seguro?",
      text: "¿Desea crear la orden de venta?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Sí, crear",
    });

    if (!isConfirmed) {
      return;
    }

    Swal.fire({
      title: "Enviando...",
      text: "Por favor, espere un momento.",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });

    const resultado = await dispatch(crearOrdenVenta(estimacionId, leadId));

    if (resultado?.statusNormal !== 200) {
      Swal.close();
      Swal.fire(
        "Algo no está bien.",
        "No se pudo crear la orden de venta.",
        "question",
      );
      return;
    }

    await Swal.fire({
      title: "¡Éxito!",
      text: "Orden de venta creada correctamente",
      icon: "success",
      timer: 3000,
      showConfirmButton: false,
    });

    navigate(`/orden/view?data=${leadId}&data2=${resultado.data.id}`);
  };

  const navigateToOrder = (orderId) => {
    navigate(`/orden/view?data=${leadId}&data2=${orderId[0].id_ov_netsuite}`);
  };

  const fields = datosEstimacion?.data?.fields || {};
  const hasOrders = Array.isArray(totalOredenes) && totalOredenes.length > 0;
  const canSendPreReserva =
    datosCrm?.pre_reserva !== 1 &&
    fields?.custbody191 &&
    fields?.custbody189 &&
    fields?.custbody206 &&
    fields?.custbody190 &&
    fields?.custbody188;
  const canSendPreReservaCaida =
    datosCrm?.pre_caida !== 1 && datosCrm?.pre_reserva === 1;

  const sidebarSummary = useMemo(
    () => [
      {
        label: "Cliente relacionado",
        value: getDisplayText(datosEstimacion?.cli),
      },
      {
        label: "Oportunidad ligada",
        value: getDisplayText(datosEstimacion?.opportunity_name),
      },
      {
        label: "Estado estimación",
        value: getDisplayText(datosEstimacion?.Estado),
      },
      {
        label: "Cierre previsto",
        value: getDisplayText(datosCrm?.caduca),
      },
      {
        label: "Órdenes generadas",
        value: hasOrders ? `${totalOredenes.length}` : "0",
      },
    ],
    [
      datosCrm?.caduca,
      datosEstimacion?.Estado,
      datosEstimacion?.cli,
      datosEstimacion?.opportunity_name,
      hasOrders,
      totalOredenes.length,
    ],
  );

  const basicMetrics = useMemo(
    () => [
      {
        label: "Cliente",
        value: getDisplayText(datosEstimacion?.cli),
        icon: "fas fa-user",
      },
      {
        label: "Unidad expediente ligada",
        value: getDisplayText(datosEstimacion?.Exp),
        icon: "fas fa-archway",
      },
      {
        label: "Subsidiaria",
        value: getDisplayText(datosEstimacion?.Subsidaria),
        icon: "fas fa-building",
      },
      {
        label: "Estado",
        value: getDisplayText(datosEstimacion?.Estado),
        icon: "fas fa-certificate",
      },
      {
        label: "Oportunidad",
        value: getDisplayText(datosEstimacion?.opportunity_name),
        icon: "fas fa-chevron-circle-up",
      },
      {
        label: "Cierre previsto",
        value: getDisplayText(datosCrm?.caduca),
        icon: "fas fa-calendar-plus",
      },
    ],
    [
      datosCrm?.caduca,
      datosEstimacion?.Estado,
      datosEstimacion?.Exp,
      datosEstimacion?.Subsidaria,
      datosEstimacion?.cli,
      datosEstimacion?.opportunity_name,
    ],
  );

  const financialMetrics = useMemo(
    () => [
      {
        label: "Precio de lista",
        value: formatCurrency(fields?.custbody13),
        icon: "fas fa-money-bill-wave",
      },
      {
        label: "Monto descuento directo",
        value: formatCurrency(fields?.custbody132),
        icon: "fas fa-money-bill-wave",
      },
      {
        label: "Monto extras sobre el precio de lista",
        value: formatCurrency(fields?.custbody46),
        icon: "fas fa-money-bill-wave",
      },
      {
        label: "Descripción extras",
        value: getDisplayText(fields?.custbody47),
        icon: "fas fa-list-ul",
      },
      {
        label: "Cashback",
        value: formatCurrency(fields?.custbodyix_salesorder_cashback),
        icon: "fas fa-money-bill-wave",
      },
      {
        label: "Monto reserva",
        value: formatCurrency(fields?.custbody52),
        icon: "fas fa-money-bill-wave",
      },
      {
        label: "Monto total de cortesías",
        value: formatCurrency(fields?.custbody16),
        icon: "fas fa-gift",
      },
      {
        label: "Descripción de las cortesías",
        value: getDisplayText(fields?.custbody35),
        icon: "fas fa-list-ul",
      },
      {
        label: "Precio de venta mínimo",
        value: formatCurrency(fields?.custbody18),
        icon: "fas fa-money-check-alt",
      },
      {
        label: "Precio de venta neto",
        value: formatCurrency(
          calculateNetSalePrice(
            fields?.custbody13,
            fields?.custbody132,
            fields?.custbody46,
            fields?.custbodyix_salesorder_cashback,
            fields?.custbody16,
          ),
        ),
        icon: "fas fa-sack-dollar",
      },
      {
        label: "Monto total",
        value: formatCurrency(fields?.custbody_ix_total_amount),
        icon: "fas fa-coins",
      },
    ],
    [fields],
  );

  const primeMetrics = useMemo(
    () => [
      {
        label: "Prima total",
        value: formatCurrency(fields?.custbody39),
        icon: "fas fa-money-bill-alt",
      },
      {
        label: "Prima %",
        value: `${getDisplayText(fields?.custbody60)}%`,
        icon: "fas fa-percent",
      },
      {
        label: "Monto prima neta",
        value: formatCurrency(fields?.custbody_ix_salesorder_monto_prima),
        icon: "fas fa-wallet",
      },
      {
        label: "Monto asignable prima neta",
        value: formatCurrency(fields?.custbody211),
        icon: "fas fa-file-invoice-dollar",
      },
    ],
    [fields],
  );

  return (
    <>
      <style>{ESTIMATION_VIEW_STYLES}</style>

      <div className="estimation-view-notes">
        <SticNotesContainer
          idinternoLead={leadId}
          transactionType="estimate"
          transactionId={estimacionId}
          sourceUrl={window.location.href}
        />
      </div>

      <div className="estimation-view-shell">
        <section className="estimation-view-hero-card">
          <div className="estimation-view-hero-body">
            <div>
              <span className="estimation-view-hero-kicker">
                Gestión comercial
              </span>
              <h1 className="estimation-view-hero-title">
                Vista ejecutiva de la estimación
              </h1>
              <p className="estimation-view-hero-copy">
                Revise la información comercial, financiera y operativa de la
                estimación desde una presentación más clara, compacta y alineada
                al estilo actual del CRM.
              </p>
            </div>

            <div className="estimation-view-hero-figure">
              <img src="/opt.png" alt="Estimación" />
            </div>
          </div>
        </section>

        <div className="estimation-view-layout">
          <aside className="estimation-view-sidebar-card">
            <div className="estimation-view-sidebar-body">
              <div className="estimation-view-sidebar-top">
                <div className="estimation-view-sidebar-avatar">
                  <img src="/opt.png" alt="Estimación" />
                </div>
                <div>
                  <h3 className="estimation-view-sidebar-title">
                    #{getDisplayText(datosCrm?.tranid_est)}
                  </h3>
                  <p className="estimation-view-sidebar-copy">
                    Seguimiento consolidado de la estimación, sus acciones
                    disponibles y la trazabilidad comercial del cliente.
                  </p>
                </div>
              </div>

              <div className="estimation-view-lead-actions">
                <div className="lead-profile-section-head">
                  <span className="lead-profile-kicker">
                    Lead vinculado
                  </span>
                  <h5 className="lead-profile-section-title">
                    Gestión del lead vinculado
                  </h5>
                  <p className="lead-profile-section-copy">
                    Acceda a las acciones comerciales disponibles para el lead
                    asociado esta estimación.
                  </p>
                </div>

                {Object.keys(leadDetails).length > 0 ? (
                  <ButtonActions leadData={leadDetails} className="mb-0" />
                ) : null}
              </div>

              <div className="estimation-view-button-panel">
                <div className="lead-profile-section-head">
                  <span className="lead-profile-kicker">Acciones rápidas</span>
                  <h5 className="lead-profile-section-title">
                    Operación sobre la estimación
                  </h5>
                  <p className="lead-profile-section-copy">
                    Ejecute edición, orden de venta, visualización de PDF y
                    transiciones de negocio sin salir esta vista.
                  </p>
                </div>

                <div className="estimation-view-button-group">
                  {!hasOrders ? (
                    <button
                      type="button"
                      className="btn btn-dark"
                      onClick={() => setIsModalOpen(true)}
                    >
                      <i className="ti ti-pencil"></i>
                      Editar estimación
                    </button>
                  ) : null}

                  {!hasOrders ? (
                    <button
                      type="button"
                      className="btn btn-dark"
                      onClick={crearOrdenVentas}
                    >
                      <i className="ti ti-color-swatch"></i>
                      Orden de venta
                    </button>
                  ) : null}

                  {hasOrders ? (
                    <button
                      type="button"
                      className="btn btn-outline-dark"
                      onClick={() => navigateToOrder(totalOredenes)}
                    >
                      <i className="ti ti-eye"></i>
                      Ver orden de venta
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="btn btn-outline-dark"
                    onClick={vistaDePdf}
                  >
                    <i className="ti ti-file-type-pdf"></i>
                    PDF estimación
                  </button>

                  {canSendPreReserva ? (
                    <button
                      type="button"
                      className="btn btn-dark"
                      onClick={EnviarReserva}
                    >
                      <i className="ti ti-flag-3"></i>
                      Pre-reserva
                    </button>
                  ) : null}

                  {canSendPreReservaCaida ? (
                    <button
                      type="button"
                      className="btn btn-outline-dark"
                      onClick={EnviarTransaccionCaida}
                    >
                      <i className="ti ti-file-shredder"></i>
                      Pre-reserva caída
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="estimation-view-meta-grid">
                {sidebarSummary.map((item) => (
                  <div className="estimation-view-meta-item" key={item.label}>
                    <p className="estimation-view-meta-label">{item.label}</p>
                    <p className="estimation-view-meta-value">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section className="estimation-view-main-card">
            <div className="lead-profile-panel" style={PROFILE_PANEL_STYLES}>
              <div className="lead-profile-hero">
                <div>
                  <span className="lead-profile-eyebrow">
                    Resumen
                  </span>
                  <h2 className="lead-profile-page-title">
                    Información integral de la estimación
                  </h2>
                  <p className="lead-profile-page-copy">
                    Consulte los datos base, la composición financiera y el
                    detalle de pagos proyectados usando una estructura más
                    ejecutiva y legible.
                  </p>
                </div>
              </div>

              <div className="estimation-view-summary-banner">
                <div>
                  <span className="estimation-view-summary-banner-label">
                    Código de referencia
                  </span>
                  <h3 className="estimation-view-summary-banner-title">
                    #{getDisplayText(datosCrm?.tranid_est)}
                  </h3>
                  <p className="estimation-view-summary-banner-copy">
                    Registro principal de la estimación y punto de partida para
                    validar avance comercial, orden de venta y conversión a
                    pre-reserva.
                  </p>
                </div>

                <div className="estimation-view-meta-item">
                  <p className="estimation-view-meta-label">Cliente</p>
                  <p className="estimation-view-meta-value">
                    {getDisplayText(datosEstimacion?.cli)}
                  </p>
                </div>
              </div>

              <ProfileSection
                eyebrow="Resumen principal"
                title="Información base de la estimación"
                description="Datos generales del cliente, expediente, oportunidad y contexto operativo de la estimación."
              >
                <div className="estimation-view-metric-grid">
                  {getMetricCards(basicMetrics)}
                </div>
              </ProfileSection>

              <ProfileSection
                eyebrow="Composición financiera"
                title="Montos, descuentos y valor neto"
                description="Consolidado del precio de lista, descuentos, extras, cortesías y cálculo neto de venta."
              >
                <div className="estimation-view-metric-grid">
                  {getMetricCards(financialMetrics)}
                </div>
              </ProfileSection>

              <ProfileSection
                eyebrow="Condiciones de la prima"
                title="Estructura de prima del negocio"
                description="Resumen de la prima total, porcentaje aplicado y monto neto asociado la estimación."
              >
                <div className="estimation-view-metric-grid">
                  {getMetricCards(primeMetrics)}
                </div>
              </ProfileSection>

              <ProfileSection
                eyebrow="Detalle operativo"
                title="Pagos proyectados y líneas de la estimación"
                description="Consulta cada artículo incluido, su monto, fecha estimada de pago y descripción registrada."
              >
                <div className="estimation-view-table-shell">
                  <div className="estimation-view-table-head">
                    <div>
                      <h5>Detalle de partidas</h5>
                      <p>
                        Tabla consolidada de los artículos y proyecciones de
                        pago asociadas a la estimación.
                      </p>
                    </div>
                  </div>

                  <table
                    id="estimacionTable"
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
            </div>
          </section>
        </div>
      </div>

      {isModalOpen ? (
        <ModalEstimacionEdit
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          idEstimacion={estimacionId}
        />
      ) : null}
    </>
  );
};
