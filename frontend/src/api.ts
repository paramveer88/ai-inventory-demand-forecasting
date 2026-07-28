import axios from "axios";

const API_URL =
  (import.meta as any).env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_URL,
});

export interface Vendor {
  id: string;
  name: string;
  contactEmail?: string;
  createdAt: string;
  _count?: {
    products: number;
  };
}

export interface ProductVendor {
  id: string;
  productId: string;
  vendorId: string;
  price: number;
  vendor: Vendor;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  inventory?: Inventory;
  vendors?: ProductVendor[];
}

export interface Inventory {
  productId: string;
  currentStock: number;
  reorderLevel?: number;
  safetyStock?: number;
  leadTime?: number;
  product?: Product;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  product: Product;
}

export interface Order {
  id: string;
  date: string;
  totalAmount: number;
  items: OrderItem[];
}

export interface DailyPrediction {
  date: string;
  value: number;
}

export interface HistoricalSale {
  date: string;
  quantity: number;
}

export interface Forecast {
  productId: string;
  next_30_days: number;
  daily_predictions: DailyPrediction[];
  historical_sales?: HistoricalSale[];
  trend: string;
}

export interface Recommendation {
  productId: string;
  currentStock: number;
  reorderLevel: number;
  recommendedStock: number;
  daysUntilStockout: number;
  leadTime?: number;
  avgDailyDemand?: number;
}

export interface PaginatedResult<T> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  [key: string]: any; // To support 'products' or 'orders' keys
}
export interface VendorInput {
  vendorId: string;
  price: number;
}

export const createProduct = (
  data: { name: string; category: string; initialStock?: number; vendors?: VendorInput[] },
) => api.post<Product>("/products", data);

export const updateProduct = (
  id: string,
  data: { name?: string; category?: string; vendors?: VendorInput[] },
) => api.put<Product>(`/products/${id}`, data);

export const deleteProduct = (id: string) => api.delete(`/products/${id}`);

export const createOrder = (data: {
  items: { productId: string; quantity: number }[];
}) => api.post("/orders", data);

export const getInventory = () => api.get<Inventory[]>("/inventory");
export const getForecast = (productId: string) =>
  api.get<Forecast>(`/forecast?productId=${productId}`);
export const getForecastHistory = (productId: string) =>
  api.get<{ data: any[] }>(`/forecast/history?productId=${productId}`);
export const seedForecastHistory = (days: number = 14) =>
  api.get(`/forecast/seed-history?days=${days}`);
export const getRecommendations = (productId: string) =>
  api.get<Recommendation>(`/recommendations?productId=${productId}`);

export const getProducts = (
  params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  } = {},
) => api.get<PaginatedResult<Product>>("/products", { params });

export const getOrders = (page: number = 1, limit: number = 10) =>
  api.get<PaginatedResult<Order>>("/orders", { params: { page, limit } });

export const getVendors = () => api.get<Vendor[]>("/vendors");
export const createVendor = (data: Partial<Vendor>) =>
  api.post<Vendor>("/vendors", data);
export const updateVendor = (id: string, data: Partial<Vendor>) =>
  api.put<Vendor>(`/vendors/${id}`, data);
export const deleteVendor = (id: string) => api.delete(`/vendors/${id}`);

export const importProducts = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post<{ success: number; errors: any[] }>(
    "/products/import",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
};

export const exportProducts = () =>
  api.get("/products/export", { responseType: "blob" });

export const getSampleFile = () =>
  api.get("/products/sample-file", { responseType: "blob" });

// Vendor import / export / sample
export const importVendors = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post<{ success: number; errors: any[] }>(
    "/vendors/import",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
};

export const exportVendors = () =>
  api.get("/vendors/export", { responseType: "blob" });

export const getVendorSampleFile = () =>
  api.get("/vendors/sample-file", { responseType: "blob" });

// Order import / export / sample
export const importOrders = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post<{ success: number; errors: any[] }>(
    "/orders/import",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
};

export const exportOrders = () =>
  api.get("/orders/export", { responseType: "blob" });

export const getOrderSampleFile = () =>
  api.get("/orders/sample-file", { responseType: "blob" });

// Inventory import / export / sample
export const importInventory = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post<{ success: number; errors: any[] }>(
    "/inventory/import",
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
    },
  );
};

export const exportInventory = () =>
  api.get("/inventory/export", { responseType: "blob" });

export const getInventorySampleFile = () =>
  api.get("/inventory/sample-file", { responseType: "blob" });

export const simulateData = () => api.post("/simulate-data");

export default api;
