import { Suspense } from "react";
import { requirePermission } from "@/lib/auth";
import { LocationForm } from "../location-form";
import { LocationHeader } from "../location-header";

export default function NewLocationPage() {
  return (
    <Suspense fallback={<main className="p-4 text-sm text-muted">Loading...</main>}>
      <NewLocationContent />
    </Suspense>
  );
}

async function NewLocationContent() {
  await requirePermission("locations.manage");
  return (
    <main className="space-y-5">
      <LocationHeader current="Add Warehouse" title="Add Warehouse" subtitle="Create a warehouse or a shop. You can change any of this later." />
      <LocationForm />
    </main>
  );
}

export const metadata = { title: "Add Location" };
