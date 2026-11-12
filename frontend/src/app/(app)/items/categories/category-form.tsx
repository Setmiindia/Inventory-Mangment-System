"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";
import { saveCategory, type CategoryState } from "./actions";

type Category = { id: string; name: string; code: string | null; description: string | null; isActive: boolean };

const field = "min-h-12 w-full rounded-xl border border-[var(--line-strong)] bg-surface px-3 text-base md:text-sm";

// Add or edit a category in the side panel (the same form, with or without an id).
export function CategoryForm({ category, cancelHref }: { category?: Category; cancelHref: string }) {
  const [state, formAction, pending] = useActionState<CategoryState, FormData>(saveCategory, null);
  // After a failed save keep what the person typed (React empties the boxes when the action ends).
  const typed = (name: string, fallback: string | null | undefined) => state?.values?.[name] ?? fallback ?? "";
  return (
    <form action={formAction} className="space-y-3">
      {category && <input type="hidden" name="id" value={category.id} />}
      <label className="block">
        <span className="mb-1 block text-xs text-muted">Category name *</span>
        <input name="name" defaultValue={typed("name", category?.name)} required maxLength={100} autoFocus className={field} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-muted">Category code (optional)</span>
        <input name="code" defaultValue={typed("code", category?.code)} maxLength={12} autoCapitalize="characters" autoComplete="off" placeholder="e.g. CON" className={`${field} font-mono uppercase placeholder:normal-case`} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs text-muted">Description (optional)</span>
        <textarea name="description" defaultValue={typed("description", category?.description)} maxLength={300} rows={3} className={`${field} py-2`} />
      </label>
      {category && (
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input type="checkbox" name="isActive" defaultChecked={category.isActive} className="h-5 w-5 accent-[var(--brand)]" /> Active
        </label>
      )}
      {state && !state.ok && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-700">{state.message}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Link href={cancelHref} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line bg-surface text-sm font-semibold hover:bg-surface-muted">Cancel</Link>
        <button type="submit" disabled={pending} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-60">
          {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />} {category ? "Save Category" : "Add Category"}
        </button>
      </div>
    </form>
  );
}
