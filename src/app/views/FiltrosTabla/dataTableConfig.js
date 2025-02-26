/**
 * Helper function to get date range for the last 3 months.
 * @returns {Object} An object containing firstDay and lastDay in YYYY-MM-DD format.
 */
export const getDefaultDatesMeses   = () => {
   const now = new Date();
   const firstDay = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split("T")[0];
   const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
   return { firstDay, lastDay };
};

export const getDefaultDates = () => {
   const now = new Date();
   const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
   const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
   return { firstDay, lastDay };
};