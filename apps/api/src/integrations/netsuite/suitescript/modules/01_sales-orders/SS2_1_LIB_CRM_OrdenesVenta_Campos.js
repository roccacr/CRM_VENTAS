/**
 * Esquema de LECTURA de ordenes de venta (que campos se exponen y con que nombre).
 * No autoriza escrituras. Mantener sincronizado con el mapper netsuite-primary del CRM.
 * Las claves son las del JSON del CRM; los valores son IDs de campos de NetSuite.
 *
 * @NApiVersion 2.1
 */
define(["../../lib/SS2_1_LIB_CRM_Campos"], (fields) => {
    "use strict";

    const { fieldMap } = fields;

    return Object.freeze({
        // Montos, IDs y banderas: valor crudo.
        bodyValues: {
            ...fieldMap(`
                memo custbody116 custbody_ix_total_amount custbody36 custbody13 custbody22 custbody15
                custbody219 custbody16 custbody35 custbody46 custbody47 custbodyix_salesorder_cashback
                custbody17 custbody18 custbody19 custbody21 custbody71 exchangerate
                custbody_ov_cargos_adicionales custbody132 custbody52 custbody39 custbody185 custbody188
                custbody189 custbody207 custbody191 custbody190 custbody_ix_salesorder_monto_prima
                custbodyix_salesorder_hito1 custbody_ix_salesorder_hito2 custbody_ix_salesorder_hito3
                custbody_ix_salesorder_hito4 custbody_ix_salesorder_hito5 custbody_ix_salesorder_hito6
                custbody_i_amount_hitos custbody211 custbody_total_hitos_amount subtotal taxtotal
                giftcertapplied total custbody90 custbody51 custbody91 custbody105 custbody43 custbody103
                custbody_ix_comision_pagada custbody_entrega_de_llaves custbody274 custbody_mezzanine_verifica
                custbody_aprueba_jefe_ventas custbodyid_firma_rc custbodyid_firma_rocca custbody74 custbody73
                custbody141 custbody157
            `),
            initialtranid: "tranid", // Alias que consume el frontend; el campo real es tranid.
        },

        // Fechas y porcentajes: texto, para respetar el formato configurado en NetSuite.
        bodyTexts: {
            ...fieldMap(`
                trandate custbody68 saleseffectivedate custbodytpv_vigencia_garantia custbody114
                custbody140 custbody208 custbody206 custbody14 custbody20 custbody60 custbody62
                custbody63 custbody64 custbody65 custbody66 custbody67
            `),
            currencyname: "currency",
        },

        // Alias en la raiz de la respuesta que el CRM consume por nombre (listas -> texto visible).
        rootTexts: {
            Expediente: "custbody38",
            UNIDAD: "custbodyix_exp_ligado_num_unid",
            cli: "entity",
            Subsidaria: "subsidiary",
            Departamento: "department",
            Clase: "class",
            Ubi: "location",
            Oportunidad: "opportunity",
            CREADO: "createdfrom",
            vendedor: "salesrep",
            socio: "partner",
            CAMPANA: "leadsource",
            METODO_PAGO: "custbody75",
            FONDOS: "custbody37",
            MOTIVO_CANCE: "custbody115",
        },

        // Sublista "item".
        itemLines: {
            texts: { item_display: "item", custcolfecha_pago_proyectado: "custcolfecha_pago_proyectado" },
            values: fieldMap("quantity description rate amount grossamt"),
        },
    });
});
