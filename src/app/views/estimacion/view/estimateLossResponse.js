export const getEstimateLossResponseStatus = (response) => (
  response?.data?.Detalle?.status ?? response?.data?.status
);

export const isEstimateLossConfirmedByNetSuite = (response) => (
  getEstimateLossResponseStatus(response) === 200
);
