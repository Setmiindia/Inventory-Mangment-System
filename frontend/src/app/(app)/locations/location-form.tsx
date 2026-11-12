"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CheckCircle2, Loader2, Save, Store, TriangleAlert, Warehouse } from "lucide-react";
import { saveLocation, setLocationActive, type LocationState } from "./actions";
import { cardClass, dangerButton, inputClass, labelClass, primaryButton, secondaryButton } from "@/lib/ui";

export type LocationValues = {
  id: string;
  updatedAt: string;
  code: string;
  name: string;
  type: "WAREHOUSE" | "SHOP";
  address: string | null;
  city: string | null;
  capacity: number | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
};

function Message({ state }: { state: LocationState }) {
  if (!state) return null;
  const Icon = state.ok ? CheckCircle2 : TriangleAlert;
  return (
    <p role={state.ok ? "status" : "alert"} className={`inline-flex items-center gap-1.5 text-sm font-medium ${state.ok ? "text-green-700 dark:text-green-400" : "text-[var(--danger)]"}`}>
      <Icon size={16} aria-hidden /> {state.message}
    </p>
  );
}

// A label with a red star for required fields, and a short plain-language hint under the box.
function Field({ id, label, required, hint, className, children }: { id: string; label: string; required?: boolean; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label} {required && <span className="text-[var(--danger)]" aria-hidden>*</span>}
        {required && <span className="sr-only">(required)</span>}
      </label>
      {children}
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className={`${cardClass} !p-5`}>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-0.5 text-sm text-muted">{hint}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

const TYPES = [
  { value: "WAREHOUSE", label: "Warehouse", hint: "Main store where stock is kept", Icon: Warehouse },
  { value: "SHOP", label: "Shop", hint: "Counter where bills are made", Icon: Store },
] as const;

export function LocationForm({ location }: { location?: LocationValues }) {
  const [state, action, pending] = useActionState<LocationState, FormData>(saveLocation, null);
  // After a failed save keep what the person typed (React empties the boxes when the action ends).
  const v = (name: keyof LocationValues, fallback: string | number | null | undefined) => state?.values?.[name] ?? fallback ?? "";

  return (
    <form action={action} className="max-w-3xl space-y-5">
      {location && <input type="hidden" name="id" value={location.id} />}
      {location && <input type="hidden" name="expectedUpdatedAt" value={location.updatedAt} />}

      <Section title="Basic details" hint="What is this place, and what should it be called?">
        <fieldset className="sm:col-span-2">
          <legend className={labelClass}>Type <span className="text-[var(--danger)]" aria-hidden>*</span></legend>
          <div className="mt-1 grid gap-3 sm:grid-cols-2">
            {TYPES.map(({ value, label, hint, Icon }) => (
              <label key={value} className="relative flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-[var(--line-strong)] bg-surface p-3 shadow-sm transition hover:bg-surface-muted has-[:checked]:border-[var(--brand)] has-[:checked]:bg-brand-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--brand)]">
                <input type="radio" name="type" value={value} required defaultChecked={String(v("type", location?.type ?? "WAREHOUSE")) === value} className="sr-only" />
                <Icon size={22} aria-hidden className="shrink-0 text-[var(--brand-text)]" />
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-muted">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field id="code" label="Code" required hint="A short, unique code. Example: WH-MAIN or SHOP-01. Two places cannot share a code.">
          <input id="code" name="code" required maxLength={20} defaultValue={v("code", location?.code)} placeholder="e.g. WH-MAIN" autoComplete="off" aria-describedby="code-hint" className={inputClass} />
        </Field>
        <Field id="name" label="Name" required hint="The name your team uses. Example: Saroop Nagar Warehouse.">
          <input id="name" name="name" required maxLength={100} defaultValue={v("name", location?.name)} placeholder="e.g. Main Warehouse" autoComplete="off" aria-describedby="name-hint" className={inputClass} />
        </Field>
      </Section>

      <Section title="Where is it?" hint="Used on documents and to find the place quickly.">
        <Field id="city" label="City">
          <input id="city" name="city" maxLength={60} defaultValue={v("city", location?.city)} placeholder="e.g. Delhi" autoComplete="off" className={inputClass} />
        </Field>
        <Field id="capacity" label="Capacity (storage slots)" hint="How many bins or slots it has. Leave empty if you are not sure; it only powers the utilization chart.">
          <input id="capacity" name="capacity" type="number" min={0} max={10000000} step={1} inputMode="numeric" defaultValue={v("capacity", location?.capacity)} placeholder="e.g. 500" aria-describedby="capacity-hint" className={inputClass} />
        </Field>
        <Field id="address" label="Address" className="sm:col-span-2">
          <textarea id="address" name="address" rows={3} maxLength={500} defaultValue={v("address", location?.address)} placeholder="e.g. Street, area, pincode" className={inputClass} />
        </Field>
      </Section>

      <Section title="Who to contact" hint="Optional. The person who looks after this place.">
        <Field id="contactPerson" label="Contact person">
          <input id="contactPerson" name="contactPerson" maxLength={100} defaultValue={v("contactPerson", location?.contactPerson)} autoComplete="off" className={inputClass} />
        </Field>
        <Field id="phone" label="Phone">
          <input id="phone" name="phone" type="tel" inputMode="tel" maxLength={30} defaultValue={v("phone", location?.phone)} autoComplete="off" className={inputClass} />
        </Field>
        <Field id="email" label="Email" className="sm:col-span-2">
          <input id="email" name="email" type="email" maxLength={150} defaultValue={v("email", location?.email)} autoComplete="off" className={inputClass} />
        </Field>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />}
          {pending ? "Saving..." : location ? "Save changes" : "Create warehouse"}
        </button>
        <Link href={location ? `/locations?sel=${location.id}` : "/locations"} className={secondaryButton}>Cancel</Link>
        <Message state={state} />
      </div>
    </form>
  );
}

export function LocationArchiveControl({ id, isActive }: { id: string; isActive: boolean }) {
  const [state, action, pending] = useActionState<LocationState, FormData>(setLocationActive, null);
  return (
    <section className={`${cardClass} max-w-3xl !p-5`}>
      <h2 className="text-base font-semibold">{isActive ? "Archive this place" : "Restore this place"}</h2>
      <p className="mt-0.5 text-sm text-muted">
        {isActive
          ? "Archiving hides it from the lists. Nothing is deleted and the stock history is kept. A place that still holds stock cannot be archived."
          : "This place is archived. Restore it to use it again."}
      </p>
      <form action={action} className="mt-3 flex flex-wrap items-center gap-3">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="active" value={isActive ? "false" : "true"} />
        <button type="submit" disabled={pending} className={isActive ? dangerButton : secondaryButton}>
          {pending ? "Please wait..." : isActive ? "Archive" : "Restore"}
        </button>
        <Message state={state} />
      </form>
    </section>
  );
}
