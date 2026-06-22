import { Modal } from "@mui/material";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import Swal from "sweetalert2";
import {
   calcularPrimaToal,
   calculoAvanceDiferenciado,
   calculoAvenceObra,
   calculoContraEntregaSinprimaTotal,
   calculoHito1Diferenciado,
   calculoHito1DiferenciadoMonto,
   calculoMontoSegunPorcentaje,
   calculoPrimaAsignable,
   calculoPrimaTotalPorcentaje,
   limpiarCampos,
   montoPrimaNeta,
   montoTotal,
   precioVentaNeto,
   recalcultarMontoshitos
} from "../../../hook/useInputFormatter";
import { editarEstimacionFormulario, extarerEstimacion } from "../../../store/estimacion/thunkEstimacion";
import { CalculodePrima } from "./CalculodePrima";
import { MetodoPago } from "./MetodoPago";
import { PrimeraLinea } from "./PrimeraLinea";
import { SeleccionPrima } from "./SeleccionPrima";
import "./style.css";

const ESTIMATION_MODAL_STYLES = `
  .estimation-create-modal-shell {
    display: grid;
    gap: 14px;
  }

  .estimation-create-modal-content {
    border: 1px solid #d9dde3;
    border-radius: 18px;
    background: #ffffff;
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
    overflow: hidden;
  }

  .estimation-create-modal-body {
    padding: 18px;
    background: linear-gradient(180deg, #ffffff 0%, #fcfcfd 100%);
  }

  .estimation-create-modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 18px 16px;
    border-bottom: 1px solid #eceff3;
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  }

  .estimation-create-modal-kicker {
    display: inline-block;
    margin-bottom: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6b7280;
  }

  .estimation-create-modal-title {
    margin: 0 0 6px;
    font-size: 22px;
    font-weight: 700;
    color: #111827;
  }

  .estimation-create-modal-copy {
    max-width: 760px;
    margin: 0;
    font-size: 12px;
    line-height: 1.55;
    color: #4b5563;
  }

  .estimation-create-modal-badge {
    min-width: 210px;
    padding: 12px 14px;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: #ffffff;
  }

  .estimation-create-modal-badge-label {
    margin: 0 0 4px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6b7280;
  }

  .estimation-create-modal-badge-value {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    color: #111827;
  }

  .estimation-create-modal-grid {
    display: grid;
    grid-template-columns: minmax(250px, 295px) minmax(0, 1fr);
    gap: 16px;
    align-items: start;
  }

  .estimation-create-modal-sidebar {
    display: grid;
    gap: 12px;
  }

  .estimation-create-modal-sidebar-card {
    padding: 14px;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
  }

  .estimation-create-modal-sidebar-title {
    margin: 0 0 6px;
    font-size: 13px;
    font-weight: 700;
    color: #111827;
  }

  .estimation-create-modal-sidebar-copy {
    margin: 0;
    font-size: 11px;
    line-height: 1.5;
    color: #4b5563;
  }

  .estimation-create-modal-hint-list {
    display: grid;
    gap: 10px;
  }

  .estimation-create-modal-hint {
    padding: 10px 11px;
    border: 1px solid #eceff3;
    border-radius: 12px;
    background: #fbfbfc;
  }

  .estimation-create-modal-hint-label {
    margin: 0 0 3px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6b7280;
  }

  .estimation-create-modal-hint-value {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: #111827;
    word-break: break-word;
  }

  .estimation-create-modal-main {
    padding: 14px;
  }

  .estimation-create-modal-section {
    margin-top: 12px;
    padding: 14px;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
  }

  .estimation-create-modal-section:first-child {
    margin-top: 0;
  }

  .estimation-create-modal-section-head {
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid #eceff3;
  }

  .estimation-create-modal-section-kicker {
    display: inline-block;
    margin-bottom: 4px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6b7280;
  }

  .estimation-create-modal-section-title {
    margin: 0 0 4px;
    font-size: 14px;
    font-weight: 700;
    color: #111827;
  }

  .estimation-create-modal-section-copy {
    margin: 0;
    font-size: 11px;
    line-height: 1.45;
    color: #4b5563;
  }

  .estimation-create-modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid #eceff3;
  }

  .estimation-create-modal-footer-copy {
    margin: 0;
    font-size: 11px;
    line-height: 1.45;
    color: #4b5563;
  }

  .estimation-create-modal-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .estimation-create-modal-main hr {
    margin: 14px 0;
    border-color: #eceff3;
    opacity: 1;
  }

  .estimation-create-modal-main h4 {
    font-size: 15px;
    font-weight: 700;
    color: #111827;
  }

  .estimation-create-modal-main .card-body {
    padding: 14px;
  }

  .estimation-create-modal-loading {
    display: flex;
    min-height: 220px;
    align-items: center;
    justify-content: center;
  }

  @media (max-width: 1199px) {
    .estimation-create-modal-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 767px) {
    .estimation-create-modal-body,
    .estimation-create-modal-header,
    .estimation-create-modal-main,
    .estimation-create-modal-sidebar {
      padding: 12px;
    }

    .estimation-create-modal-header,
    .estimation-create-modal-footer {
      flex-direction: column;
      align-items: flex-start;
    }

    .estimation-create-modal-actions {
      width: 100%;
      justify-content: stretch;
      flex-direction: column;
    }

    .estimation-create-modal-actions .btn {
      width: 100%;
    }
  }
`;

