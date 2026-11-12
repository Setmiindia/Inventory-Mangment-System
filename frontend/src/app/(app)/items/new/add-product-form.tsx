"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, ImagePlus, Loader2, Package, Save, Wand2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ACCEPT_IMAGES, BUCKET, MAX_IMAGES, checkDeclaredFile } from "@/lib/validation/files";
import { confirmUpload, requestUpload } from "../[id]/file-actions";
import { createProduct, suggestSku } from "../actions";

type Option = { id: string; name: string };

const field = "min-h-10 w-full rounded-lg border border-[var(--line-strong)] bg-surface px-3 text-base shadow-sm placeholder:text-muted disabled:opacity-60 sm:text-sm";
const area = "w-full rounded-lg border border-[var(--line-strong)] bg-surface px-3 py-2 text-base shadow-sm placeholder:text-muted sm:text-sm";
const card = "rounded-xl border border-line bg-surface p-4 shadow-sm";
const lab = "mb-1 block text-xs font-medium text-muted";

function Check({ name, label, hint }: { name: string; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm" title={hint}>
      <input type="checkbox" name={name} defaultChecked className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
      <span><span className="block font-medium">{label}</span><span className="block text-xs text-muted">{hint}</span></span>
    </label>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className={card}>
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <p className="mb-3 text-xs text-muted">{hint}</p>}
      <div className={hint ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

// A card that is closed until the person needs it, so the page stays short.
function More({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <details className={`${card} group`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-muted">{hint}</span></span>
        <ChevronRight size={18} aria-hidden className="shrink-0 text-muted transition group-open:rotate-90" />
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

// Add Product on ONE page. The everyday boxes are open; the optional ones (details, purchase and reorder) are in closed cards.
// Everything stays in the same form, so Save Product always sends all the boxes (also those in a closed card).
export type DuplicateSource = {
  fromCode: string;
  values: Record<string, string | number | null>;
  flags: { isActive: boolean; showInSales: boolean; showInPurchase: boolean; lowStockAlert: boolean };
};

export function AddProductForm({ categories, brands, canEditPrice, canUploadImages, initial }: {
  categories: Option[]; brands: string[]; canEditPrice: boolean; canUploadImages: boolean; initial?: DuplicateSource | null;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; link?: string } | null>(null);
  const [name, setName] = useState(String(initial?.values.itemName ?? ""));
  const [sellingName, setSellingName] = useState(String(initial?.values.sellingItemName ?? ""));
  const [sellingTouched, setSellingTouched] = useState(Boolean(initial));
  const [skuBusy, setSkuBusy] = useState(false);
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [preview, setPreview] = useState({ code: "", category: "", brand: "", hsn: "", price: "" });
  const urlsRef = useRef<string[]>([]);
  useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // The preview card on the right follows the boxes. Read from the form, so a duplicated product is shown too.
  function syncPreview() {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const text = (k: string) => String(fd.get(k) ?? "");
    // The person is fixing the boxes: an old error message has done its job. A "saved, but..." message with a link stays.
    setMsg((m) => (m && !m.ok && !m.link ? null : m));
    setPreview({
      code: text("internalItemCode"), category: categories.find((c) => c.id === text("categoryId"))?.name ?? "", brand: text("brand"),
      hsn: text("hsnCode"), price: text("sellingPrice"),
    });
  }

  // Duplicate: put the copied details into the boxes (they are plain boxes, so this sets them once when the page opens).
  useEffect(() => {
    const form = formRef.current;
    if (!form || !initial) return;
    for (const [k, v] of Object.entries(initial.values)) {
      if (k === "itemName" || k === "sellingItemName" || v === null || v === "") continue;
      const el = form.elements.namedItem(k);
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) el.value = String(v);
    }
    for (const [k, v] of Object.entries(initial.flags)) {
      const el = form.elements.namedItem(k);
      if (el instanceof HTMLInputElement) el.checked = v;
    }
    syncPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fillSku() {
    const cat = String(new FormData(formRef.current!).get("categoryId") ?? "");
    setSkuBusy(true);
    const r = await suggestSku(cat);
    setSkuBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.message });
    const el = formRef.current!.elements.namedItem("internalItemCode");
    if (el instanceof HTMLInputElement) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, r.sku);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    setMsg(null);
  }

  function addFiles(list: FileList | File[]) {
    const next = [...files];
    const problems: string[] = [];
    for (const f of Array.from(list)) {
      if (next.length >= MAX_IMAGES) { problems.push(`Only ${MAX_IMAGES} images are allowed.`); break; }
      const q = checkDeclaredFile(f.type, f.size);
      if (!q.ok || q.kind !== "image") { problems.push(`${f.name}: ${q.ok ? "only JPG, PNG or WebP." : q.message}`); continue; }
      const url = URL.createObjectURL(f);
      urlsRef.current.push(url);
      next.push({ file: f, url });
    }
    setFiles(next);
    setMsg(problems.length ? { ok: false, text: problems.join(" ") } : null);
  }

  async function submit(draft: boolean) {
    const form = formRef.current;
    if (!form || busy) return;
    const fd = new FormData(form);
    if (!String(fd.get("itemName") ?? "").trim() || !String(fd.get("internalItemCode") ?? "").trim()) {
      return setMsg({ ok: false, text: "Product Name and Product Code (SKU) are required." });
    }
    if (!draft && !fd.get("categoryId")) {
      return setMsg({ ok: false, text: "Choose a Category (or use Save as Draft)." });
    }
    fd.set("draft", draft ? "true" : "false");
    setBusy(true);
    setMsg(null);
    const res = await createProduct(fd);
    if (!res.ok) {
      setBusy(false);
      return setMsg({ ok: false, text: res.message });
    }
    // The product exists now: send the chosen images one by one (the first is the Main image).
    const problems: string[] = res.warn ? [res.warn] : [];
    for (const { file } of files) {
      try {
        const ticket = await requestUpload({ itemId: res.id, size: file.size, contentType: file.type });
        if (!ticket.ok) { problems.push(`${file.name}: ${ticket.message}`); continue; }
        const { error } = await createClient().storage.from(BUCKET).uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
        if (error) { problems.push(`${file.name}: upload failed.`); continue; }
        const done = await confirmUpload({ itemId: res.id, path: ticket.path });
        if (!done.ok) problems.push(`${file.name}: ${done.message}`);
      } catch {
        problems.push(`${file.name}: upload failed.`);
      }
    }
    if (problems.length === 0) return router.push(`/items/${res.id}`);
    setBusy(false);
    setMsg({ ok: false, text: `The product was saved, but: ${problems.join(" ")}`, link: `/items/${res.id}` });
  }

  return (
    <form ref={formRef} onChange={syncPreview} onSubmit={(e) => { e.preventDefault(); void submit(false); }} className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Link href="/dashboard">Dashboard</Link><ChevronRight size={14} aria-hidden /><span>Master Data</span><ChevronRight size={14} aria-hidden />
            <Link href="/items">Products / SKU</Link><ChevronRight size={14} aria-hidden /><span className="font-medium text-[var(--foreground)]">{initial ? "Duplicate Product" : "Add Product"}</span>
          </nav>
          <h1 className="!text-3xl !font-bold">{initial ? "Duplicate Product" : "Add Product / SKU"}</h1>
          <p className="mt-1 text-sm text-muted">
            {initial ? `Copy of ${initial.fromCode}. Give it a new code. Pictures and barcodes are not copied.` : "Fill the name, code and category. Everything else is optional."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/items" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold shadow-sm hover:bg-surface-muted"><ArrowLeft size={16} aria-hidden /> Back to Products</Link>
          <button type="button" disabled={busy} onClick={() => void submit(true)} className="inline-flex min-h-11 items-center rounded-xl border border-line bg-surface px-4 text-sm font-semibold shadow-sm hover:bg-surface-muted disabled:opacity-60">Save as Draft</button>
          <button type="submit" disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand)] px-5 text-sm font-semibold text-white shadow-sm hover:bg-brand-strong disabled:opacity-60">
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />} Save Product
          </button>
        </div>
      </header>

      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`rounded-lg border p-3 text-sm ${msg.ok ? "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300" : "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300"}`}>
          {msg.text} {msg.link && <Link href={msg.link} className="font-medium underline">Open the product</Link>}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <Section title="Basic Product Information" hint="The name, code and category are needed. The rest is optional.">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2"><span className={lab}>Product Name *</span>
                <input name="itemName" maxLength={200} value={name} placeholder="Product name" className={field}
                  onChange={(e) => { setName(e.target.value); if (!sellingTouched) setSellingName(e.target.value); }} /></label>
              <div><span className={lab}>Product Code (SKU) *</span>
                <div className="flex gap-2">
                  <input name="internalItemCode" maxLength={120} placeholder="Product code" aria-label="Product code" autoComplete="off" className={field} />
                  <button type="button" onClick={() => void fillSku()} disabled={skuBusy} title="Suggest a free code from the category (choose the category first)" aria-label="Suggest a product code"
                    className="inline-flex min-h-10 w-11 shrink-0 items-center justify-center rounded-lg border border-line bg-surface hover:bg-surface-muted disabled:opacity-60">
                    {skuBusy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Wand2 size={16} aria-hidden />}
                  </button>
                </div></div>
              <div><span className={lab}>Unit</span>
                {/* The unit is always Pieces for now. A hidden box sends it; the visible one only shows it. */}
                <input type="hidden" name="unit" value="PCS" />
                <input value="PCS - Pieces" readOnly aria-label="Unit" className={`${field} bg-surface-muted`} /></div>
              <label className="block"><span className={lab}>Category *</span>
                <select name="categoryId" defaultValue="" className={field}>
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {categories.length === 0 && (
                  <span className="mt-1 block text-xs text-[var(--danger)]">No category exists yet. <Link href="/items/categories" className="font-semibold underline">Create a category first</Link>, then come back (use Save as Draft to keep this page).</span>
                )}</label>
              <label className="block"><span className={lab}>Brand</span>
                <input name="brand" maxLength={100} list="brand-list" placeholder="Brand" className={field} />
                <datalist id="brand-list">{brands.map((b) => <option key={b} value={b} />)}</datalist></label>
              <label className="block"><span className={lab}>HSN Code (only stored, no tax is calculated)</span><input name="hsnCode" inputMode="numeric" maxLength={20} className={field} /></label>
              <label className="block"><span className={lab}>Selling price (₹ per unit)</span>
                <input name="sellingPrice" inputMode="decimal" maxLength={11} disabled={!canEditPrice} placeholder={canEditPrice ? "0.00" : "No permission"} className={field} /></label>
              <label className="block sm:col-span-2"><span className={lab}>Selling Item Name (printed on bills)</span>
                <input name="sellingItemName" maxLength={200} value={sellingName} placeholder="Same as Product Name" className={field}
                  onChange={(e) => { setSellingName(e.target.value); setSellingTouched(true); }} /></label>
              <label className="block sm:col-span-2"><span className={lab}>Short Description</span>
                <textarea name="shortDescription" rows={2} maxLength={500} placeholder="One or two lines (optional)" className={area} /></label>
            </div>
          </Section>

          <Section title="Product Images" hint={`Up to ${MAX_IMAGES} images, JPG / PNG / WebP, 5 MB each. The first one is the Main image.`}>
            <div className="flex flex-wrap items-center gap-2">
              {files.map((f, i) => (
                <div key={f.url} className="relative h-20 w-20 overflow-hidden rounded-lg border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={f.file.name} className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute bottom-0 left-0 right-0 bg-brand text-center text-[10px] text-white">Main</span>}
                  <button type="button" aria-label={`Remove ${f.file.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"><X size={12} aria-hidden /></button>
                </div>
              ))}
              {files.length < MAX_IMAGES && (
                <label title={canUploadImages ? "Add images" : "Needs the item edit right"}
                  className={`inline-flex h-20 w-20 flex-col items-center justify-center rounded-lg border-2 border-dashed border-[var(--line-strong)] text-xs text-muted ${canUploadImages ? "cursor-pointer hover:bg-surface-muted" : "opacity-50"}`}>
                  <ImagePlus size={22} aria-hidden />Add
                  <input type="file" multiple accept={ACCEPT_IMAGES} disabled={!canUploadImages} className="sr-only"
                    onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
                </label>
              )}
            </div>
          </Section>

          <Section title="Status & Visibility">
            <div className="grid gap-3 sm:grid-cols-2">
              <Check name="isActive" label="Active Product" hint="Switch off to keep it hidden." />
              <Check name="showInSales" label="Show in Sales Order" hint="Off: it cannot be put on a sales order." />
              <Check name="showInPurchase" label="Show in Purchase Order" hint="Off: it cannot be put on a purchase order." />
              <Check name="lowStockAlert" label="Low Stock Alert" hint="Off: never shown as low stock or in the reorder list." />
            </div>
          </Section>

          <More title="Purchase & reorder (optional)" hint="Used by purchase orders and the reorder list.">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className={lab}>Purchase Source</span>
                <select name="purchaseSource" defaultValue="LOCAL" className={field}><option value="LOCAL">LOCAL (Indian supplier)</option><option value="IMPORT">IMPORT (foreign supplier)</option></select></label>
              <label className="block"><span className={lab}>Import Item Code</span><input name="importItemCode" maxLength={64} className={field} /></label>
              <label className="block"><span className={lab}>Purchase Lead Time (days)</span><input name="leadTimeDays" inputMode="numeric" maxLength={4} className={field} /></label>
              <label className="block"><span className={lab}>Reorder safety factor (empty = 1.5)</span><input name="safetyFactor" inputMode="decimal" maxLength={5} className={field} /></label>
            </div>
            <p className="mt-3 text-xs text-muted">Minimum and maximum stock per warehouse is set on the Stock screen after saving. Opening stock: use Stock In after saving.</p>
          </More>

          <More title="Specifications (optional)" hint="Colour and weight.">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className={lab}>Color</span><input name="color" maxLength={100} className={field} /></label>
              <div><span className={lab}>Net Weight</span>
                <div className="flex gap-2">
                  <input name="netWeight" inputMode="decimal" maxLength={12} aria-label="Net weight" className={field} />
                  <select name="weightUnit" defaultValue="kg" aria-label="Weight unit" className={`${field} !w-20 shrink-0`}><option value="g">g</option><option value="kg">kg</option></select>
                </div></div>
            </div>
          </More>

          <More title="Barcode & remarks (optional)" hint="A manufacturer barcode, or a SETMI one you can print.">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className={lab}>Barcode (from the manufacturer)</span><input name="barcodes" maxLength={64} className={field} /></label>
              <div className="flex items-end"><Check name="generateBarcode" label="Make a SETMI barcode" hint="EAN-13, you can print it later." /></div>
            </div>
            <label className="mt-3 block"><span className={lab}>Remarks</span><textarea name="remarks" rows={2} maxLength={500} className={area} /></label>
          </More>
        </div>

        {/* Preview card, follows the boxes */}
        <aside aria-label="Product preview" className={`${card} h-fit xl:sticky xl:top-20`}>
          <h2 className="text-sm font-semibold">Product Preview</h2>
          <p className="mb-3 text-xs text-muted">How the product looks once saved.</p>
          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-line bg-white">
            {files[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={files[0].url} alt="Main image" className="h-full w-full object-contain" />
            ) : <Package size={56} aria-hidden className="text-muted" />}
          </div>
          <p className="mt-3 break-words text-base font-bold">{name || "Product name"}</p>
          <p className="break-words text-sm text-muted">{preview.code || "Product code"}</p>
          <dl className="mt-3 space-y-1 text-sm">
            {([["Category", preview.category], ["Brand", preview.brand], ["HSN Code", preview.hsn], ["Unit", "PCS"], ["Selling price", preview.price ? `₹${preview.price}` : ""]] as const).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-t border-line pt-1"><dt className="text-muted">{k}</dt><dd className="text-right">{v || "-"}</dd></div>
            ))}
          </dl>
        </aside>
      </div>
    </form>
  );
}
