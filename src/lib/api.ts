import { z } from "zod";

export const API_URL = (import.meta.env["VITE_API_URL"] || "https://team-agenda-backend.onrender.com").replace(
  /\/$/,
  "",
);

export const appointmentFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(160, "Title is too long"),
    description: z.string().max(2000, "Description is too long"),
    date: z.string().min(1, "Date is required"),
    startTime: z.string().min(1, "Start time is required"),
    endTime: z.string().min(1, "End time is required"),
  })
  .superRefine((value, ctx) => {
    if (value.startTime && value.endTime && value.endTime <= value.startTime) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "End time must be after start time" });
    }
  });

export type AppointmentForm = z.infer<typeof appointmentFormSchema>;
export type AppointmentStatus = "scheduled" | "completed" | "cancelled";

export interface Appointment {
  id: number;
  title: string;
  description: string | null;
  date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  created_at: string;
  updated_at: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const detail =
        body && typeof body === "object" && "detail" in body && typeof body.detail === "string"
          ? body.detail
          : "The request could not be completed.";
      throw new ApiError(detail, response.status);
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Unable to reach the appointment service.", 0);
  }
}

export function fetchAppointments(filters: { date: string; status: string }) {
  const params = new URLSearchParams();
  if (filters.date) params.set("date", filters.date);
  if (filters.status !== "all") params.set("status", filters.status);
  const query = params.toString();
  return request<Appointment[]>(`/api/appointments${query ? `?${query}` : ""}`);
}

function toPayload(form: AppointmentForm) {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    date: form.date,
    start_time: form.startTime,
    end_time: form.endTime,
  };
}

export function createAppointment(form: AppointmentForm) {
  return request<Appointment>("/api/appointments", { method: "POST", body: JSON.stringify(toPayload(form)) });
}

export function editAppointment(id: number, form: AppointmentForm) {
  return request<Appointment>(`/api/appointments/${id}`, { method: "PUT", body: JSON.stringify(toPayload(form)) });
}

export function completeAppointment(id: number) {
  return request<Appointment>(`/api/appointments/${id}/complete`, { method: "PATCH", body: JSON.stringify({}) });
}

export function cancelAppointment(id: number) {
  return request<Appointment>(`/api/appointments/${id}/cancel`, { method: "PATCH", body: JSON.stringify({}) });
}