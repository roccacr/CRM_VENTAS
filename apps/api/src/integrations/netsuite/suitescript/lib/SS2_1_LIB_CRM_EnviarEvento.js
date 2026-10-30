/**
 * Transporte de eventos a desarrollo local. Sin escrituras ni reintentos automaticos.
 * Archivador: /SuiteScripts/CRM TINK/lib/SS2_1_LIB_CRM_EnviarEvento.js
 * @NApiVersion 2.1
 */
define(["N/https", "N/runtime"], (https, runtime) => {
    "use strict";
    const LOCAL_URL =
        "https://nontransgressively-sequential-leif.ngrok-free.dev/integrations/netsuite/local/order-events";
    const SECRET_ID = "custsecret_crm_local_events";

    /** Solo confirma recepcion cuando HTTP y JSON coinciden con la orden enviada. */
    function sendRecordEvent(event, readSnapshot) {
        if (runtime.accountId !== "4552704_SB1" || runtime.envType !== runtime.EnvType.SANDBOX)
            return { status: "environment_blocked", delivered: false };
        // URL administrada, nunca tomada de los campos o del usuario que edito el registro.
        const url = runtime.getCurrentScript().getParameter({ name: "custscript_crm_event_url" }) || LOCAL_URL;
        if (!/^https:\/\/[a-z0-9-]+\.ngrok-free\.dev\/integrations\/netsuite\/local\/order-events$/.test(url))
            return { status: "destination_blocked", delivered: false };
        try {
            // El secreto reside en API Secrets; nunca se incluye en el ZIP ni en logs.
            const authorization = https.createSecureString({ input: "Bearer {" + SECRET_ID + "}" });
            const snapshot = readSnapshot(event.netsuiteId);
            if (snapshot.status !== 200) return { status: "snapshot_failed", delivered: false };
            const body = JSON.stringify({
                schemaVersion: 1,
                source: { system: "netsuite", accountId: runtime.accountId, environment: "sandbox" },
                event: { ...event, observedAt: new Date().toISOString() },
                snapshot,
            });
            if (body.length > 500000) return { status: "payload_too_large", delivered: false };
            const response = https.post({
                url,
                body,
                headers: {
                    Authorization: authorization,
                    "Content-Type": "application/json",
                    "ngrok-skip-browser-warning": "true",
                },
            });
            if (Number(response.code) !== 200) return { status: "receiver_rejected", delivered: false };
            const receipt = JSON.parse(response.body);
            if (
                receipt.schemaVersion !== 1 ||
                receipt.received !== true ||
                receipt.persisted !== false ||
                receipt.netsuiteId !== event.netsuiteId
            )
                return { status: "receipt_invalid", delivered: false };
            return { status: "received_local", delivered: true };
        } catch {
            // El guardado ya ocurrio; no lanzar ni fingir que se reintentara automaticamente.
            return { status: "delivery_failed", delivered: false };
        }
    }
    return Object.freeze({ sendRecordEvent });
});
