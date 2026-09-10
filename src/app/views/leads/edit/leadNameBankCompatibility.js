export const getBankCompatibleLeadName = (value) => (
   String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
);

export const isBankCompatibleLeadName = (value) => {
   const leadName = String(value ?? "");

   if (!leadName.trim()) {
      return true;
   }

   return leadName === getBankCompatibleLeadName(leadName);
};
