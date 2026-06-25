import { fetchKapsoData } from "../../api";

export const getKapsoIntegrations = async () => {
   return await fetchKapsoData("kapso/integrations");
};

export const getKapsoTemplatesByIntegration = async (integrationCode) => {
   return await fetchKapsoData(
      `kapso/integrations/${encodeURIComponent(integrationCode)}/templates`,
   );
};
