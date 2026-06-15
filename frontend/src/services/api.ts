import axios from "axios";

const BASE = "/e-dokter";

const api = axios.create({
  baseURL: `${BASE}/api`,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${BASE}/api/auth/refresh`, { refreshToken });
          localStorage.setItem("accessToken", data.accessToken);
          localStorage.setItem("refreshToken", data.refreshToken);
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = `${BASE}/login`;
        }
      } else {
        window.location.href = `${BASE}/login`;
      }
    }
    return Promise.reject(error);
  }
);

export default api;

export type User = {
  id: number;
  email: string;
  name: string;
  role: "doctor" | "assistant" | "admin";
  spesialisasi?: string;
  doctor_code?: string;
};

export type Patient = {
  id: string;
  medicalRecordNumber: string;
  nik: string | null;
  name: string;
  birthDate: string | null;
  gender: string | null;
  address: string | null;
  phone: string | null;
  bloodType: string | null;
  allergies: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
};

export type MedicalRecord = {
  id: string;
  patientId: string;
  doctorId: string;
  visitDate: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  diagnosisCode: string | null;
  diagnosisDescription: string | null;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  doctorName?: string;
  addendums?: Addendum[];
  attachments?: Attachment[];
};

export type Addendum = {
  id: string;
  medicalRecordId: string;
  doctorId: string;
  content: string;
  createdAt: string;
};

export type Attachment = {
  id: string;
  medicalRecordId: string | null;
  patientId: string;
  fileName: string;
  filePath: string;
  fileSize: number | null;
  mimeType: string | null;
  category: string | null;
  uploadedBy: number | null;
  createdAt: string;
};

export type ICD10Code = {
  code: string;
  description: string;
};

export async function login(username: string, password: string) {
  const { data } = await api.post("/auth/login", { username, password });
  localStorage.setItem("accessToken", data.accessToken);
  localStorage.setItem("refreshToken", data.refreshToken);
  localStorage.setItem("user", JSON.stringify(data.user));
  return data.user as User;
}

export type HospitalSetting = {
  nama_instansi: string;
  alamat_instansi: string;
  logo: string | null;
};

export async function getSetting() {
  const { data } = await api.get("/auth/setting");
  return data as HospitalSetting;
}

export function logout() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (refreshToken) {
    api.post("/auth/logout", { refreshToken }).catch(() => {});
  }
  localStorage.clear();
}

export function getCurrentUser(): User | null {
  const u = localStorage.getItem("user");
  return u ? JSON.parse(u) : null;
}

export async function getPatients(search?: string, page = 1) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  params.set("page", String(page));
  const { data } = await api.get(`/patients?${params}`);
  return data;
}

export async function getPatient(id: string) {
  const { data } = await api.get(`/patients/${id}`);
  return data;
}

export async function createPatient(data_: Partial<Patient>) {
  const { data } = await api.post("/patients", data_);
  return data;
}

export async function updatePatient(id: string, data_: Partial<Patient>) {
  const { data } = await api.put(`/patients/${id}`, data_);
  return data;
}

export async function getRecords(patientId: string) {
  const { data } = await api.get(`/records/patient/${patientId}`);
  return data as MedicalRecord[];
}

export async function createRecord(data_: any) {
  const { data } = await api.post("/records", data_);
  return data as MedicalRecord;
}

export async function lockRecord(id: string) {
  const { data } = await api.post(`/records/${id}/lock`);
  return data;
}

export async function addAddendum(recordId: string, content: string) {
  const { data } = await api.post(`/records/${recordId}/addendum`, { content });
  return data;
}

export async function uploadAttachment(file: File, patientId: string, medicalRecordId?: string, category?: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("patientId", patientId);
  if (medicalRecordId) form.append("medicalRecordId", medicalRecordId);
  if (category) form.append("category", category);
  const { data } = await api.post("/attachments/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getUsers() {
  const { data } = await api.get("/users");
  return data;
}

export async function createUser(data_: { email: string; password: string; name: string; role: string }) {
  const { data } = await api.post("/users", data_);
  return data;
}

export async function updateUser(id: number, data_: any) {
  const { data } = await api.put(`/users/${id}`, data_);
  return data;
}

export async function getAuditLogs(page = 1) {
  const { data } = await api.get(`/audit-logs?page=${page}`);
  return data;
}

export async function searchICD10(q: string) {
  const { data } = await api.get(`/icd10/search?q=${encodeURIComponent(q)}`);
  return data as ICD10Code[];
}

export async function searchICD9(q: string) {
  const { data } = await api.get(`/icd9/search?q=${encodeURIComponent(q)}`);
  return data as ICD10Code[];
}

export async function searchRalanVisit(params_: {
  q?: string; page?: number; limit?: number;
  tgl_from?: string; tgl_to?: string; kd_pj?: string; poli?: string;
} = {}) {
  const sp = new URLSearchParams();
  if (params_.q) sp.set("q", params_.q);
  if (params_.page) sp.set("page", String(params_.page));
  if (params_.limit) sp.set("limit", String(params_.limit));
  if (params_.tgl_from) sp.set("tgl_from", params_.tgl_from);
  if (params_.tgl_to) sp.set("tgl_to", params_.tgl_to);
  if (params_.kd_pj) sp.set("kd_pj", params_.kd_pj);
  if (params_.poli) sp.set("poli", params_.poli);
  const { data } = await api.get(`/resume-ralan/search-visit?${sp}`);
  return data;
}

export async function getPoliklinik() {
  const { data } = await api.get("/resume-ralan/poliklinik");
  return data;
}

export async function getCurrentJadwal() {
  const { data } = await api.get("/resume-ralan/current-jadwal");
  return data;
}

export async function getPenjab() {
  const { data } = await api.get("/resume-ralan/penjab");
  return data;
}

export async function getResumeRalan(no_rawat: string) {
  const { data } = await api.get(`/resume-ralan/by-visit/${encodeURIComponent(no_rawat)}`);
  return data;
}

export async function createResumeRalan(data_: any) {
  const { data } = await api.post("/resume-ralan", data_);
  return data;
}

export async function updateResumeRalan(no_rawat: string, data_: any) {
  const { data } = await api.put(`/resume-ralan/${encodeURIComponent(no_rawat)}`, data_);
  return data;
}

export async function getResumeRalanAutoFill(no_rawat: string) {
  const { data } = await api.get(`/resume-ralan/auto-fill/${encodeURIComponent(no_rawat)}`);
  return data;
}

export async function getResumeRalanStats() {
  const { data } = await api.get("/resume-ralan/stats");
  return data;
}

export async function searchRanapVisit(params_: {
  q?: string; page?: number; limit?: number;
  tgl_from?: string; tgl_to?: string; kd_pj?: string; ruangan?: string;
} = {}) {
  const sp = new URLSearchParams();
  if (params_.q) sp.set("q", params_.q);
  if (params_.page) sp.set("page", String(params_.page));
  if (params_.limit) sp.set("limit", String(params_.limit));
  if (params_.tgl_from) sp.set("tgl_from", params_.tgl_from);
  if (params_.tgl_to) sp.set("tgl_to", params_.tgl_to);
  if (params_.kd_pj) sp.set("kd_pj", params_.kd_pj);
  if (params_.ruangan) sp.set("ruangan", params_.ruangan);
  const { data } = await api.get(`/resume-ranap/search-visit?${sp}`);
  return data;
}

export async function getBangsal() {
  const { data } = await api.get("/resume-ranap/bangsal");
  return data;
}

export async function getRanapPenjab() {
  const { data } = await api.get("/resume-ranap/penjab");
  return data;
}

export async function getResumeRanap(no_rawat: string) {
  const { data } = await api.get(`/resume-ranap/by-visit/${encodeURIComponent(no_rawat)}`);
  return data;
}

export async function createResumeRanap(data_: any) {
  const { data } = await api.post("/resume-ranap", data_);
  return data;
}

export async function updateResumeRanap(no_rawat: string, data_: any) {
  const { data } = await api.put(`/resume-ranap/${encodeURIComponent(no_rawat)}`, data_);
  return data;
}

export async function getResumeRanapAutoFill(no_rawat: string) {
  const { data } = await api.get(`/resume-ranap/auto-fill/${encodeURIComponent(no_rawat)}`);
  return data;
}

export async function getResumeRanapStats() {
  const { data } = await api.get("/resume-ranap/stats");
  return data;
}

export async function getOperasiList(params?: { search?: string; page?: number; limit?: number; ruangan?: string; jenis?: string; pj?: string; tgl_from?: string; tgl_to?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.ruangan) searchParams.set("ruangan", params.ruangan);
  if (params?.jenis) searchParams.set("jenis", params.jenis);
  if (params?.pj) searchParams.set("pj", params.pj);
  if (params?.tgl_from) searchParams.set("tgl_from", params.tgl_from);
  if (params?.tgl_to) searchParams.set("tgl_to", params.tgl_to);
  const { data } = await api.get(`/operasi?${searchParams}`);
  return data;
}

export async function getOperasiBangsal() {
  const { data } = await api.get("/operasi/bangsal");
  return data;
}

export async function getOperasiPenjab() {
  const { data } = await api.get("/operasi/penjab");
  return data;
}

export async function getOperasiStats(params?: { tgl_from?: string; tgl_to?: string; pj?: string }) {
  const sp = new URLSearchParams();
  if (params?.tgl_from) sp.set("tgl_from", params.tgl_from);
  if (params?.tgl_to) sp.set("tgl_to", params.tgl_to);
  if (params?.pj) sp.set("pj", params.pj);
  const qs = sp.toString();
  const { data } = await api.get(`/operasi/stats${qs ? `?${qs}` : ""}`);
  return data;
}

export async function getOperasiDetail(no_rawat: string) {
  const { data } = await api.get(`/operasi/detail?no_rawat=${encodeURIComponent(no_rawat)}`);
  return data;
}

export async function createOperasi(data_: any) {
  const { data } = await api.post("/operasi", data_);
  return data;
}

export async function updateOperasi(no_rawat: string, data_: any) {
  const { data } = await api.put(`/operasi/update?no_rawat=${encodeURIComponent(no_rawat)}`, data_);
  return data;
}

export async function signOperasi(no_rawat: string, tanggal: string) {
  const { data } = await api.post(`/operasi/lock?no_rawat=${encodeURIComponent(no_rawat)}`, { tanggal });
  return data;
}

export async function getOperasiAutoFill(no_rawat: string) {
  const { data } = await api.get(`/operasi/auto-fill/${encodeURIComponent(no_rawat)}`);
  return data;
}

export async function changePassword(old_password: string, new_password: string) {
  const { data } = await api.put("/auth/change-password", { old_password, new_password });
  return data;
}

export async function getDoctorStats() {
  const { data } = await api.get("/dashboard/doctor-stats");
  return data;
}

export async function getDoctorRecent() {
  const { data } = await api.get("/dashboard/doctor-recent");
  return data;
}

export async function getDoctorMonthly() {
  const { data } = await api.get("/dashboard/doctor-monthly");
  return data;
}

export async function getDoctorPolyDistribution() {
  const { data } = await api.get("/dashboard/doctor-poly-distribution");
  return data;
}

export async function getDoctorOperasiStats() {
  const { data } = await api.get("/dashboard/doctor-operasi-stats");
  return data;
}

export async function getDoctorTopObat() {
  const { data } = await api.get("/dashboard/doctor-top-obat");
  return data;
}

export async function getResumePenjab() {
  const { data } = await api.get("/resume/penjab");
  return data;
}

export async function getResumeStats(params?: { tgl_from?: string; tgl_to?: string; pj?: string }) {
  const sp = new URLSearchParams();
  if (params?.tgl_from) sp.set("tgl_from", params.tgl_from);
  if (params?.tgl_to) sp.set("tgl_to", params.tgl_to);
  if (params?.pj) sp.set("pj", params.pj);
  const qs = sp.toString();
  const { data } = await api.get(`/resume/stats${qs ? `?${qs}` : ""}`);
  return data;
}

export async function getResumeList(params?: { q?: string; page?: number; limit?: number; jenis?: string; tgl_from?: string; tgl_to?: string; pj?: string }) {
  const sp = new URLSearchParams();
  if (params?.q) sp.set("q", params.q);
  if (params?.page) sp.set("page", String(params.page));
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.jenis) sp.set("jenis", params.jenis);
  if (params?.tgl_from) sp.set("tgl_from", params.tgl_from);
  if (params?.tgl_to) sp.set("tgl_to", params.tgl_to);
  if (params?.pj) sp.set("pj", params.pj);
  const { data } = await api.get(`/resume?${sp}`);
  return data;
}

export async function getResumeDetail(no_rawat: string) {
  const { data } = await api.get(`/resume/detail?no_rawat=${encodeURIComponent(no_rawat)}`);
  return data;
}

export async function deleteResume(no_rawat: string) {
  const { data } = await api.delete(`/resume/by-no-rawat?no_rawat=${encodeURIComponent(no_rawat)}`);
  return data;
}

export async function getNotifications() {
  const { data } = await api.get("/notifications");
  return data;
}

export async function searchDokter(q: string) {
  const { data } = await api.get(`/auth/dokter/search?q=${encodeURIComponent(q)}`);
  return data as { kd_dokter: string; nm_dokter: string }[];
}

export async function searchPegawai(q: string) {
  const { data } = await api.get(`/auth/pegawai/search?q=${encodeURIComponent(q)}`);
  return data as any[];
}

export async function searchPaketOperasi(q: string) {
  const { data } = await api.get(`/operasi/data/paket?q=${encodeURIComponent(q)}`);
  return data;
}

export async function searchObatOperasi(q: string) {
  const { data } = await api.get(`/operasi/data/obat?q=${encodeURIComponent(q)}`);
  return data;
}

export async function getBookingOperasi(no_rawat: string) {
  const { data } = await api.get(`/operasi/booking-data?no_rawat=${encodeURIComponent(no_rawat)}`);
  return data;
}

export async function deleteOperasi(no_rawat: string) {
  const { data } = await api.delete(`/operasi/remove?no_rawat=${encodeURIComponent(no_rawat)}`);
  return data;
}
