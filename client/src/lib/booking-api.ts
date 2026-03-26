export interface Staff {
  id: string;
  name: string;
  role: string;
  avatar: string;
  courseIds: string[];
}

export interface Course {
  id: string;
  name: string;
  category: string;
  duration: number;
  price: number;
  description: string;
  prepaymentOnly: boolean;
  imageUrl: string | null;
  staffIds: string[];
}

export interface TimeSlot {
  time: string;
  available: boolean;
}

export interface Reservation {
  id: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  date: string;
  time: string;
  staffId: string;
  courseId: string;
  status: "confirmed" | "pending" | "cancelled";
  paid: boolean;
  partySize?: number;
}

export interface CancelInfo {
  id: string;
  customerName: string;
  date: string;
  time: string;
  courseId: string;
  courseName: string;
  courseDuration: number;
  coursePrice: number;
  status: string;
}

export const fetchCancelInfo = (shopId: number, token: string) =>
  api<CancelInfo>(`/api/shops/${shopId}/cancel/${token}`);

export const executeCancelByToken = (shopId: number, token: string) =>
  api<{ ok: boolean; already?: boolean }>(`/api/shops/${shopId}/cancel/${token}`, { method: "POST" });

export interface StoreSettings {
  store_name: string;
  store_description: string;
  store_address: string;
  store_phone: string;
  store_email: string;
  store_hours: string;
  store_closed_days: string;
  banner_url: string;
  staff_selection_enabled: string;
  table_count?: string;
  max_party_size?: string;
}

export const SHOP_STAFF_ID = "__shop__";

export function formatPrice(price: number): string {
  return `¥${price.toLocaleString()}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const fetchStaff = (shopId: number) => api<Staff[]>(`/api/shops/${shopId}/staff`);
export const fetchCourses = (shopId: number) => api<Course[]>(`/api/shops/${shopId}/courses`);
export const fetchReservations = (shopId: number) => api<Reservation[]>(`/api/shops/${shopId}/reservations`);
export const fetchSettings = (shopId: number) => api<StoreSettings>(`/api/shops/${shopId}/settings`);
export const updateSettings = (shopId: number, data: Partial<StoreSettings>) =>
  api(`/api/shops/${shopId}/settings`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

export const createStaff = (shopId: number, data: Partial<Staff> & { courseIds?: string[] }) =>
  api(`/api/shops/${shopId}/staff`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

export const updateStaff = (shopId: number, data: Partial<Staff> & { courseIds?: string[] }) =>
  api(`/api/shops/${shopId}/staff`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

export const deleteStaff = (shopId: number, id: string) =>
  api(`/api/shops/${shopId}/staff?id=${id}`, { method: "DELETE" });

export const createCourse = (shopId: number, data: Partial<Course> & { staffIds?: string[] }) =>
  api(`/api/shops/${shopId}/courses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

export const updateCourse = (shopId: number, data: Partial<Course> & { staffIds?: string[] }) =>
  api(`/api/shops/${shopId}/courses`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

export const deleteCourse = (shopId: number, id: string) =>
  api(`/api/shops/${shopId}/courses?id=${id}`, { method: "DELETE" });

export const createReservation = (shopId: number, data: Partial<Reservation>) =>
  api(`/api/shops/${shopId}/reservations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

export const updateReservation = (shopId: number, data: { id: string; status?: string; paid?: boolean; customerName?: string; customerPhone?: string; customerEmail?: string; date?: string; time?: string; staffId?: string; courseId?: string }) =>
  api(`/api/shops/${shopId}/reservations`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

export const deleteReservation = (shopId: number, id: string) =>
  api(`/api/shops/${shopId}/reservations?id=${id}`, { method: "DELETE" });

export const fetchSlots = (shopId: number, staffId: string, date?: string, courseId?: string) => {
  const params = new URLSearchParams({ staffId });
  if (date) params.set("date", date);
  if (courseId) params.set("courseId", courseId);
  return api<Array<{ time: string; available: boolean }>>(`/api/shops/${shopId}/slots?${params}`);
};

export const updateSlot = (shopId: number, staffId: string, dayOfWeek: number, time: string, available: boolean) =>
  api(`/api/shops/${shopId}/slots`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffId, dayOfWeek, time, available }) });

export const bulkUpdateSlots = (shopId: number, staffId: string, dayOfWeek: number, times: string[], available: boolean) =>
  api(`/api/shops/${shopId}/slots`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffId, dayOfWeek, times, available }) });

export const createInquiry = (shopId: number, data: { name: string; email?: string; phone?: string; message: string }) =>
  api(`/api/shops/${shopId}/inquiries`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
