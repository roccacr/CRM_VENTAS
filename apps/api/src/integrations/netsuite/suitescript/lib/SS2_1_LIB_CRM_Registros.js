/**
 * Unico punto de acceso a N/record y N/search. Si cambia la forma de leer o escribir
 * en NetSuite, solo cambia este archivo; el resto trabaja contra estas funciones.
 *
 * @NApiVersion 2.1
 */
define(["N/record", "N/search"], (record, search) => {
    "use strict";

    /** Carga un record completo. Es la operacion mas costosa: usarla solo si se necesita el record entero. */
    function loadRecord(type, id) {
        return record.load({ type, id, isDynamic: false });
    }

    /**
     * Lee solo los campos pedidos sin cargar el record completo.
     * Las casillas devuelven boolean.
     */
    function lookupFlags(type, id, fieldIds) {
        return search.lookupFields({ type, id, columns: fieldIds });
    }

    /**
     * Activa UNA casilla sin tocar otros campos. enableSourcing false evita recalcular datos de origen;
     * ignoreMandatoryFields false respeta las reglas de la cuenta.
     */
    function writeFlag(type, id, fieldId) {
        record.submitFields({
            type,
            id,
            values: { [fieldId]: true },
            options: {
                enableSourcing: false,
                ignoreMandatoryFields: false,
            },
        });
    }

    // NetSuite evalua define antes de habilitar N/record, incluso su enum Type.
    // Los identificadores de tipo son constantes; las llamadas API quedan dentro de las acciones.
    const types = Object.freeze({ SALES_ORDER: "salesorder" });
    return Object.freeze({ types, loadRecord, lookupFlags, writeFlag });
});
