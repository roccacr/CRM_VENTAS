const fetch = require("node-fetch");

const { executeQuery } = require("../conectionPool/conectionPool");

const outlookCalendarSync = {};

const OUTLOOK_SYNC_TABLE = "outlook_calendar_sync";
const MICROSOFT_GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const WEBHOOK_PATH = "/api/v2.0/webhooks/microsoft/calendar";
const SYNC_PAST_DAYS = 30;
const SYNC_FUTURE_DAYS = 365;
const SUBSCRIPTION_RENEWAL_BUFFER_MINUTES = 180;
const SUBSCRIPTION_DURATION_MINUTES = 1440;
const GRAPH_TIMEZONE_HEADER = 'outlook.timezone="Central America Standard Time"';

const normalizeIntegerValue = (value, fallback = 0) => {
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

const normalizeStringValue = (value, fallback = "") => (
    typeof value === "string" && value.trim() ? value.trim() : fallback
);

const normalizeNullableStringValue = (value) => {
    const normalizedValue = normalizeStringValue(value);

    return normalizedValue || null;
};

const formatDateOnly = (value) => {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, "0");
    const day = `${value.getDate()}`.padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const formatDateTimeValue = (value) => {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, "0");
    const day = `${value.getDate()}`.padStart(2, "0");
    const hours = `${value.getHours()}`.padStart(2, "0");
    const minutes = `${value.getMinutes()}`.padStart(2, "0");

    return `${year}-${month}-${day} ${hours}:${minutes}:${"00"}`;
};

const addDays = (value, days) => {
    const clonedDate = new Date(value.getTime());
    clonedDate.setDate(clonedDate.getDate() + days);

    return clonedDate;
};

const addMinutes = (value, minutes) => {
    const clonedDate = new Date(value.getTime());
    clonedDate.setMinutes(clonedDate.getMinutes() + minutes);

    return clonedDate;
};

const buildSyncWindowRange = () => {
    const today = new Date();
    const startDate = addDays(today, -SYNC_PAST_DAYS);
    const endDate = addDays(today, SYNC_FUTURE_DAYS);

    return {
        syncWindowStart: formatDateOnly(startDate),
        syncWindowEnd: formatDateOnly(endDate),
    };
};

const buildSubscriptionExpirationDateTime = () => addMinutes(
    new Date(),
    SUBSCRIPTION_DURATION_MINUTES,
).toISOString();

const resolveWebhookBaseUrl = (database) => {
    if (database === "produccion") {
        return "https://api-node-v2.roccacr.com";
    }

    return null;
};

const buildWebhookUrl = (database) => {
    const webhookBaseUrl = resolveWebhookBaseUrl(database);

    return webhookBaseUrl ? `${webhookBaseUrl}${WEBHOOK_PATH}` : null;
};

const buildClientState = (idAdmin, outlookUserEmail) => (
    `crm-sync-${idAdmin}-${Buffer.from(outlookUserEmail).toString("base64").replace(/=/g, "")}`
);

const isSubscriptionExpiringSoon = (expirationValue) => {
    if (!expirationValue) {
        return true;
    }

    const expirationDate = new Date(expirationValue);

    if (Number.isNaN(expirationDate.getTime())) {
        return true;
    }

    return expirationDate.getTime() - Date.now() <= SUBSCRIPTION_RENEWAL_BUFFER_MINUTES * 60 * 1000;
};

const stripHtmlTags = (value) => {
    if (typeof value !== "string") {
        return "";
    }

    return value
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};

const normalizeGraphDateTimeValue = (value) => {
    if (typeof value !== "string") {
        return "";
    }

    const trimmedValue = value.trim();

    if (!trimmedValue) {
        return "";
    }

    const matchedValue = trimmedValue.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);

    return matchedValue ? matchedValue[1] : "";
};

