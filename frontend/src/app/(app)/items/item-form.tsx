"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CheckCircle2, Loader2, Save, TriangleAlert } from "lucide-react";
import { createItem, updateItem, type FormState } from "./actions";
import { cardClass, inputClass, labelClass, primaryButton, secondaryButton } from "@/lib/ui";

export type CategoryOption = { id: string; name: string };
export type ItemValues = {
  id: string;
  updatedAt: string;
  internalItemCode: string;
  importItemCode: string | null;
  itemName: string;
  sellingItemName: string;
  categoryId: string | null;
  purchaseSource: "LOCAL" | "IMPORT";
  unit: string;
  remarks: string | null;
  sellingPrice: string | null;
  leadTimeDays: string | null;
  safetyFactor: string | null;
  moq: string | null;
  // Optional product details (migration 56); only the edit form shows them.
  subCategory: string | null;
  brand: string | null;
  hsnCode: string | null;
  shortDescription: string | null;
  detailedDescription: string | null;
  productType: string | null;
  material: string | null;
  color: string | null;
  netWeight: string | null;
  weightUnit: string | null;
  dimL: string | null;
  dimW: string | null;
  dimH: string | null;
  dimUnit: string | null;
  countryOfOrigin: string | null;
  modelNo: string | null;
  searchKeywords: string | null;
  shelfLife: string | null;
  tags: string[];
  showInSales: boolean;
  showInPurchase: boolean;
  lowStockAlert: boolean;
};

export type UnitOption = { code: string; name: string };

const hint = "mt-1 text-xs text-muted";

