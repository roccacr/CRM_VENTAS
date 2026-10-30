/**
 * Unico punto de acceso a N/record y N/search. Si cambia la forma de leer o escribir
 * en NetSuite, solo cambia este archivo; el resto trabaja contra estas funciones.
 * No hace: no valida entrada ni traduce errores (eso lo hacen Validacion y ErroresProveedor).
 *
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define(["N/record", "N/search"], (record, search) => {
    "use strict";

    // NetSuite evalua define antes de habilitar N/record, incluso su enum Type.
    // Los identificadores de tipo son constantes de texto; las llamadas API quedan dentro de las funciones.
    const RECORD_TYPES = Object.freeze({ SALES_ORDER: "salesorder" });

    /**
     * Carga un record completo en modo estandar. Es la operacion mas costosa (10 unidades en transacciones):
     * usarla solo si se necesitan sublistas o muchos campos.
     * @param {string} type Tipo de record (ver RECORD_TYPES).
     * @param {string} id ID interno ya validado.
     * @returns {object} Record de NetSuite.
     * @throws {SuiteScriptError} Errores del proveedor; para un ID inexistente se espera RCRD_DSNT_EXIST.
     */
    function loadRecord(type, id) {
        return record.load({ type, id, isDynamic: false });
    }

    /**
     * Lee solo los campos pedidos sin cargar el record completo (1 unidad). Las casillas devuelven boolean.
     * @param {string} type Tipo de record.
     * @param {string} id ID interno ya validado.
     * @param {string[]} fieldIds IDs de los campos a leer.
     * @returns {Object<string, *>} Valores por ID de campo.
     * @throws {SuiteScriptError} Errores del proveedor; para un ID inexistente se espera RCRD_DSNT_EXIST
     *         (pendiente de comprobar con un ID inexistente en Sandbox).
     */
    function lookupFlags(type, id, fieldIds) {
        return search.lookupFields({ type, id, columns: fieldIds });
    }

    /**
     * Activa UNA casilla sin tocar otros campos. enableSourcing false evita recalcular datos de origen;
     * ignoreMandatoryFields false respeta las reglas de la cuenta.
     * @param {string} type Tipo de record.
     * @param {string} id ID interno ya validado.
     * @param {string} fieldId Casilla a activar.
     * @returns {void}
     * @throws {SuiteScriptError} Si la escritura falla; el resultado puede ser desconocido.
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

    return Object.freeze({ RECORD_TYPES, loadRecord, lookupFlags, writeFlag });
});
