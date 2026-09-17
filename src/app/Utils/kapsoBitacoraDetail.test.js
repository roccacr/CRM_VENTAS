import assert from "node:assert/strict";
import test from "node:test";

import { getKapsoReadableBitacoraDetail } from "./kapsoBitacoraDetail.js";

test("oculta el marker tecnico de idempotencia en respuestas WhatsApp", () => {
   const detail =
      'El cliente acepto recibir informacion por WhatsApp. Respuesta: "Si, enviar informacion". [Kapso webhook idem:6db442aa82f5a7543f37152a91dceb56c2163f158c7af3ab89ba997414b127a7]';

   assert.equal(
      getKapsoReadableBitacoraDetail(detail),
      'El cliente acepto recibir informacion por WhatsApp. Respuesta: "Si, enviar informacion".',
   );
});

test("oculta el marker tecnico en respuestas negativas", () => {
   const detail =
      'El cliente no quiso recibir informacion por WhatsApp. Respuesta: "No, gracias". [Kapso webhook idem:03c86a019315c6e2ae5c3abfa4db39e575ce5fc0fb5d2f4f27843c9e70fe6a1b]';

   assert.equal(
      getKapsoReadableBitacoraDetail(detail),
      'El cliente no quiso recibir informacion por WhatsApp. Respuesta: "No, gracias".',
   );
});

test("oculta el marker tecnico aunque llegue sin cierre", () => {
   const detail =
      'El cliente no quiso recibir informacion por WhatsApp. Respuesta: "No, gracias". [Kapso webhook idem:03c86a019315c6e2ae5c3abfa4db39e575ce5fc0fb5d2f4f27843c9e70fe6a1b';

   assert.equal(
      getKapsoReadableBitacoraDetail(detail),
      'El cliente no quiso recibir informacion por WhatsApp. Respuesta: "No, gracias".',
   );
});

test("normaliza mensajes tecnicos antiguos del template inicial", () => {
   assert.equal(
      getKapsoReadableBitacoraDetail("Template saludo inicial enviado con exito por Kapso. Mensaje: wamid.123"),
      "Se inicio el envio del template inicial por WhatsApp.",
   );
});
