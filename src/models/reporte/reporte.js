const config = require("../../config/config");
const nsrestlet = require("nsrestlet");

const reporte = {};
const DEFAULT_SAVED_SEARCH_ID = "3195";

var accountSettings = {
    accountId: config.oauthNetsuite.realm,
    tokenKey: config.oauthNetsuite.token.id,
    tokenSecret: config.oauthNetsuite.token.secret,
    consumerKey: config.oauthNetsuite.consumer.key,
    consumerSecret: config.oauthNetsuite.consumer.secret,
};

reporte.obtenerBusquedaGuardada = async (dataParams) => {
    try {
        const urlSettings = {
            url: "https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=1764&deploy=1",
        };
        const rest = nsrestlet.createLink(accountSettings, urlSettings);
        const searchId = dataParams.searchId || DEFAULT_SAVED_SEARCH_ID;

        const response = await rest.get({
            rType: "savedSearch",
            searchId,
            dateFrom: dataParams.dateFrom || "",
            dateTo: dataParams.dateTo || "",
        });

        if (response?.status !== 200) {
            console.error(
                "[reporte.obtenerBusquedaGuardada] netsuite error:",
                JSON.stringify(response?.Error || response, null, 2)
            );
        }

        return {
            status: response?.status || 200,
            msg: "Busqueda guardada consultada correctamente.",
            Detalle: response,
        };
    } catch (error) {
        console.error("[reporte.obtenerBusquedaGuardada] error:", error);
        throw error;
    }
};

module.exports = reporte;