const normalizeGraphTimeValue = (value) => {
    const normalizedDateTime = normalizeGraphDateTimeValue(value);

    return normalizedDateTime ? normalizedDateTime.slice(11, 16) : "";
};

const normalizeOutlookEventPayload = (eventItem) => {
    const startDateTime = normalizeGraphDateTimeValue(eventItem?.start?.dateTime);
    const endDateTime = normalizeGraphDateTimeValue(eventItem?.end?.dateTime);

    return {
        outlookEventId: normalizeStringValue(eventItem?.id),
        nombreCalendar: normalizeStringValue(eventItem?.subject, "Evento sin título"),
        descripcionCalendar: normalizeStringValue(
            eventItem?.bodyPreview || stripHtmlTags(eventItem?.body?.content),
            "",
        ),
        fechaInicioCalendar: startDateTime,
        fechaFinCalendar: endDateTime,
        horaInicioCalendar: normalizeGraphTimeValue(eventItem?.start?.dateTime),
        horaFinalCalendar: normalizeGraphTimeValue(eventItem?.end?.dateTime),
    };
};

const buildGraphHeaders = (accessToken, extraHeaders = {}) => ({
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    Prefer: GRAPH_TIMEZONE_HEADER,
    ...extraHeaders,
});

const parseGraphResponse = async (response) => {
    const responseText = await response.text();
    let parsedBody = {};

    if (responseText) {
        try {
            parsedBody = JSON.parse(responseText);
        } catch {
            parsedBody = {};
        }
    }

    if (!response.ok) {
        const graphError = new Error(parsedBody?.error?.message || `Microsoft Graph HTTP ${response.status}`);
        graphError.statusCode = response.status;
        graphError.response = parsedBody;
        throw graphError;
    }

    return parsedBody;
};

const createSyncTableIfNeeded = async (database) => {
    const query = `
        CREATE TABLE IF NOT EXISTS ${OUTLOOK_SYNC_TABLE} (
            id_sync INT AUTO_INCREMENT PRIMARY KEY,
            id_admin INT NOT NULL,
            outlook_user_email VARCHAR(250) NOT NULL,
            subscription_id VARCHAR(255) DEFAULT NULL,
            subscription_expires_at VARCHAR(50) DEFAULT NULL,
            delta_link TEXT DEFAULT NULL,
            sync_window_start VARCHAR(25) DEFAULT NULL,
            sync_window_end VARCHAR(25) DEFAULT NULL,
            client_state VARCHAR(255) DEFAULT NULL,
            pending_sync INT NOT NULL DEFAULT 0,
            reauthorization_required INT NOT NULL DEFAULT 0,
            last_sync_at VARCHAR(50) DEFAULT NULL,
            last_notification_at VARCHAR(50) DEFAULT NULL,
            last_error TEXT DEFAULT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY ux_outlook_calendar_sync_admin_email (id_admin, outlook_user_email),
            KEY idx_outlook_calendar_sync_subscription (subscription_id)
        )
    `;

    return executeQuery(query, [], database);
};

const getSyncRowByAdminAndEmail = async (database, idAdmin, outlookUserEmail) => {
    const query = `
        SELECT *
        FROM ${OUTLOOK_SYNC_TABLE}
        WHERE id_admin = ?
          AND outlook_user_email = ?
        LIMIT 1
    `;
    const result = await executeQuery(query, [idAdmin, outlookUserEmail], database);

    if (!result?.ok) {
        return null;
    }

    return Array.isArray(result.data) ? result.data[0] || null : null;
};

const getSyncRowsBySubscriptionId = async (database, subscriptionId) => {
    const query = `
        SELECT *
        FROM ${OUTLOOK_SYNC_TABLE}
        WHERE subscription_id = ?
    `;
    const result = await executeQuery(query, [subscriptionId], database);

    if (!result?.ok) {
        return [];
    }

    return Array.isArray(result.data) ? result.data : [];
};

