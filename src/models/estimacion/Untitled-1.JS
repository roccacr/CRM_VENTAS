/**
 * @NApiVersion 2.x
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */
define(["N/search", "N/record", "N/log", "N/format"], /**
 * @param {search} search
 * @param {record} record
 * @param {log} log
 */
function (search, record, log, format) {
    function getRestLet(dataIn) {
        try {
            // 1. ******************************************************LLAMAMOS LOS DATOS DEL EMPLEADO POR MEDIO DEL ID *******************************************
            if (dataIn.rType == "employee") {
                var employeeRecord = record.load({
                    type: record.Type.EMPLOYEE,
                    id: dataIn.id,
                    isDynamic: false,
                });
                var employeeData = employeeRecord.getText({
                    fieldId: "supervisor",
                });
                return {
                    tipo: "Leads",
                    status: 200,
                    data: employeeRecord,
                    supervisor: employeeData,
                };
            }

            // 2. ******************************************************LLAMAMOS LOS DATOS DEL CLIENTE POR MEDIO DEL ID *******************************************
            if (dataIn.rType == "customer") {
                var customerRecord = record.load({
                    type: record.Type.CUSTOMER,
                    id: dataIn.id,
                    isDynamic: false,
                });
                var data = customerRecord;
                var subsidiary = customerRecord.getText({
                    fieldId: "subsidiary",
                });
                var project = customerRecord.getText({
                    fieldId: "custentity_csegix_proyectos",
                });
                var marketing = customerRecord.getText({
                    fieldId: "custentity_ix_campanademarketing",
                });
                var activity = customerRecord.getText({
                    fieldId: "entitystatus",
                });
                var referred = customerRecord.getText({
                    fieldId: "custentityix_dondeescuchodenostros",
                });
                return {
                    tipo: "Leads",
                    status: 200,
                    data: data,
                    Subsidaria: subsidiary,
                    Proyecto: project,
                    Marketing: marketing,
                    Actividad: activity,
                    Referido: referred,
                };
            }

            // 3. ******************************************************LLAMAMOS LOS DATOS DEL EXPEDIENTE DE UNIDAD POR MEDIO DEL ID **************************************
            if (dataIn.rType == "customrecord_ix_record_exp_unidades") {
                var recordLoad = record.load({
                    type: "customrecord_ix_record_exp_unidades",
                    id: dataIn.id,
                    isDynamic: true,
                });
                var codigo = recordLoad.getText({
                    fieldId: "name",
                });
                var proyecto_Principal = recordLoad.getText({
                    fieldId: "custrecord_163_csegix_proyectos",
                });
                var id_proyecto_Principal = recordLoad.getValue({
                    fieldId: "custrecord_163_csegix_proyectos",
                });
                var tipo_De_Vivienda = recordLoad.getText({
                    fieldId: "custrecordix_tipo_vivienda",
                });
                var lote_M2 = recordLoad.getText({
                    fieldId: "custrecordis_lote",
                });
                var estado = recordLoad.getText({
                    fieldId: "custrecord_ix_field_estado_exp_uni",
                });
                var Precio_Venta_Unico = recordLoad.getText({
                    fieldId: "custrecord_ix_field_precio_venta_unico",
                });
                var MetrosHabitables = recordLoad.getText({
                    fieldId: "custrecord_ix_field_m2_de_construccion",
                });
                var Area_Total_M2 = recordLoad.getText({
                    fieldId: "custrecordcv_totalm2",
                });
                var Cuota_Manten_Apox = recordLoad.getText({
                    fieldId: "custrecord226",
                });
                var Planos_Unidad = recordLoad.getText({
                    fieldId: "custrecord238",
                });
                var Entrega_Estimada = recordLoad.getText({
                    fieldId: "custrecordcv_entrega",
                });
                var AREA_DE_BODEGA_M2 = recordLoad.getText({
                    fieldId: "custrecordix_bodega",
                });
                var AREA_DE_MEZZANINE_M2 = recordLoad.getText({
                    fieldId: "custrecordix_mezzanine",
                });
                var AREA_DE_BALCON_M2 = recordLoad.getText({
                    fieldId: "custrecordix_balcon",
                });
                var AREA_DE_PLANTA_BAJA_M2 = recordLoad.getText({
                    fieldId: "custrecordix_planta_baja",
                });
                var AREA_DE_PLANTA_ALTA_M2 = recordLoad.getText({
                    fieldId: "custrecordix_planta_alta",
                });
                var AREA_DE_AMPLIACION_M2 = recordLoad.getText({
                    fieldId: "custrecordix_ampliacion",
                });
                var AREA_DE_TERRAZA_M2 = recordLoad.getText({
                    fieldId: "custrecordix_terraza",
                });
                var PRECIOPOR_M2 = recordLoad.getText({
                    fieldId: "custrecord_ix_field_precio_m2_exp_uni",
                });
                var TERCER_NIVEL_SOTANO_M2 = recordLoad.getText({
                    fieldId: "custrecord_ix_field_sotano",
                });
                var AREA_DE_PARQUEO_APROXM2 = recordLoad.getText({
                    fieldId: "custrecord_ix_fiedl_area_parqueo_aprox",
                });
                var AREA_EXTERNA_JARDIN_M2 = recordLoad.getText({
                    fieldId: "custrecordix_area_externa",
                });
                var AREA_COMUNLIBRE_ASIGNADO = recordLoad.getText({
                    fieldId: "custrecord17",
                });
                var JARDI_CON_TALUD = recordLoad.getText({
                    fieldId: "custrecord81",
                });
                var PRECIO_DE_VENTA_MINIMO = recordLoad.getText({
                    fieldId: "custrecord14",
                });

                var response = {
                    tipo: "Expediente de unidad " + dataIn.id,
                    status: 200,
                    codigo: codigo,
                    proyecto_Principal: proyecto_Principal,
                    id_proyecto_Principal: id_proyecto_Principal,
                    tipo_De_Vivienda: tipo_De_Vivienda,
                    lote_M2: lote_M2,
                    estado: estado,
                    Precio_Venta_Unico: Precio_Venta_Unico,
                    MetrosHabitables: MetrosHabitables,
                    Area_Total_M2: Area_Total_M2,
                    Cuota_Manten_Apox: Cuota_Manten_Apox,
                    Planos_Unidad: Planos_Unidad,
                    Entrega_Estimada: Entrega_Estimada,
                    AREA_DE_BODEGA_M2: AREA_DE_BODEGA_M2,
                    AREA_DE_MEZZANINE_M2: AREA_DE_MEZZANINE_M2,
                    AREA_DE_BALCON_M2: AREA_DE_BALCON_M2,
                    AREA_DE_PLANTA_BAJA_M2: AREA_DE_PLANTA_BAJA_M2,
                    AREA_DE_PLANTA_ALTA_M2: AREA_DE_PLANTA_ALTA_M2,
                    AREA_DE_AMPLIACION_M2: AREA_DE_AMPLIACION_M2,
                    AREA_DE_TERRAZA_M2: AREA_DE_TERRAZA_M2,
                    PRECIOPOR_M2: PRECIOPOR_M2,
                    TERCER_NIVEL_SOTANO_M2: TERCER_NIVEL_SOTANO_M2,
                    AREA_DE_PARQUEO_APROXM2: AREA_DE_PARQUEO_APROXM2,
                    AREA_EXTERNA_JARDIN_M2: AREA_EXTERNA_JARDIN_M2,
                    AREA_COMUNLIBRE_ASIGNADO: AREA_COMUNLIBRE_ASIGNADO,
                    JARDI_CON_TALUD: JARDI_CON_TALUD,
                    PRECIO_DE_VENTA_MINIMO: PRECIO_DE_VENTA_MINIMO,
                };
                return response;
            }

            // 4. ******************************************************LLAMAMOS LOS DATOS DELA ESTIMACION POR MEDIO DEL ID **************************************

            if (dataIn.rType == "estimate") {
                var recordLoad = record.load({
                    type: record.Type.ESTIMATE,
                    id: dataIn.id,
                    isDynamic: false,
                });
                log.debug({
                    title: "RES estimate",
                    details: "--: " + JSON.stringify(recordLoad),
                });
                var data = recordLoad;
                var fields = ["subsidiary", "entitystatus", "custbody38", "custbody76", "salesrep", "entity", "opportunity", "tranid"];
                var names = ["Subsidaria", "Estado", "Exp", "Mt_pago", "vendedor", "cli", "opportunity_name", "train_id"];
                var results = {};
                for (var i = 0; i < fields.length; i++) {
                    results[names[i]] = JSON.parse(
                        JSON.stringify(
                            recordLoad.getText({
                                fieldId: fields[i],
                            }),
                        ),
                    );
                }
                results["tipo"] = "estiamcion";
                results["status"] = 200;
                results["data"] = data;
                return results;
            }

            //   ******************************************************LLAMAMOS LOS DATOS DELA OPORTUNIDAD POR MEDIO DEL ID **************************************
            if (dataIn.rType == "opportunity") {
                var recordLoad = record.load({
                    type: record.Type.OPPORTUNITY,
                    id: dataIn.id,
                    isDynamic: false,
                });
                log.debug({
                    title: "RES  oportunidad",
                    details: "--: " + JSON.stringify(recordLoad),
                });
                var data = recordLoad;
                var subsidaria = recordLoad.getText({
                    fieldId: "subsidiary",
                });
                var obj1 = JSON.stringify(subsidaria);
                var resultado_sub_tranform = JSON.parse(obj1);
                return {
                    tipo: "oportunidad",
                    status: 200,
                    Subsidaria: resultado_sub_tranform,
                    data: data,
                };
            }

            // 6. ******************************************************LLAMAMOS LOS DATOS DE LA ORDEN DE VENTA POR MEDIO DEL ID *******************************************
            if (dataIn.rType === "salesordersExtraer") {
                var salesOrderRecord = record.load({
                    type: record.Type.SALES_ORDER,
                    id: dataIn.id,
                    isDynamic: false,
                });
                var fields = {
                    subsidiary: "Subsidaria",
                    department: "Departamento",
                    class: "Clase",
                    location: "Ubi",
                    entity: "cli",
                    custbody38: "Expediente",
                    opportunity: "Oportunidad",
                    custbody115: "MOTIVO_CANCE",
                    custbody76: "MOTIVO_COMPRA",
                    createdfrom: "CREADO",
                    custbody75: "METODO_PAGO",
                    custbody37: "FONDOS",
                    leadsource: "CAMPANA",
                    partner: "socio",
                    salesrep: "vendedor",
                    custbodyix_exp_ligado_num_unid: "UNIDAD",
                    custbody18: "minimo",
                };

                var result = {
                    tipo: "orden de venta",
                    status: 200,
                    data: salesOrderRecord,
                };

                for (var field in fields) {
                    var value = salesOrderRecord.getText({
                        fieldId: field,
                    });
                    result[fields[field]] = JSON.stringify(value);
                    log.debug("valuie: ", JSON.stringify(value));
                }
                log.debug("datos reci: ", result);
                return result;
                return {
                    tipo: "oportunidad",
                    status: 200,
                    data: result,
                };
            }
        } catch (error) {
            log.error("Se presentó un error: ", error);
            return {
                status: 500,
                Error: error,
            };
        }
    }

    function doPut(dataIn) {
        log.debug("datos reci: ", dataIn);

        //   ******************************************************ACTUALIZAMOS LA ESTIMACION ************************************************

        if (dataIn.rType == "estimate") {
            //Paso # 1 - Cargar el registro indicando el tipo de registro y el ID Interno de Netsuite.
            var registro = record.load({
                type: "estimate",
                id: dataIn.id,
                isDynamic: true,
            });
            //var registro = record.load({ type: 'estimate', id: dataIn.id, isDynamic: true })
            try {
                registro.setValue("customform", 342);
                /*POR DEFEECTO USAMOS LA CLASE DE VENTAS*/
                registro.setValue({
                    fieldId: "department",
                    value: 15,
                }); //Check prereserva

                /*MONTO TOTAL*/
                registro.setValue({
                    fieldId: "custbody_ix_total_amount",
                    value: dataIn.custbody_ix_total_amount,
                });
                /*PRECIO DE LISTA :estimacion.*/
                registro.setValue({
                    fieldId: "custbody13",
                    value: dataIn.custbody13,
                });
                /*PRIMA TOTAL*/
                registro.setValue({
                    fieldId: "custbody39",
                    value: dataIn.custbody39,
                });
                /*PRIMA%*/
                registro.setValue({
                    fieldId: "custbody60",
                    value: dataIn.custbody60,
                });
                /*MONTO PRIMA NETA%*/
                registro.setValue({
                    fieldId: "custbody_ix_salesorder_monto_prima",
                    value: dataIn.custbody_ix_salesorder_monto_prima,
                });
                /*MONTO DESCUENTO DIRECTO*/
                registro.setValue({
                    fieldId: "custbody132",
                    value: dataIn.custbody132,
                });

                /*CASHBACK*/
                var reserva = dataIn.custbodyix_salesorder_cashback != "" ? dataIn.custbodyix_salesorder_cashback : 0.0;
                if (reserva > 0) {
                    /*CASHBACK*/
                    registro.setValue({
                        fieldId: "custbodyix_salesorder_cashback",
                        value: dataIn.custbodyix_salesorder_cashback,
                    });
                }
                //EXTRAS SOBRE EL PRECIO DE LISTA
                registro.setValue({
                    fieldId: "custbody185",
                    value: dataIn.custbody185,
                });
                /*MONTO EXTRAS SOBRE EL PRECIO DE LISTA*/
                registro.setValue({
                    fieldId: "custbody46",
                    value: dataIn.custbody46,
                });
                /*MONTO TOTAL DE CORTESÍAS*/
                registro.setValue({
                    fieldId: "custbody16",
                    value: dataIn.custbody16,
                });
                /*DESCRIPCIÓN DE EXTRAS SOBRE EL PRECIO DE LISTA*/
                registro.setValue({
                    fieldId: "custbody47",
                    value: dataIn.custbody47,
                });
                /*DESCRIPCIÓN DE LAS CORTESIAS*/
                registro.setValue({
                    fieldId: "custbody35",
                    value: dataIn.custbody35,
                });

                var numLineas = registro.getLineCount({
                    sublistId: "item",
                });

                // Eliminar todas las líneas existentes
                for (var i = numLineas - 1; i >= 0; i--) {
                    registro.removeLine({
                        sublistId: "item",
                        line: i,
                    });
                }

                // registro.setValue({ fieldId: 'custbody52', value: dataIn.rateReserva });// este campo es el campo de MONTO RESERVA
                // registro.setValue({ fieldId: 'custbody191', value: dataIn.custbody191 });// este campo es el campo de MONTO PRE- RESERVA

                var custbody113 = dataIn.custbody113;
                
                var montoReserva = dataIn.rateReserva;
                var montoPREReserva = dataIn.custbody191;
                var totalRestaPre = montoReserva - montoPREReserva;
                // Define una tolerancia para la comparación
                var epsilon = 0.0001; // Ajusta según tus necesidades

                if (dataIn.custbody113 == "T") {
                    var custbody206Date = dataIn.custbody206;
                    custbody206Date = format.parse({
                        value: dataIn.custbody206,
                        type: format.Type.DATE,
                    });
                    registro.setValue({
                        fieldId: "custbody113",
                        value: true,
                    }); //chek de prereserva
                    registro.setValue({
                        fieldId: "custbody191",
                        value: dataIn.custbody191,
                    }); //monto prereserva
                    registro.setValue({
                        fieldId: "custbody188",
                        value: dataIn.custbody188,
                    }); //metodo de pago
                    registro.setValue({
                        fieldId: "custbody189",
                        value: dataIn.custbody189,
                    }); //numero de transaccion
                    registro.setValue({
                        fieldId: "custbody206",
                        value: custbody206Date,
                    }); //fecha pre reserva
                    registro.setValue({
                        fieldId: "custbody190",
                        value: dataIn.custbody190,
                    }); //observaciones pre reserva

                    // Verifica si el valor está dentro de la tolerancia para cero
                    if (Math.abs(totalRestaPre) < epsilon) {
                        /*MONTO RESERVA*/
                        var date = dataIn.fech_reserva;
                        date = format.parse({
                            value: date,
                            type: format.Type.DATE,
                        });
                        var reserva = dataIn.rateReserva != "" ? dataIn.rateReserva : 0.0;
                        registro.selectNewLine({
                            sublistId: "item",
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "item",
                            value: 55563,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "quantity",
                            value: 1,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "rate",
                            value: dataIn.rateReserva,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcolfecha_pago_proyectado",
                            value: date,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "taxcode",
                            value: 24865,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_indentificadorprima",
                            value: 551,
                        });
                        registro.commitLine({
                            sublistId: "item",
                        });
                    } else {
                        var date1custbody206 = dataIn.custbody206;
                        date1custbody206 = format.parse({
                            value: date1custbody206,
                            type: format.Type.DATE,
                        });
                        registro.selectNewLine({
                            sublistId: "item",
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "item",
                            value: 55563,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "quantity",
                            value: 1,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "rate",
                            value: dataIn.custbody191,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcolfecha_pago_proyectado",
                            value: date1custbody206,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "taxcode",
                            value: 24865,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_indentificadorprima",
                            value: 552,
                        });
                        registro.commitLine({
                            sublistId: "item",
                        });

                        var fech_reserva = dataIn.fech_reserva;
                        fech_reserva = format.parse({
                            value: fech_reserva,
                            type: format.Type.DATE,
                        });
                        registro.selectNewLine({
                            sublistId: "item",
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "item",
                            value: 55563,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "quantity",
                            value: 1,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "rate",
                            value: totalRestaPre,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcolfecha_pago_proyectado",
                            value: fech_reserva,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "taxcode",
                            value: 24865,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_indentificadorprima",
                            value: 551,
                        });
                        registro.commitLine({
                            sublistId: "item",
                        });
                    }
                } else {
                    registro.setValue({
                        fieldId: "custbody191",
                        value: "",
                    }); //monto prereserva
                    registro.setValue({
                        fieldId: "custbody188",
                        value: "",
                    }); //metodo de pago
                    registro.setValue({
                        fieldId: "custbody189",
                        value: "",
                    }); //numero de transaccion
                    registro.setValue({
                        fieldId: "custbody206",
                        value: "",
                    }); //fecha pre reserva
                    registro.setValue({
                        fieldId: "custbody190",
                        value: "",
                    }); //observaciones pre reserva

                    /*MONTO RESERVA*/
                    var date = dataIn.fech_reserva;
                    date = format.parse({
                        value: date,
                        type: format.Type.DATE,
                    });
                    var reserva = dataIn.rateReserva != "" ? dataIn.rateReserva : 0.0;
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55563,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: 1,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.rateReserva,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcolfecha_pago_proyectado",
                        value: date,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 551,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });
                }

                /*PRIMA FRACCIONADA*/
                if (dataIn.custbody176 == "T") {
                    var date = dataIn.custbody179_date;
                    date = format.parse({
                        value: date,
                        type: format.Type.DATE,
                    });
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55564,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: dataIn.custbody180,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "description",
                        value: dataIn.custbody193,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.custbody179,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcolfecha_pago_proyectado",
                        value: date,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 5551,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });
                }

                /*PRIMA FRACCIONADA*/
                if (dataIn.custbody177 == "T") {
                    var date = dataIn.custbody182_date;
                    date = format.parse({
                        value: date,
                        type: format.Type.DATE,
                    });
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55564,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: dataIn.custbody182,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "description",
                        value: dataIn.custbody194,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.custbody181,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcolfecha_pago_proyectado",
                        value: date,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 5552,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });
                }

                /*PRIMA EXTRA*/
                if (dataIn.custbody178 == "T") {
                    var date = dataIn.custbody184_date;
                    date = format.parse({
                        value: date,
                        type: format.Type.DATE,
                    });
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55564,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: dataIn.custbody184,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "description",
                        value: dataIn.custbody195,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.custbody183,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcolfecha_pago_proyectado",
                        value: date,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 5553,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });
                }

                //PRIMA EXTRA +1
                if (dataIn.prima_extra_uno == "T") {
                    var date = dataIn.custbody184_uno_date;
                    date = format.parse({
                        value: date,
                        type: format.Type.DATE,
                    });
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55564,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: dataIn.monto_tracto_uno,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "description",
                        value: dataIn.desc_extra_uno,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.monto_extra_uno,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcolfecha_pago_proyectado",
                        value: date,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 5554,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });
                }

                //PRIMA EXTRA +2
                if (dataIn.prima_extra_dos == "T") {
                    var date = dataIn.custbody184_dos_date;
                    date = format.parse({
                        value: date,
                        type: format.Type.DATE,
                    });
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55564,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: dataIn.monto_tracto_dos,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "description",
                        value: dataIn.desc_extra_dos,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.monto_extra_dos,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcolfecha_pago_proyectado",
                        value: date,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 5555,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });
                }

                //PRIMA EXTRA +3
                if (dataIn.prima_extra_tres == "T") {
                    var date = dataIn.custbody184_tres_date;
                    date = format.parse({
                        value: date,
                        type: format.Type.DATE,
                    });
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55564,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: dataIn.monto_tracto_tres,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "description",
                        value: dataIn.desc_extra_tres,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.monto_extra_tres,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcolfecha_pago_proyectado",
                        value: date,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 5556,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });
                }

                log.debug("dataIn.custbody75 : ", dataIn.custbody75);
                //METODO DE PAGO
                registro.setValue({
                    fieldId: "custbody75",
                    value: dataIn.custbody75,
                });
                if (dataIn.custbody75 == 1) {
                    var date = dataIn.date_hito_6;
                    date = format.parse({
                        value: date,
                        type: format.Type.DATE,
                    });
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55570,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: 1,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.custbody_ix_salesorder_hito6,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcolfecha_pago_proyectado",
                        value: date,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 5557,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });

                    //MONTO SIN PRIMA TOTAL
                    registro.setValue({
                        fieldId: "custbody163",
                        value: dataIn.custbody163,
                    });
                }

                if (dataIn.custbody75 == 2) {
                    //HITO 1 %
                    registro.setValue("custbody62", dataIn.custbody62.replace("%", ""));
                    registro.setValue("custbodyix_salesorder_hito1", dataIn.custbodyix_salesorder_hito1);
                    // CREAMOS LA LINEA DE HITO 1:
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55565,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: 1,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.custbodyix_salesorder_hito1,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 11115,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });

                    //HITO 2 %
                    registro.setValue("custbody63", dataIn.custbody63.replace("%", ""));
                    registro.setValue("custbody_ix_salesorder_hito2", dataIn.custbody_ix_salesorder_hito2);
                    // CREAMOS LA LINEA DE HITO 2:
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55566,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: 1,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.custbody_ix_salesorder_hito2,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 11116,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });

                    // CREAMOS LA LINEA DE HITO 3:
                    //HITO 3 %
                    registro.setValue("custbody64", dataIn.custbody64.replace("%", ""));
                    registro.setValue("custbody_ix_salesorder_hito3", dataIn.custbody_ix_salesorder_hito3);
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55567,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: 1,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.custbody_ix_salesorder_hito3,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 111167,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });

                    // CREAMOS LA LINEA DE HITO 4:
                    registro.setValue("custbody65", dataIn.custbody65.replace("%", ""));
                    registro.setValue("custbody_ix_salesorder_hito4", dataIn.custbody_ix_salesorder_hito4);
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55568,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: 1,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.custbody_ix_salesorder_hito4,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 111168,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });

                    // CREAMOS LA LINEA DE HITO 5:
                    registro.setValue("custbody66", dataIn.custbody66.replace("%", ""));
                    registro.setValue("custbody_ix_salesorder_hito5", dataIn.custbody_ix_salesorder_hito5);
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55569,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: 1,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.custbody_ix_salesorder_hito5,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 111169,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });

                    // CREAMOS LA LINEA DE HITO 6:
                    registro.setValue("custbody67", dataIn.custbody67.replace("%", ""));
                    registro.setValue("custbody_ix_salesorder_hito6", dataIn.custbody_ix_salesorder_hito6);
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55570,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: 1,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.custbody_ix_salesorder_hito6,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 111170,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });

                    //MONTO SIN PRIMA TOTAL
                    //MONTO ASIGNABLE PRIMA NETA:
                    registro.setValue("custbody163", dataIn.custbody163);
                }

                if (dataIn.custbody75 == 7) {
                    if (dataIn.hito_chek_uno == 1) {
                        var date = dataIn.date_hito_1;
                        date = format.parse({
                            value: date,
                            type: format.Type.DATE,
                        });

                        registro.selectNewLine({
                            sublistId: "item",
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "item",
                            value: 55565,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "quantity",
                            value: 1,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "rate",
                            value: dataIn.custbodyix_salesorder_hito1,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcolfecha_pago_proyectado",
                            value: date,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "taxcode",
                            value: 24865,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_indentificadorprima",
                            value: 55565,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_porcentajediferenciadocrm",
                            value: dataIn.custbody62,
                        });
                        registro.commitLine({
                            sublistId: "item",
                        });
                    }
                    if (dataIn.hito_chek_dos == 1) {
                        var date = dataIn.date_hito_2;
                        date = format.parse({
                            value: date,
                            type: format.Type.DATE,
                        });
                        // CREAMOS LA LINEA DE HITO 2:
                        registro.selectNewLine({
                            sublistId: "item",
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "item",
                            value: 55566,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "quantity",
                            value: 1,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "rate",
                            value: dataIn.custbody_ix_salesorder_hito2,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcolfecha_pago_proyectado",
                            value: date,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "taxcode",
                            value: 24865,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_indentificadorprima",
                            value: 55566,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_porcentajediferenciadocrm",
                            value: dataIn.custbody63,
                        });
                        registro.commitLine({
                            sublistId: "item",
                        });
                    }
                    if (dataIn.hito_chek_tres == 1) {
                        // CREAMOS LA LINEA DE HITO 3:
                        var date = dataIn.date_hito_3;
                        date = format.parse({
                            value: date,
                            type: format.Type.DATE,
                        });
                        registro.selectNewLine({
                            sublistId: "item",
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "item",
                            value: 55567,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "quantity",
                            value: 1,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "rate",
                            value: dataIn.custbody_ix_salesorder_hito3,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcolfecha_pago_proyectado",
                            value: date,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "taxcode",
                            value: 24865,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_indentificadorprima",
                            value: 55567,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_porcentajediferenciadocrm",
                            value: dataIn.custbody64,
                        });
                        registro.commitLine({
                            sublistId: "item",
                        });
                    }
                    if (dataIn.hito_chek_cuatro == 1) {
                        // CREAMOS LA LINEA DE HITO 4:
                        var date = dataIn.date_hito_4;
                        date = format.parse({
                            value: date,
                            type: format.Type.DATE,
                        });
                        registro.selectNewLine({
                            sublistId: "item",
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "item",
                            value: 55568,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "quantity",
                            value: 1,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "rate",
                            value: dataIn.custbody_ix_salesorder_hito4,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcolfecha_pago_proyectado",
                            value: date,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "taxcode",
                            value: 24865,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_indentificadorprima",
                            value: 55568,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_porcentajediferenciadocrm",
                            value: dataIn.custbody65,
                        });
                        registro.commitLine({
                            sublistId: "item",
                        });
                    }
                    if (dataIn.hito_chek_cinco == 1) {
                        // CREAMOS LA LINEA DE HITO 5:
                        var date = dataIn.date_hito_5;
                        date = format.parse({
                            value: date,
                            type: format.Type.DATE,
                        });
                        registro.selectNewLine({
                            sublistId: "item",
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "item",
                            value: 55569,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "quantity",
                            value: 1,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "rate",
                            value: dataIn.custbody_ix_salesorder_hito5,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcolfecha_pago_proyectado",
                            value: date,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "taxcode",
                            value: 24865,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_indentificadorprima",
                            value: 55569,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_porcentajediferenciadocrm",
                            value: dataIn.custbody66,
                        });
                        registro.commitLine({
                            sublistId: "item",
                        });
                    }
                    if (dataIn.hito_chek_seis == 1) {
                        // CREAMOS LA LINEA DE HITO 5:
                        var date = dataIn.date_hito_6;
                        date = format.parse({
                            value: date,
                            type: format.Type.DATE,
                        });
                        registro.selectNewLine({
                            sublistId: "item",
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "item",
                            value: 55570,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "quantity",
                            value: 1,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "rate",
                            value: dataIn.custbody_ix_salesorder_hito6,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcolfecha_pago_proyectado",
                            value: date,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "taxcode",
                            value: 24865,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_indentificadorprima",
                            value: 55570,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_porcentajediferenciadocrm",
                            value: dataIn.custbody67,
                        });
                        registro.commitLine({
                            sublistId: "item",
                        });
                    }

                    //MONTO SIN PRIMA TOTAL
                    registro.setValue("custbody163", dataIn.custbody163);
                }

                //MONTO ASIGNABLE PRIMA NETA:
                registro.setValue({
                    fieldId: "custbody211",
                    value: dataIn.custbody_ix_salesorder_monto_prima,
                });

                //Paso # 3 - Guardar el registro modificado en Netsuite.
                registro.save();
                return {
                    Status: 200,
                    Data: registro,
                    id: JSON.parse(dataIn.id),
                };
            } catch (error) {
                log.error("Se presentó un error: ", error);
                return {
                    Status: 500,
                    Error: error,
                };
            }
        }

        //   ******************************************************ACTUALIZAMOS EL EMPLEADO ************************************************
        if (dataIn.rType == "empleado_edit") {
            //Paso # 1 - Cargar el registro indicando el tipo de registro y el ID Interno de Netsuite.
            var registro = record.load({
                type: "employee",
                id: dataIn.id,
            });
            //Paso # 2 - Actualizar el registro indicando los campos a modificar, con su respectivo valor.
            try {
                registro.setValue({
                    fieldId: "phone",
                    value: dataIn.phone,
                });
                registro.setValue({
                    fieldId: "custentity_ix_cedula",
                    value: dataIn.custentity_ix_cedula,
                });
                registro.setValue({
                    fieldId: "email",
                    value: dataIn.email,
                });
                registro.setValue({
                    fieldId: "firstname",
                    value: dataIn.firstname,
                });
                //Paso # 3 - Guardar el registro modificado en Netsuite.
                registro.save();
                return {
                    status: 200,
                    Data: registro,
                };
            } catch (error) {
                log.error("Se presentó un error: ", error);
                return {
                    status: 500,
                    Error: error,
                };
            }
        }

        //   ******************************************************ACTUALIZAMOS LA ORDEN DE VENTA ************************************************
        if (dataIn.rType == "update_salesorder") {
            //Paso # 1 - Cargar el registro indicando el tipo de registro y el ID Interno de Netsuite.
            var registro = record.load({
                type: "salesorder",
                id: dataIn.id,
            });
            //Paso # 2 - Actualizar el registro indicando los campos a modificar, con su respectivo valor.
            try {
                registro.setValue({
                    fieldId: "customform",
                    value: 136,
                });

                //FIRMA DE CONTRATO:
                var shipDate_custbody68 = dataIn.custbody68;
                if (shipDate_custbody68) {
                    // shipDate no está vacía, realizar alguna acción
                    shipDate_custbody68 = format.parse({
                        value: shipDate_custbody68,
                        type: format.Type.DATE,
                    });
                    registro.setValue({
                        fieldId: "custbody68",
                        value: shipDate_custbody68,
                    });
                }
                //DEPARTAMENTO
                registro.setValue({
                    fieldId: "department",
                    value: dataIn.department,
                });

                //NOTA
                registro.setValue({
                    fieldId: "memo",
                    value: dataIn.memo,
                });

                //FECHA:
                var shipDate_trandate = dataIn.trandate;
                if (shipDate_trandate) {
                    shipDate_trandate = format.parse({
                        value: shipDate_trandate,
                        type: format.Type.DATE,
                    });
                    registro.setValue({
                        fieldId: "trandate",
                        value: shipDate_trandate,
                    });
                }

                //CLASEE
                registro.setValue({
                    fieldId: "class",
                    value: dataIn.class,
                });

                //ubicacion
                registro.setValue({
                    fieldId: "location",
                    value: dataIn.location,
                });

                //MOTIVO DE CANCELACIÓN DE RESERVA O VENTA CAIDA
                registro.setValue({
                    fieldId: "custbody115",
                    value: dataIn.custbody115,
                });

                //MOTIVO DE COMPRA
                registro.setValue({
                    fieldId: "custbody76",
                    value: dataIn.custbody76,
                });
                //ENTREGA ESTIMADA
                registro.setValue({
                    fieldId: "custbody114",
                    value: dataIn.custbody114,
                });

                //COMENTARIOS CANCELACIÓN DE RESERVA
                registro.setValue({
                    fieldId: "custbody116",
                    value: dataIn.custbody116,
                });

                //MÉTODO DE PAGO
                registro.setValue({
                    fieldId: "custbody75",
                    value: dataIn.custbody75,
                });

                //FONDOS DE COMPRA
                registro.setValue({
                    fieldId: "custbody37",
                    value: dataIn.custbody37,
                });

                //FECHA DE ENTREGA CONTRACTUAL
                var shipDate_custbody140 = dataIn.custbody140;
                if (shipDate_custbody140) {
                    shipDate_custbody140 = format.parse({
                        value: shipDate_custbody140,
                        type: format.Type.DATE,
                    });
                    registro.setValue({
                        fieldId: "custbody140",
                        value: shipDate_custbody140,
                    });
                }

                //FECHA DE ENTREGA CONTRACTUAL
                var shipDate_saleseffectivedate = dataIn.saleseffectivedate;
                if (shipDate_saleseffectivedate) {
                    shipDate_saleseffectivedate = format.parse({
                        value: shipDate_saleseffectivedate,
                        type: format.Type.DATE,
                    });
                    registro.setValue({
                        fieldId: "saleseffectivedate",
                        value: shipDate_saleseffectivedate,
                    });
                }

                //CAMPAÑA DE MARKETING
                registro.setValue({
                    fieldId: "leadsource",
                    value: dataIn.leadsource,
                });

                //MONTO EXTRAS SOBRE EL PRECIO DE LISTA
                registro.setValue({
                    fieldId: "custbody46",
                    value: dataIn.custbody46,
                });

                //COMISIÓN DEL ASESOR %
                registro.setValue({
                    fieldId: "custbody20",
                    value: dataIn.custbody20,
                });

                //DESCRIPCIÓN DE EXTRAS SOBRE EL PRECIO DE LISTA
                registro.setValue({
                    fieldId: "custbody47",
                    value: dataIn.custbody47,
                });
                //MONTO DE COMISIÓN DEL ASESOR
                registro.setValue({
                    fieldId: "custbody21",
                    value: dataIn.custbody21,
                });
                //CASHBACK
                registro.setValue({
                    fieldId: "custbodyix_salesorder_cashback",
                    value: dataIn.custbodyix_salesorder_cashback,
                });
                //MONTO DE COMISIÓN SEGUNDO ASESOR
                registro.setValue({
                    fieldId: "custbody71",
                    value: dataIn.custbody71,
                });

                //MONTO DE COMISIÓN DE CORREDOR
                registro.setValue({
                    fieldId: "custbody15",
                    value: dataIn.custbody15,
                });
                //MONTO TOTAL DE CORTESÍAS
                registro.setValue({
                    fieldId: "custbody16",
                    value: dataIn.custbody16,
                });
                //DESCRIPCIÓN DE CORTESÍAS
                registro.setValue({
                    fieldId: "custbody35",
                    value: dataIn.custbody35,
                });

                //Paso # 3 - Guardar el registro modificado en Netsuite.
                registro.save();
                return {
                    status: 200,
                    Data: registro,
                };
            } catch (error) {
                log.error("Se presentó un error: ", error);
                return {
                    status: 500,
                    Error: error,
                };
            }
        }

        if (dataIn.tipos == "update_add_lead_id") {
            var registro = record.load({
                type: "lead",
                id: dataIn.id,
                isDynamic: false,
            });
            //Paso # 2 - Actualizar el registro indicando los campos a modificar, con su respectivo valor.
            try {
                //Modificamos los datos principales
                registro.setValue({
                    fieldId: "comments",
                    value: dataIn.comentario_cliente,
                });
                registro.setValue({
                    fieldId: "custentity_csegix_proyectos",
                    value: dataIn.proyecto_new,
                });
                registro.setValue({
                    fieldId: "subsidiary",
                    value: dataIn.subsidiary_new,
                });
                registro.setValue({
                    fieldId: "custentity_ix_campanademarketing",
                    value: dataIn.campana_new,
                });
                registro.setValue({
                    fieldId: "email",
                    value: dataIn.email,
                });
                registro.setValue({
                    fieldId: "phone",
                    value: dataIn.phone,
                });
                //Nombre y apellidos en blanco para poder Colcoar en el form

                //ahora los llenamos
                registro.setValue({
                    fieldId: "firstname",
                    value: dataIn.nombre + " " + dataIn.primerApellido,
                });
                registro.setValue({
                    fieldId: "lastname",
                    value: dataIn.segundoApellido,
                });
                registro.setValue({
                    fieldId: "middlename",
                    value: "",
                });
                //agregamos el vendedor
                var sub = registro.getSublist({
                    sublistId: "salesteam",
                });
                var contador_sublist = registro.getLineCount({
                    sublistId: "salesteam",
                });
                for (var i = 0; i < contador_sublist; i++) {
                    var isprimary = registro.getSublistValue({
                        sublistId: "salesteam",
                        fieldId: "isprimary",
                        line: i,
                    });

                    if (isprimary == true || isprimary == false) {
                        var id_vendedor = registro.setSublistValue({
                            sublistId: "salesteam",
                            fieldId: "employee",
                            line: i,
                            value: dataIn.employee,
                        });
                        var rol_vendedor = registro.setSublistValue({
                            sublistId: "salesteam",
                            fieldId: "salesrole",
                            line: i,
                            value: "-2",
                        });

                        log.debug({
                            title: "id vendedor",
                            details: id_vendedor,
                        });
                    }
                }

                if (dataIn.informacion_Extra == 1) {
                    //cambiamos la cedula del usuario
                    registro.setValue({
                        fieldId: "vatregnumber",
                        value: dataIn.vatregnumber,
                    });
                    //cambiamos la nacionalidad
                    registro.setValue({
                        fieldId: "custentity1",
                        value: dataIn.custentity1,
                    });
                    //cambiamos el estado civil
                    registro.setValue({
                        fieldId: "custentityestado_civil",
                        value: dataIn.custentityestado_civil,
                    });
                    //telefono alternativo
                    registro.setValue({
                        fieldId: "altphone",
                        value: dataIn.altphone,
                    });
                    //edad del cliente
                    registro.setValue({
                        fieldId: "custentity11",
                        value: dataIn.custentity11,
                    });
                    //hijos del cliente
                    registro.setValue({
                        fieldId: "custentityhijos_cliente",
                        value: dataIn.custentityhijos_cliente,
                    });
                    //hijos profesion del cliente
                    registro.setValue({
                        fieldId: "custentity_ix_customer_profession",
                        value: dataIn.custentity_ix_customer_profession,
                    });
                    //hijos cambiamos el corredor del cliente
                }

                //validamos que el corredor exista
                if (dataIn.corredor_extra == 1) {
                    var contador_sublist_partners = registro.getLineCount({
                        sublistId: "partners",
                    });
                    for (var i = 0; i < contador_sublist_partners; i++) {
                        var isprimary = registro.getSublistValue({
                            sublistId: "partners",
                            fieldId: "isprimary",
                            line: i,
                        });

                        if (isprimary === true || isprimary === false) {
                            var id_vendedor = registro.setSublistValue({
                                sublistId: "partners",
                                fieldId: "partner",
                                line: i,
                                value: dataIn.corredor_new,
                            });
                            var rol_vendedor = registro.setSublistValue({
                                sublistId: "partners",
                                fieldId: "partnerrole",
                                line: i,
                                value: "3",
                            });
                            var isprimary2 = registro.setSublistValue({
                                sublistId: "partners",
                                fieldId: "isprimary",
                                line: i,
                                value: true,
                            });
                            var contribution = registro.setSublistValue({
                                sublistId: "partners",
                                fieldId: "contribution",
                                line: i,
                                value: "100.0",
                            });
                        }
                    }
                }
                if (dataIn.infromacion_extra_dos == 1) {
                    registro.setValue({
                        fieldId: "custentity77",
                        value: dataIn.custentity77,
                    });
                    registro.setValue({
                        fieldId: "custentity78",
                        value: dataIn.custentity78,
                    });
                    registro.setValue({
                        fieldId: "custentity79",
                        value: dataIn.custentity79,
                    });
                    registro.setValue({
                        fieldId: "custentity80",
                        value: dataIn.custentity80,
                    });
                    registro.setValue({
                        fieldId: "custentity82",
                        value: dataIn.custentity82,
                    });
                    registro.setValue({
                        fieldId: "custentity81",
                        value: dataIn.custentity81,
                    });
                    registro.setValue({
                        fieldId: "custentity84",
                        value: dataIn.custentity84,
                    });
                }

                if (dataIn.defaultaddress === "null") {
                } else {
                    // Configura los campos en el registro principal.
                    registro.setValue({
                        fieldId: "fieldName1",
                        value: dataIn.defaultaddress,
                    });

                    registro.setValue({
                        fieldId: "fieldName2",
                        value: dataIn.defaultaddress,
                    });

                    // Configura los campos en el sublist 'addressbook'.
                    registro.setSublistValue({
                        sublistId: "addressbook",
                        fieldId: "label",
                        line: 0, // Número de línea
                        value: dataIn.defaultaddress,
                    });

                    // Crea una subregistro de dirección para la línea.
                    var subrec = registro.getSublistSubrecord({
                        sublistId: "addressbook",
                        fieldId: "addressbookaddress",
                        line: 0, // Número de línea
                    });
                    subrec.setValue({
                        fieldId: "addr1",
                        value: dataIn.defaultaddress,
                    });

                    subrec.setValue({
                        fieldId: "addressee",
                        value: "",
                    });
                }

                registro.save();

                return {
                    status: 200,
                    Data: registro,
                };
            } catch (error) {
                log.error("Se presentó un error: ", error);
                return {
                    status: 500,
                    Data: error,
                };
            }
        }

        if (dataIn.rType === "edit_oportuindad") {
            try {
                var registro = record.load({
                    type: "opportunity",
                    id: dataIn.id,
                });
                var date = dataIn.fechCierre;

                date = format.parse({
                    value: date,
                    type: format.Type.DATE,
                });
                registro.setValue({
                    fieldId: "expectedclosedate",
                    value: date,
                });
                registro.setValue({
                    fieldId: "entitystatus",
                    value: dataIn.opciones,
                }); // ESTADO *
                registro.setValue({
                    fieldId: "custbody76",
                    value: dataIn.custbody76,
                }); // MOTIVO DE COMPRA
                registro.setValue({
                    fieldId: "custbody75",
                    value: dataIn.custbody75_est,
                }); // METODO DE PAGO
                registro.setValue({
                    fieldId: "memo",
                    value: dataIn.memo,
                }); // detalle *
                // Guardar el registro modificado en Netsuite
                registro.save({
                    enableSourcing: false,
                    ignoreMandatoryFields: true,
                });
                return {
                    Status: 200,
                    Data: registro,
                };
            } catch (error) {
                log.error("Se presentó un error: ", error);
                return {
                    Status: 500,
                    Error: error,
                };
            }
        }

        if (dataIn.rType == "ordenVenta") {
            var registro = record.load({
                type: "salesorder",
                id: dataIn.id,
                isDynamic: true,
            });

            try {
                // var valorCorredor = 1;
                // if (valorCorredor == 1) {
                //     var contador_sublist_partners = registro.getLineCount({ sublistId: 'partners' });
                //     for (var i = 0; i < contador_sublist_partners; i++) {
                //         registro.setSublistValue({
                //             sublistId: 'partners',
                //             fieldId: 'partner',
                //             line: i,
                //             value: 6130 // Check that this partner ID is correct and valid in your system
                //         });
                //         registro.setSublistValue({
                //             sublistId: 'partners',
                //             fieldId: 'partnerrole',
                //             line: i,
                //             value: "3" // Ensure that the role "3" is correct and expected in your system
                //         });
                //         registro.setSublistValue({
                //             sublistId: 'partners',
                //             fieldId: 'isprimary',
                //             line: i,
                //             value: true // Change to string value as it seems to expect "T" or "F"
                //         });
                //         registro.setSublistValue({
                //             sublistId: 'partners',
                //             fieldId: 'contribution',
                //             line: i,
                //             value: '100.0%' // Ensure this is the correct format; if not, try as a decimal 1.0
                //         });

                //     }
                //    registro.commitLine({ sublistId: 'partners' }); // Commit each line inside the loop
                // }

                //registro.setValue("customform", 342);
                /*POR DEFEECTO USAMOS LA CLASE DE VENTAS*/
                // registro.setValue({ fieldId: 'class', value: 2 }); //Check prereserva
                // ENTREGA ESTIMADA
                var custbody114 = dataIn.custbody114;
                if (custbody114 !== 0) {
                    registro.setValue({
                        fieldId: "custbody114",
                        value: custbody114,
                    });
                }

                // FECHA DE VIGENCIA DE LA VENTA
                var saleseffectivedate = dataIn.saleseffectivedate;
                if (saleseffectivedate != 0) {
                    saleseffectivedate = format.parse({
                        value: saleseffectivedate,
                        type: format.Type.DATE,
                    });
                    registro.setValue({
                        fieldId: "saleseffectivedate",
                        value: saleseffectivedate,
                    });
                }

                registro.setValue({
                    fieldId: "custbody18",
                    value: dataIn.custbody18,
                });

                // COMISIÓN DEL ASESOR
                var custbody20 = dataIn.custbody20;
                if (custbody20 !== 0) {
                    registro.setValue({
                        fieldId: "custbody20",
                        value: custbody20,
                    });
                }

                // % COMISIÓN DEL CORREDOR
                var custbody14 = dataIn.custbody14;
                if (custbody14 !== 0) {
                    registro.setValue({
                        fieldId: "custbody14",
                        value: custbody14,
                    });
                }

                // FONDOS DE COMPRA
                var custbody37 = dataIn.custbody37;
                if (custbody37 !== 0) {
                    registro.setValue({
                        fieldId: "custbody37",
                        value: custbody37,
                    });
                }

                // MOTIVO DE CANCELACIÓN DE RESERVA O VENTA CAIDA
                var custbody115 = dataIn.custbody115;
                if (custbody115 !== 0) {
                    registro.setValue({
                        fieldId: "custbody115",
                        value: custbody115,
                    });
                }

                // COMENTARIOS CANCELACIÓN DE RESERVA
                var custbody116 = dataIn.custbody116;
                if (custbody116 !== 0) {
                    registro.setValue({
                        fieldId: "custbody116",
                        value: custbody116,
                    });
                }

                // NOTA
                var memo = dataIn.memo;
                if (memo !== 0) {
                    registro.setValue({
                        fieldId: "memo",
                        value: memo,
                    });
                }

                //PRECIO DE VENTA NETP
                registro.setValue({
                    fieldId: "custbody17",
                    value: dataIn.pvneto,
                });
                registro.setValue({
                    fieldId: "custbody19",
                    value: dataIn.diferencia,
                });

                // RESERVA
                var RESERVA = dataIn.RESERVA;
                //log.debug( "pvneto",   );

                if (RESERVA === "T" || parseFloat(dataIn.rateReserva) == 1) {
                    // FECHA DE RESERVA APLICADA
                    var custbody208 = dataIn.custbody208;

                    custbody208 = format.parse({
                        value: custbody208,
                        type: format.Type.DATE,
                    });
                    registro.setValue({
                        fieldId: "custbody208",
                        value: custbody208,
                    });

                    registro.setValue({
                        fieldId: "custbody188",
                        value: dataIn.custbody188,
                    });
                    registro.setValue({
                        fieldId: "custbody189",
                        value: dataIn.custbody189,
                    });

                    // MONTO RESERVA APLICADA
                    var custbody207 = dataIn.custbody207;
                    if (custbody207 !== 0) {
                        registro.setValue({
                            fieldId: "custbody207",
                            value: custbody207,
                        });
                    }
                }
                /*MONTO TOTAL*/
                registro.setValue({
                    fieldId: "custbody_ix_total_amount",
                    value: dataIn.custbody_ix_total_amount,
                });
                /*PRECIO DE LISTA :estimacion.*/
                registro.setValue({
                    fieldId: "custbody13",
                    value: dataIn.custbody13,
                });
                /*PRIMA TOTAL*/
                registro.setValue({
                    fieldId: "custbody39",
                    value: dataIn.custbody39,
                });
                /*PRIMA%*/
                registro.setValue({
                    fieldId: "custbody60",
                    value: dataIn.custbody60,
                });
                /*MONTO PRIMA NETA%*/
                registro.setValue({
                    fieldId: "custbody_ix_salesorder_monto_prima",
                    value: dataIn.custbody_ix_salesorder_monto_prima,
                });
                /*MONTO DESCUENTO DIRECTO*/
                registro.setValue({
                    fieldId: "custbody132",
                    value: dataIn.custbody132,
                });
                /*CASHBACK*/
                var reserva = dataIn.custbodyix_salesorder_cashback != "" ? dataIn.custbodyix_salesorder_cashback : 0.0;
                if (reserva > 0) {
                    /*CASHBACK*/
                    registro.setValue({
                        fieldId: "custbodyix_salesorder_cashback",
                        value: dataIn.custbodyix_salesorder_cashback,
                    });
                }
                //EXTRAS SOBRE EL PRECIO DE LISTA
                registro.setValue({
                    fieldId: "custbody185",
                    value: dataIn.custbody185,
                });
                /*MONTO EXTRAS SOBRE EL PRECIO DE LISTA*/
                registro.setValue({
                    fieldId: "custbody46",
                    value: dataIn.custbody46,
                });
                /*MONTO TOTAL DE CORTESÍAS*/
                registro.setValue({
                    fieldId: "custbody16",
                    value: dataIn.custbody16,
                });
                /*DESCRIPCIÓN DE EXTRAS SOBRE EL PRECIO DE LISTA*/
                registro.setValue({
                    fieldId: "custbody47",
                    value: dataIn.custbody47,
                });
                /*DESCRIPCIÓN DE LAS CORTESIAS*/
                registro.setValue({
                    fieldId: "custbody35",
                    value: dataIn.custbody35,
                });
                registro.setValue({
                    fieldId: "custbody190",
                    value: dataIn.custbody190,
                }); //observaciones  reserva

                var numLineas = registro.getLineCount({
                    sublistId: "item",
                });

                // Eliminar todas las líneas existentes excepto aquellas con custcol_indentificadorprima = 552
                for (var i = numLineas - 1; i >= 0; i--) {
                    var identificadorPrima = registro.getSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        line: i,
                    });
                    registro.removeLine({
                        sublistId: "item",
                        line: i,
                    });
                }

                if (dataIn.rateReserva !== 0 && dataIn.rateReserva !== "") {
                    log.debug({
                        title: "validacion de diferente a o",
                        details: "VALIDACION DIFERENTE A 0",
                    });
                    if (dataIn.custbody207 !== 0 && dataIn.custbody207 !== "") {
                        log.debug({
                            title: "validacion de diferente a o custbody207",
                            details: "VALIDACION DIFERENTE A 0 custbody207",
                        });
                        log.debug({
                            title: "dataIn.custbody207",
                            details: dataIn.custbody207,
                        });
                        log.debug({
                            title: "dataIn.rateReserva ",
                            details: dataIn.rateReserva,
                        });
                        if (dataIn.custbody207 === dataIn.rateReserva) {
                            log.debug({
                                title: "son iguales",
                                details: "son iguales",
                            });

                            var date = dataIn.fech_reserva;
                            date = format.parse({
                                value: date,
                                type: format.Type.DATE,
                            });
                            var reserva = dataIn.rateReserva != "" ? dataIn.rateReserva : 0.0;
                            registro.selectNewLine({
                                sublistId: "item",
                            });
                            registro.setCurrentSublistValue({
                                sublistId: "item",
                                fieldId: "item",
                                value: 55563,
                            });
                            registro.setCurrentSublistValue({
                                sublistId: "item",
                                fieldId: "quantity",
                                value: 1,
                            });
                            registro.setCurrentSublistValue({
                                sublistId: "item",
                                fieldId: "rate",
                                value: dataIn.rateReserva,
                            });
                            registro.setCurrentSublistValue({
                                sublistId: "item",
                                fieldId: "custcolfecha_pago_proyectado",
                                value: date,
                            });
                            registro.setCurrentSublistValue({
                                sublistId: "item",
                                fieldId: "taxcode",
                                value: 24865,
                            });
                            registro.setCurrentSublistValue({
                                sublistId: "item",
                                fieldId: "custcol_indentificadorprima",
                                value: 551,
                            });
                            registro.commitLine({
                                sublistId: "item",
                            });
                        } else {
                            log.debug({
                                title: "no son iguales",
                                details: "no son iguales",
                            });
                            var restaRe = dataIn.rateReserva - dataIn.custbody207;

                            var date = dataIn.fech_reserva;
                            date = format.parse({
                                value: date,
                                type: format.Type.DATE,
                            });
                            var reserva = dataIn.rateReserva != "" ? dataIn.rateReserva : 0.0;
                            registro.selectNewLine({
                                sublistId: "item",
                            });
                            registro.setCurrentSublistValue({
                                sublistId: "item",
                                fieldId: "item",
                                value: 55563,
                            });
                            registro.setCurrentSublistValue({
                                sublistId: "item",
                                fieldId: "quantity",
                                value: 1,
                            });
                            registro.setCurrentSublistValue({
                                sublistId: "item",
                                fieldId: "rate",
                                value: restaRe,
                            });
                            registro.setCurrentSublistValue({
                                sublistId: "item",
                                fieldId: "custcolfecha_pago_proyectado",
                                value: date,
                            });
                            registro.setCurrentSublistValue({
                                sublistId: "item",
                                fieldId: "taxcode",
                                value: 24865,
                            });
                            registro.setCurrentSublistValue({
                                sublistId: "item",
                                fieldId: "custcol_indentificadorprima",
                                value: 551,
                            });
                            registro.commitLine({
                                sublistId: "item",
                            });

                            //SI ESTA CHEK RESERVA ENTONCES CREA LA LINEA
                            if (dataIn.RESERVA === "T") {
                                var date = dataIn.custbody208;
                                date = format.parse({
                                    value: date,
                                    type: format.Type.DATE,
                                });
                                registro.selectNewLine({
                                    sublistId: "item",
                                });
                                registro.setCurrentSublistValue({
                                    sublistId: "item",
                                    fieldId: "item",
                                    value: 55563,
                                });
                                registro.setCurrentSublistValue({
                                    sublistId: "item",
                                    fieldId: "quantity",
                                    value: 1,
                                });
                                registro.setCurrentSublistValue({
                                    sublistId: "item",
                                    fieldId: "rate",
                                    value: dataIn.custbody207,
                                });
                                registro.setCurrentSublistValue({
                                    sublistId: "item",
                                    fieldId: "custcolfecha_pago_proyectado",
                                    value: date,
                                });
                                registro.setCurrentSublistValue({
                                    sublistId: "item",
                                    fieldId: "taxcode",
                                    value: 24865,
                                });
                                registro.setCurrentSublistValue({
                                    sublistId: "item",
                                    fieldId: "custcol_indentificadorprima",
                                    value: 552,
                                });
                                registro.commitLine({
                                    sublistId: "item",
                                });
                            }
                        }
                    } else {
                        log.debug({
                            title: "no es diferne a 0  dataIn.custbody207",
                            details: " dataIn.custbody207",
                        });

                        var date = dataIn.fech_reserva;
                        date = format.parse({
                            value: date,
                            type: format.Type.DATE,
                        });
                        var reserva = dataIn.rateReserva != "" ? dataIn.rateReserva : 0.0;
                        registro.selectNewLine({
                            sublistId: "item",
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "item",
                            value: 55563,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "quantity",
                            value: 1,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "rate",
                            value: dataIn.rateReserva,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcolfecha_pago_proyectado",
                            value: date,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "taxcode",
                            value: 24865,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_indentificadorprima",
                            value: 551,
                        });
                        registro.commitLine({
                            sublistId: "item",
                        });
                    }
                }

                /*PRIMA FRACCIONADA*/
                if (dataIn.custbody176 == "T") {
                    var date = dataIn.custbody179_date;
                    date = format.parse({
                        value: date,
                        type: format.Type.DATE,
                    });
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55564,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: dataIn.custbody180,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "description",
                        value: dataIn.custbody193,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.custbody179,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcolfecha_pago_proyectado",
                        value: date,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 5551,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });
                }

                /*PRIMA FRACCIONADA*/
                if (dataIn.custbody177 == "T") {
                    var date = dataIn.custbody182_date;
                    date = format.parse({
                        value: date,
                        type: format.Type.DATE,
                    });
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55564,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: dataIn.custbody182,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "description",
                        value: dataIn.custbody194,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.custbody181,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcolfecha_pago_proyectado",
                        value: date,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 5552,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });
                }

                /*PRIMA EXTRA*/
                if (dataIn.custbody178 == "T") {
                    var date = dataIn.custbody184_date;
                    date = format.parse({
                        value: date,
                        type: format.Type.DATE,
                    });
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55564,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: dataIn.custbody184,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "description",
                        value: dataIn.custbody195,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.custbody183,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcolfecha_pago_proyectado",
                        value: date,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 5553,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });
                }

                //PRIMA EXTRA +1
                if (dataIn.prima_extra_uno == "T") {
                    var date = dataIn.custbody184_uno_date;
                    date = format.parse({
                        value: date,
                        type: format.Type.DATE,
                    });
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55564,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: dataIn.monto_tracto_uno,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "description",
                        value: dataIn.desc_extra_uno,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.monto_extra_uno,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcolfecha_pago_proyectado",
                        value: date,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 5554,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });
                }

                //PRIMA EXTRA +2
                if (dataIn.prima_extra_dos == "T") {
                    var date = dataIn.custbody184_dos_date;
                    date = format.parse({
                        value: date,
                        type: format.Type.DATE,
                    });
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55564,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: dataIn.monto_tracto_dos,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "description",
                        value: dataIn.desc_extra_dos,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.monto_extra_dos,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcolfecha_pago_proyectado",
                        value: date,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 5555,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });
                }

                //PRIMA EXTRA +3
                if (dataIn.prima_extra_tres == "T") {
                    var date = dataIn.custbody184_tres_date;
                    date = format.parse({
                        value: date,
                        type: format.Type.DATE,
                    });
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55564,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: dataIn.monto_tracto_tres,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "description",
                        value: dataIn.desc_extra_tres,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.monto_extra_tres,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcolfecha_pago_proyectado",
                        value: date,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 5556,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });
                }

                log.debug("dataIn.custbody75 : ", dataIn.custbody75);
                //METODO DE PAGO
                registro.setValue({
                    fieldId: "custbody75",
                    value: dataIn.custbody75,
                });
                if (dataIn.custbody75 == 1) {
                    var date = dataIn.date_hito_6;
                    date = format.parse({
                        value: date,
                        type: format.Type.DATE,
                    });
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55570,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: 1,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.custbody_ix_salesorder_hito6,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcolfecha_pago_proyectado",
                        value: date,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 5557,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });

                    //MONTO SIN PRIMA TOTAL
                    registro.setValue({
                        fieldId: "custbody163",
                        value: dataIn.custbody163,
                    });
                    //MONTO ASIGNABLE PRIMA NETA:
                    registro.setValue({
                        fieldId: "custbody211",
                        value: dataIn.neta,
                    });
                }

                if (dataIn.custbody75 == 2) {
                    //HITO 1 %
                    registro.setValue("custbody62", dataIn.custbody62.replace("%", ""));
                    registro.setValue("custbodyix_salesorder_hito1", dataIn.custbodyix_salesorder_hito1);
                    // CREAMOS LA LINEA DE HITO 1:
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55565,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: 1,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.custbodyix_salesorder_hito1,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 11115,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });

                    //HITO 2 %
                    registro.setValue("custbody63", dataIn.custbody63.replace("%", ""));
                    registro.setValue("custbody_ix_salesorder_hito2", dataIn.custbody_ix_salesorder_hito2);
                    // CREAMOS LA LINEA DE HITO 2:
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55566,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: 1,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.custbody_ix_salesorder_hito2,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 11116,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });

                    // CREAMOS LA LINEA DE HITO 3:
                    //HITO 3 %
                    registro.setValue("custbody64", dataIn.custbody64.replace("%", ""));
                    registro.setValue("custbody_ix_salesorder_hito3", dataIn.custbody_ix_salesorder_hito3);
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55567,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: 1,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.custbody_ix_salesorder_hito3,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 111167,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });

                    // CREAMOS LA LINEA DE HITO 4:
                    registro.setValue("custbody65", dataIn.custbody65.replace("%", ""));
                    registro.setValue("custbody_ix_salesorder_hito4", dataIn.custbody_ix_salesorder_hito4);
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55568,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: 1,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.custbody_ix_salesorder_hito4,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 111168,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });

                    // CREAMOS LA LINEA DE HITO 5:
                    registro.setValue("custbody66", dataIn.custbody66.replace("%", ""));
                    registro.setValue("custbody_ix_salesorder_hito5", dataIn.custbody_ix_salesorder_hito5);
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55569,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: 1,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.custbody_ix_salesorder_hito5,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 111169,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });

                    // CREAMOS LA LINEA DE HITO 6:
                    registro.setValue("custbody67", dataIn.custbody67.replace("%", ""));
                    registro.setValue("custbody_ix_salesorder_hito6", dataIn.custbody_ix_salesorder_hito6);
                    registro.selectNewLine({
                        sublistId: "item",
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "item",
                        value: 55570,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "quantity",
                        value: 1,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "rate",
                        value: dataIn.custbody_ix_salesorder_hito6,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "taxcode",
                        value: 24865,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "item",
                        fieldId: "custcol_indentificadorprima",
                        value: 111170,
                    });
                    registro.commitLine({
                        sublistId: "item",
                    });

                    //MONTO SIN PRIMA TOTAL
                    //MONTO ASIGNABLE PRIMA NETA:
                    registro.setValue("custbody163", dataIn.custbody163);
                    registro.setValue("custbody211", dataIn.neta);
                }

                if (dataIn.custbody75 == 7) {
                    if (dataIn.hito_chek_uno == 1) {
                        var date = dataIn.date_hito_1;
                        date = format.parse({
                            value: date,
                            type: format.Type.DATE,
                        });

                        registro.selectNewLine({
                            sublistId: "item",
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "item",
                            value: 55565,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "quantity",
                            value: 1,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "rate",
                            value: dataIn.custbodyix_salesorder_hito1,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcolfecha_pago_proyectado",
                            value: date,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "taxcode",
                            value: 24865,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_indentificadorprima",
                            value: 55565,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_porcentajediferenciadocrm",
                            value: dataIn.custbody62,
                        });
                        registro.commitLine({
                            sublistId: "item",
                        });
                    }
                    if (dataIn.hito_chek_dos == 1) {
                        var date = dataIn.date_hito_2;
                        date = format.parse({
                            value: date,
                            type: format.Type.DATE,
                        });
                        // CREAMOS LA LINEA DE HITO 2:
                        registro.selectNewLine({
                            sublistId: "item",
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "item",
                            value: 55566,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "quantity",
                            value: 1,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "rate",
                            value: dataIn.custbody_ix_salesorder_hito2,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcolfecha_pago_proyectado",
                            value: date,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "taxcode",
                            value: 24865,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_indentificadorprima",
                            value: 55566,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_porcentajediferenciadocrm",
                            value: dataIn.custbody63,
                        });
                        registro.commitLine({
                            sublistId: "item",
                        });
                    }
                    if (dataIn.hito_chek_tres == 1) {
                        // CREAMOS LA LINEA DE HITO 3:
                        var date = dataIn.date_hito_3;
                        date = format.parse({
                            value: date,
                            type: format.Type.DATE,
                        });
                        registro.selectNewLine({
                            sublistId: "item",
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "item",
                            value: 55567,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "quantity",
                            value: 1,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "rate",
                            value: dataIn.custbody_ix_salesorder_hito3,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcolfecha_pago_proyectado",
                            value: date,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "taxcode",
                            value: 24865,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_indentificadorprima",
                            value: 55567,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_porcentajediferenciadocrm",
                            value: dataIn.custbody64,
                        });
                        registro.commitLine({
                            sublistId: "item",
                        });
                    }
                    if (dataIn.hito_chek_cuatro == 1) {
                        // CREAMOS LA LINEA DE HITO 4:
                        var date = dataIn.date_hito_4;
                        date = format.parse({
                            value: date,
                            type: format.Type.DATE,
                        });
                        registro.selectNewLine({
                            sublistId: "item",
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "item",
                            value: 55568,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "quantity",
                            value: 1,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "rate",
                            value: dataIn.custbody_ix_salesorder_hito4,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcolfecha_pago_proyectado",
                            value: date,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "taxcode",
                            value: 24865,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_indentificadorprima",
                            value: 55568,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_porcentajediferenciadocrm",
                            value: dataIn.custbody65,
                        });
                        registro.commitLine({
                            sublistId: "item",
                        });
                    }
                    if (dataIn.hito_chek_cinco == 1) {
                        // CREAMOS LA LINEA DE HITO 5:
                        var date = dataIn.date_hito_5;
                        date = format.parse({
                            value: date,
                            type: format.Type.DATE,
                        });
                        registro.selectNewLine({
                            sublistId: "item",
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "item",
                            value: 55569,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "quantity",
                            value: 1,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "rate",
                            value: dataIn.custbody_ix_salesorder_hito5,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcolfecha_pago_proyectado",
                            value: date,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "taxcode",
                            value: 24865,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_indentificadorprima",
                            value: 55569,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_porcentajediferenciadocrm",
                            value: dataIn.custbody66,
                        });
                        registro.commitLine({
                            sublistId: "item",
                        });
                    }
                    if (dataIn.hito_chek_seis == 1) {
                        // CREAMOS LA LINEA DE HITO 5:
                        var date = dataIn.date_hito_6;
                        date = format.parse({
                            value: date,
                            type: format.Type.DATE,
                        });
                        registro.selectNewLine({
                            sublistId: "item",
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "item",
                            value: 55570,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "quantity",
                            value: 1,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "rate",
                            value: dataIn.custbody_ix_salesorder_hito6,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcolfecha_pago_proyectado",
                            value: date,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "taxcode",
                            value: 24865,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_indentificadorprima",
                            value: 55570,
                        });
                        registro.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_porcentajediferenciadocrm",
                            value: dataIn.custbody67,
                        });
                        registro.commitLine({
                            sublistId: "item",
                        });
                    }

                    //MONTO SIN PRIMA TOTAL
                    registro.setValue("custbody163", dataIn.custbody163);
                    //MONTO ASIGNABLE PRIMA NETA:
                    registro.setValue("custbody211", dataIn.neta);
                }

                // Define variables iniciales
                var partnerId = dataIn.corredorID; // Almacena el ID válido de un socio
                var partnerRole = 3; // Asume que '3' es un código de rol válido
                var contribution = 100; // Establece la contribución de ejemplo

                // Verifica si el socio necesita validación
                if (dataIn.validacionCorredor != 0) {
                    // Obtiene el número de líneas existentes en la sublista 'partners'
                    var numLineas = registro.getLineCount({
                        sublistId: "partners",
                    });

                    // Elimina todas las líneas existentes para asegurar que no hay duplicados
                    for (var i = numLineas - 1; i >= 0; i--) {
                        registro.removeLine({
                            sublistId: "partners",
                            line: i,
                        });
                    }

                    registro.selectNewLine({ sublistId: "partners" });
                    registro.setCurrentSublistValue({
                        sublistId: "partners",
                        fieldId: "partner",
                        value: partnerId,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "partners",
                        fieldId: "partnerrole",
                        value: partnerRole,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "partners",
                        fieldId: "isprimary",
                        value: true,
                    });
                    registro.setCurrentSublistValue({
                        sublistId: "partners",
                        fieldId: "contribution",
                        value: contribution,
                    });
                    registro.commitLine({ sublistId: "partners" });
                } else {
                    // Obtiene el número de líneas existentes en la sublista 'partners'
                    var numLineas = registro.getLineCount({
                        sublistId: "partners",
                    });

                    // Elimina todas las líneas existentes para asegurar que no hay duplicados
                    for (var i = numLineas - 1; i >= 0; i--) {
                        registro.removeLine({
                            sublistId: "partners",
                            line: i,
                        });
                    }
                }

                // Paso #3 - Guardar el registro modificado en Netsuite.
                registro.save();

                return {
                    Guardar: "Guardar",
                    Status: 200,
                    Data: registro,
                    id: JSON.parse(dataIn.id),
                };
            } catch (error) {
                log.error("Se presentó un error: ", error);
                return {
                    status: 500,
                    Error: error,
                };
            }
        }
    }
    return {
        get: getRestLet,
        put: doPut,
        //'post': doPost,
        //'delete': doDelete
    };
});
