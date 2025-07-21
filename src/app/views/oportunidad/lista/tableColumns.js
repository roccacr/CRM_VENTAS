export const tableColumns = [
  { title: "LEADS", data: "nombre_lead", className: "text-center" }, // 0
  { title: "ASESOR", data: "name_admin", className: "text-center" }, // 1
  { title: "#OPORTUNIDAD", data: "tranid_oport", className: "text-center" }, // 1
  { title: "MOTIVO CONDICION", data: "Motico_Condicion", className: "text-center" }, // 2
  {
    title: "CIERRE PREV", data: "fecha_Condicion", className: "text-center",
    render: (data) => data ? new Date(data).toLocaleDateString() : "N/A"
  }, // 3
  { title: "EXPEDIENTE", data: "codigo_exp", className: "text-center" }, // 4
  { title: "MET PAGO", data: "nombre_motivo_pago", className: "text-center" }, // 5
  {
    title: "PREC DE LIS", data: "precioVentaUncio_exp", className: "text-center",
    render: (data) => data || "N/A"
  }, // 6
  {
    title: "PREC VENTA MÍN", data: "precioDeVentaMinimo", className: "text-center",
    render: (data) => data || "N/A"
  }, // 7
  {
    title: "ESTADO", data: "entitystatus_oport", className: "text-center",
    render: (data) => {
      switch (data) {
        case 22: return "FIRME";
        case 11: return "CONDICIONAL";
        default: return data;
      }
    }
  }, // 8
  {
    title: "CREADO", data: "fecha_creada_oport", className: "text-center",
    render: (data) => data ? new Date(data).toLocaleDateString() : "N/A"
  }, // 9
  { title: "CAMPAÑAS", data: "campana_lead", className: "text-center" }, // 10
  { title: "PROYECTO", data: "proyecto_lead", className: "text-center" }, // 11
  {
    title: "PROBABILIDAD", className: "text-center", data: null,
    render: (data, type, row) => {
      // Verificación defensiva de las propiedades
      // const check2 = row.chek2_oport !== undefined ? parseInt(row.chek2_oport) : 0;
      const check1 = row.chek_oport !== undefined ? parseInt(row.chek_oport) : 0;

      return (check1 === 1) ? "Probable" : "Menos Probable";
    }
  }, // 12
];