const upsertSyncRow = async ({
    database,
    idAdmin,
    outlookUserEmail,
    subscriptionId = null,
    subscriptionExpiresAt = null,
    deltaLink = null,
    syncWindowStart = null,
    syncWindowEnd = null,
    clientState = null,
    pendingSync = 0,
    reauthorizationRequired = 0,
    lastSyncAt = null,
    lastNotificationAt = null,
    lastError = null,
}) => {
    const query = `
        INSERT INTO ${OUTLOOK_SYNC_TABLE} (
            id_admin,
            outlook_user_email,
            subscription_id,
            subscription_expires_at,
            delta_link,
            sync_window_start,
            sync_window_end,
            client_state,
            pending_sync,
            reauthorization_required,
            last_sync_at,
            last_notification_at,
            last_error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            subscription_id = VALUES(subscription_id),
            subscription_expires_at = VALUES(subscription_expires_at),
            delta_link = COALESCE(VALUES(delta_link), delta_link),
            sync_window_start = COALESCE(VALUES(sync_window_start), sync_window_start),
            sync_window_end = COALESCE(VALUES(sync_window_end), sync_window_end),
            client_state = VALUES(client_state),
            pending_sync = VALUES(pending_sync),
            reauthorization_required = VALUES(reauthorization_required),
            last_sync_at = COALESCE(VALUES(last_sync_at), last_sync_at),
            last_notification_at = COALESCE(VALUES(last_notification_at), last_notification_at),
            last_error = VALUES(last_error)
    `;
    const params = [
        idAdmin,
        outlookUserEmail,
        subscriptionId,
        subscriptionExpiresAt,
        deltaLink,
        syncWindowStart,
        syncWindowEnd,
        clientState,
        pendingSync,
        reauthorizationRequired,
        lastSyncAt,
        lastNotificationAt,
        lastError,
    ];

    return executeQuery(query, params, database);
};

