"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CheckCircle2, Globe, Loader2, MapPin, Save, TriangleAlert } from "lucide-react";
import { saveSupplier, setSupplierActive, type SupplierState } from "./actions";
import { cardClass, dangerButton, inputClass, labelClass, primaryButton, secondaryButton } from "@/lib/ui";

export type SupplierValues = {
  id: string; updatedAt: string; name: string; supplierType: "LOCAL" | "IMPORT";
  contactPerson: string | null; phone: string | null; email: string | null; address: string | null;
  country: string | null; gstin: string | null; notes: string | null;
  city: string | null; website: string | null; paymentTerms: string | null; currency: string;
};

function Message({ state }: { state: SupplierState }) {
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
  { value: "LOCAL", label: "Local supplier", hint: "An Indian supplier", Icon: MapPin },
  { value: "IMPORT", label: "Import supplier", hint: "A foreign supplier", Icon: Globe },
] as const;

export function SupplierForm({ supplier }: { supplier?: SupplierValues }) {
  const [state, action, pending] = useActionState<SupplierState, FormData>(saveSupplier, null);
  // After a failed save keep what the person typed (React empties the boxes when the action ends).
  const f = (k: keyof SupplierValues, fallback?: string) => state?.values?.[k] ?? (supplier?.[k] as string | null | undefined) ?? fallback ?? "";
  return (
    <form action={action} className="max-w-3xl space-y-5">
      {supplier && <input type="hidden" name="id" value={supplier.id} />}
      {supplier && <input type="hidden" name="expectedUpdatedAt" value={supplier.updatedAt} />}

      <Section title="Basic details" hint="Who is this supplier?">
        <Field id="name" label="Supplier name" required className="sm:col-span-2">
          <input id="name" name="name" required maxLength={150} autoComplete="off" defaultValue={f("name")} placeholder="e.g. Sharma Electricals" className={inputClass} />
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className={labelClass}>Type <span className="text-[var(--danger)]" aria-hidden>*</span></legend>
          <div className="mt-1 grid gap-3 sm:grid-cols-2">
            {TYPES.map(({ value, label, hint, Icon }) => (
              <label key={value} className="relative flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-[var(--line-strong)] bg-surface p-3 shadow-sm transition hover:bg-surface-muted has-[:checked]:border-[var(--brand)] has-[:checked]:bg-brand-soft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--brand)]">
                <input type="radio" name="supplierType" value={value} required defaultChecked={f("supplierType", "LOCAL") === value} className="sr-only" />
                <Icon size={22} aria-hidden className="shrink-0 text-[var(--brand-text)]" />
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-muted">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field id="city" label="City">
          <input id="city" name="city" maxLength={60} autoComplete="off" defaultValue={f("city")} className={inputClass} />
        </Field>
        <Field id="country" label="Country" hint="Fill this for import suppliers.">
          <input id="country" name="country" maxLength={60} autoComplete="off" defaultValue={f("country")} aria-describedby="country-hint" className={inputClass} />
        </Field>
        <Field id="address" label="Address" className="sm:col-span-2">
          <textarea id="address" name="address" rows={2} maxLength={500} defaultValue={f("address")} className={inputClass} />
        </Field>
      </Section>

      <Section title="Who to contact" hint="Optional. The person you talk to when you order.">
        <Field id="contactPerson" label="Contact person">
          <input id="contactPerson" name="contactPerson" maxLength={100} autoComplete="off" defaultValue={f("contactPerson")} className={inputClass} />
        </Field>
        <Field id="phone" label="Phone">
          <input id="phone" name="phone" type="tel" inputMode="tel" maxLength={30} autoComplete="off" defaultValue={f("phone")} className={inputClass} />
        </Field>
        <Field id="email" label="Email">
          <input id="email" name="email" type="email" maxLength={150} autoComplete="off" defaultValue={f("email")} className={inputClass} />
        </Field>
        <Field id="website" label="Website">
          <input id="website" name="website" maxLength={200} autoComplete="off" defaultValue={f("website")} placeholder="e.g. www.example.com" className={inputClass} />
        </Field>
      </Section>

      <Section title="Business terms" hint="Optional. Used on purchase orders.">
        <Field id="gstin" label="GSTIN" hint="15 letters and digits. For Indian suppliers.">
          <input id="gstin" name="gstin" maxLength={15} autoComplete="off" defaultValue={f("gstin")} aria-describedby="gstin-hint" className={`${inputClass} font-mono uppercase`} />
        </Field>
        <Field id="paymentTerms" label="Payment terms" hint="For example 30 Days.">
          <input id="paymentTerms" name="paymentTerms" maxLength={60} autoComplete="off" defaultValue={f("paymentTerms")} aria-describedby="paymentTerms-hint" className={inputClass} />
        </Field>
        <Field id="currency" label="Currency" hint="3 letters, for example INR or USD. Empty = INR.">
          <input id="currency" name="currency" maxLength={3} autoComplete="off" defaultValue={f("currency", "INR")} aria-describedby="currency-hint" className={`${inputClass} font-mono uppercase`} />
        </Field>
        <Field id="notes" label="Notes" className="sm:col-span-2">
          <textarea id="notes" name="notes" rows={2} maxLength={1000} defaultValue={f("notes")} className={inputClass} />
        </Field>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />}
          {pending ? "Saving..." : supplier ? "Save changes" : "Create supplier"}
        </button>
        <Link href={supplier ? `/suppliers?sel=${supplier.id}` : "/suppliers"} className={secondaryButton}>Cancel</Link>
        <Message state={state} />
      </div>
    </form>
  );
}

export function SupplierArchiveControl({ id, isActive }: { id: string; isActive: boolean }) {
  const [state, action, pending] = useActionState<SupplierState, FormData>(setSupplierActive, null);
  return (
    <section className={`${cardClass} max-w-3xl !p-5`}>
      <h2 className="text-base font-semibold">{isActive ? "Archive this supplier" : "Restore this supplier"}</h2>
      <p className="mt-0.5 text-sm text-muted">
        {isActive ? "Archiving hides the supplier from the lists. Nothing is deleted: old orders and receipts keep their supplier." : "This supplier is archived. Restore it to use it again."}
      </p>
      <form action={action} className="mt-3 flex flex-wrap items-center gap-3">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="active" value={isActive ? "false" : "true"} />
        <button type="submit" disabled={pending} className={isActive ? dangerButton : secondaryButton}>{pending ? "Please wait..." : isActive ? "Archive" : "Restore"}</button>
        <Message state={state} />
      </form>
    </section>
  );
}
