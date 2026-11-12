import { Badge } from "@/components/badge";
import { PageHeader } from "@/components/page-header";
import { streamed } from "@/components/streamed";
import { cardClass } from "@/lib/ui";
import { notFound } from "next/navigation";
import { z } from "zod";
import { can, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SupplierArchiveControl, SupplierForm } from "../supplier-form";

export default streamed(async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const supabase = await createClient();
  const { data: s } = await supabase.from("suppliers").select("*").eq("id", id.data).maybeSingle();
  if (!s) notFound();
  const canManage = can(user, "suppliers.manage");

  return (
    <main className="space-y-5">
      <PageHeader
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Master Data" }, { label: "Suppliers", href: "/suppliers" }, { label: s.name }]}
        title={s.name}
        subtitle={canManage ? "Change the details below and press Save changes." : undefined}
        badges={<><Badge tone="brand">{s.supplier_type === "IMPORT" ? "Import" : "Local"}</Badge><Badge tone={s.is_active ? "green" : "amber"}>{s.is_active ? "Active" : "Archived"}</Badge></>}
      />
      {canManage ? (
        <SupplierForm
          supplier={{
            id: s.id, updatedAt: s.updated_at, name: s.name, supplierType: s.supplier_type, contactPerson: s.contact_person,
            phone: s.phone, email: s.email, address: s.address, country: s.country, gstin: s.gstin, notes: s.notes,
            city: s.city, website: s.website, paymentTerms: s.payment_terms, currency: s.currency,
          }}
        />
      ) : (
        <dl className={`${cardClass} grid max-w-3xl gap-3 !p-5 text-sm sm:grid-cols-2`}>
          <div><dt className="font-medium">Contact person</dt><dd>{s.contact_person ?? ""}</dd></div>
          <div><dt className="font-medium">Phone</dt><dd>{s.phone ?? ""}</dd></div>
          <div><dt className="font-medium">Email</dt><dd>{s.email ?? ""}</dd></div>
          <div><dt className="font-medium">GSTIN</dt><dd>{s.gstin ?? ""}</dd></div>
          <div className="sm:col-span-2"><dt className="font-medium">Address</dt><dd>{s.address ?? ""}</dd></div>
        </dl>
      )}
      {canManage && <SupplierArchiveControl id={s.id} isActive={s.is_active} />}
    </main>
  );
})
