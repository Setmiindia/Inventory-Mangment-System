import Link from "next/link";
import { ChevronRight } from "lucide-react";

// Breadcrumb + title block shared by the Add / Edit screens, the same look as the list pages.
export function PageHeader({ crumbs, title, subtitle, badges, actions }: {
  crumbs: { label: string; href?: string }[]; title: string; subtitle?: string; badges?: React.ReactNode; actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          {crumbs.map((c, i) => (
            <span key={c.label} className="flex items-center gap-2">
              {i > 0 && <ChevronRight size={14} aria-hidden />}
              {c.href ? <Link href={c.href}>{c.label}</Link> : <span className="font-medium text-[var(--foreground)]">{c.label}</span>}
            </span>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="!text-3xl !font-bold">{title}</h1>
          {badges}
        </div>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
