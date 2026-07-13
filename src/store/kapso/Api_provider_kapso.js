import { fetchKapsoData, sendKapsoData } from "../../api";

export const getKapsoIntegrations = async () => {
   return await fetchKapsoData("kapso/integrations");
};

export const getKapsoTemplatesByIntegration = async (integrationCode) => {
   return await fetchKapsoData(
      `kapso/integrations/${encodeURIComponent(integrationCode)}/templates`,
   );
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