export const ModalEstimacionEdit = ({ open, onClose, idEstimacion }) => {
   // Estado para manejar si el contenido del modal estÃƒÆ’Ã‚Â¡ cargando
   const [isLoading, setIsLoading] = useState(false);
   const dispatch = useDispatch();

const [formValues, setFormValues] = useState({
      // Datos de la primera lÃƒÆ’Ã‚Â­nea
      idEst: idEstimacion,
      location: "",
      entity: "",
      custbody38: "",
      proyecto_lead_est: "",
      entitystatus: "",
      pvneto: 0,

      // Datos de la segunda lÃƒÆ’Ã‚Â­nea
      rType: "estimacion",
      custbody18: "",
      /*MONTO TOTAL*/
      custbody_ix_total_amount: "",
      /*OPORTUNIDAD*/
      opportunity: "",
      /*PRECIO DE LISTA:*/
      custbody13: "",
      /*SUBSIDIARIA*/
      subsidiary: "",
      /*PRIMA TOTAL*/
      custbody39: 0,
      /*PRIMA%*/
      custbody60: 0.15,
      /*MONTO PRIMA NETA%*/
      custbody_ix_salesorder_monto_prima: 0,
      /*MONTO DESCUENTO DIRECTO%*/
      custbody132: 0,
      /*CASHBACK*/
      custbodyix_salesorder_cashback: 0,

      /*EXTRAS SOBRE EL PRECIO DE LISTA /diferencia*/
      custbody185: 0,
      //MONTO EXTRAS SOBRE EL PRECIO DE LISTA / EXTRAS PAGADAS POR EL CLIENTE
      custbody46: 0,
      //MONTO TOTAL DE CORTESÃƒÆ’Ã‚ÂAS
      custbody16: 0,

      //DESCRIPCIÃƒÆ’Ã¢â‚¬Å“N EXTRAS
      custbody47: "--",
      //DESCRIPCIÃƒÆ’Ã¢â‚¬Å“N DE LAS CORTESIAS
      custbody35: "--",
      //MONTO RESERVA
      rateReserva: "",

      fech_reserva: "",
      //MONTO ASIGNABLE PRIMA NETA:
      neta: "",
      /*-----------Nuevo*/
      //METODO DE PAGO
      // custbody75_estimacion
      custbody75: 0,

      //avance_diferenciado_hito16
      custbody67: 0,
      custbody_ix_salesorder_hito6: "",

      //mspt_contra_entrega
      custbody163: 0,
      //avance_diferenciado_hito11
      custbody62: 0.15,
      custbodyix_salesorder_hito1: "",

      //avnace_obra_hito12
      custbody63: 0.25,
      custbody_ix_salesorder_hito2: "",

      //avance_diferenciado_hito13
      custbody64: 0.25,
      custbody_ix_salesorder_hito3: "",

      //avance_diferenciado_hito14
      custbody65: 0.15,
      custbody_ix_salesorder_hito4: "",

      //avance_diferenciado_hito15
      custbody66: 0.15,
      custbody_ix_salesorder_hito5: "",
      hito_chek_uno: false,
      hito_chek_dos: false,
      hito_chek_tres: false,
      hito_chek_cuatro: false,
      hito_chek_cinco: false,
      hito_chek_seis: false,
      date_hito_1: "",
      date_hito_2: "",
      date_hito_3: "",
      date_hito_4: "",
      date_hito_5: "",
      date_hito_6: "",

      // ($('#PRERESERVA').prop('checked')) ? "T" : "F";
      custbody113: "",
      custbody191: 500,
      custbody188: 1,
      custbody189: "",
      custbody206: "",

      custbody190: "--",

      custbody176: "",

      //($('#chec_fra').prop('checked')) ? $("#custbody179").val() : 0;
      custbody179: 0,
      custbody180: 1,
      custbody193: "PRIMA",
      custbody179_date: "",

      //($('#chec_uica').prop('checked')) ? "T" : "F";
      custbody177: "",
      custbody181: 0,
      custbody182: 1,
      custbody194: "PRIMA",
      custbody182_date: "",

      // ($('#chec_extra').prop('checked')) ? "T" : "F";
      custbody178: "",
      custbody183: "",
      custbody184: 1,
      custbody195: "PRIMA",
      custbody184_date: "",

      prima_extra_uno: "",
      monto_extra_uno: 0,
      monto_tracto_uno: 1,
      desc_extra_uno: "PRIMA",
      custbody184_uno_date: "",

      prima_extra_dos: "",
      monto_extra_dos: "",
      monto_tracto_dos: 1,
      desc_extra_dos: "PRIMA",
      custbody184_dos_date: "",

      prima_extra_tres: "",
      monto_extra_tres: "",
      monto_tracto_tres: 1,
      desc_extra_tres: "PRIMA",
      custbody184_tres_date: "",

      //entrega estimada
      custbody114: "",
      isDiscounted: null,

      total_porcentaje: "100",
      valortotals: 0,
      custbody52: 0,
pre_reserva: false,
});

const summaryCards = [
   {
      label: "Entrega fecha",
      value: formValues.custbody114 || "N/A",
   },
   {
      label: "Nombre cliente",
      value: formValues.entity || "N/A",
   },
   {
      label: "Uni. exped. ligado vta",
      value: formValues.custbody38 || "N/A",
   },
   {
      label: "Proyecto",
      value: formValues.proyecto_lead_est || "N/A",
   },
   {
      label: "Estado",
      value: formValues.entitystatus || "N/A",
   },
   {
      label: "Oportunidad",
      value: formValues.tranid_oport || formValues.opportunity || "N/A",
   },
   {
      label: "Cierre previsto",
      value: formValues.expectedclosedate || "N/A",
   },
];

// Estado para manejar los errores del formulario
const [errors, setErrors] = useState({});

   // Maneja la selecciÃƒÆ’Ã‚Â³n de descuento por parte del usuario
   const handleDiscountSelection = (e) => {
      // Extrae el valor seleccionado del evento
      const { value } = e.target;

      // Actualiza el estado del formulario con el valor seleccionado.
      // Si el valor estÃƒÆ’Ã‚Â¡ vacÃƒÆ’Ã‚Â­o, se establece isDiscounted como null, de lo contrario, se guarda el valor.
      setFormValues({
         ...formValues, // Mantiene los valores actuales del formulario
         isDiscounted: value === "" ? null : value, // Asigna null si el valor es vacÃƒÆ’Ã‚Â­o, de lo contrario, asigna el valor
      });
   };

   // Maneja los cambios en los inputs del formulario
   const handleInputChange = (e) => {
      const { name, value, type, checked } = e.target;

      // Determina el nuevo valor segÃƒÆ’Ã‚Âºn el tipo de input
      const newValue = type === "checkbox" ? checked : value;

      // Lista de campos que requieren limpieza especÃƒÆ’Ã‚Â­fica
      const camposLimpieza = [
         "custbody132",
         "custbody46",
         "custbodyix_salesorder_cashback",
         "custbody52",
         "custbody16",
         "custbody39",
         "custbody60",
      ];

      // Mapeo de los campos relacionados con cada hito para facilitar la actualizaciÃƒÆ’Ã‚Â³n del estado
      const hitoMappings = {
         hito_chek_uno: { custbody: "custbody62", salesOrder: "custbodyix_salesorder_hito1", date: "date_hito_1" },
         hito_chek_dos: { custbody: "custbody63", salesOrder: "custbody_ix_salesorder_hito2", date: "date_hito_2" },
         hito_chek_tres: { custbody: "custbody64", salesOrder: "custbody_ix_salesorder_hito3", date: "date_hito_3" },
         hito_chek_cuatro: { custbody: "custbody65", salesOrder: "custbody_ix_salesorder_hito4", date: "date_hito_4" },
         hito_chek_cinco: { custbody: "custbody66", salesOrder: "custbody_ix_salesorder_hito5", date: "date_hito_5" },
         hito_chek_seis: { custbody: "custbody67", salesOrder: "custbody_ix_salesorder_hito6", date: "date_hito_6" },
      };

      // Verifica si el nombre del hito existe en el mapeo
      if (hitoMappings[name]) {
         // Extrae los nombres de los campos relevantes para el hito actual
         const { custbody, salesOrder, date } = hitoMappings[name];

         // Actualiza el estado del formulario
         setFormValues((prevValues) => {
            // Construye un nuevo objeto de estado con los valores actualizados
            const updatedValues = {
               ...prevValues, // Mantiene los valores previos del estado
               [custbody]: "0", // Reinicia el valor asociado al campo custbody del hito
               [salesOrder]: 0, // Reinicia el valor del campo de orden de venta asociado
               [date]: "", // Limpia la fecha asociada al hito
               [name]: newValue, // Actualiza el valor del checkbox del hito
            };

            // Recalcula los montos de los hitos usando los valores actualizados
            recalcultarMontoshitos(updatedValues, setFormValues);

            return updatedValues; // Retorna el nuevo estado para actualizar
         });
      }

      // Aplica reglas especÃƒÆ’Ã‚Â­ficas de limpieza para ciertos campos
      // Si el campo actual estÃƒÆ’Ã‚Â¡ en la lista de `camposLimpieza`, procesa el valor con una funciÃƒÆ’Ã‚Â³n personalizada.
      // De lo contrario, usa el valor nuevo sin procesamiento adicional.
      const valorProcesado = camposLimpieza.includes(name) ? procesarValor(name, value) : newValue;

      // Define una lista de campos que requieren cÃƒÆ’Ã‚Â¡lculos complejos antes de ser actualizados
      const camposCalculos = ["custbody132", "custbody46", "custbodyix_salesorder_cashback", "custbody52", "custbody16"];
      if (camposCalculos.includes(name)) {
         // Realiza cÃƒÆ’Ã‚Â¡lculos complejos especÃƒÆ’Ã‚Â­ficos para el campo actual
         actualizarConCalculos(name, valorProcesado);
         return; // Termina la ejecuciÃƒÆ’Ã‚Â³n para evitar pasos adicionales innecesarios
      }

      // Maneja cambios especÃƒÆ’Ã‚Â­ficos en el campo de "prima total"
      // Se utiliza una funciÃƒÆ’Ã‚Â³n especializada para actualizar este campo
      if (name === "custbody39") {
         actualizarPrimaTotal(name, valorProcesado);
         return; // Detiene el flujo despuÃƒÆ’Ã‚Â©s de manejar este caso especÃƒÆ’Ã‚Â­fico
      }

      //limpiamos lo valores de las primas cuando se deselecciona el checkbox
      if (name === "custbody39") {
         actualizarPrimaTotal(name, valorProcesado);
         return; // Detiene el flujo despuÃƒÆ’Ã‚Â©s de manejar este caso especÃƒÆ’Ã‚Â­fico
      }

      // /// Maneja cambios relacionados con porcentajes
      // // Define una lista de campos que representan porcentajes y requieren un manejo especÃƒÆ’Ã‚Â­fico
      const camposPorcentaje = [
         "custbody60",
         "custbody179",
         "custbody180",
         "custbody181",
         "custbody182",
         "custbody183",
         "custbody184",
         "monto_extra_uno",
         "monto_tracto_uno",
         "monto_extra_dos",
         "monto_extra_tres",
         "monto_tracto_tres",
      ];

      // Si el campo pertenece a `camposPorcentaje`, utiliza la funciÃƒÆ’Ã‚Â³n para actualizar el valor del porcentaje
      if (camposPorcentaje.includes(name)) {
         actualizarPorcentaje(name, valorProcesado);
         return; // Detiene el flujo despuÃƒÆ’Ã‚Â©s de manejar el campo
      }

      // Define manejadores especÃƒÆ’Ã‚Â­ficos para ciertos campos, ejecutando lÃƒÆ’Ã‚Â³gica personalizada
      const manejadores = {
         custbody75: () => actualizarCustbody75(name, valorProcesado), // LÃƒÆ’Ã‚Â³gica para el campo `custbody75`
         custbody62: () => actualizarHitoDiferenciado(name, valorProcesado, "custbodyix_salesorder_hito1"), // Hito 1
         custbody63: () => actualizarHitoDiferenciado(name, valorProcesado, "custbody_ix_salesorder_hito2"), // Hito 2
         custbody64: () => actualizarHitoDiferenciado(name, valorProcesado, "custbody_ix_salesorder_hito3"), // Hito 3
         custbody65: () => actualizarHitoDiferenciado(name, valorProcesado, "custbody_ix_salesorder_hito4"), // Hito 4
         custbody66: () => actualizarHitoDiferenciado(name, valorProcesado, "custbody_ix_salesorder_hito5"), // Hito 5
         custbody67: () => actualizarHitoDiferenciado(name, valorProcesado, "custbody_ix_salesorder_hito6"), // Hito 6
      };

      // Define manejadores especÃƒÆ’Ã‚Â­ficos para actualizar montos asociados a los hitos
      const manejadoresMonto = {
         custbodyix_salesorder_hito1: () => actualizarHitoDiferenciadoMonto(name, valorProcesado, "custbody62"), // Monto Hito 1
         custbody_ix_salesorder_hito2: () => actualizarHitoDiferenciadoMonto(name, valorProcesado, "custbody63"), // Monto Hito 2
         custbody_ix_salesorder_hito3: () => actualizarHitoDiferenciadoMonto(name, valorProcesado, "custbody64"), // Monto Hito 3
         custbody_ix_salesorder_hito4: () => actualizarHitoDiferenciadoMonto(name, valorProcesado, "custbody65"), // Monto Hito 4
         custbody_ix_salesorder_hito5: () => actualizarHitoDiferenciadoMonto(name, valorProcesado, "custbody66"), // Monto Hito 5
         custbody_ix_salesorder_hito6: () => actualizarHitoDiferenciadoMonto(name, valorProcesado, "custbody67"), // Monto Hito 6
      };

      // Verifica si el campo tiene un manejador asignado y lo ejecuta
      if (manejadores[name]) {
         manejadores[name](); // LÃƒÆ’Ã‚Â³gica especÃƒÆ’Ã‚Â­fica para el campo
      }

      // Verifica si el campo tiene un manejador de monto asignado y lo ejecuta
      if (manejadoresMonto[name]) {
         manejadoresMonto[name](); // LÃƒÆ’Ã‚Â³gica especÃƒÆ’Ã‚Â­fica para actualizar el monto asociado al campo
      }

      // ActualizaciÃƒÆ’Ã‚Â³n genÃƒÆ’Ã‚Â©rica para otros campos
      // Si el campo no requiere manejo especial, simplemente actualiza su valor en el estado del formulario
      setFormValues({
         ...formValues, // Mantiene los valores actuales del formulario
         [name]: valorProcesado, // Actualiza el valor del campo especÃƒÆ’Ã‚Â­fico con el valor procesado
      });

      // Limpia errores relacionados con el campo
      // Establece el mensaje de error del campo como vacÃƒÆ’Ã‚Â­o para indicar que no hay errores
      setErrors({
         ...errors, // Mantiene los errores existentes de otros campos
         [name]: "", // Elimina cualquier error asociado al campo actualizado
      });

      // Mapa de campos a restablecer por cada checkbox de primas
      const mapaPrimas = {
         custbody176: {
            campos: ["custbody179", "custbody179_date", "custbody180", "custbody193"],
            numero: 1,
         },
         custbody177: {
            campos: ["custbody181", "custbody182_date", "custbody182", "custbody194"],
            numero: 2,
         },
         custbody178: {
            campos: ["custbody183", "custbody184_date", "custbody184", "custbody195"],
            numero: 3,
         },
         prima_extra_uno: {
            campos: ["monto_extra_uno", "custbody184_uno_date", "monto_tracto_uno", "desc_extra_uno"],
            numero: 4,
         },
         prima_extra_dos: {
            campos: ["monto_extra_dos", "custbody184_dos_date", "monto_tracto_dos", "desc_extra_dos"],
            numero: 5,
         },
         prima_extra_tres: {
            campos: ["monto_extra_tres", "custbody184_tres_date", "monto_tracto_tres", "desc_extra_tres"],
            numero: 6,
         },
      };

      // LÃƒÆ’Ã‚Â³gica ÃƒÆ’Ã‚Âºnica para manejar todas las primas
      if (mapaPrimas[name] && !newValue) {
         // Obtener configuraciÃƒÆ’Ã‚Â³n de la prima actual
         const { campos, numero } = mapaPrimas[name];

         // Actualizar porcentaje primero
         actualizarPorcentaje(name, valorProcesado);

         // Restablecer campos relacionados
         setFormValues((prevValues) => ({
            ...prevValues,
            [campos[0]]: "0", // Restablece monto
            [campos[1]]: "", // Limpia fecha
            [campos[2]]: 1, // Tractos a 1
            [campos[3]]: `PRIMA ${numero}`, // DescripciÃƒÆ’Ã‚Â³n estÃƒÆ’Ã‚Â¡ndar
         }));
      }
   };

   // Procesa el valor de campos especÃƒÆ’Ã‚Â­ficos con reglas adicionales
   const procesarValor = (name, value) => {
      // Aplica una limpieza inicial al valor utilizando una funciÃƒÆ’Ã‚Â³n genÃƒÆ’Ã‚Â©rica
      let processedValue = limpiarCampos(value);

      // Aplica reglas especÃƒÆ’Ã‚Â­ficas para el campo "custbody132"
      if (name === "custbody132") {
         // Asegura que el valor procesado tenga un solo guion inicial
         processedValue = `-${processedValue.replace(/^-+/, "")}`;

         // Si el valor es "-0" o solo "-", lo ajusta a una cadena vacÃƒÆ’Ã‚Â­a para evitar valores invÃƒÆ’Ã‚Â¡lidos
         if (processedValue === "-0" || processedValue === "-") {
            processedValue = ""; // Establece como vacÃƒÆ’Ã‚Â­o para mantener consistencia
         }
      }

      // Retorna el valor procesado (ya sea limpio o con las reglas especÃƒÆ’Ã‚Â­ficas aplicadas)
      return processedValue;
   };

   // Actualiza el estado con cÃƒÆ’Ã‚Â¡lculos complejos segÃƒÆ’Ã‚Âºn el campo modificado
   const actualizarConCalculos = (name, value) => {
      // Actualiza el estado utilizando la funciÃƒÆ’Ã‚Â³n `setFormValues`
      setFormValues((prevValues) => {
         // Copia el estado actual y actualiza el valor del campo modificado
         const updatedValues = { ...prevValues, [name]: value };

         // Calcula el precio de venta neto basado en los valores actualizados
         const pvn = precioVentaNeto(updatedValues);

         // Calcula el monto total basado en los valores actualizados
         const montot = montoTotal(updatedValues);

         // Calcula la prima total utilizando el monto total y un valor porcentual (`custbody60`)
         const montoPrimaTotal = calcularPrimaToal(montot, updatedValues.custbody60);

         // Calcula la prima neta basÃƒÆ’Ã‚Â¡ndose en la prima total y otros valores actualizados
         const montoPrimaNet = montoPrimaNeta(montoPrimaTotal, updatedValues);

         // Calcula el valor asignable para la prima utilizando la prima total y valores adicionales
         const asignable = calculoPrimaAsignable(montoPrimaTotal, updatedValues);

         // Ejecuta cÃƒÆ’Ã‚Â¡lculos especÃƒÆ’Ã‚Â­ficos adicionales, si es necesario, utilizando los valores actualizados
         ejecutarCalculosEspecificos(updatedValues, montot, montoPrimaTotal);

         // Retorna el nuevo estado con todos los valores calculados incluidos
         return {
            ...updatedValues, // Mantiene los valores actualizados del estado
            pvneto: pvn, // Asigna el precio de venta neto
            neta: asignable, // Asigna la prima asignable calculada
            custbody_ix_total_amount: montot, // Asigna el monto total calculado
            custbody39: montoPrimaTotal, // Asigna la prima total calculada
            custbody_ix_salesorder_monto_prima: montoPrimaNet, // Asigna la prima neta calculada
         };
      });
   };

   // Actualiza el estado al modificar custbody39 (Prima total)
   const actualizarPrimaTotal = (name, value) => {
      // Primero, crear el objeto con los valores actualizados
      const updatedValues = { ...formValues, [name]: value };

      // Calcular todos los valores derivados
      const total = calculoPrimaTotalPorcentaje(updatedValues);
      const montoPrimaNet = montoPrimaNeta(value, updatedValues);
      const asignable = calculoPrimaAsignable(value, updatedValues);


      // Crear el objeto final de valores
      const valoresFinales = {
         ...updatedValues,
         custbody60: total,
         custbody_ix_salesorder_monto_prima: montoPrimaNet,
         neta: asignable
      };


      console.clear()


      // este modifica si es por monto
      // Actualizar el estado con los nuevos valores
      setFormValues(valoresFinales);
      // Luego ejecutar cÃƒÆ’Ã‚Â¡lculos especÃƒÆ’Ã‚Â­ficos con los valores finales ya calculados
      ejecutarCalculosEspecificos(
         valoresFinales,
         valoresFinales.custbody_ix_total_amount,
         valoresFinales.custbody39
      );
   };

   /**
      * Maneja la actualizaciÃƒÆ’Ã‚Â³n de campos relacionados con porcentajes en el formulario.
      * Realiza cÃƒÆ’Ã‚Â¡lculos basados en el valor actualizado y actualiza el estado del formulario
      * con los nuevos valores calculados.
      *
      * @param {string} name - El nombre del campo que se estÃƒÆ’Ã‚Â¡ actualizando.
      * @param {number} value - El nuevo valor del campo.
      */
   const actualizarPorcentaje = (name, value) => {
      // 1. Crea updatedValues fuera de setFormValues para poder usarlo despuÃƒÆ’Ã‚Â©s
      const updatedValues = { ...formValues, [name]: value };

      // 2. Calcula el monto total basado en el porcentaje actualizado.
      const total = calculoMontoSegunPorcentaje(updatedValues);

      // 3. Calcula la prima neta basada en el monto total y los valores actualizados.
      const montoPrimaNet = montoPrimaNeta(total, updatedValues);

      // 4. Calcula la prima asignable utilizando el monto total y los valores actuales.
      const asignable = calculoPrimaAsignable(total, updatedValues);

      // 5. Prepara el objeto final con todas las actualizaciones necesarias
      let valoresFinales = { ...updatedValues, neta: asignable };

      // 6. Si el campo actualizado es "custbody60", aÃƒÆ’Ã‚Â±ade campos adicionales
      if (name === "custbody60") {
         valoresFinales = {
            ...valoresFinales,
            custbody39: total,
            custbody_ix_salesorder_monto_prima: montoPrimaNet
         };
      }

      // 7. Actualiza el estado con los valores finales
      setFormValues(valoresFinales);

      // este modifica si es por % 

      // 8. Ejecuta cÃƒÆ’Ã‚Â¡lculos especÃƒÆ’Ã‚Â­ficos con los mismos valores actualizados
      ejecutarCalculosEspecificos(
         valoresFinales,
         valoresFinales.custbody_ix_total_amount,
         valoresFinales.custbody39
      );
   };
   // Maneja actualizaciones del campo custbody75
   const actualizarCustbody75 = (name, value) => {
      setFormValues((prevValues) => {
         // Copia el estado actual y actualiza el valor de "custbody75"
         let updatedValues = { ...prevValues, [name]: value };

         if (updatedValues.custbody75 === 1 || updatedValues.custbody75 === "1") {
            updatedValues = {
               ...updatedValues,  // Use updatedValues instead of prevValues to keep the custbody75 update
               date_hito_6: updatedValues.custbody114,
               custbody67: "100%"
            };
         }



         // Calcula el precio de venta neto basado en los valores actualizados
         const pvn = precioVentaNeto(updatedValues);

         // Calcula el monto total basado en los valores actualizados
         const montot = montoTotal(updatedValues);

         // Calcula la prima total utilizando el monto total y un porcentaje definido (`custbody60`)
         const montoPrimaTotal = calcularPrimaToal(montot, updatedValues.custbody60);

         // Calcula la prima neta utilizando la prima total y los valores actualizados
         const montoPrimaNet = montoPrimaNeta(montoPrimaTotal, updatedValues);

         // Calcula la prima asignable utilizando la prima total y los valores actualizados
         const asignable = calculoPrimaAsignable(montoPrimaTotal, updatedValues);

         // Ejecuta cÃƒÆ’Ã‚Â¡lculos adicionales personalizados basados en los valores calculados
         ejecutarCalculosEspecificos(updatedValues, montot, montoPrimaTotal);

         // Retorna el nuevo estado actualizado con los valores calculados
         return {
            ...updatedValues, // Mantiene los valores existentes del estado
            pvneto: pvn, // Actualiza el precio de venta neto calculado
            neta: asignable, // Actualiza la prima asignable calculada
            custbody_ix_total_amount: montot, // Actualiza el monto total calculado
            custbody39: montoPrimaTotal, // Actualiza la prima total calculada
            custbody_ix_salesorder_monto_prima: montoPrimaNet, // Actualiza la prima neta calculada
         };
      });
   };

   // Maneja actualizaciones especÃƒÆ’Ã‚Â­ficas para custbody62
   const actualizarHitoDiferenciado = (name, value, campoActualizar) => {
      setFormValues((prevValues) => {
         // Copia el estado actual y actualiza el valor del campo modificado
         const updatedValues = { ...prevValues, [name]: value };

         // Calcula el monto total y la prima total utilizando los valores actualizados
         const montot = montoTotal(updatedValues);

         const montoPrimaTotal = calcularPrimaToal(montot, updatedValues.custbody60);

         // Porcentaje inicial (100%)
         const porcentajeInicial = 100;

         // Define los porcentajes relacionados a los hitos, considerando si estÃƒÆ’Ã‚Â¡n marcados como chequeados
         const porcentajes = [
            updatedValues.hito_chek_uno === true ? updatedValues.custbody62 : 0,
            updatedValues.hito_chek_dos === true ? updatedValues.custbody63 : 0,
            updatedValues.hito_chek_tres === true ? updatedValues.custbody64 : 0,
            updatedValues.hito_chek_cuatro === true ? updatedValues.custbody65 : 0,
            updatedValues.hito_chek_cinco === true ? updatedValues.custbody66 : 0,
            updatedValues.hito_chek_seis === true ? updatedValues.custbody67 : 0,
         ];

         // Convertir directamente a porcentajes (multiplicando por 100)
         const porcentajesEnPorciento = porcentajes.map(p => p * 100);

         // Suma los porcentajes 
         const sumaPorcentajes = porcentajesEnPorciento.reduce((sum, value) => sum + value, 0);

         // Calcula el porcentaje restante
         const porcentajeRestante = porcentajeInicial - sumaPorcentajes;


         // Verifica si la suma de porcentajes excede el 100%
         if (sumaPorcentajes > 100) {
            alert(
               `La suma de los porcentajes no puede exceder el 100%. El porcentaje actual es del ${sumaPorcentajes.toFixed(2)}%. Por favor, ajusta los valores.`
            );
         }

         // Calcula y actualiza el campo dinÃƒÆ’Ã‚Â¡mico utilizando una funciÃƒÆ’Ã‚Â³n especÃƒÆ’Ã‚Â­fica
         calculoHito1Diferenciado(
            value, // Nuevo porcentaje ingresado
            montot, // Monto total calculado
            montoPrimaTotal, // Prima total calculada
            setFormValues, // FunciÃƒÆ’Ã‚Â³n para actualizar el formulario
            updatedValues, // Valores actuales del formulario
            campoActualizar, // Campo que debe actualizarse dinÃƒÆ’Ã‚Â¡micamente
            porcentajeRestante, // Porcentaje restante calculado
            updatedValues, // Estado actualizado
         );

         return updatedValues; // Retorna el estado actualizado para reflejar los cambios
      });
   };

   // Maneja actualizaciones especÃƒÆ’Ã‚Â­ficas para los montos de hitos
   const actualizarHitoDiferenciadoMonto = (name, value, campoActualizar) => {
      console.clear();
      setFormValues((prevValues) => {
         // Copia y actualiza el estado con el nuevo valor
         const updatedValues = { ...prevValues, [name]: value };
         // Obtiene el monto inicial actualizado
         const montoInicial = updatedValues.custbody163;

         // Calcula el porcentaje - limpia los valores de cualquier formato
         const montoInicialNumerico = parseFloat(String(montoInicial).replace(/,/g, ''));
         const valueNumerico = parseFloat(String(value).replace(/,/g, ''));

         // Calcula el porcentaje decimal (0-1)
         const porcentajeDecimal = valueNumerico / montoInicialNumerico;

         // Redondea a 2 decimales para evitar errores de punto flotante
         const porcentajeRedondeado = Math.round(porcentajeDecimal * 100) / 100;

         // Guarda el valor formateado con 2 decimales
         const porcentajeFormateado = porcentajeRedondeado.toFixed(2);

         const valoresActualizados = {
            ...prevValues,
            [campoActualizar]: porcentajeFormateado
         };


         // Porcentaje inicial (100%)
         const porcentajeInicial = 100;

         // Define los porcentajes relacionados a los hitos, considerando si estÃƒÆ’Ã‚Â¡n marcados como chequeados
         // y multiplicando por 100 para convertir de decimal a porcentaje
         const porcentajes = [
            updatedValues.hito_chek_uno === true ? parseFloat(valoresActualizados.custbody62) : 0,
            updatedValues.hito_chek_dos === true ? parseFloat(valoresActualizados.custbody63) : 0,
            updatedValues.hito_chek_tres === true ? parseFloat(valoresActualizados.custbody64) : 0,
            updatedValues.hito_chek_cuatro === true ? parseFloat(valoresActualizados.custbody65) : 0,
            updatedValues.hito_chek_cinco === true ? parseFloat(valoresActualizados.custbody66) : 0,
            updatedValues.hito_chek_seis === true ? parseFloat(valoresActualizados.custbody67) : 0,
         ];

         // Convertir de decimal a porcentaje (multiplicando por 100)
         const porcentajesEnPorciento = porcentajes.map(p => p * 100);

         // Suma los porcentajes 
         const sumaPorcentajes = porcentajesEnPorciento.reduce((sum, value) => sum + value, 0);

         // Calcula el porcentaje restante
         const porcentajeRestante = porcentajeInicial - sumaPorcentajes;


         // Verifica si la suma de porcentajes excede el 100%
         if (sumaPorcentajes > 100) {
            alert(
               `La suma de los porcentajes no puede exceder el 100%. El porcentaje actual es del ${sumaPorcentajes.toFixed(2)}%. Por favor, ajusta los valores.`
            );
         }

         // Crear un nuevo estado actualizado antes de llamar a la funciÃƒÆ’Ã‚Â³n de cÃƒÆ’Ã‚Â¡lculo
         const updatedFormValues = {
            ...updatedValues,
            total_porcentaje: porcentajeRestante.toFixed(2)
         };

         // Llamar a la funciÃƒÆ’Ã‚Â³n de cÃƒÆ’Ã‚Â¡lculo con los valores correctos
         calculoHito1DiferenciadoMonto(
            montoInicial, // Monto inicial actualizado
            campoActualizar, // Campo a actualizar
            updatedFormValues, // Formulario actualizado
            setFormValues, // Setter del estado
            name, // Nombre del campo modificado
            porcentajeRestante,
         );

         // Retornar el nuevo estado para actualizar correctamente
         return updatedFormValues;
      });
   };

   // Ejecuta cÃƒÆ’Ã‚Â¡lculos especÃƒÆ’Ã‚Â­ficos segÃƒÆ’Ã‚Âºn el tipo de operaciÃƒÆ’Ã‚Â³n
   const ejecutarCalculosEspecificos = (updatedValues, montot, montoPrimaTotal) => {
      // Determina el tipo de operaciÃƒÆ’Ã‚Â³n a partir del valor en custbody75
      const tipoOperacion = parseInt(updatedValues.custbody75, 10);

      // LÃƒÆ’Ã‚Â³gica para cada tipo de operaciÃƒÆ’Ã‚Â³n
      if (tipoOperacion === 2) {
         // CÃƒÆ’Ã‚Â¡lculo para avance de obra
         setFormValues((prevValues) => ({
            ...prevValues, // Conserva los valores existentes del formulario.
            custbody62: 0.15, // Actualiza el campo `hito 1` con el monto total calculado.
            custbody63: 0.25, // Actualiza el campo `hito 2` con el monto total calculado.
            custbody64: 0.25, // Actualiza el campo `hito 3` con el monto total calculado.
            custbody65: 0.15, // Actualiza el campo `hito 4` con el monto total calculado.
            custbody66: 0.15, // Actualiza el campo `hito 5` con el monto total calculado.
            custbody67: 0.05, // Actualiza el campo `hito 6` con el monto total calculado.
         }));
         calculoAvenceObra(updatedValues, setFormValues, montot, montoPrimaTotal);
      } else if (tipoOperacion === 1) {
         // CÃƒÆ’Ã‚Â¡lculos para operaciones contra entrega
         calculoContraEntregaSinprimaTotal(updatedValues, setFormValues); // Sin prima total
      } else if (tipoOperacion === 7) {
         setFormValues((prevValues) => ({
            ...prevValues, // Conserva los valores existentes del formulario.
            custbody62: 0, // Actualiza el campo `hito 1` con el monto total calculado.
            custbody63: 0, // Actualiza el campo `hito 2` con el monto total calculado.
            custbody64: 0, // Actualiza el campo `hito 3` con el monto total calculado.
            custbody65: 0, // Actualiza el campo `hito 4` con el monto total calculado.
            custbody66: 0, // Actualiza el campo `hito 5` con el monto total calculado.
            custbody67: 0, // Actualiza el campo `hito 6` con el monto total calculado.
            valortotals: 0, // Actualiza el campo `valor por asignar` con el monto total calculado.
            total_porcentaje: "100%", // actualiza el campo `total porcentaje` con el valor 100%.
            custbodyix_salesorder_hito1: 0, // Actualiza el campo `hito 1` con el monto total calculado.
            custbody_ix_salesorder_hito2: 0, // Actualiza el campo `hito 2` con el monto total calculado.
            custbody_ix_salesorder_hito3: 0, // Actualiza el campo `hito 3` con el monto total calculado.
            custbody_ix_salesorder_hito4: 0, // Actualiza el campo `hito 4` con el monto total calculado.
            custbody_ix_salesorder_hito5: 0, // Actualiza el campo `hito 5` con el monto total calculado.
            custbody_ix_salesorder_hito6: 0, // Actualiza el campo `hito 6` con el monto total calculado.
         }));
         // CÃƒÆ’Ã‚Â¡lculo para avance diferenciado
         calculoAvanceDiferenciado(updatedValues, setFormValues, montot, montoPrimaTotal);
      }
   };

   // Reglas de validaciÃƒÆ’Ã‚Â³n: Configuran los campos del formulario indicando si son obligatorios y el mensaje de error correspondiente
   const validationRules = {
      // ValidaciÃƒÆ’Ã‚Â³n del cliente
      entity: {
         required: false, // Este campo no es obligatorio
         message: "El nombre del cliente es obligatorio", // Mensaje en caso de que sea requerido en el futuro
      },

      // Validaciones para campos relacionados con pre-reserva
      custbody191: {
         required: !!formValues.pre_reserva, // Obligatorio solo si hay una pre-reserva activa
         message: "Pre-reserva: Este campo es obligatorio y debe ser seleccionado.",
      },
      custbody189: {
         required: !!formValues.pre_reserva,
         message: "Pre-reserva: Este campo es obligatorio y debe ser seleccionado.",
      },
      custbody206: {
         required: !!formValues.pre_reserva,
         message: "Pre-reserva: Este campo es obligatorio y debe ser seleccionado.",
      },
      custbody190: {
         required: !!formValues.pre_reserva,
         message: "Pre-reserva: Este campo es obligatorio y debe ser seleccionado.",
      },

      // Validaciones para campos relacionados con primas (custbody176)
      custbody179: {
         required: !!formValues.custbody176,
         message: "Este valor es requerido",
      },
      custbody179_date: {
         required: !!formValues.custbody176,
         message: "Este valor es requerido",
      },
      custbody180: {
         required: !!formValues.custbody176,
         message: "Este valor es requerido",
      },
      custbody193: {
         required: !!formValues.custbody176,
         message: "Este valor es requerido",
      },

      // Validaciones para otras primas relacionadas (custbody177 y custbody178)
      custbody181: {
         required: !!formValues.custbody177,
         message: "Este valor es requerido",
      },
      custbody182_date: {
         required: !!formValues.custbody177,
         message: "Este valor es requerido",
      },
      custbody182: {
         required: !!formValues.custbody177,
         message: "Este valor es requerido",
      },
      custbody194: {
         required: !!formValues.custbody177,
         message: "Este valor es requerido",
      },

      custbody183: {
         required: !!formValues.custbody178,
         message: "Este valor es requerido",
      },
      custbody184_date: {
         required: !!formValues.custbody178,
         message: "Este valor es requerido",
      },
      custbody184: {
         required: !!formValues.custbody178,
         message: "Este valor es requerido",
      },
      custbody195: {
         required: !!formValues.custbody178,
         message: "Este valor es requerido",
      },

      // Validaciones para primas adicionales (prima_extra_uno, prima_extra_dos, prima_extra_tres)
      monto_extra_uno: {
         required: !!formValues.prima_extra_uno,
         message: "Este valor es requerido",
      },
      custbody184_uno_date: {
         required: !!formValues.prima_extra_uno,
         message: "Este valor es requerido",
      },
      monto_tracto_uno: {
         required: !!formValues.prima_extra_uno,
         message: "Este valor es requerido",
      },

      monto_extra_dos: {
         required: !!formValues.prima_extra_dos,
         message: "Este valor es requerido",
      },
      custbody184_dos_date: {
         required: !!formValues.prima_extra_dos,
         message: "Este valor es requerido",
      },
      monto_tracto_dos: {
         required: !!formValues.prima_extra_dos,
         message: "Este valor es requerido",
      },
      desc_extra_dos: {
         required: !!formValues.prima_extra_dos,
         message: "Este valor es requerido",
      },

      monto_extra_tres: {
         required: !!formValues.prima_extra_tres,
         message: "Este valor es requerido",
      },
      custbody184_tres_date: {
         required: !!formValues.prima_extra_tres,
         message: "Este valor es requerido",
      },
      monto_tracto_tres: {
         required: !!formValues.prima_extra_tres,
         message: "Este valor es requerido",
      },
      desc_extra_tres: {
         required: !!formValues.prima_extra_tres,
         message: "Este valor es requerido",
      },

      // ValidaciÃƒÆ’Ã‚Â³n de campos esenciales
      custbody39: {
         required: true, // Campo siempre obligatorio
         message: "Este valor es requerido",
      },
      custbody60: {
         required: true, // Campo siempre obligatorio
         message: "Este valor es requerido",
      },

      date_hito_6: {
         required: parseInt(formValues.custbody75, 10) === 1 ? true : false, // Campo obligatorio si custbody75 es igual a 2
         message: "Este valor es requerido",
      },
   };

   // Valida el formulario
   const validateForm = () => {
      const newErrors = {}; // Objeto para almacenar los errores detectados

      // Itera sobre las reglas de validaciÃƒÆ’Ã‚Â³n definidas
      Object.keys(validationRules).forEach((field) => {
         const rule = validationRules[field]; // Reglas de validaciÃƒÆ’Ã‚Â³n para el campo actual
         const fieldValue = formValues[field]; // Valor actual del campo en el formulario

         // Verifica si el campo es obligatorio y si su valor es vÃƒÆ’Ã‚Â¡lido
         if (
            rule.required && // La regla indica que el campo es obligatorio
            (!fieldValue || (typeof fieldValue === "string" && !fieldValue.trim())) // El valor estÃƒÆ’Ã‚Â¡ vacÃƒÆ’Ã‚Â­o o no contiene texto
         ) {
            // Agrega un mensaje de error para el campo actual
            newErrors[field] = rule.message || "Este campo es obligatorio";
         }
      });

      // Actualiza los errores en el estado del formulario
      setErrors(newErrors);

      // Retorna `true` si no se detectaron errores, `false` en caso contrario
      return Object.keys(newErrors).length === 0;
   };

   // Maneja el envÃƒÆ’Ã‚Â­o del formulario
   const handleSubmit = async (e) => {
      e.preventDefault();

      if (validateForm()) {
         const confirmEdit = window.confirm("Ãƒâ€šÃ‚Â¿Desea editar la estimaciÃƒÆ’Ã‚Â³n?");

         if (confirmEdit) {
            // Mostrar Swal de carga
            Swal.fire({
               title: "Editando estimaciÃƒÆ’Ã‚Â³n...",
               text: "Por favor espere",
               allowOutsideClick: false,
               allowEscapeKey: false,
               allowEnterKey: false,
               showConfirmButton: false,
               didOpen: () => {
                  Swal.showLoading();
               },
               customClass: {
                  popup: "swal-on-top", // Clase personalizada para asegurar que estÃƒÆ’Ã‚Â© por encima
               },
            });

            try {
               const result = await dispatch(editarEstimacionFormulario(formValues));
               let ExTraerResultado = result.data["Detalle"];

               // Cerrar el Swal de carga
               Swal.close();

               if (ExTraerResultado.Status == 200) {
                  Swal.fire({
                     position: "top-end",
                     icon: "success",
                     title: "Se editÃƒÆ’Ã‚Â³ la estimaciÃƒÆ’Ã‚Â³n",
                     showConfirmButton: false,
                     timer: 2500,
                     customClass: {
                        popup: "swal-on-top",
                     },
                  }).then((result) => {
                     window.location.reload();
                  });
               }

               if (ExTraerResultado.Status == 500) {
                  if (
                     result.data["Detalle"].Error.message ==
                     "El campo custcolfecha_pago_proyectado contenÃƒÆ’Ã‚Â­a mÃƒÆ’Ã‚Â¡s del nÃƒÆ’Ã‚Âºmero mÃƒÆ’Ã‚Â¡ximo ( 10 ) de caracteres permitidos."
                  ) {
                     return Swal.fire({
                        title: "Lo sentimos, ha ocurrido un error.  : El campo de fecha debe estar seleccionado o tener el formato correcto.",
                        icon: "question",
                        width: "40em",
                        padding: "0 0 1.25em",
                        iconHtml: "ÃƒËœÃ…Â¸",
                        confirmButtonText: "OK",
                        cancelButtonText: "CORREGUIR",
                        showCancelButton: true,
                        showCloseButton: true,
                        customClass: {
                           popup: "swal-on-top",
                        },
                     });
                  } else {
                     return Swal.fire({
                        title:
                           "Detalle de error : " +
                           result.data["Detalle"].Error.message +
                           ",  \nLo sentimos, favor revisar este error con su administrador.",
                        icon: "question",
                        iconHtml: "ÃƒËœÃ…Â¸",
                        width: "40em",
                        padding: "0 0 1.25em",
                        confirmButtonText: "OK",
                        cancelButtonText: "CORREGUIR",
                        showCancelButton: true,
                        showCloseButton: true,
                        customClass: {
                           popup: "swal-on-top",
                        },
                     });
                  }
               }
            } catch (error) {
               // Cerrar el Swal de carga en caso de error
               Swal.close();

               // Mostrar error
               Swal.fire({
                  icon: "error",
                  title: "Error",
                  text: "Ha ocurrido un error al editar la estimaciÃƒÆ’Ã‚Â³n",
                  customClass: {
                     popup: "swal-on-top",
                  },
               });
            }
         }
      } else {
         alert("Algunos campos no pueden quedar vacÃƒÆ’Ã‚Â­os. Por favor, verifÃƒÆ’Ã‚Â­quelos.");
      }
   };

   useEffect(() => {
      if (!open) return; // Salir temprano si el modal no estÃƒÆ’Ã‚Â¡ abierto

      const fetchEstimacion = async () => {
         try {
            setIsLoading(true); // Activar indicador de carga

            const formatDate = (dateStr) => {
               if (!dateStr) return "";
               const [day, month, year] = dateStr.includes("/") ? dateStr.split("/") : [];
               return dateStr.includes("/") ? `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}` : dateStr;
            };

            const formatNumber = (value) => {
               const cleanValue = typeof value === "string" ? value.replace(/[^0-9.-]/g, "") : value;
               return new Intl.NumberFormat("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
               }).format(Number(cleanValue) || 0);
            };

            const estimacionData = await dispatch(extarerEstimacion(idEstimacion));
            const transactionData = estimacionData?.netsuite?.Detalle || {};

            const financialData = {
               listPrice: formatNumber(transactionData?.data?.fields?.custbody13),
               directDiscount: formatNumber(transactionData?.data?.fields?.custbody132),
               extrasPaidByClient: formatNumber(transactionData?.data?.fields?.custbody46),
               cashback: formatNumber(transactionData?.data?.fields?.custbodyix_salesorder_cashback),
               courtesyAmount: formatNumber(transactionData?.data?.fields?.custbody16),
               custbody52: formatNumber(transactionData?.data?.fields?.custbody52),
               custbody18: formatNumber(transactionData?.data?.fields?.custbody18),
               custbody_ix_total_amount: formatNumber(transactionData?.data?.fields?.custbody_ix_total_amount) || 0,
               custbody39: formatNumber(transactionData?.data?.fields?.custbody39),
               custbody_ix_salesorder_monto_prima: formatNumber(transactionData?.data?.fields?.custbody_ix_salesorder_monto_prima),
            };

            const netSalePrice = (
               Number(financialData.listPrice.replace(/,/g, "")) +
               Number(financialData.directDiscount.replace(/,/g, "")) +
               Number(financialData.extrasPaidByClient.replace(/,/g, "")) -
               Number(financialData.cashback.replace(/,/g, "")) -
               Number(financialData.courtesyAmount.replace(/,/g, ""))
            ).toFixed(2);

            setFormValues((prevValues) => ({
               ...prevValues,
               rType: "estimacion",
               location: transactionData?.data?.fields?.location || "-",
               entity: transactionData?.cli || "-",
               custbody38: transactionData?.Exp || "-",
               proyecto_lead_est: transactionData?.Exp || "-",
               entitystatus: transactionData?.Estado || "-",
               subsidiary: transactionData?.Subsidaria || "-",
               pvneto: formatNumber(netSalePrice),
               custbody13: financialData.listPrice,
               custbody132: financialData.directDiscount,
               custbodyix_salesorder_cashback: financialData.cashback,
               custbody46: financialData.extrasPaidByClient,
               custbody16: financialData.courtesyAmount,
               custbody52: financialData.custbody52,
               custbody18: financialData.custbody18,
               custbody47: transactionData?.data?.fields?.custbody47 || "-",
               custbody35: transactionData?.data?.fields?.custbody35 || "-",
               // custbody114: formatDate(transactionData?.data?.fields?.custbody114) || 0,
               custbody114: transactionData?.data?.fields?.custbody114 || 0,
               date_hito_6: transactionData?.data?.fields?.custbody114,
               tranid_oport: transactionData?.opportunity_name || "-",
               custbody_ix_total_amount: formatNumber(financialData.custbody_ix_total_amount) || 0,
               expectedclosedate: transactionData?.data?.fields?.expectedclosedate || "-",
               custbody39: formatNumber(financialData.custbody39), // PRIMA TOTAL
               custbody60: transactionData?.data?.fields?.custbody60 || "0.15",
               custbody_ix_salesorder_monto_prima: formatNumber(financialData.custbody_ix_salesorder_monto_prima),
               neta: formatNumber(transactionData?.data?.fields?.custbody211),
               custbody75: transactionData?.data?.fields?.custbody75 || 1,
               total_porcentaje: "0.00%"
            }));

            const itemData = transactionData?.data?.sublists?.item || {};

            // Function to process item lines from the transaction data
            /**
             * Procesa las lÃƒÆ’Ã‚Â­neas de items y actualiza los valores del formulario segÃƒÆ’Ã‚Âºn los identificadores de prima.
             * @param {Object} items - Lista de lÃƒÆ’Ã‚Â­neas de items.
             * @returns {Array} Formato de salida para las lÃƒÆ’Ã‚Â­neas procesadas.
             */
            const processItemLines = (items) => {
               /**
                * Actualiza los valores del formulario con los datos proporcionados.
                * @param {Object} updates - Objeto con las actualizaciones a realizar.
                */
               const updateFormValues = (updates) => {
                  setFormValues((prev) => ({
                     ...prev,
                     ...updates,
                  }));
               };

               /**
                * Formatea los datos de una lÃƒÆ’Ã‚Â­nea para generar la salida final.
                * @param {Object} lineData - Datos de la lÃƒÆ’Ã‚Â­nea.
                * @returns {Object} Objeto formateado para la salida.
                */
               const formatLineOutput = (lineData) => ({
                  rate: lineData.rate || "",
                  quantity: lineData.quantity || "",
                  custcolfecha_pago_proyectado: lineData.custcolfecha_pago_proyectado || "",
                  custcol_indentificadorprima: lineData.custcol_indentificadorprima || "",
                  description: lineData.description || "",
                  porcentaje: lineData.rate || "",
               });
               /**
                * Genera las actualizaciones del formulario basadas en el identificador de prima.
                * @param {string} identifier - Identificador de la prima.
                * @param {Object} data - Datos de la lÃƒÆ’Ã‚Â­nea de prima.
                * @returns {Object} Objeto con las actualizaciones del formulario.
                */
               const getPrimaUpdates = (identifier, data) => {
                  const { rate, quantity, custcolfecha_pago_proyectado, description, porcentaje } = data;
                  const formattedDate = formatDate(custcolfecha_pago_proyectado);
                  const formattedAmount = formatNumber(rate);

                  // Mapa de identificadores de prima y sus respectivas actualizaciones
                  const primaUpdatesMap = {
                     551: { fech_reserva: formattedDate },
                     552: {
                        custbody206: formattedDate,
                        custbody191: formatNumber(transactionData?.data?.fields?.custbody191),
                        custbody189: transactionData?.data?.fields?.custbody189,
                        custbody190: transactionData?.data?.fields?.custbody190,
                        custbody188: transactionData?.data?.fields?.custbody188,
                        pre_reserva: true,
                     },
                     5551: {
                        custbody176: true,
                        custbody179: formattedAmount,
                        custbody179_date: formattedDate,
                        custbody180: quantity,
                        custbody193: description,
                     },
                     5552: {
                        custbody177: true,
                        custbody181: formattedAmount,
                        custbody182_date: formattedDate,
                        custbody182: quantity,
                        custbody194: description,
                     },
                     5553: {
                        custbody178: true,
                        custbody183: formattedAmount,
                        custbody184_date: formattedDate,
                        custbody184: quantity,
                        custbody195: description,
                     },
                     5554: {
                        prima_extra_uno: true,
                        monto_extra_uno: formattedAmount,
                        custbody184_uno_date: formattedDate,
                        monto_tracto_uno: quantity,
                        desc_extra_uno: description,
                     },
                     5555: {
                        prima_extra_dos: true,
                        monto_extra_dos: formattedAmount,
                        custbody184_dos_date: formattedDate,
                        monto_tracto_dos: quantity,
                        desc_extra_dos: description,
                     },
                     5556: {
                        prima_extra_tres: true,
                        monto_extra_tres: formattedAmount,
                        custbody184_tres_date: formattedDate,
                        monto_tracto_tres: quantity,
                        desc_extra_tres: description,
                     },

                     //Se calcula el contra entrega
                     5557: {
                        custbody67: "100%",
                        custbody_ix_salesorder_hito6: formattedAmount,
                        date_hito_6: custcolfecha_pago_proyectado,
                        custbody163: formatNumber(transactionData?.data?.fields?.custbody163),
                     },

                     // se calcula el avance obras
                     // se calcula el hito 1
                     11115: {
                        custbody163: formatNumber(transactionData?.data?.fields?.custbody163),
                        custbody62: "0.15",
                        custbodyix_salesorder_hito1: formattedAmount,
                     },
                     // se calcula el hito 2
                     11116: {
                        custbody163: formatNumber(transactionData?.data?.fields?.custbody163),
                        custbody63: "0.25",
                        custbody_ix_salesorder_hito2: formattedAmount,
                     },
                     // se calcula el hito 3
                     111167: {
                        custbody163: formatNumber(transactionData?.data?.fields?.custbody163),
                        custbody64: "0.25",
                        custbody_ix_salesorder_hito3: formattedAmount,
                     },
                     // se calcula el hito 4
                     111168: {
                        custbody163: formatNumber(transactionData?.data?.fields?.custbody163),
                        custbody65: "0.15",
                        custbody_ix_salesorder_hito4: formattedAmount,
                     },
                     // se calcula el hito 5
                     111169: {
                        custbody163: formatNumber(transactionData?.data?.fields?.custbody163),
                        custbody66: "0.15",
                        custbody_ix_salesorder_hito5: formattedAmount,
                     },
                     // se calcula el hito 6
                     111170: {
                        custbody163: formatNumber(transactionData?.data?.fields?.custbody163),
                        custbody67: "0.05",
                        custbody_ix_salesorder_hito6: formattedAmount,
                     },

                     // se calcula El avance diferenciado
                     // este es el hito 1
                     55565: {
                        custbody163: formatNumber(transactionData?.data?.fields?.custbody163),
                        hito_chek_uno: true,
                        custbody62: data.custcol_porcentajediferenciadocrm,
                        custbodyix_salesorder_hito1: formattedAmount,
                        date_hito_1: formattedDate,
                     },
                     // este es el hito 2
                     55566: {
                        custbody163: formatNumber(transactionData?.data?.fields?.custbody163),
                        hito_chek_dos: true,
                        custbody63: data.custcol_porcentajediferenciadocrm,
                        custbody_ix_salesorder_hito2: formattedAmount,
                        date_hito_2: formattedDate,
                     },
                     // este es el hito 3
                     55567: {
                        custbody163: formatNumber(transactionData?.data?.fields?.custbody163),
                        hito_chek_tres: true,
                        custbody64: data.custcol_porcentajediferenciadocrm,
                        custbody_ix_salesorder_hito3: formattedAmount,
                        date_hito_3: formattedDate,
                     },
                     // este es el hito 4
                     55568: {
                        custbody163: formatNumber(transactionData?.data?.fields?.custbody163),
                        hito_chek_cuatro: true,
                        custbody65: data.custcol_porcentajediferenciadocrm,
                        custbody_ix_salesorder_hito4: formattedAmount,
                        date_hito_4: formattedDate,
                     },
                     // este es el hito 5
                     55569: {
                        custbody163: formatNumber(transactionData?.data?.fields?.custbody163),
                        hito_chek_cinco: true,
                        custbody66: data.custcol_porcentajediferenciadocrm,
                        custbody_ix_salesorder_hito5: formattedAmount,
                        date_hito_5: formattedDate,
                     },

                     // este es el hito 6
                     55570: {
                        custbody163: formatNumber(transactionData?.data?.fields?.custbody163),
                        hito_chek_seis: true,
                        custbody67: data.custcol_porcentajediferenciadocrm,
                        custbody_ix_salesorder_hito6: formattedAmount,
                        date_hito_6: formattedDate,
                     },
                  };

                  // Devuelve las actualizaciones especÃƒÆ’Ã‚Â­ficas o un objeto vacÃƒÆ’Ã‚Â­o si no hay coincidencia
                  return primaUpdatesMap[identifier] || {};
               };

               // Procesa las lÃƒÆ’Ã‚Â­neas de items y aplica las actualizaciones correspondientes
               return Object.entries(items)
                  .filter(([key]) => key !== "currentline") // Excluir la lÃƒÆ’Ã‚Â­nea 'currentline'
                  .map(([_, lineData]) => {
                     const { custcol_indentificadorprima } = lineData;

                     // Obtener actualizaciones para el identificador actual
                     const primaUpdates = getPrimaUpdates(custcol_indentificadorprima, lineData);

                     // Aplicar las actualizaciones si existen
                     if (Object.keys(primaUpdates).length > 0) {
                        updateFormValues(primaUpdates);
                     }

                     // Retornar la lÃƒÆ’Ã‚Â­nea formateada
                     return formatLineOutput(lineData);
                  });
            };
            const processedItems = processItemLines(itemData);
         } catch (error) {
            console.error("Error fetching estimacion:", error);
            alert("Error al obtener la estimaciÃƒÆ’Ã‚Â³n. Por favor, intÃƒÆ’Ã‚Â©ntelo de nuevo.");
         } finally {
            setIsLoading(false);
         }
      };

      fetchEstimacion(); // Ejecutar la funciÃƒÆ’Ã‚Â³n de obtenciÃƒÆ’Ã‚Â³n de datos
   }, [open, idEstimacion, dispatch]); // Dependencias del efecto

   return (
      <>
         <style>{ESTIMATION_MODAL_STYLES}</style>
         <Modal
            open={Boolean(open)}
            onClose={onClose}
            className="modal fade show"
            aria-labelledby="exampleModalLongTitle"
            style={{ display: "block" }}
            aria-modal="true"
            role="dialog"
         >
            <div className="modal-dialog" style={{ maxWidth: "89%", margin: "1.75rem auto" }}>
               <div className="modal-content estimation-create-modal-content">
                  <div className="estimation-create-modal-header">
                     <div>
                        <span className="estimation-create-modal-kicker">Gestion comercial</span>
                        <h4 className="estimation-create-modal-title">Editar estimacion</h4>
                        <p className="estimation-create-modal-copy">
                           Ajuste la informacion comercial, revise la distribucion de prima y confirme el metodo de
                           pago sin perder el contexto principal de la operacion.
                        </p>
                     </div>

                     <div className="estimation-create-modal-badge">
                        <p className="estimation-create-modal-badge-label">Estado del formulario</p>
                        <p className="estimation-create-modal-badge-value">
                           {isLoading ? "Cargando informacion..." : "Listo para edicion"}
                        </p>
                     </div>
                  </div>

                  <div className="modal-body estimation-create-modal-body">
                     {isLoading ? (
                        <div className="estimation-create-modal-loading">
                           <div className="spinner-border" role="status">
                              <span className="visually-hidden">Cargando...</span>
                           </div>
                        </div>
                     ) : (
                        <div className="estimation-create-modal-shell">
                           <div className="estimation-create-modal-grid">
                              <aside className="estimation-create-modal-sidebar">
                                 <div className="estimation-create-modal-sidebar-card">
                                    <h5 className="estimation-create-modal-sidebar-title">Resumen de contexto</h5>
                                    <p className="estimation-create-modal-sidebar-copy">
                                       Consulte aqui la referencia comercial principal antes de editar la estimacion
                                       para mantener consistencia entre valores, tractos y forma de cobro.
                                    </p>
                                 </div>

                                 <div className="estimation-create-modal-hint-list">
                                    {summaryCards.map((item) => (
                                       <div className="estimation-create-modal-hint" key={item.label}>
                                          <p className="estimation-create-modal-hint-label">{item.label}</p>
                                          <p className="estimation-create-modal-hint-value">{item.value}</p>
                                       </div>
                                    ))}
                                 </div>

                                 <div className="estimation-create-modal-sidebar-card">
                                    <h5 className="estimation-create-modal-sidebar-title">Como revisar esta edicion</h5>
                                    <p className="estimation-create-modal-sidebar-copy">
                                       Valide primero la base economica, luego confirme la distribucion de primas y
                                       cierre verificando que el metodo de pago mantenga la estructura comercial.
                                    </p>
                                 </div>
                              </aside>

                              <section className="estimation-create-modal-main">
                                 <form onSubmit={handleSubmit}>
                                    <section className="estimation-create-modal-section">
                                       <div className="estimation-create-modal-section-head">
                                          <span className="estimation-create-modal-section-kicker">Datos base</span>
                                          <h5 className="estimation-create-modal-section-title">
                                             Informacion principal de la estimacion
                                          </h5>
                                          <p className="estimation-create-modal-section-copy">
                                             Revise descuentos, extras, reservas y valores netos con los datos
                                             iniciales heredados del negocio.
                                          </p>
                                       </div>

                                       <PrimeraLinea
                                          formValues={formValues}
                                          handleInputChange={handleInputChange}
                                          errors={errors}
                                          hideContextFields
                                       />
                                    </section>

                                    <section className="estimation-create-modal-section">
                                       <div className="estimation-create-modal-section-head">
                                          <span className="estimation-create-modal-section-kicker">
                                             Estructura economica
                                          </span>
                                          <h5 className="estimation-create-modal-section-title">
                                             Ajustes y calculo de prima
                                          </h5>
                                          <p className="estimation-create-modal-section-copy">
                                             Modifique descuentos, porcentajes y montos clave mientras confirma el
                                             impacto en los valores netos y asignables.
                                          </p>
                                       </div>

                                       <CalculodePrima
                                          errors={errors}
                                          formValues={formValues}
                                          handleInputChange={handleInputChange}
                                          handleDiscountSelection={handleDiscountSelection}
                                       />
                                    </section>

                                    <section className="estimation-create-modal-section">
                                       <div className="estimation-create-modal-section-head">
                                          <span className="estimation-create-modal-section-kicker">
                                             Distribucion comercial
                                          </span>
                                          <h5 className="estimation-create-modal-section-title">
                                             Organizacion de primas y tractos
                                          </h5>
                                          <p className="estimation-create-modal-section-copy">
                                             Ajuste la estructura de prima manteniendo visibles fechas, porcentajes,
                                             tractos, montos y descripcion de cada una.
                                          </p>
                                       </div>

                                       <SeleccionPrima
                                          errors={errors}
                                          formValues={formValues}
                                          handleInputChange={handleInputChange}
                                       />
                                    </section>

                                    <section className="estimation-create-modal-section">
                                       <div className="estimation-create-modal-section-head">
                                          <span className="estimation-create-modal-section-kicker">
                                             Estructura de cobro
                                          </span>
                                          <h5 className="estimation-create-modal-section-title">
                                             MÃƒÂ©todo de pago y programacion financiera
                                          </h5>
                                          <p className="estimation-create-modal-section-copy">
                                             Seleccione la modalidad correcta y revise los hitos necesarios para
                                             completar la programacion financiera correspondiente.
                                          </p>
                                       </div>

                                       <MetodoPago
                                          formValues={formValues}
                                          handleInputChange={handleInputChange}
                                          errors={errors}
                                       />
                                    </section>

                                    <div className="estimation-create-modal-footer">
                                       <p className="estimation-create-modal-footer-copy">
                                          Antes de guardar, confirme que los montos, primas y metodo de pago reflejan
                                          correctamente la estructura comercial actual del cliente.
                                       </p>

                                       <div className="estimation-create-modal-actions">
                                          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
                                             Cancelar
                                          </button>
                                          <button type="submit" className="btn btn-primary">
                                             Guardar estimacion
                                          </button>
                                       </div>
                                    </div>
                                 </form>
                              </section>
                           </div>
                        </div>
                     )}
                  </div>
               </div>
            </div>
         </Modal>
      </>
   );
};