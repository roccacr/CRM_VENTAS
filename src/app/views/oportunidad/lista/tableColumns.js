const INACTIVATION_REASON_LABELS = {
  MANUAL: "Manual",
  SISTEMA_OTRO: "Sistema",
  LEAD_PERDIDO: "Lead perdido",
  LEAD_SEGUIMIENTO: "Lead en seguimiento",
  LEAD_PRE_RESERVA: "Lead en pre-reserva",
  LEAD_RESERVA: "Lead en reserva",
  MENOS_PROBABLE_3_MESES: "Menos probable por 3 meses",
};

const getInactivationReasonLabel = (reason) => {
  if (!reason) {
    return "Activa";
  }

  return INACTIVATION_REASON_LABELS[reason] || reason;
};

export const tableColumns = [
  { title: "LEADS", data: "nombre_lead", className: "text-center" }, // 0
  { title: "ASESOR", data: "name_admin", className: "text-center" }, // 1
  { title: "#OPORTUNIDAD", data: "tranid_oport", className: "text-center" }, // 2
  { title: "MOTIVO CONDICION", data: "Motico_Condicion", className: "text-center" }, // 3
  {
    title: "MOTIVO INACTIVACION",
    data: "motivo_inactivacion_oport",
    className: "text-center",
    render: (data) => getInactivationReasonLabel(data),
  }, // 4
  {
    title: "CIERRE PREV",
    data: "fecha_Condicion",
    className: "text-center",
    render: (data) => data ? new Date(data).toLocaleDateString() : "N/A"
  }, // 5
  { title: "EXPEDIENTE", data: "codigo_exp", className: "text-center" }, // 6
  { title: "MET PAGO", data: "nombre_motivo_pago", className: "text-center" }, // 7
  {
    title: "PREC DE LIS",
    data: "precioVentaUncio_exp",
    className: "text-center",
    render: (data) => data || "N/A"
  }, // 8
  {
    title: "PREC VENTA MIN",
    data: "precioDeVentaMinimo",
    className: "text-center",
    render: (data) => data || "N/A"
  }, // 9
  {
    title: "ESTADO",
    data: "entitystatus_oport",
    className: "text-center",
    render: (data) => {
      switch (data) {
        case 22: return "FIRME";
        case 11: return "CONDICIONAL";
        default: return data;
      }
    }
  }, // 10
  {
    title: "CREADO",
    data: "fecha_creada_oport",
    className: "text-center",
    render: (data) => data ? new Date(data).toLocaleDateString() : "N/A"
  }, // 11
  { title: "CAMPANAS", data: "campana_lead", className: "text-center" }, // 12
  { title: "PROYECTO", data: "proyecto_lead", className: "text-center" }, // 13
  {
    title: "PROBABILIDAD",
    className: "text-center",
    data: null,
    render: (data, type, row) => {
      const check1 = row.chek_oport !== undefined ? parseInt(row.chek_oport) : 0;

      return check1 === 1 ? "Probable" : "Menos Probable";
    }
  }, // 14
];
