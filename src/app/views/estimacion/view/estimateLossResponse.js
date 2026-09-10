export const getEstimateLossResponseStatus = (response) => (
  response?.data?.Detalle?.status ?? response?.data?.status
);
