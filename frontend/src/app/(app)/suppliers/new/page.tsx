import { PageHeader } from "@/components/page-header";
import { streamed } from "@/components/streamed";
import { requirePermission } from "@/lib/auth";
import { SupplierForm } from "../supplier-form";

export default streamed(async function NewSupplierPage() {
  await requirePermission("suppliers.manage");
  return (
    <main className="space-y-5">
      <PageHeader
        crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Master Data" }, { label: "Suppliers", href: "/suppliers" }, { label: "Add Supplier" }]}
        title="Add Supplier"
        subtitle="Add a supplier you buy from. Only the name is needed; you can fill the rest later."
      />
      <SupplierForm />
    </main>
  );
});

export const metadata = { title: "Add Supplier" };
