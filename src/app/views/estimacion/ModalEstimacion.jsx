import { Modal } from "@mui/material";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
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
import { crearEstimacionFormulario } from "../../../store/estimacion/thunkEstimacion";
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
    margin-bottom: 4px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6b7280;
  }

  .estimation-create-modal-title {
    margin: 0 0 5px;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #111827;
  }

  .estimation-create-modal-copy {
    max-width: 660px;
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: #4b5563;
  }

  .estimation-create-modal-badge {
    min-width: 190px;
    padding: 12px 14px;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: #ffffff;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  }

  .estimation-create-modal-badge-label {
    margin: 0 0 4px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6b7280;
  }

  .estimation-create-modal-badge-value {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    color: #111827;
  }

  .estimation-create-modal-grid {
    display: grid;
    grid-template-columns: minmax(230px, 280px) minmax(0, 1fr);
    gap: 14px;
    align-items: start;
  }

  .estimation-create-modal-sidebar,
  .estimation-create-modal-main {
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    background: #ffffff;
  }

  .estimation-create-modal-sidebar {
    padding: 14px;
    background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
  }

  .estimation-create-modal-sidebar-card {
    padding: 12px;
    border: 1px solid #eceff3;
    border-radius: 14px;
    background: #ffffff;
  }

  .estimation-create-modal-sidebar-card + .estimation-create-modal-sidebar-card {
    margin-top: 10px;
  }

  .estimation-create-modal-sidebar-title {
    margin: 0 0 4px;
    font-size: 12px;
    font-weight: 700;
    color: #111827;
  }

  .estimation-create-modal-sidebar-copy {
    margin: 0;
    font-size: 11px;
    line-height: 1.5;
    color: #6b7280;
  }

  .estimation-create-modal-hint-list {
    display: grid;
    gap: 8px;
    margin-top: 10px;
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
    color: #6b7280;
  }

  .estimation-create-modal-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .estimation-create-modal-actions .btn {
    min-height: 40px;
    padding: 0 16px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 700;
    transition: transform 160ms ease-out;
  }

  .estimation-create-modal-actions .btn:active {
    transform: scale(0.98);
  }

  .estimation-create-modal-main .row {
    row-gap: 4px;
  }

  .estimation-create-modal-main .form-label {
    margin-bottom: 6px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #4b5563;
  }

  .estimation-create-modal-main .form-control,
  .estimation-create-modal-main .form-select {
    min-height: 40px;
    border-color: #d1d5db;
    border-radius: 12px;
    font-size: 12px;
    color: #111827;
    box-shadow: none;
  }

  .estimation-create-modal-main textarea.form-control {
    min-height: 86px;
  }

  .estimation-create-modal-main .form-control:disabled,
  .estimation-create-modal-main .form-select:disabled {
    background: #f8fafc;
    color: #4b5563;
  }

  .estimation-create-modal-main hr {
    margin: 10px 0 14px;
    border-color: #eceff3;
    opacity: 1;
  }

  .estimation-create-modal-main .alert {
    margin-bottom: 0;
    padding: 12px;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    background: #ffffff;
    color: #111827;
  }

  .estimation-create-modal-main .alert.alert-dark {
    background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
    border-color: #e5e7eb;
  }

  .estimation-create-modal-main .alert p,
  .estimation-create-modal-main .alert h2 {
    margin-bottom: 8px !important;
    font-size: 11px !important;
    font-style: normal !important;
    text-decoration: none !important;
    color: #111827 !important;
  }

  .estimation-create-modal-main .card {
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    box-shadow: none;
    overflow: hidden;
  }

  .estimation-create-modal-main .card-header {
    padding: 11px 14px;
    border-bottom: 1px solid #eceff3;
    background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%) !important;
    color: #111827 !important;
  }

  .estimation-create-modal-main .card-header h5,
  .estimation-create-modal-main .card-header center {
    margin: 0;
    font-size: 12px;
    font-weight: 700;
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

export const ModalEstimacion = ({ open, onClose, OportunidadDetails, cliente }) => {
   // Estado para manejar si el contenido del modal está cargando
   const [isLoading, setIsLoading] = useState(true);
   const dispatch = useDispatch();

const [formValues, setFormValues] = useState({
      // Datos de la primera línea
      entity: "",
      custbody38: "",
      proyecto_lead_est: "",
      entitystatus: "",
      pvneto: 0,

      // Datos de la segunda línea
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
      //MONTO TOTAL DE CORTESÍAS
      custbody16: 0,

      //DESCRIPCIÓN EXTRAS
      custbody47: "--",
      //DESCRIPCIÓN DE LAS CORTESIAS
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
    value: formValues.entity || cliente?.nombre_lead || "N/A",
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
    value: formValues.tranid_oport || OportunidadDetails?.tranid_oport || "N/A",
  },
  {
    label: "Cierre previsto",
    value:
      OportunidadDetails?.caduca ||
      OportunidadDetails?.fecha_Condicion ||
      OportunidadDetails?.fecha_cierre_oport ||
      "N/A",
  },
];

   // Estado para manejar los errores del formulario
   const [errors, setErrors] = useState({});

   // Maneja la selección de descuento por parte del usuario
   const handleDiscountSelection = (e) => {
      // Extrae el valor seleccionado del evento
      const { value } = e.target;

      // Actualiza el estado del formulario con el valor seleccionado.
      // Si el valor está vacío, se establece isDiscounted como null, de lo contrario, se guarda el valor.
      setFormValues({
         ...formValues, // Mantiene los valores actuales del formulario
         isDiscounted: value === "" ? null : value, // Asigna null si el valor es vacío, de lo contrario, asigna el valor
      });
   };

   // Maneja los cambios en los inputs del formulario
   const handleInputChange = (e) => {
      const { name, value, type, checked } = e.target;

      // Determina el nuevo valor según el tipo de input
      const newValue = type === "checkbox" ? checked : value;

      // Lista de campos que requieren limpieza específica
      const camposLimpieza = [
         "custbody132",
         "custbody46",
         "custbodyix_salesorder_cashback",
         "custbody52",
         "custbody16",
         "custbody39",
         "custbody60",
      ];

      // Mapeo de los campos relacionados con cada hito para facilitar la actualización del estado
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

      // Aplica reglas específicas de limpieza para ciertos campos
      // Si el campo actual está en la lista de `camposLimpieza`, procesa el valor con una función personalizada.
      // De lo contrario, usa el valor nuevo sin procesamiento adicional.
      const valorProcesado = camposLimpieza.includes(name) ? procesarValor(name, value) : newValue;

      // Define una lista de campos que requieren cálculos complejos antes de ser actualizados
      const camposCalculos = ["custbody132", "custbody46", "custbodyix_salesorder_cashback", "custbody52", "custbody16"];
      if (camposCalculos.includes(name)) {
         // Realiza cálculos complejos específicos para el campo actual
         actualizarConCalculos(name, valorProcesado);
         return; // Termina la ejecución para evitar pasos adicionales innecesarios
      }

      // Maneja cambios específicos en el campo de "prima total"
      // Se utiliza una función especializada para actualizar este campo
      if (name === "custbody39") {
         actualizarPrimaTotal(name, valorProcesado);
         return; // Detiene el flujo después de manejar este caso específico
      }

      //limpiamos lo valores de las primas cuando se deselecciona el checkbox
      if (name === "custbody39") {
         actualizarPrimaTotal(name, valorProcesado);
         return; // Detiene el flujo después de manejar este caso específico
      }

      // /// Maneja cambios relacionados con porcentajes
      // // Define una lista de campos que representan porcentajes y requieren un manejo específico
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

      // Si el campo pertenece a `camposPorcentaje`, utiliza la función para actualizar el valor del porcentaje
      if (camposPorcentaje.includes(name)) {
         actualizarPorcentaje(name, valorProcesado);
         return; // Detiene el flujo después de manejar el campo
      }

      // Define manejadores específicos para ciertos campos, ejecutando lógica personalizada
      const manejadores = {
         custbody75: () => actualizarCustbody75(name, valorProcesado), // Lógica para el campo `custbody75`
         custbody62: () => actualizarHitoDiferenciado(name, valorProcesado, "custbodyix_salesorder_hito1"), // Hito 1
         custbody63: () => actualizarHitoDiferenciado(name, valorProcesado, "custbody_ix_salesorder_hito2"), // Hito 2
         custbody64: () => actualizarHitoDiferenciado(name, valorProcesado, "custbody_ix_salesorder_hito3"), // Hito 3
         custbody65: () => actualizarHitoDiferenciado(name, valorProcesado, "custbody_ix_salesorder_hito4"), // Hito 4
         custbody66: () => actualizarHitoDiferenciado(name, valorProcesado, "custbody_ix_salesorder_hito5"), // Hito 5
         custbody67: () => actualizarHitoDiferenciado(name, valorProcesado, "custbody_ix_salesorder_hito6"), // Hito 6
      };

      // Define manejadores específicos para actualizar montos asociados a los hitos
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
         manejadores[name](); // Lógica específica para el campo
      }

      // Verifica si el campo tiene un manejador de monto asignado y lo ejecuta
      if (manejadoresMonto[name]) {
         manejadoresMonto[name](); // Lógica específica para actualizar el monto asociado al campo
      }

      // Actualización genérica para otros campos
      // Si el campo no requiere manejo especial, simplemente actualiza su valor en el estado del formulario
      setFormValues({
         ...formValues, // Mantiene los valores actuales del formulario
         [name]: valorProcesado, // Actualiza el valor del campo específico con el valor procesado
      });

      // Limpia errores relacionados con el campo
      // Establece el mensaje de error del campo como vacío para indicar que no hay errores
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

      // Lógica única para manejar todas las primas
      if (mapaPrimas[name] && !newValue) {
         // Obtener configuración de la prima actual
         const { campos, numero } = mapaPrimas[name];

         // Actualizar porcentaje primero
         actualizarPorcentaje(name, valorProcesado);

         // Restablecer campos relacionados
         setFormValues((prevValues) => ({
            ...prevValues,
            [campos[0]]: "0", // Restablece monto
            [campos[1]]: "", // Limpia fecha
            [campos[2]]: 1, // Tractos a 1
            [campos[3]]: `PRIMA ${numero}`, // Descripción estándar
         }));
      }
   };

   // Procesa el valor de campos específicos con reglas adicionales
   const procesarValor = (name, value) => {
      // Aplica una limpieza inicial al valor utilizando una función genérica
      let processedValue = limpiarCampos(value);

      // Aplica reglas específicas para el campo "custbody132"
      if (name === "custbody132") {
         // Asegura que el valor procesado tenga un solo guion inicial
         processedValue = `-${processedValue.replace(/^-+/, "")}`;

         // Si el valor es "-0" o solo "-", lo ajusta a una cadena vacía para evitar valores inválidos
         if (processedValue === "-0" || processedValue === "-") {
            processedValue = ""; // Establece como vacío para mantener consistencia
         }
      }

      // Retorna el valor procesado (ya sea limpio o con las reglas específicas aplicadas)
      return processedValue;
   };

   // Actualiza el estado con cálculos complejos según el campo modificado
   const actualizarConCalculos = (name, value) => {
      // Actualiza el estado utilizando la función `setFormValues`
      setFormValues((prevValues) => {
         // Copia el estado actual y actualiza el valor del campo modificado
         const updatedValues = { ...prevValues, [name]: value };

         // Calcula el precio de venta neto basado en los valores actualizados
         const pvn = precioVentaNeto(updatedValues);

         // Calcula el monto total basado en los valores actualizados
         const montot = montoTotal(updatedValues);

         // Calcula la prima total utilizando el monto total y un valor porcentual (`custbody60`)
         const montoPrimaTotal = calcularPrimaToal(montot, updatedValues.custbody60);

         // Calcula la prima neta basándose en la prima total y otros valores actualizados
         const montoPrimaNet = montoPrimaNeta(montoPrimaTotal, updatedValues);

         // Calcula el valor asignable para la prima utilizando la prima total y valores adicionales
         const asignable = calculoPrimaAsignable(montoPrimaTotal, updatedValues);

         // Ejecuta cálculos específicos adicionales, si es necesario, utilizando los valores actualizados
         ejecutarCálculosEspecíficos(updatedValues, montot, montoPrimaTotal);

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
      // Luego ejecutar cálculos específicos con los valores finales ya calculados
      ejecutarCálculosEspecíficos(
         valoresFinales,
         valoresFinales.custbody_ix_total_amount,
         valoresFinales.custbody39
      );
   };

   /**
     * Maneja la actualización de campos relacionados con porcentajes en el formulario.
     * Realiza cálculos basados en el valor actualizado y actualiza el estado del formulario
     * con los nuevos valores calculados.
     *
     * @param {string} name - El nombre del campo que se está actualizando.
     * @param {number} value - El nuevo valor del campo.
     */
   const actualizarPorcentaje = (name, value) => {
      // 1. Crea updatedValues fuera de setFormValues para poder usarlo después
      const updatedValues = { ...formValues, [name]: value };

      // 2. Calcula el monto total basado en el porcentaje actualizado.
      const total = calculoMontoSegunPorcentaje(updatedValues);

      // 3. Calcula la prima neta basada en el monto total y los valores actualizados.
      const montoPrimaNet = montoPrimaNeta(total, updatedValues);

      // 4. Calcula la prima asignable utilizando el monto total y los valores actuales.
      const asignable = calculoPrimaAsignable(total, updatedValues);

      // 5. Prepara el objeto final con todas las actualizaciones necesarias
      let valoresFinales = { ...updatedValues, neta: asignable };

      // 6. Si el campo actualizado es "custbody60", añade campos adicionales
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

      // 8. Ejecuta cálculos específicos con los mismos valores actualizados
      ejecutarCálculosEspecíficos(
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

         // Ejecuta cálculos adicionales personalizados basados en los valores calculados
         ejecutarCálculosEspecíficos(updatedValues, montot, montoPrimaTotal);

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

   // Maneja actualizaciones específicas para custbody62
   const actualizarHitoDiferenciado = (name, value, campoActualizar) => {
      setFormValues((prevValues) => {
         // Copia el estado actual y actualiza el valor del campo modificado
         const updatedValues = { ...prevValues, [name]: value };

         // Calcula el monto total y la prima total utilizando los valores actualizados
         const montot = montoTotal(updatedValues);

         const montoPrimaTotal = calcularPrimaToal(montot, updatedValues.custbody60);

         // Porcentaje inicial (100%)
         const porcentajeInicial = 100;

         // Define los porcentajes relacionados a los hitos, considerando si están marcados como chequeados
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

         // Calcula y actualiza el campo dinámico utilizando una función específica
         calculoHito1Diferenciado(
            value, // Nuevo porcentaje ingresado
            montot, // Monto total calculado
            montoPrimaTotal, // Prima total calculada
            setFormValues, // Función para actualizar el formulario
            updatedValues, // Valores actuales del formulario
            campoActualizar, // Campo que debe actualizarse dinámicamente
            porcentajeRestante, // Porcentaje restante calculado
            updatedValues, // Estado actualizado
         );

         return updatedValues; // Retorna el estado actualizado para reflejar los cambios
      });
   };

   // Maneja actualizaciones específicas para los montos de hitos
   const actualizarHitoDiferenciadoMonto = (name, value, campoActualizar) => {
      // console.clear();
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

         // Define los porcentajes relacionados a los hitos, considerando si están marcados como chequeados
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

         // Crear un nuevo estado actualizado antes de llamar a la función de cálculo
         const updatedFormValues = {
            ...updatedValues,
            total_porcentaje: porcentajeRestante.toFixed(2)
         };

         // Llamar a la función de cálculo con los valores correctos
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

   // Ejecuta cálculos específicos según el tipo de operación
   const ejecutarCálculosEspecíficos = (updatedValues, montot, montoPrimaTotal) => {
      // Determina el tipo de operación a partir del valor en custbody75
      const tipoOperacion = parseInt(updatedValues.custbody75, 10);

      // Lógica para cada tipo de operación
      if (tipoOperacion === 2) {
         // Cálculo para avance de obra
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
         // Cálculos para operaciones contra entrega
         calculoContraEntregaSinprimaTotal(updatedValues, setFormValues); // Sin prima tota
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
         // Cálculo para avance diferenciado
         calculoAvanceDiferenciado(updatedValues, setFormValues, montot, montoPrimaTotal);
      }
   };

   // Reglas de validación: Configuran los campos del formulario indicando si son obligatorios y el mensaje de error correspondiente
   const validationRules = {
      // Validación del cliente
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

      // Validación de campos esenciales
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

      // Itera sobre las reglas de validación definidas
      Object.keys(validationRules).forEach((field) => {
         const rule = validationRules[field]; // Reglas de validación para el campo actual
         const fieldValue = formValues[field]; // Valor actual del campo en el formulario

         // Verifica si el campo es obligatorio y si su valor es válido
         if (
            rule.required && // La regla indica que el campo es obligatorio
            (!fieldValue || (typeof fieldValue === "string" && !fieldValue.trim())) // El valor está vacío o no contiene texto
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

   const navigate = useNavigate();

   // Maneja el envío del formulario
   const handleSubmit = async (e) => {
      e.preventDefault(); // Previene que la página se recargue al enviar el formulario

      // Valida los datos del formulario antes de proceder
      if (validateForm()) {
         // Confirmar si desea crear la estimación
         const confirmCreate = window.confirm("¿Desea crear la estimación?");

         if (confirmCreate) {
            // Mostrar Swal de carga
            Swal.fire({
               title: "Creando estimación...",
               text: "Por favor espere",
               allowOutsideClick: false,
               allowEscapeKey: false,
               allowEnterKey: false,
               showConfirmButton: false,
               didOpen: () => {
                  Swal.showLoading();
               },
               customClass: {
                  popup: "swal-on-top", // Clase personalizada para asegurar que esté por encima
               },
            });

            // Si el usuario acepta
            const result = await dispatch(crearEstimacionFormulario(formValues));

            let ExTraerResultado = result.data["Detalle"];

            Swal.close();


            if (ExTraerResultado.status == 200) {
               Swal.fire({
                  position: "top-end",
                  icon: "success",
                  title: "Se creo la estimación",
                  showConfirmButton: false,
                  timer: 2500,
                  customClass: {
                     popup: "swal-on-top",
                  },
               }).then((result) => {
                  navigate(`/estimaciones/view?data=${cliente.idinterno_lead}&data2=${ExTraerResultado.id}`);
               });
            }

            if (ExTraerResultado.status == 500) {

               // Parseamos el mensaje de error contenido en ErrorMsj
               const parsedError = JSON.parse(ExTraerResultado.ErrorMsj);

               // Accedemos al campo "details"
               const errorDetails = parsedError.details;



               return Swal.fire({
                  title:
                     "Error: " + errorDetails,
                  icon: "question",
                  iconHtml: "؟",
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

            // Aquí puedes agregar la lógica para crear la estimación
         } else {
            // Si el usuario cancela
            alert("Operación cancelada.");
         }
      } else {
         // Si la validación falla
         alert("Algunos campos no pueden quedar vacíos. Por favor, verifíquelos.");
      }
   };

   useEffect(() => {
      if (!open) return; // Si el componente no está "abierto", salir inmediatamente

      setIsLoading(true); // Indicar que se está cargando la información necesaria

      // Extraer datos de la oportunidad y del cliente
      const dataOportunidad = OportunidadDetails;
      const dataCliente = cliente;

      // Convertir el precio de venta único en un valor numérico eliminando caracteres no numéricos
      const precioVenta = parseFloat(dataOportunidad.precioVentaUncio_exp.replace(/\D/g, ""));

      // Calcular el monto de la prima como el 15% del precio de venta (escala de 0 a 100)
      const montoPrima = (precioVenta * 0.15) / 100;

      // Determinar el valor para "hito6" basado en una condición específica
      let hito6 = 0;
      hito6 = parseInt(dataOportunidad.custbody75_oport, 10) === 1 ? "100%" : parseInt(dataOportunidad.custbody75_oport, 10) === 2 ? "0.05" : 0;

      // Obtener la fecha actual y formatearla como mm/dd/yyyy
      const today = new Date();
      const formattedDate = today.toISOString().split("T")[0];



      // Actualizar los valores del formulario con la información procesada
      setFormValues((prevValues) => ({
         ...prevValues,
         opportunity: dataOportunidad.id_oportunidad_oport, // ID de la oportunidad
         entity: dataCliente.nombre_lead, // Asignar el nombre del cliente
         custbody114: dataOportunidad.entregaEstimada, // Fecha estimada de entrega
         proyecto_lead_est: dataCliente.proyecto_lead, // Proyecto asociado al cliente
         custbody38: dataOportunidad.codigo_exp, // Código único de la oportunidad
         tranid_oport: dataOportunidad.tranid_oport, // ID de transacción de la oportunidad
         expectedclosedate: dataOportunidad.expectedclosedate_oport, // Fecha esperada de cierre
         entitystatus: dataOportunidad.Motico_Condicion, // Estado o condición de la oportunidad
         custbody13: dataOportunidad.precioVentaUncio_exp, // Precio de venta único original
         custbody18: dataOportunidad.precioDeVentaMinimo, //Precio mínimo permitido para la venta
         custbody_ix_total_amount: dataOportunidad.precioVentaUncio_exp, // Total del precio de venta
         custbody39: montoPrima.toFixed(2), // Prima calculada con dos decimales
         custbody_ix_salesorder_monto_prima: montoPrima.toFixed(2), // Monto de la prima para la orden de venta
         neta: montoPrima.toFixed(2), // Prima neta calculada con precisión

         // Método de pago y otros campos adicionales
         custbody75: dataOportunidad.custbody75_oport, // Método de pago seleccionado
         custbody67: hito6, // Hito de progreso basado en condiciones específicas
         fech_reserva: formattedDate, // Fecha de la reserva
         date_hito_6: dataOportunidad.entregaEstimada,
      }));

      setIsLoading(false); // Indicar que la carga de datos ha finalizado
   }, [open, cliente, OportunidadDetails]);

return (
      <>
         <style>{ESTIMATION_MODAL_STYLES}</style>
         <Modal
            open={open}
            onClose={onClose}
            className="modal fade show"
            style={{ display: "block" }}
            aria-modal="true"
         >
            <div className="modal-dialog" style={{ maxWidth: "89%", margin: "1.75rem auto" }}>
               <div className="modal-content estimation-create-modal-content">
                  <div className="estimation-create-modal-header">
                     <div>
                        <span className="estimation-create-modal-kicker">Generación comercial</span>
                        <h4 className="estimation-create-modal-title">Crear estimación</h4>
                        <p className="estimation-create-modal-copy">
                           Complete la información comercial, la estructura de prima y el método de pago
                           usando bloques más claros para facilitar lectura, validación y captura.
                        </p>
                     </div>

                     <div className="estimation-create-modal-badge">
                        <p className="estimation-create-modal-badge-label">Estado del formulario</p>
                        <p className="estimation-create-modal-badge-value">
                           {isLoading ? "Preparando datos..." : "Listo para captura"}
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
                                    <h5 className="estimation-create-modal-sidebar-title">
                                       Resumen de contexto
                                    </h5>
                                    <p className="estimation-create-modal-sidebar-copy">
                                       Consulte aquí la referencia comercial principal antes de completar
                                       la estimación para evitar duplicar revisión dentro del formulario.
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
                                    <h5 className="estimation-create-modal-sidebar-title">
                                       Cómo llenar esta vista
                                    </h5>
                                    <p className="estimation-create-modal-sidebar-copy">
                                       Primero valide datos base y precio, luego defina la prima, active
                                       solo los tractos necesarios y cierre con el método de pago.
                                    </p>
                                 </div>
                              </aside>

                              <section className="estimation-create-modal-main">
                                 <form onSubmit={handleSubmit}>
                                    <section className="estimation-create-modal-section">
                                       <div className="estimation-create-modal-section-head">
                                          <span className="estimation-create-modal-section-kicker">
                                             Datos base
                                          </span>
                                          <h5 className="estimation-create-modal-section-title">
                                             Información principal de la estimación
                                          </h5>
                                          <p className="estimation-create-modal-section-copy">
                                             Revise el cliente, expediente, oportunidad, precio base y
                                             datos iniciales heredados del negocio.
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
                                             Estructura económica
                                          </span>
                                          <h5 className="estimation-create-modal-section-title">
                                             Definición y cálculo de la prima
                                          </h5>
                                          <p className="estimation-create-modal-section-copy">
                                             Elija si desea calcular la prima por porcentaje o monto y
                                             confirme el impacto en los valores netos y asignables.
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
                                             Distribución comercial
                                          </span>
                                          <h5 className="estimation-create-modal-section-title">
                                             Selección y configuración de primas
                                          </h5>
                                          <p className="estimation-create-modal-section-copy">
                                             Active únicamente las primas requeridas y complete fecha,
                                             tractos, montos y descripción de cada una.
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
                                             Método de pago y avance del negocio
                                          </h5>
                                          <p className="estimation-create-modal-section-copy">
                                             Seleccione la modalidad de pago para desplegar los hitos y
                                             completar la programación financiera correspondiente.
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
                                          Antes de guardar, confirme que los montos, primas y método de pago
                                          reflejan correctamente la estructura comercial del cliente.
                                       </p>

                                       <div className="estimation-create-modal-actions">
                                          <button type="button" className="btn btn-outline-dark" onClick={onClose}>
                                             Cancelar
                                          </button>
                                          <button type="submit" className="btn btn-primary">
                                             Guardar estimación
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
