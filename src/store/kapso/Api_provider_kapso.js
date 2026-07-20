import { fetchKapsoData, kapsoApiUrl, sendKapsoData, sendKapsoFormData } from "../../api";

const resolveKapsoPublicUrl = (publicUrl) => {
   if (!publicUrl) {
      return publicUrl;
   }

   const normalizedBaseUrl = kapsoApiUrl.replace(/\/$/, "");
   const absoluteApiPrefix = "/api/v1/";

   if (/^https?:\/\//i.test(publicUrl)) {
      const parsedUrl = new URL(publicUrl);

      return parsedUrl.pathname.startsWith(absoluteApiPrefix)
         ? `${normalizedBaseUrl}/${parsedUrl.pathname.slice(absoluteApiPrefix.length)}${parsedUrl.search}`
         : publicUrl;
   }

   const normalizedPublicUrl = publicUrl.replace(/^\//, "");
   const relativeApiPrefix = "api/v1/";

   return normalizedPublicUrl.startsWith(relativeApiPrefix)
      ? `${normalizedBaseUrl}/${normalizedPublicUrl.slice(relativeApiPrefix.length)}`
      : `${normalizedBaseUrl}/${normalizedPublicUrl}`;
};

const normalizeKapsoMediaItems = (items = []) => {
   return items.map((item) => ({
      ...item,
      publicUrl: resolveKapsoPublicUrl(item.publicUrl),
   }));
};

export const getKapsoIntegrations = async () => {
   return await fetchKapsoData("kapso/integrations");
};

export const getKapsoTemplatesByIntegration = async (integrationCode) => {
   return await fetchKapsoData(`kapso/integrations/${encodeURIComponent(integrationCode)}/templates`);
};

export const getKapsoAdministratorOptions = async (search = "", includeInactive = 0) => {
   const query = new URLSearchParams();

   if (search) {
      query.set("search", search);
   }

   query.set("includeInactive", String(includeInactive));

   return await fetchKapsoData(`kapso/admins/options?${query.toString()}`);
};

export const getKapsoPhoneNumberOptions = async (search = "", includeInactive = 0) => {
   const query = new URLSearchParams();

   if (search) {
      query.set("search", search);
   }

   query.set("includeInactive", String(includeInactive));

   return await fetchKapsoData(`kapso/phone-numbers/options?${query.toString()}`);
};

export const getAdminKapsoIntegrations = async (params = {}) => {
   const query = new URLSearchParams();

   Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
         query.set(key, String(value));
      }
   });

   return await fetchKapsoData(`kapso/admin-integrations?${query.toString()}`);
};

export const getAdminKapsoIntegrationById = async (id) => {
   return await fetchKapsoData(`kapso/admin-integrations/${id}`);
};

export const createAdminKapsoIntegration = async (payload) => {
   return await sendKapsoData("post", "kapso/admin-integrations", payload);
};

export const updateAdminKapsoIntegration = async (id, payload) => {
   return await sendKapsoData("patch", `kapso/admin-integrations/${id}`, payload);
};

export const updateAdminKapsoIntegrationStatus = async (id, status) => {
   return await sendKapsoData("patch", `kapso/admin-integrations/${id}/status`, {
      status,
   });
};

export const deleteAdminKapsoIntegration = async (id) => {
   return await sendKapsoData("delete", `kapso/admin-integrations/${id}`);
};

export const getKapsoBusinessFlows = async () => {
   return await fetchKapsoData("kapso/business-flows");
};

export const getKapsoProjectOptions = async () => {
   return await fetchKapsoData("kapso/projects/options");
};

export const enableKapsoBusinessFlowProject = async (flowUuid, idProyecto) => {
   return await sendKapsoData("post", `kapso/business-flows/${encodeURIComponent(flowUuid)}/projects`, {
      idProyecto,
   });
};

export const disableKapsoBusinessFlowProject = async (flowUuid, idProyecto) => {
   return await sendKapsoData("delete", `kapso/business-flows/${encodeURIComponent(flowUuid)}/projects/${encodeURIComponent(idProyecto)}`);
};

export const getKapsoFlowProjectMedia = async (flowUuid, idProyectoNetsuite, stepCode = "intro") => {
   const query = new URLSearchParams({
      stepCode,
   });

   const response = await fetchKapsoData(
      `kapso/flows/${encodeURIComponent(flowUuid)}/projects/${encodeURIComponent(idProyectoNetsuite)}/media?${query.toString()}`,
   );

   return response.ok
      ? {
           ...response,
           data: normalizeKapsoMediaItems(response.data),
        }
      : response;
};

export const uploadKapsoFlowProjectMedia = async (flowUuid, idProyectoNetsuite, file, stepCode = "intro") => {
   const formData = new FormData();

   formData.append("stepCode", stepCode);
   formData.append("file", file);

   return await sendKapsoFormData(
      "post",
      `kapso/flows/${encodeURIComponent(flowUuid)}/projects/${encodeURIComponent(idProyectoNetsuite)}/media`,
      formData,
   );
};

export const deleteKapsoFlowProjectMedia = async (id) => {
   return await sendKapsoData("delete", `kapso/flow-project-media/${encodeURIComponent(id)}`);
};