const patchExistingSubscription = async (accessToken, subscriptionId) => {
    const response = await fetch(`${MICROSOFT_GRAPH_BASE_URL}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
        method: "PATCH",
        headers: buildGraphHeaders(accessToken),
        body: JSON.stringify({
            expirationDateTime: buildSubscriptionExpirationDateTime(),
        }),
    });
    const data = await parseGraphResponse(response);

    return {
        subscriptionId: data?.id || subscriptionId,
        subscriptionExpiresAt: data?.expirationDateTime || null,
    };
};

const createGraphSubscription = async ({ accessToken, database, idAdmin, outlookUserEmail }) => {
    const webhookUrl = buildWebhookUrl(database);

    if (!webhookUrl) {
        const configError = new Error(
            "No hay URL pública de webhook configurada para este entorno. Outlook sync por webhook no puede ejecutarse localmente.",
        );
        configError.statusCode = 400;
        throw configError;
    }

    const response = await fetch(`${MICROSOFT_GRAPH_BASE_URL}/subscriptions`, {
        method: "POST",
        headers: buildGraphHeaders(accessToken),
        body: JSON.stringify({
            changeType: "created,updated,deleted",
            notificationUrl: webhookUrl,
            lifecycleNotificationUrl: webhookUrl,
            resource: "/me/events",
            expirationDateTime: buildSubscriptionExpirationDateTime(),
            clientState: buildClientState(idAdmin, outlookUserEmail),
        }),
    });
    const data = await parseGraphResponse(response);

    return {
        subscriptionId: data?.id || null,
        subscriptionExpiresAt: data?.expirationDateTime || null,
        clientState: data?.clientState || buildClientState(idAdmin, outlookUserEmail),
    };
};

const isExpectedLocalWebhookSyncError = (error) => {
    const message = typeof error?.message === "string" ? error.message : "";

    return message.includes("No hay URL pública de webhook configurada para este entorno");
};

const ensureGraphSubscription = async ({ accessToken, database, idAdmin, outlookUserEmail }) => {
    const currentSyncRow = await getSyncRowByAdminAndEmail(database, idAdmin, outlookUserEmail);

    if (
        currentSyncRow?.subscription_id
        && !isSubscriptionExpiringSoon(currentSyncRow.subscription_expires_at)
    ) {
        return currentSyncRow;
    }

    let subscriptionData = null;

    if (currentSyncRow?.subscription_id) {
        try {
            subscriptionData = await patchExistingSubscription(accessToken, currentSyncRow.subscription_id);
        } catch (error) {
            if (error.statusCode !== 404) {
                throw error;
            }
        }
    }

    if (!subscriptionData) {
        subscriptionData = await createGraphSubscription({ accessToken, database, idAdmin, outlookUserEmail });
    }

    const syncWindow = buildSyncWindowRange();

    await upsertSyncRow({
        database,
        idAdmin,
        outlookUserEmail,
        subscriptionId: subscriptionData.subscriptionId,
        subscriptionExpiresAt: subscriptionData.subscriptionExpiresAt,
        deltaLink: currentSyncRow?.delta_link || null,
        syncWindowStart: currentSyncRow?.sync_window_start || syncWindow.syncWindowStart,
        syncWindowEnd: currentSyncRow?.sync_window_end || syncWindow.syncWindowEnd,
        clientState: subscriptionData.clientState || currentSyncRow?.client_state || buildClientState(idAdmin, outlookUserEmail),
        pendingSync: currentSyncRow?.pending_sync || 0,
        reauthorizationRequired: 0,
        lastSyncAt: currentSyncRow?.last_sync_at || null,
        lastNotificationAt: currentSyncRow?.last_notification_at || null,
        lastError: null,
    });

    return getSyncRowByAdminAndEmail(database, idAdmin, outlookUserEmail);
};

const updateLinkedCalendarEventFromOutlook = async (database, eventItem) => {
    const normalizedPayload = normalizeOutlookEventPayload(eventItem);

    if (
        !normalizedPayload.outlookEventId
        || !normalizedPayload.fechaInicioCalendar
        || !normalizedPayload.fechaFinCalendar
    ) {
        return { matched: 0, updated: 0 };
    }

    const query = `
        UPDATE calendars
        SET
            nombre_calendar = ?,
            decrip_calendar = ?,
            fechaIni_calendar = ?,
            fechaFin_calendar = ?,
            horaInicio_calendar = ?,
            horaFinal_calendar = ?
        WHERE outlook_event_id = ?
          AND estado_calendar = 1
          AND accion_calendar = 'Pendiente'
    `;
    const params = [
        normalizedPayload.nombreCalendar,
        normalizedPayload.descripcionCalendar,
        normalizedPayload.fechaInicioCalendar,
        normalizedPayload.fechaFinCalendar,
        normalizedPayload.horaInicioCalendar,
        normalizedPayload.horaFinalCalendar,
        normalizedPayload.outlookEventId,
    ];
    const result = await executeQuery(query, params, database);
    const updatedRows = result?.data?.affectedRows ?? 0;

    return {
        matched: updatedRows > 0 ? 1 : 0,
        updated: updatedRows,
    };
};

const cancelLinkedCalendarEventFromOutlook = async (database, outlookEventId) => {
    const query = `
        UPDATE calendars
        SET
            estado_calendar = 0,
            accion_calendar = 'Cancelado',
            NotificarCliente = 4,
            correoEnviado = 0
        WHERE outlook_event_id = ?
          AND estado_calendar = 1
          AND accion_calendar = 'Pendiente'
    `;
    const result = await executeQuery(query, [outlookEventId], database);
    const updatedRows = result?.data?.affectedRows ?? 0;

    return {
        matched: updatedRows > 0 ? 1 : 0,
        updated: updatedRows,
    };
};

const consumeDeltaPage = async (database, deltaPageEvents) => {
    const summary = {
        processed: 0,
        updated: 0,
        cancelled: 0,
        matched: 0,
    };

    for (const eventItem of deltaPageEvents) {
        summary.processed += 1;

        if (eventItem?.["@removed"]?.reason === "deleted") {
            const result = await cancelLinkedCalendarEventFromOutlook(
                database,
                normalizeStringValue(eventItem?.id),
            );

            summary.matched += result.matched;
            summary.cancelled += result.updated;
            continue;
        }

        const result = await updateLinkedCalendarEventFromOutlook(database, eventItem);

        summary.matched += result.matched;
        summary.updated += result.updated;
    }

    return summary;
};

const getInitialDeltaUrl = (syncWindowStart, syncWindowEnd) => {
    const searchParams = new URLSearchParams({
        startdatetime: `${syncWindowStart}T00:00:00`,
        enddatetime: `${syncWindowEnd}T23:59:59`,
        $select: "id,subject,bodyPreview,start,end,lastModifiedDateTime",
    });

    return `${MICROSOFT_GRAPH_BASE_URL}/me/calendarView/delta?${searchParams.toString()}`;
};

const executeDeltaSync = async ({ accessToken, database, syncRow }) => {
    const syncWindowStart = normalizeStringValue(syncRow?.sync_window_start) || buildSyncWindowRange().syncWindowStart;
    const syncWindowEnd = normalizeStringValue(syncRow?.sync_window_end) || buildSyncWindowRange().syncWindowEnd;
    let nextUrl = normalizeStringValue(syncRow?.delta_link) || getInitialDeltaUrl(syncWindowStart, syncWindowEnd);
    let latestDeltaLink = normalizeStringValue(syncRow?.delta_link) || null;
    const syncSummary = {
        processed: 0,
        matched: 0,
        updated: 0,
        cancelled: 0,
        pages: 0,
    };

    while (nextUrl) {
        const response = await fetch(nextUrl, {
            method: "GET",
            headers: buildGraphHeaders(accessToken),
        });
        const data = await parseGraphResponse(response);
        const deltaPageEvents = Array.isArray(data?.value) ? data.value : [];
        const pageSummary = await consumeDeltaPage(database, deltaPageEvents);

        syncSummary.processed += pageSummary.processed;
        syncSummary.matched += pageSummary.matched;
        syncSummary.updated += pageSummary.updated;
        syncSummary.cancelled += pageSummary.cancelled;
        syncSummary.pages += 1;
        nextUrl = data?.["@odata.nextLink"] || null;

        if (data?.["@odata.deltaLink"]) {
            latestDeltaLink = data["@odata.deltaLink"];
        }
    }

    return {
        ...syncSummary,
        latestDeltaLink,
        syncWindowStart,
        syncWindowEnd,
    };
};

/**
 * Registra o renueva la suscripción del usuario autenticado para cambios en Outlook.
 *
 * @param {Object} dataParams - Parámetros de la solicitud.
 * @returns {Promise<Object>} Estado final del registro de sincronización.
 */
outlookCalendarSync.registerOutlookCalendarSync = async (dataParams) => {
    const accessToken = normalizeStringValue(dataParams.accessToken);
    const idAdmin = normalizeIntegerValue(dataParams.idnetsuite_admin, 0);
    const outlookUserEmail = normalizeStringValue(dataParams.outlook_user_email);

    if (!accessToken || !idAdmin || !outlookUserEmail) {
        return {
            ok: false,
            statusCode: 400,
            message: "Faltan datos para registrar la sincronización de Outlook.",
        };
    }

    try {
        await createSyncTableIfNeeded(dataParams.database);

        const syncRow = await ensureGraphSubscription({
            accessToken,
            database: dataParams.database,
            idAdmin,
            outlookUserEmail,
        });

        return {
            ok: true,
            statusCode: 200,
            data: {
                subscription_id: syncRow?.subscription_id || null,
                subscription_expires_at: syncRow?.subscription_expires_at || null,
                delta_link_ready: Boolean(syncRow?.delta_link),
                sync_window_start: syncRow?.sync_window_start || null,
                sync_window_end: syncRow?.sync_window_end || null,
            },
        };
    } catch (error) {
        console.error("[outlook-sync] register failed", {
            idAdmin,
            outlookUserEmail,
            statusCode: error?.statusCode || 500,
            message: error?.message || "Error registrando sincronización Outlook.",
            response: error?.response || null,
        });

        return {
            ok: false,
            statusCode: error?.statusCode || 500,
            message: error?.message || "Error registrando sincronización Outlook.",
        };
    }
};

/**
 * Ejecuta delta query contra Outlook y actualiza eventos CRM vinculados.
 *
 * @param {Object} dataParams - Parámetros de la solicitud.
 * @returns {Promise<Object>} Resumen de sincronización.
 */
outlookCalendarSync.processOutlookCalendarSync = async (dataParams) => {
    const accessToken = normalizeStringValue(dataParams.accessToken);
    const idAdmin = normalizeIntegerValue(dataParams.idnetsuite_admin, 0);
    const outlookUserEmail = normalizeStringValue(dataParams.outlook_user_email);
    const forceSync = Boolean(dataParams.forceSync);

    if (!accessToken || !idAdmin || !outlookUserEmail) {
        return {
            ok: false,
            statusCode: 400,
            message: "Faltan datos para procesar la sincronización de Outlook.",
        };
    }

    await createSyncTableIfNeeded(dataParams.database);

    let syncRow = await ensureGraphSubscription({
        accessToken,
        database: dataParams.database,
        idAdmin,
        outlookUserEmail,
    });

    if (!syncRow) {
        return {
            ok: false,
            statusCode: 404,
            message: "No se encontró el registro de sincronización de Outlook.",
        };
    }

    if (!forceSync && !normalizeIntegerValue(syncRow.pending_sync, 0) && syncRow.delta_link) {
        return {
            ok: true,
            statusCode: 200,
            data: {
                skipped: true,
                reason: "NO_PENDING_CHANGES",
                processed: 0,
                matched: 0,
                updated: 0,
                cancelled: 0,
            },
        };
    }

    try {
        const deltaSummary = await executeDeltaSync({
            accessToken,
            database: dataParams.database,
            syncRow,
        });
        const lastSyncAt = formatDateTimeValue(new Date());

        await upsertSyncRow({
            database: dataParams.database,
            idAdmin,
            outlookUserEmail,
            subscriptionId: syncRow.subscription_id,
            subscriptionExpiresAt: syncRow.subscription_expires_at,
            deltaLink: deltaSummary.latestDeltaLink,
            syncWindowStart: deltaSummary.syncWindowStart,
            syncWindowEnd: deltaSummary.syncWindowEnd,
            clientState: syncRow.client_state,
            pendingSync: 0,
            reauthorizationRequired: 0,
            lastSyncAt,
            lastNotificationAt: syncRow.last_notification_at || null,
            lastError: null,
        });

        console.log("[outlook-sync] delta procesado", {
            idAdmin,
            outlookUserEmail,
            processed: deltaSummary.processed,
            matched: deltaSummary.matched,
            updated: deltaSummary.updated,
            cancelled: deltaSummary.cancelled,
            pages: deltaSummary.pages,
        });

        return {
            ok: true,
            statusCode: 200,
            data: {
                skipped: false,
                processed: deltaSummary.processed,
                matched: deltaSummary.matched,
                updated: deltaSummary.updated,
                cancelled: deltaSummary.cancelled,
                pages: deltaSummary.pages,
                changed: deltaSummary.updated + deltaSummary.cancelled,
            },
        };
    } catch (error) {
        console.error("[outlook-sync] process failed", {
            idAdmin,
            outlookUserEmail,
            statusCode: error?.statusCode || 500,
            message: error?.message || "Error procesando delta de Outlook.",
            response: error?.response || null,
        });

        await upsertSyncRow({
            database: dataParams.database,
            idAdmin,
            outlookUserEmail,
            subscriptionId: syncRow.subscription_id,
            subscriptionExpiresAt: syncRow.subscription_expires_at,
            deltaLink: syncRow.delta_link,
            syncWindowStart: syncRow.sync_window_start,
            syncWindowEnd: syncRow.sync_window_end,
            clientState: syncRow.client_state,
            pendingSync: 1,
            reauthorizationRequired: error.statusCode === 401 ? 1 : normalizeIntegerValue(syncRow.reauthorization_required, 0),
            lastSyncAt: syncRow.last_sync_at || null,
            lastNotificationAt: syncRow.last_notification_at || null,
            lastError: error.message,
        });

        return {
            ok: false,
            statusCode: error.statusCode || 500,
            message: error.message || "Error procesando delta de Outlook.",
        };
    }
};

/**
 * Atiende webhook de Microsoft Graph para notificaciones y lifecycle events.
 *
 * @param {Object} params - Parámetros normalizados del webhook.
 * @returns {Promise<Object>} Resultado para el controlador HTTP.
 */
outlookCalendarSync.handleMicrosoftCalendarWebhook = async (params) => {
    const validationToken = normalizeStringValue(params.validationToken);

    if (validationToken) {
        return {
            isValidation: true,
            validationToken,
        };
    }

    const notifications = Array.isArray(params.notifications) ? params.notifications : [];

    for (const notification of notifications) {
        const subscriptionId = normalizeStringValue(notification?.subscriptionId);

        if (!subscriptionId) {
            continue;
        }

        for (const databaseName of ["pruebas", "produccion"]) {
            await createSyncTableIfNeeded(databaseName);

            const syncRows = await getSyncRowsBySubscriptionId(databaseName, subscriptionId);

            if (!syncRows.length) {
                continue;
            }

            for (const syncRow of syncRows) {
                const isLifecycleNotification = Boolean(notification?.lifecycleEvent);
                const requiresReauthorization = notification?.lifecycleEvent === "reauthorizationRequired";

                if (
                    syncRow.client_state
                    && notification?.clientState
                    && syncRow.client_state !== notification.clientState
                ) {
                    continue;
                }

                await upsertSyncRow({
                    database: databaseName,
                    idAdmin: normalizeIntegerValue(syncRow.id_admin, 0),
                    outlookUserEmail: normalizeStringValue(syncRow.outlook_user_email),
                    subscriptionId: syncRow.subscription_id,
                    subscriptionExpiresAt: normalizeNullableStringValue(
                        notification?.subscriptionExpirationDateTime || syncRow.subscription_expires_at,
                    ),
                    deltaLink: syncRow.delta_link,
                    syncWindowStart: syncRow.sync_window_start,
                    syncWindowEnd: syncRow.sync_window_end,
                    clientState: syncRow.client_state,
                    pendingSync: 1,
                    reauthorizationRequired: requiresReauthorization ? 1 : normalizeIntegerValue(syncRow.reauthorization_required, 0),
                    lastSyncAt: syncRow.last_sync_at,
                    lastNotificationAt: formatDateTimeValue(new Date()),
                    lastError: isLifecycleNotification
                        ? `Lifecycle event: ${notification.lifecycleEvent}`
                        : null,
                });
            }
        }
    }

    return {
        isValidation: false,
        processed: notifications.length,
    };
};

outlookCalendarSync.__testables = {
    buildSyncWindowRange,
    buildClientState,
    normalizeOutlookEventPayload,
    normalizeGraphDateTimeValue,
    normalizeGraphTimeValue,
    isSubscriptionExpiringSoon,
};

module.exports = outlookCalendarSync;
