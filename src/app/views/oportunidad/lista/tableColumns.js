export const tableColumns = [
    { title: "LEADS", data: "nombre_lead", className: "text-center" }, // 0
    { title: "#OPORTUNIDAD", data: "tranid_oport", className: "text-center" }, // 1
    { title: "MOTIVO CONDICION", data: "Motico_Condicion", className: "text-center" }, // 2
    { title: "CIERRE PREV", data: "fecha_Condicion", className: "text-center",
      render: (data) => data ? new Date(data).toLocaleDateString() : "N/A" }, // 3
    { title: "EXPEDIENTE", data: "codigo_exp", className: "text-center" }, // 4
    { title: "MET PAGO", data: "nombre_motivo_pago", className: "text-center" }, // 5
    { title: "PREC DE LIS", data: "precioVentaUncio_exp", className: "text-center",
      render: (data) => data || "N/A" }, // 6
    { title: "PREC VENTA MÍN", data: "precioDeVentaMinimo", className: "text-center",
      render: (data) => data || "N/A" }, // 7
    { title: "ESTADO", data: "entitystatus_oport", className: "text-center",
      render: (data) => {
        switch (data) {
          case 22: return "FIRME";
          case 11: return "CONDICIONAL";
          default: return data;
        }
      }
    }, // 8
    { title: "CREADO", data: "fecha_creada_oport", className: "text-center",
      render: (data) => data ? new Date(data).toLocaleDateString() : "N/A" }, // 9
    { title: "CAMPAÑAS", data: "campana_lead", className: "text-center" }, // 10
    { title: "PROYECTO", data: "proyecto_lead", className: "text-center" }, // 11
];