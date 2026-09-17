const KAPSO_IDEMPOTENCY_MARKER = /\s*\[Kapso webhook idem:[a-f0-9]+(?:\]|\s*$)/gi;

const DETAIL_REWRITES = [
   {
      startsWith: "Template saludo inicial enviado con exito",
      text: "Se inicio el envio del template inicial por WhatsApp.",
   },
   {
      startsWith: "Template inicial enviado al cliente",
      text: "Se inicio el envio del template inicial por WhatsApp.",
   },
   {
      startsWith: "Se inicio el envio del template inicial",
      text: "Se inicio el envio del template inicial por WhatsApp.",
   },
   {
      startsWith: "Template inicial entregado al cliente",
      text: "WhatsApp confirmo que el cliente recibio el template inicial.",
   },
   {
      startsWith: "WhatsApp confirmo que el cliente recibio",
      text: "WhatsApp confirmo que el cliente recibio el template inicial.",
   },
   {
      startsWith: "Template saludo inicial fallo",
      text: "No se pudo entregar el template saludo inicial por WhatsApp. Revisar el numero del cliente antes de reintentar.",
   },
   {
      startsWith: "No se pudo entregar el template saludo inicial",
      text: "No se pudo entregar el template saludo inicial por WhatsApp. Revisar el numero del cliente antes de reintentar.",
   },
];

export const getKapsoReadableBitacoraDetail = (detail, fallback = "Sin detalle") => {
   const cleanDetail = String(detail ?? "")
      .replace(KAPSO_IDEMPOTENCY_MARKER, " ")
      .replace(/\s+/g, " ")
      .trim();

   if (!cleanDetail) {
      return fallback;
   }

   const rewrite = DETAIL_REWRITES.find((item) => cleanDetail.startsWith(item.startsWith));
   return rewrite?.text || cleanDetail;
};
