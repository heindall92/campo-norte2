import {
  fileToAvatarDataUrl,
  loadUserProfile,
  saveUserProfile,
  type UserProfile,
} from "@/lib/user-profile";
import { ROLE_LABEL, type AppUser, type UserRole } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Check, Upload, User, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const fieldCls =
  "mps-field mt-1 w-full rounded-lg px-2.5 py-2 text-sm font-normal text-[var(--ink)]";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-[var(--ink-muted)]";

export function ProfileModal({
  open,
  onClose,
  subject,
  role,
  /** Si true, el visitante solo mira (admin inspeccionando) — no guarda en su cuenta */
  readOnly = false,
  lang = "es",
}: {
  open: boolean;
  onClose: () => void;
  subject: AppUser;
  role: UserRole;
  readOnly?: boolean;
  lang?: "es" | "en";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<UserProfile>(() =>
    loadUserProfile(subject.id, {
      name: subject.name,
      email: subject.email,
      roleLabel: ROLE_LABEL[role],
    }),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      loadUserProfile(subject.id, {
        name: subject.name,
        email: subject.email,
        roleLabel: ROLE_LABEL[role],
      }),
    );
    setError(null);
    setSaved(false);
  }, [open, subject.id, subject.name, subject.email, role]);

  if (!open) return null;

  async function onPickFile(file: File | undefined) {
    if (!file || readOnly) return;
    try {
      const url = await fileToAvatarDataUrl(file);
      setForm((f) => ({ ...f, avatarDataUrl: url }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function onSave() {
    if (readOnly) return;
    if (!form.fullName.trim()) {
      setError(lang === "es" ? "El nombre es obligatorio" : "Name is required");
      return;
    }
    saveUserProfile({ ...form, userId: subject.id, jobTitle: form.jobTitle || ROLE_LABEL[role] });
    setSaved(true);
    setError(null);
    window.dispatchEvent(new Event("mps-profile-saved"));
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[color-mix(in_oklab,#0f172a_50%,transparent)] p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[min(92vh,880px)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--field-border)] bg-[var(--glass-strong)] p-5 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--mps-display)] text-xl text-[var(--ink)]">
              {lang === "es" ? "Mi perfil" : "My profile"}
            </h2>
            <p className="mt-0.5 text-sm text-[var(--ink-muted)]">
              {readOnly
                ? lang === "es"
                  ? `Vista admin · ${subject.email} · ${ROLE_LABEL[role]}`
                  : `Admin view · ${subject.email} · ${ROLE_LABEL[role]}`
                : lang === "es"
                  ? "Identidad profesional · solo tú (y Admin) pueden ver estos datos."
                  : "Professional identity · only you (and Admin) can see this."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--field-border)] p-2 text-[var(--ink-muted)] hover:border-[var(--accent)]"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Foto */}
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent)] text-2xl font-bold text-white">
            {form.avatarDataUrl ? (
              <img src={form.avatarDataUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              subject.avatarInitial
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--ink)]">
              {lang === "es" ? "Foto de perfil" : "Profile photo"}
            </p>
            <p className="text-xs text-[var(--ink-muted)]">PNG, JPG o WebP · máx. 3 MB</p>
            {!readOnly && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mps-choice inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {lang === "es" ? "Subir foto" : "Upload"}
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, avatarDataUrl: null }))}
                  className="mps-choice inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold"
                >
                  <X className="h-3.5 w-3.5" />
                  {lang === "es" ? "Quitar" : "Remove"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => void onPickFile(e.target.files?.[0])}
                />
              </div>
            )}
            <p className="mt-2 text-xs font-semibold text-[var(--accent)]">
              {lang === "es" ? "Rol asignado" : "Assigned role"}: {ROLE_LABEL[role]}
            </p>
          </div>
        </div>

        <Section title={lang === "es" ? "Identidad" : "Identity"} required>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelCls}>
              {lang === "es" ? "Nombre completo" : "Full name"}
              <input
                className={fieldCls}
                disabled={readOnly}
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </label>
            <label className={labelCls}>
              {lang === "es" ? "Rol / cargo" : "Role / title"}
              <input
                className={fieldCls}
                disabled={readOnly}
                value={form.jobTitle}
                onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
              />
            </label>
            <label className={`${labelCls} sm:col-span-2`}>
              {lang === "es" ? "Acerca de ti" : "About you"}
              <textarea
                className={cn(fieldCls, "min-h-[4.5rem] resize-y")}
                disabled={readOnly}
                placeholder={lang === "es" ? "Breve descripción profesional (opcional)" : "Short bio (optional)"}
                value={form.about}
                onChange={(e) => setForm({ ...form, about: e.target.value })}
              />
            </label>
          </div>
        </Section>

        <Section title={lang === "es" ? "Organización" : "Organization"}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={`${labelCls} sm:col-span-2`}>
              {lang === "es" ? "Empresa / entidad" : "Company"}
              <input
                className={fieldCls}
                disabled={readOnly}
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
              />
            </label>
            <label className={labelCls}>
              {lang === "es" ? "Departamento / área" : "Department"}
              <input
                className={fieldCls}
                disabled={readOnly}
                placeholder="Ej. Ops · Booking"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              />
            </label>
            <label className={labelCls}>
              {lang === "es" ? "Rol CRM (sistema)" : "CRM role (system)"}
              <input className={fieldCls} disabled value={ROLE_LABEL[role]} readOnly />
            </label>
          </div>
        </Section>

        <Section title={lang === "es" ? "Contacto" : "Contact"} optional>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelCls}>
              {lang === "es" ? "Correo electrónico" : "Email"}
              <input
                type="email"
                className={fieldCls}
                disabled={readOnly}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className={labelCls}>
              {lang === "es" ? "Teléfono" : "Phone"}
              <input
                className={fieldCls}
                disabled={readOnly}
                placeholder="+34 600 000 000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </label>
            <label className={`${labelCls} sm:col-span-2`}>
              {lang === "es" ? "Ubicación / oficina" : "Location"}
              <input
                className={fieldCls}
                disabled={readOnly}
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </label>
          </div>
        </Section>

        <Section title={lang === "es" ? "Redes y presencia web" : "Web presence"} optional>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["linkedin", "LinkedIn", "https://linkedin.com/in/usuario"],
                ["github", "GitHub", "https://github.com/usuario"],
                ["twitter", "X (Twitter)", "https://x.com/usuario"],
                ["website", lang === "es" ? "Sitio web" : "Website", "https://tu-dominio.com"],
              ] as const
            ).map(([k, label, ph]) => (
              <label key={k} className={labelCls}>
                {label}
                <input
                  className={fieldCls}
                  disabled={readOnly}
                  placeholder={ph}
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
              </label>
            ))}
          </div>
        </Section>

        {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
        {saved && (
          <p className="mt-3 text-sm text-[var(--ok)]">
            {lang === "es" ? "Perfil guardado" : "Profile saved"}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--ink-muted)]">
            {lang === "es"
              ? "Nombre y cargo son obligatorios. El resto enriquece tu sesión."
              : "Name and title are required. The rest enriches your session."}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="mps-choice rounded-lg px-4 py-2 text-sm font-semibold"
            >
              {lang === "es" ? "Cancelar" : "Cancel"}
            </button>
            {!readOnly && (
              <button
                type="button"
                onClick={onSave}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-[0_0_20px_color-mix(in_oklab,var(--accent)_45%,transparent)]"
              >
                <Check className="h-4 w-4" />
                {lang === "es" ? "Guardar perfil" : "Save profile"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  required,
  optional,
}: {
  title: string;
  children: ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <section className="mb-4 rounded-xl border border-[var(--field-border)] bg-[var(--field-bg)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <User className="h-3.5 w-3.5 text-[var(--accent)]" />
        <h3 className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--ink-muted)]">
          {title}
        </h3>
        {required && (
          <span className="rounded-full bg-[color-mix(in_oklab,var(--danger)_18%,transparent)] px-2 py-0.5 text-[10px] font-bold text-[var(--danger)]">
            Obligatorio
          </span>
        )}
        {optional && (
          <span className="rounded-full border border-[var(--field-border)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-muted)]">
            Opcional
          </span>
        )}
      </div>
      {children}
    </section>
  );
}