// A card with a heading and a short plain sentence, so a long form reads as a few small steps.
function Section({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) {
  return (
    <section className={`${cardClass} !p-5`}>
      <h2 className="text-base font-semibold">{title}</h2>
      {text && <p className="mt-0.5 text-sm text-muted">{text}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ItemForm({
  item,
  categories,
  units,
  canEditSellingName,
  canEditPrice,
}: {
  item?: ItemValues;
  categories: CategoryOption[];
  units: UnitOption[];
  canEditSellingName: boolean;
  canEditPrice: boolean;
}) {
  const editing = Boolean(item);
  const [state, formAction, pending] = useActionState<FormState, FormData>(editing ? updateItem : createItem, null);
  // After a failed save keep what the person typed (React empties the boxes when the action ends).
  const dv = (name: string, fallback: string | null | undefined) => state?.values?.[name] ?? fallback ?? "";

  // On create, Selling Item Name follows Item Name until the user types in it themselves.
  const [itemName, setItemName] = useState(item?.itemName ?? "");
  const [sellingName, setSellingName] = useState(item?.sellingItemName ?? "");
  const [sellingTouched, setSellingTouched] = useState(editing);

  return (
    <form action={formAction} className="max-w-5xl space-y-5">
      {item && <input type="hidden" name="id" value={item.id} />}
      {item && <input type="hidden" name="expectedUpdatedAt" value={item.updatedAt} />}

      <Section title="Basic details" text="The name, code and unit this product is known by.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="internalItemCode" className={labelClass}>Product Code (SKU) <span className="text-[var(--danger)]" aria-hidden>*</span></label>
            <input id="internalItemCode" name="internalItemCode" required maxLength={120} autoComplete="off" defaultValue={dv("internalItemCode", item?.internalItemCode)} className={inputClass} />
            <p className={hint}>Must be unique. Changing it does not change the old stock history.</p>
          </div>
          <div>
            <label htmlFor="importItemCode" className={labelClass}>Import Item Code</label>
            <input id="importItemCode" name="importItemCode" maxLength={64} autoComplete="off" defaultValue={dv("importItemCode", item?.importItemCode)} className={inputClass} />
            <p className={hint}>The supplier&apos;s own code, only for imported goods.</p>
          </div>
          <div>
            <label htmlFor="itemName" className={labelClass}>Product Name <span className="text-[var(--danger)]" aria-hidden>*</span></label>
            <input id="itemName" name="itemName" required maxLength={200} value={itemName}
              onChange={(e) => {
                setItemName(e.target.value);
                if (!sellingTouched) setSellingName(e.target.value);
              }}
              className={inputClass} />
            <p className={hint}>The name your store team uses.</p>
          </div>
          <div>
            <label htmlFor="sellingItemName" className={labelClass}>Selling Item Name <span className="text-[var(--danger)]" aria-hidden>*</span> (printed on bills)</label>
            <input id="sellingItemName" name="sellingItemName" maxLength={200} value={sellingName}
              disabled={editing && !canEditSellingName}
              onChange={(e) => {
                setSellingName(e.target.value);
                setSellingTouched(true);
              }}
              className={inputClass} />
            {editing && !canEditSellingName && <p className={hint}>You do not have permission to change this name.</p>}
          </div>
          <div>
            <label htmlFor="categoryId" className={labelClass}>Category</label>
            <select id="categoryId" name="categoryId" defaultValue={dv("categoryId", item?.categoryId)} className={inputClass}>
              <option value="">(none)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {categories.length === 0 && <p className={hint}><Link href="/items/categories" className="font-semibold text-[var(--brand-text)] underline">Create a category</Link> to group your products.</p>}
          </div>
          <div>
            <label htmlFor="purchaseSource" className={labelClass}>Purchase Source <span className="text-[var(--danger)]" aria-hidden>*</span></label>
            <select id="purchaseSource" name="purchaseSource" required defaultValue={dv("purchaseSource", item?.purchaseSource ?? "LOCAL")} className={inputClass}>
              <option value="LOCAL">LOCAL (Indian supplier)</option>
              <option value="IMPORT">IMPORT (foreign supplier)</option>
            </select>
          </div>
          <div>
            <label htmlFor="unit" className={labelClass}>Unit <span className="text-[var(--danger)]" aria-hidden>*</span></label>
            <select id="unit" name="unit" required defaultValue={dv("unit", item?.unit ?? "PCS")} className={inputClass}>
              {units.map((u) => (
                <option key={u.code} value={u.code}>{u.code} - {u.name}</option>
              ))}
            </select>
            <p className={hint}>How stock is counted. Metres allow decimals, pieces do not. Cannot be changed once the item has stock.</p>
          </div>
        </div>
      </Section>

      <Section title="Pricing" text="Used when billing is switched on. No tax is calculated.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="sellingPrice" className={labelClass}>Selling price (₹ per unit)</label>
            <input id="sellingPrice" name="sellingPrice" inputMode="decimal" maxLength={11} defaultValue={dv("sellingPrice", item?.sellingPrice)}
              disabled={!canEditPrice} className={inputClass} />
            <p className={hint}>{canEditPrice ? "Leave empty if the item is not billed here." : "You do not have permission to change the price."}</p>
          </div>
        </div>
      </Section>

      <Section title="Reorder planning (optional)" text="Used by the Reorder screen: maximum level = average daily use × lead time × safety factor. Leave empty if you set a maximum by hand.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="leadTimeDays" className={labelClass}>Lead time (days)</label>
            <input id="leadTimeDays" name="leadTimeDays" inputMode="numeric" maxLength={4} defaultValue={dv("leadTimeDays", item?.leadTimeDays)} className={inputClass} />
            <p className={hint}>Days from order to arrival.</p>
          </div>
          <div>
            <label htmlFor="safetyFactor" className={labelClass}>Safety factor</label>
            <input id="safetyFactor" name="safetyFactor" inputMode="decimal" maxLength={5} defaultValue={dv("safetyFactor", item?.safetyFactor)} className={inputClass} />
            <p className={hint}>Empty = 1.5.</p>
          </div>
          <div>
            <label htmlFor="moq" className={labelClass}>MOQ</label>
            <input id="moq" name="moq" inputMode="decimal" maxLength={12} defaultValue={dv("moq", item?.moq)} className={inputClass} />
            <p className={hint}>Minimum order quantity.</p>
          </div>
        </div>
      </Section>

      {item && (
        <Section title="Product details (optional)" text="Extra facts about the product. None of these are needed to sell it.">
          <div className="grid gap-4 sm:grid-cols-3">
            {([
              ["subCategory", "Sub Category", item.subCategory, 100], ["brand", "Brand", item.brand, 100], ["hsnCode", "HSN Code (only stored, no tax)", item.hsnCode, 20],
              ["productType", "Product Type", item.productType, 100], ["material", "Material", item.material, 100], ["color", "Color", item.color, 100],
              ["countryOfOrigin", "Country of Origin", item.countryOfOrigin, 100], ["modelNo", "Model / Part No.", item.modelNo, 100], ["shelfLife", "Shelf Life / Warranty", item.shelfLife, 100],
            ] as const).map(([name, label, value, max]) => (
              <div key={name}>
                <label htmlFor={name} className={labelClass}>{label}</label>
                <input id={name} name={name} maxLength={max} defaultValue={dv(name, value)} className={inputClass} />
              </div>
            ))}
            <div>
              <label htmlFor="netWeight" className={labelClass}>Net Weight</label>
              <div className="flex gap-2">
                <input id="netWeight" name="netWeight" inputMode="decimal" maxLength={12} defaultValue={dv("netWeight", item.netWeight)} className={inputClass} />
                <select name="weightUnit" aria-label="Weight unit" defaultValue={dv("weightUnit", item.weightUnit ?? "kg")} className={`${inputClass} !w-24 shrink-0`}><option value="g">g</option><option value="kg">kg</option></select>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="dimL" className={labelClass}>Dimensions (L × W × H)</label>
              <div className="flex gap-2">
                <input id="dimL" name="dimL" inputMode="decimal" maxLength={12} placeholder="L" defaultValue={dv("dimL", item.dimL)} className={inputClass} />
                <input name="dimW" aria-label="Width" inputMode="decimal" maxLength={12} placeholder="W" defaultValue={dv("dimW", item.dimW)} className={inputClass} />
                <input name="dimH" aria-label="Height" inputMode="decimal" maxLength={12} placeholder="H" defaultValue={dv("dimH", item.dimH)} className={inputClass} />
                <select name="dimUnit" aria-label="Size unit" defaultValue={dv("dimUnit", item.dimUnit ?? "cm")} className={`${inputClass} !w-24 shrink-0`}><option value="mm">mm</option><option value="cm">cm</option><option value="m">m</option><option value="in">in</option></select>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="shortDescription" className={labelClass}>Short Description</label>
              <textarea id="shortDescription" name="shortDescription" rows={2} maxLength={500} defaultValue={dv("shortDescription", item.shortDescription)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="detailedDescription" className={labelClass}>Detailed Description</label>
              <textarea id="detailedDescription" name="detailedDescription" rows={4} maxLength={2000} defaultValue={dv("detailedDescription", item.detailedDescription)} className={inputClass} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="tags" className={labelClass}>Tags</label>
                <input id="tags" name="tags" defaultValue={dv("tags", item.tags.join(", "))} className={inputClass} />
                <p className={hint}>Separate with commas. Up to 20.</p>
              </div>
              <div>
                <label htmlFor="searchKeywords" className={labelClass}>Search Keywords</label>
                <input id="searchKeywords" name="searchKeywords" maxLength={500} defaultValue={dv("searchKeywords", item.searchKeywords)} className={inputClass} />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" name="showInSales" defaultChecked={item.showInSales} className="h-4 w-4 accent-[var(--brand)]" /> Show in Sales Order</label>
              <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" name="showInPurchase" defaultChecked={item.showInPurchase} className="h-4 w-4 accent-[var(--brand)]" /> Show in Purchase Order</label>
              <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" name="lowStockAlert" defaultChecked={item.lowStockAlert} className="h-4 w-4 accent-[var(--brand)]" /> Low Stock Alert</label>
            </div>
          </div>
        </Section>
      )}

      {!editing && (
        <Section title="Barcodes">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="generateBarcode" defaultChecked className="h-4 w-4 accent-[var(--brand)]" /> Generate a SETMI barcode for this item (EAN-13, you can print it)
            </label>
            <label htmlFor="barcodes" className={labelClass}>Manufacturer barcodes you already have (one per line, optional)</label>
            <textarea id="barcodes" name="barcodes" rows={2} defaultValue={dv("barcodes", "")} className={inputClass} />
          </div>
        </Section>
      )}

      <Section title="Remarks">
        <label htmlFor="remarks" className="sr-only">Remarks</label>
        <textarea id="remarks" name="remarks" rows={3} maxLength={2000} defaultValue={dv("remarks", item?.remarks)} placeholder="Anything else your team should know" className={inputClass} />
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />}
          {pending ? "Saving..." : editing ? "Save changes" : "Create item"}
        </button>
        <Link href="/items" className={secondaryButton}>Cancel</Link>
        {state && (
          <p role={state.ok ? "status" : "alert"} className={`inline-flex items-center gap-1.5 text-sm font-medium ${state.ok ? "text-green-700 dark:text-green-400" : "text-[var(--danger)]"}`}>
            {state.ok ? <CheckCircle2 size={16} aria-hidden /> : <TriangleAlert size={16} aria-hidden />} {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
