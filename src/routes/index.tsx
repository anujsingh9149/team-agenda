import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ApiError,
  appointmentFormSchema,
  cancelAppointment,
  completeAppointment,
  createAppointment,
  editAppointment,
  fetchAppointments,
  type Appointment,
  type AppointmentForm,
  type AppointmentStatus,
} from "@/lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Appointment Board | Team scheduling" },
      {
        name: "description",
        content: "Manage, schedule, and track your team's appointments in one focused workspace.",
      },
      { property: "og:title", content: "Appointment Board | Team scheduling" },
      {
        property: "og:description",
        content: "Manage, schedule, and track your team's appointments in one focused workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AppointmentBoard,
});

const EMPTY_FORM: AppointmentForm = {
  title: "",
  description: "",
  date: "",
  startTime: "",
  endTime: "",
};

const statusCopy: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function toForm(appointment: Appointment): AppointmentForm {
  return {
    title: appointment.title,
    description: appointment.description || "",
    date: appointment.date,
    startTime: appointment.start_time.slice(0, 5),
    endTime: appointment.end_time.slice(0, 5),
  };
}

function friendlyError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409) return "This time slot is already booked.";
    if (error.status === 422) return "Please check the appointment details and try again.";
    if (error.status === 404) return "That appointment is no longer available.";
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  const Icon = status === "scheduled" ? Clock3 : status === "completed" ? CheckCircle2 : XCircle;
  return (
    <span className={`status-badge status-${status}`}>
      <Icon className="size-3.5" />
      {statusCopy[status]}
    </span>
  );
}

