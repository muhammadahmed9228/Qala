import apiClient from "../../../services/apiClient";

export const getMyOrdersApi = (params) => {
  return apiClient.get("/orders/my-orders", { params });
};
