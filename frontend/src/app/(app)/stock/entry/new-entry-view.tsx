import Link from "next/link";
import { ArrowUpDown, History } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import type { CurrentUser } from "@/lib/auth";
import { getCurrentLocation, getMyLocations } from "@/lib/location";
import { cardClass } from "@/lib/ui";
import { REASON_LABELS } from "@/lib/validation/stock-entry";
import { EntryForm } from "./entry-form";
import { ENTRY_LABELS } from "./labels";

// Two tabs on top of both views, so staff who only do entries and managers who approve use the same screen.
export function EntryTabs({ active }: { active: "new" | "history" }) {
  const base = "inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium";
  const on = "bg-brand-soft text-[var(--brand-text)] shadow-sm";
  const off = "text-muted hover:bg-surface-muted hover:text-[var(--foreground)]";
  return (
    <nav aria-label="Stock In / Out sections" className="flex w-fit gap-1 rounded-xl border border-line bg-surface p-1.5 shadow-sm print:hidden">
      <Link href="/stock/entry" aria-current={active === "new" ? "page" : undefined} className={`${base} ${active === "new" ? on : off}`}><ArrowUpDown size={16} aria-hidden /> New entry</Link>
      <Link href="/stock/entry?view=history" aria-current={active === "history" ? "page" : undefined} className={`${base} ${active === "history" ? on : off}`}><History size={16} aria-hidden /> History &amp; approvals</Link>
    </nav>
  );
}

// The daily screen: only the quick form, in the middle of the page, no tables or charts around it.
export async function NewEntryView({ user, lang, canApprove }: { user: CurrentUser; lang: "en" | "hi"; canApprove: boolean }) {
  const [loc, places] = await Promise.all([getCurrentLocation(user), getMyLocations(user)]);
  const t = ENTRY_LABELS[lang];
  return (
    <main className="space-y-5">
      <PageHeader
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Inventory" }, { label: "Stock In / Out" }]}
        title="Stock In / Out"
        subtitle="Goods that leave or come back without a bill or a receipt here: sold in Zoho, samples, damage, returns."
      />
      <EntryTabs active="new" />
      {!loc ? (
        <p role="status" className="max-w-3xl rounded-xl border border-amber-500 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          You are not assigned to a warehouse or shop yet. Ask an administrator to give you one.
        </p>
      ) : (
        <div className="max-w-3xl space-y-4">
          <p className={`${cardClass} !p-4 text-sm`}>
            Working place: <strong>{loc.name}</strong> ({loc.code}).{" "}
            {places.length > 1 ? "To make an entry for another place, switch the place at the top of the page. " : ""}
            <span className="text-muted">
              {canApprove ? "You are a manager: your entry changes the stock as soon as you save." : "Your entry waits for a manager. The stock changes only after it is approved."}
            </span>
          </p>
          <EntryForm placeName={`${loc.name} (${loc.code})`} reasonLabels={REASON_LABELS[lang]} t={t} needsApproval={!canApprove} />
        </div>
      )}
    </main>
  );
}