function AppointmentCard({
  appointment,
  onEdit,
  onComplete,
  onCancel,
}: {
  appointment: Appointment;
  onEdit: (appointment: Appointment) => void;
  onComplete: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
}) {
  const isCancelled = appointment.status === "cancelled";
  const isCompleted = appointment.status === "completed";
  return (
    <article className={`appointment-card appointment-${appointment.status}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2">
            <StatusBadge status={appointment.status} />
            {isCancelled && <span className="text-xs text-muted-foreground">No longer active</span>}
          </div>
          <h3 className={`truncate text-lg font-bold tracking-tight ${isCancelled ? "text-muted-foreground line-through" : "text-foreground"}`}>
            {appointment.title}
          </h3>
          {appointment.description && (
            <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground">
              {appointment.description}
            </p>
          )}
        </div>
        <div className="appointment-time shrink-0 text-right">
          <span className="block text-sm font-bold text-foreground">{formatTime(appointment.start_time)}</span>
          <span className="text-xs text-muted-foreground">to {formatTime(appointment.end_time)}</span>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <CalendarDays className="size-4 text-primary" />
          {formatDate(appointment.date)}
        </div>
        <div className="flex items-center gap-1">
          {!isCancelled && !isCompleted && (
            <Button variant="ghost" size="sm" onClick={() => onComplete(appointment)}>
              <Check className="size-3.5" /> Complete
            </Button>
          )}
          {!isCancelled && (
            <Button variant="ghost" size="sm" onClick={() => onEdit(appointment)}>
              <Edit3 className="size-3.5" /> Edit
            </Button>
          )}
          {!isCancelled && !isCompleted && (
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onCancel(appointment)}>
              <X className="size-3.5" /> Cancel
            </Button>
          )}
          {isCancelled && <span className="inline-flex items-center gap-1 px-3 text-xs font-semibold text-muted-foreground"><Trash2 className="size-3.5" /> Kept for history</span>}
        </div>
      </div>
    </article>
  );
}

function AppointmentFormDialog({
  open,
  onOpenChange,
  initialValues,
  appointment,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues: AppointmentForm;
  appointment: Appointment | null;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<AppointmentForm>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initialValues);
      setErrors({});
    }
  }, [initialValues, open]);

  const setField = (field: keyof AppointmentForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "", form: "" }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = appointmentFormSchema.safeParse(form);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] || "form");
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }
    setSaving(true);
    try {
      if (appointment) {
        await editAppointment(appointment.id, parsed.data);
        toast.success("Appointment updated successfully.");
      } else {
        await createAppointment(parsed.data);
        toast.success("Appointment created successfully.");
      }
      onOpenChange(false);
      await onSaved();
    } catch (error) {
      setErrors({ form: friendlyError(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{appointment ? "Edit appointment" : "Add appointment"}</DialogTitle>
          <DialogDescription>
            {appointment ? "Update the details below. Time changes are checked for conflicts." : "Add a focused time block to your team's schedule."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {errors.form && <div className="form-error" role="alert">{errors.form}</div>}
          <div>
            <label className="form-label" htmlFor="title">Title <span>*</span></label>
            <Input id="title" maxLength={160} value={form.title} onChange={(event) => setField("title", event.target.value)} placeholder="e.g. Product sync" aria-invalid={Boolean(errors.title)} />
            {errors.title && <p className="field-error">{errors.title}</p>}
          </div>
          <div>
            <label className="form-label" htmlFor="description">Description <span className="optional">Optional</span></label>
            <Textarea id="description" maxLength={2000} value={form.description} onChange={(event) => setField("description", event.target.value)} placeholder="Add context for the team" rows={3} aria-invalid={Boolean(errors.description)} />
            {errors.description && <p className="field-error">{errors.description}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className="form-label" htmlFor="date">Date <span>*</span></label>
              <Input id="date" type="date" value={form.date} onChange={(event) => setField("date", event.target.value)} aria-invalid={Boolean(errors.date)} />
              {errors.date && <p className="field-error">{errors.date}</p>}
            </div>
            <div>
              <label className="form-label" htmlFor="startTime">Starts <span>*</span></label>
              <Input id="startTime" type="time" value={form.startTime} onChange={(event) => setField("startTime", event.target.value)} aria-invalid={Boolean(errors.startTime)} />
              {errors.startTime && <p className="field-error">{errors.startTime}</p>}
            </div>
            <div>
              <label className="form-label" htmlFor="endTime">Ends <span>*</span></label>
              <Input id="endTime" type="time" value={form.endTime} onChange={(event) => setField("endTime", event.target.value)} aria-invalid={Boolean(errors.endTime)} />
              {errors.endTime && <p className="field-error">{errors.endTime}</p>}
            </div>
          </div>
          <DialogFooter className="gap-2 pt-3 sm:space-x-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Keep editing</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {appointment ? "Save changes" : "Add appointment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AppointmentBoard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setAppointments(await fetchAppointments({ date: dateFilter, status: statusFilter }));
    } catch (requestError) {
      setError(friendlyError(requestError));
    } finally {
      setLoading(false);
    }
  }, [dateFilter, statusFilter]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const stats = useMemo(() => ({
    total: appointments.length,
    scheduled: appointments.filter((item) => item.status === "scheduled").length,
    completed: appointments.filter((item) => item.status === "completed").length,
    cancelled: appointments.filter((item) => item.status === "cancelled").length,
  }), [appointments]);

  const runAction = async (action: () => Promise<Appointment>, successMessage: string) => {
    if (!actionId) return;
    try {
      await action();
      toast.success(successMessage);
      await loadAppointments();
    } catch (requestError) {
      toast.error(friendlyError(requestError));
    } finally {
      setActionId(null);
    }
  };

  const handleComplete = (appointment: Appointment) => {
    setActionId(appointment.id);
    void runAction(() => completeAppointment(appointment.id), "Appointment marked as completed.");
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setActionId(cancelTarget.id);
    setCancelTarget(null);
    await runAction(() => cancelAppointment(cancelTarget.id), "Appointment cancelled successfully.");
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (appointment: Appointment) => {
    setEditing(appointment);
    setFormOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="app-header">
        <div className="page-shell flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="brand-mark"><CalendarDays className="size-5" /></div>
            <span className="text-sm font-bold tracking-tight text-foreground">Appointment Board</span>
          </div>
          <span className="hidden text-xs font-medium text-muted-foreground sm:block">Team workspace</span>
        </div>
      </header>

      <main className="page-shell pb-16 pt-10 sm:pt-14">
        <section className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="eyebrow"><Sparkles className="size-3.5" /> Team scheduling</div>
            <h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl">Make every meeting count.</h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">Manage and track team appointments with a clear view of what is next, what is done, and what changed.</p>
          </div>
          <Button size="lg" onClick={openCreate} className="self-start lg:self-auto"><Plus className="size-5" /> Add appointment</Button>
        </section>

        <section className="stats-grid mb-8" aria-label="Appointment summary">
          <div className="stat-item"><span className="stat-label">Showing</span><strong>{stats.total}</strong><span className="stat-detail">appointments</span></div>
          <div className="stat-item stat-accent"><span className="stat-label">Scheduled</span><strong>{stats.scheduled}</strong><span className="stat-detail">up next</span></div>
          <div className="stat-item"><span className="stat-label">Completed</span><strong>{stats.completed}</strong><span className="stat-detail">wrapped up</span></div>
          <div className="stat-item"><span className="stat-label">Cancelled</span><strong>{stats.cancelled}</strong><span className="stat-detail">kept in history</span></div>
        </section>

        <section className="filter-bar" aria-label="Filter appointments">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground"><SlidersHorizontal className="size-4 text-primary" /> Filters</div>
          <div className="filter-fields">
            <label className="filter-control"><span>Date</span><div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></div></label>
            <label className="filter-control"><span>Status</span><div className="relative"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /></div></label>
          </div>
          {(dateFilter || statusFilter !== "all") && <Button variant="ghost" size="sm" onClick={() => { setDateFilter(""); setStatusFilter("all"); }}><X className="size-3.5" /> Clear filters</Button>}
        </section>

        <div className="mt-8 flex items-center justify-between gap-4">
          <div><h2 className="text-xl font-bold tracking-tight text-foreground">Your appointments</h2><p className="mt-1 text-sm text-muted-foreground">Sorted by date and start time</p></div>
          <Button variant="ghost" size="icon" onClick={() => void loadAppointments()} aria-label="Refresh appointments" title="Refresh appointments"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></Button>
        </div>

        {loading ? (
          <div className="appointment-grid mt-5" aria-label="Loading appointments" aria-busy="true">{[1, 2, 3].map((item) => <div className="loading-card" key={item}><div className="skeleton w-24" /><div className="skeleton mt-5 h-6 w-3/4" /><div className="skeleton mt-3 h-4 w-full" /><div className="skeleton mt-8 h-4 w-1/2" /></div>)}</div>
        ) : error ? (
          <div className="empty-state mt-5"><div className="empty-icon"><XCircle className="size-6" /></div><h3>We couldn’t load appointments</h3><p>{error}</p><Button variant="outline" onClick={() => void loadAppointments()}><RefreshCw className="size-4" /> Try again</Button></div>
        ) : appointments.length === 0 ? (
          <div className="empty-state mt-5"><div className="empty-icon"><CalendarDays className="size-6" /></div><h3>No appointments found</h3><p>{dateFilter || statusFilter !== "all" ? "Try clearing your filters or add a new appointment." : "Your team’s schedule is clear. Add the first appointment to get started."}</p><Button onClick={openCreate}><Plus className="size-4" /> Add appointment</Button></div>
        ) : (
          <div className="appointment-grid mt-5">{appointments.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} onEdit={openEdit} onComplete={handleComplete} onCancel={setCancelTarget} />)}</div>
        )}
      </main>

      <AppointmentFormDialog open={formOpen} onOpenChange={setFormOpen} initialValues={editing ? toForm(editing) : { ...EMPTY_FORM, date: dateFilter || todayString() }} appointment={editing} onSaved={loadAppointments} />
      <Dialog open={Boolean(cancelTarget)} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Cancel this appointment?</DialogTitle><DialogDescription>“{cancelTarget?.title}” will stay visible in your history, but it will no longer hold this time slot.</DialogDescription></DialogHeader>
          <DialogFooter className="gap-2 pt-3 sm:space-x-0"><Button variant="outline" onClick={() => setCancelTarget(null)}>Keep appointment</Button><Button variant="danger" disabled={actionId !== null} onClick={() => void handleCancel()}>{actionId === cancelTarget?.id && <Loader2 className="size-4 animate-spin" />} Cancel appointment</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}