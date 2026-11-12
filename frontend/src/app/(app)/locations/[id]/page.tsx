import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { can, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/badge";
import { cardClass } from "@/lib/ui";
import { LocationArchiveControl, LocationForm } from "../location-form";
import { LocationHeader } from "../location-header";

export default function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="p-4 text-sm text-muted">Loading...</main>}>
      <LocationContent params={params} />
    </Suspense>
  );
}

async function LocationContent({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const supabase = await createClient();
  const { data: loc } = await supabase
    .from("locations")
    .select("id, code, name, type, address, city, capacity, contact_person, phone, email, is_active, updated_at")
    .eq("id", id.data)
    .maybeSingle();
  if (!loc) notFound();

  const canManage = can(user, "locations.manage");
  // Only admins may read other users' rows (RLS), so only they get the "who works here" list.
  let workers: { id: string; email: string }[] = [];
  if (user.isActive && user.isAdmin) {
    const { data } = await supabase.rpc("location_team", { p_location: loc.id });
    workers = ((data ?? []) as { id: string; email: string }[]).map((p) => ({ id: p.id, email: p.email }));
  }

  return (
    <main className="space-y-5">
      <LocationHeader
        current={loc.code}
        title={loc.name}
        subtitle={canManage ? `Code ${loc.code}. Change the details below and press Save changes.` : `Code ${loc.code}`}
        badges={<><Badge tone="brand">{loc.type === "SHOP" ? "Shop" : "Warehouse"}</Badge><Badge tone={loc.is_active ? "green" : "amber"}>{loc.is_active ? "Active" : "Archived"}</Badge></>}
      />

      {canManage ? (
        <LocationForm
          location={{ id: loc.id, updatedAt: loc.updated_at, code: loc.code, name: loc.name, type: loc.type, address: loc.address, city: loc.city, capacity: loc.capacity, contactPerson: loc.contact_person, phone: loc.phone, email: loc.email }}
        />
      ) : (
        <dl className={`${cardClass} grid max-w-3xl gap-3 !p-5 text-sm sm:grid-cols-2`}>
          <div><dt className="text-muted">Code</dt><dd className="font-medium">{loc.code}</dd></div>
          <div><dt className="text-muted">Type</dt><dd className="font-medium">{loc.type === "SHOP" ? "Shop" : "Warehouse"}</dd></div>
          <div><dt className="text-muted">City</dt><dd className="font-medium">{loc.city || "-"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted">Address</dt><dd className="font-medium">{loc.address || "-"}</dd></div>
        </dl>
      )}

      {canManage && <LocationArchiveControl id={loc.id} isActive={loc.is_active} />}

      {user.isAdmin && (
        <section className={`${cardClass} max-w-3xl !p-5`}>
          <h2 className="text-base font-semibold">People who work here</h2>
          {workers.length === 0 ? (
            <p className="mt-1 text-sm text-muted">Nobody is assigned yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-[var(--line)] text-sm">{workers.map((w) => <li key={w.id} className="py-2">{w.email}</li>)}</ul>
          )}
          <p className="mt-2 text-xs text-muted">
            To add or remove people, open <Link href="/admin/users" className="font-medium text-[var(--brand-text)] underline">Users &amp; Roles</Link>.
          </p>
        </section>
      )}
    </main>
  );
}
