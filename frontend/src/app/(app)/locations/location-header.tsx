import Link from "next/link";
import { ChevronRight } from "lucide-react";

// The same breadcrumb + title block the Warehouses list uses, so the Add and Edit screens look like part of the same module.
export function LocationHeader({ current, title, subtitle, badges }: { current: string; title: string; subtitle?: string; badges?: React.ReactNode }) {
  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link href="/dashboard">Dashboard</Link> <ChevronRight size={14} aria-hidden />
        <Link href="/locations">Warehouses</Link> <ChevronRight size={14} aria-hidden />
        <span className="font-medium text-[var(--foreground)]">{current}</span>
      </nav>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="!text-3xl !font-bold">{title}</h1>
        {badges}
      </div>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </div>
  );
}
