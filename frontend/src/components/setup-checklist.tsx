import Link from "next/link";
import { CheckCircle2, ChevronRight, CircleHelp } from "lucide-react";
import type { CurrentUser } from "@/lib/auth";
import { tr, type Lang, type MessageKey } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { cardClass } from "@/lib/ui";

// First-time setup list for the administrator, in the order the work really happens. It counts the real data, so a tick
// is never a guess. It disappears by itself once every step is done.
export async function SetupChecklist({ user, lang }: { user: CurrentUser; lang: Lang }) {
  if (!user.isAdmin || !user.isActive) return null;
  const t = (k: MessageKey) => tr(lang, k);
  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };
  const [placesQ, categoriesQ, itemsQ, stockQ, suppliersQ, peopleQ] = await Promise.all([
    supabase.from("locations").select("id", head).neq("type", "TRANSIT"),
    supabase.from("categories").select("id", head),
    supabase.from("items").select("id", head),
    supabase.from("stock_balances").select("item_id", head),
    supabase.from("suppliers").select("id", head),
    supabase.rpc("active_people_count"),
  ]);
  const steps: { done: boolean; label: MessageKey; hint: MessageKey; href: string }[] = [
    { done: (placesQ.count ?? 0) > 0, label: "step_places", hint: "step_places_hint", href: "/locations/new" },
    { done: (categoriesQ.count ?? 0) > 0, label: "step_categories", hint: "step_categories_hint", href: "/items/categories?new=1" },
    { done: (itemsQ.count ?? 0) > 0, label: "step_items", hint: "step_items_hint", href: "/items/import" },
    { done: (stockQ.count ?? 0) > 0, label: "step_stock", hint: "step_stock_hint", href: "/stock/scan" },
    { done: (suppliersQ.count ?? 0) > 0, label: "step_suppliers", hint: "step_suppliers_hint", href: "/suppliers/new" },
    { done: Number(peopleQ.data ?? 0) > 1, label: "step_staff", hint: "step_staff_hint", href: "/admin/users" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  const next = steps.find((s) => !s.done);

  return (
    <section aria-label={t("home_setup_title")} className={`${cardClass} space-y-3 border-[var(--brand)] !p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{t("home_setup_title")} ({doneCount} / {steps.length} {t("home_setup_of")})</h2>
          <div className="mt-2 h-2 w-56 max-w-full overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${(doneCount * 100) / steps.length}%` }} />
          </div>
        </div>
        <Link href="/help#start" className="inline-flex items-center gap-1 text-sm"><CircleHelp size={16} aria-hidden /> {t("top_help")}</Link>
      </div>
      <ol className="grid gap-1 md:grid-cols-2">
        {steps.map((s, i) => (
          <li key={s.label}>
            <Link href={s.href} className={`flex items-center gap-3 rounded-lg p-2 hover:bg-surface-muted ${s === next ? "bg-brand-soft" : ""}`}>
              {s.done ? <CheckCircle2 size={22} className="shrink-0 text-green-600" aria-hidden />
                : <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 border-[var(--line-strong)] text-xs font-semibold text-muted">{i + 1}</span>}
              <span className="min-w-0 flex-1">
                <span className={`block font-medium ${s.done ? "text-muted line-through" : ""}`}>{t(s.label)}</span>
                <span className="block text-sm text-muted">{t(s.hint)}</span>
              </span>
              {!s.done && <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
