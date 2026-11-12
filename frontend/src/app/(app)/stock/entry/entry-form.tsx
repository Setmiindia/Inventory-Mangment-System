"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Clock, Loader2, ScanLine, Search, TriangleAlert, X } from "lucide-react";
import { lookupEntryItem, saveStockEntry, searchEntryItems, type EntryItem, type Problem } from "./actions";
import { MIN_SCAN_GAP_MS, beep } from "@/lib/client/beep";
import { parseQuantity } from "@/lib/validation/stock";
import { IN_REASONS, OUT_REASONS, type EntryReason } from "@/lib/validation/stock-entry";
import { cardClass, inputClass, labelClass, primaryButton, secondaryButton } from "@/lib/ui";

type Line = { itemId: string; code: string; name: string; unit: string; decimals: number; quantity: string };
export type EntryLabels = {
  out: string; in: string; reason: string; scan: string; scanHint: string; search: string; searchHint: string; add: string;
  noItems: string; reference: string; referenceHint: string; remarks: string; save: string; saving: string; saved: string;
  remove: string; quantity: string; confirmOut: string; confirmIn: string;
};

// Quick Stock In / Out. Three steps on one screen: in or out, why, what. Then an inline "are you sure" (no browser pop-up) and a
// clear result card with the entry number. `needsApproval`: a staff member's entry waits for a manager, so the words say so.
export function EntryForm({ placeName, reasonLabels, t, needsApproval = false }: { placeName: string; reasonLabels: Record<EntryReason, string>; t: EntryLabels; needsApproval?: boolean }) {
  const router = useRouter();
  const [direction, setDirection] = useState<"OUT" | "IN">("OUT");
  const [reason, setReason] = useState<EntryReason>("SOLD_OUTSIDE");
  const [lines, setLines] = useState<Line[]>([]);
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [found, setFound] = useState<EntryItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<{ entryNo: string; direction: "OUT" | "IN"; pending: boolean } | null>(null);
  const [busy, start] = useTransition();
  const scanRef = useRef<HTMLInputElement>(null);
  const lastScan = useRef(0);
  const searchSeq = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Focus the scan box when the page opens, without scrolling the page down to it.
  useEffect(() => { scanRef.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const reasons = direction === "OUT" ? OUT_REASONS : IN_REASONS;

  function chooseDirection(d: "OUT" | "IN") {
    setDirection(d);
    setReason(d === "OUT" ? "SOLD_OUTSIDE" : "CUSTOMER_RETURN");
    setProblems([]);
    setConfirming(false);
  }

  function addItem(it: EntryItem) {
    setDone(null);
    setConfirming(false);
    setLines((prev) => {
      const i = prev.findIndex((l) => l.itemId === it.id);
      const step = it.decimals === 0 ? 1 : 0; // metres/kg: type the quantity
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = { ...copy[i], quantity: String((parseQuantity(copy[i].quantity) ?? 0) + step) };
        return copy;
      }
      return [{ itemId: it.id, code: it.code, name: it.name, unit: it.unit, decimals: it.decimals, quantity: step ? "1" : "" }, ...prev];
    });
  }

  async function onScan(raw: string) {
    const code = raw.trim();
    if (!code) return;
    const now = Date.now();
    if (now - lastScan.current < MIN_SCAN_GAP_MS) return;
    lastScan.current = now;
    const res = await lookupEntryItem({ code });
    if (res.ok) {
      addItem(res.item);
      setFeedback({ ok: true, text: res.item.code });
      beep(true);
    } else {
      setFeedback({ ok: false, text: res.message });
      beep(false);
    }
    scanRef.current?.focus();
  }

  // Search after a short pause in typing, and ignore an answer that arrives after a newer question.
  function onSearch(value: string) {
    clearTimeout(searchTimer.current);
    const q = value.trim();
    if (q.length < 2) { setFound(null); setSearching(false); return; }
    setSearching(true);
    const seq = ++searchSeq.current;
    searchTimer.current = setTimeout(async () => {
      const r = await searchEntryItems({ q });
      if (seq !== searchSeq.current) return;
      setFound(r);
      setSearching(false);
    }, 250);
  }

  function review() {
    if (lines.length === 0) { setFeedback({ ok: false, text: t.noItems }); return; }
    const bad = lines.filter((l) => !(parseQuantity(l.quantity) ?? 0));
    if (bad.length) { setFeedback({ ok: false, text: `${t.quantity}: ${bad.map((l) => l.code).join(", ")}` }); return; }
    setFeedback(null);
    setConfirming(true);
  }

  function save() {
    const dir = direction;
    start(async () => {
      setProblems([]);
      const r = await saveStockEntry({
        direction, reason, reference, remarks,
        lines: lines.map((l) => ({ itemId: l.itemId, quantity: parseQuantity(l.quantity) ?? 0 })),
      });
      setConfirming(false);
      if (!r.ok) { setFeedback({ ok: false, text: r.message }); setProblems(r.problems ?? []); beep(false); return; }
      setFeedback(null);
      setDone({ entryNo: r.entryNo, direction: dir, pending: needsApproval });
      setLines([]); setReference(""); setRemarks(""); setFound(null);
      router.refresh();
      scanRef.current?.focus();
    });
  }

  const setQty = (id: string, quantity: string) => { setConfirming(false); setLines((p) => p.map((l) => (l.itemId === id ? { ...l, quantity } : l))); };
  const isOut = direction === "OUT";
  const total = lines.reduce((a, l) => a + (parseQuantity(l.quantity) ?? 0), 0);

  return (
    <div className="space-y-5">
      {done && (
        <div role="status" className={`flex items-start gap-3 rounded-xl border p-4 ${done.pending ? "border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200" : "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-200"}`}>
          {done.pending ? <Clock size={22} className="mt-0.5 shrink-0" aria-hidden /> : <CheckCircle2 size={22} className="mt-0.5 shrink-0" aria-hidden />}
          <div>
            <p className="font-semibold">{t.saved}: {done.entryNo}</p>
            <p className="text-sm">{done.pending ? "It is waiting for a manager. The stock changes only after it is approved." : done.direction === "OUT" ? "The stock is taken out now." : "The stock is added now."} You can make the next entry below.</p>
          </div>
        </div>
      )}

      {/* Step 1: in or out, as two big buttons. */}
      <div>
        <p className={labelClass}>1. {t.in} / {t.out}?</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => chooseDirection("OUT")} aria-pressed={isOut}
            className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 p-4 text-lg font-semibold transition ${isOut ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "border-line bg-surface hover:bg-surface-muted"}`}>
            <ArrowUpFromLine size={22} aria-hidden /> {t.out}
          </button>
          <button type="button" onClick={() => chooseDirection("IN")} aria-pressed={!isOut}
            className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 p-4 text-lg font-semibold transition ${!isOut ? "border-green-600 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300" : "border-line bg-surface hover:bg-surface-muted"}`}>
            <ArrowDownToLine size={22} aria-hidden /> {t.in}
          </button>
        </div>
      </div>

      {/* Step 2: why. */}
      <div>
        <p className={labelClass}>2. {t.reason} <span className="font-normal text-muted">· {placeName}</span></p>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t.reason}>
          {reasons.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={reason === r} onClick={() => { setReason(r); setConfirming(false); }}
              className={`min-h-10 rounded-full border px-4 py-1.5 text-sm font-medium transition ${reason === r ? "border-brand bg-brand text-white" : "border-line bg-surface hover:bg-surface-muted"}`}>
              {reasonLabels[r]}
            </button>
          ))}
        </div>
        {!isOut && (
          <p className="mt-2 text-xs text-muted">
            Putting in stock for the first time (opening stock)? Do not use this screen: use <Link href="/stock/scan" className="font-semibold text-[var(--brand-text)] underline">Scan count</Link>, which records it as opening stock.
          </p>
        )}
      </div>

      {/* Step 3: what. */}
      <div className={`${cardClass} space-y-4 !p-5`}>
        <p className={labelClass}>3. What?</p>
        <div>
          <label htmlFor="scan" className="flex items-center gap-2 text-sm font-medium"><ScanLine size={16} aria-hidden /> {t.scan}</label>
          <input id="scan" ref={scanRef} autoComplete="off" inputMode="none" placeholder="Scan here" className={`${inputClass} font-mono`}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); const el = e.currentTarget; const v = el.value; el.value = ""; void onScan(v); }
            }} />
          <p role="status" className={`mt-1 min-h-5 text-sm ${feedback && problems.length === 0 ? (feedback.ok ? "text-green-700 dark:text-green-400" : "text-[var(--danger)]") : "text-muted"}`}>
            {feedback && problems.length === 0 ? feedback.text : t.scanHint}
          </p>
        </div>
        <div>
          <label htmlFor="find" className="flex items-center gap-2 text-sm font-medium"><Search size={16} aria-hidden /> {t.search}</label>
          <div className="relative">
            <input id="find" autoComplete="off" placeholder={t.searchHint} className={inputClass} onChange={(e) => onSearch(e.target.value)} />
            {searching && <Loader2 size={16} className="absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 animate-spin text-muted" aria-hidden />}
          </div>
          {found !== null && found.length === 0 && !searching && <p className="mt-1 text-sm text-muted">No product matches. Check the spelling, or the product may be archived.</p>}
          {found && found.length > 0 && (
            <ul className="mt-1 divide-y divide-line rounded-lg border border-line text-sm">
              {found.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0"><span className="font-medium">{it.code}</span> <span className="text-muted">{it.name}</span></span>
                  <button type="button" className={secondaryButton} onClick={() => { addItem(it); setFound(null); }}>{t.add}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {lines.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--line-strong)] p-4 text-center text-sm text-muted">{t.noItems}</p>
      ) : (
        <ul className="space-y-2">
          {lines.map((l) => (
            <li key={l.itemId} className={`${cardClass} flex items-center gap-3 !p-3`}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{l.code}</span>
                <span className="block truncate text-xs text-muted">{l.name}</span>
              </span>
              <input value={l.quantity} inputMode="decimal" aria-label={`${t.quantity} ${l.code}`} onChange={(e) => setQty(l.itemId, e.target.value)}
                className={`w-24 rounded-lg border bg-surface px-2 py-2 text-right font-mono text-base ${l.quantity !== "" && parseQuantity(l.quantity) === null ? "border-red-500" : "border-line"}`} />
              <span className="w-10 text-sm text-muted">{l.unit}</span>
              <button type="button" aria-label={`${t.remove} ${l.code}`} onClick={() => { setConfirming(false); setLines((p) => p.filter((x) => x.itemId !== l.itemId)); }}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-surface-muted"><X size={18} aria-hidden /></button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="reference" className={labelClass}>{t.reference}</label>
          <input id="reference" value={reference} maxLength={60} onChange={(e) => setReference(e.target.value)} placeholder={t.referenceHint} className={inputClass} />
        </div>
        <div>
          <label htmlFor="remarks" className={labelClass}>{t.remarks}</label>
          <input id="remarks" value={remarks} maxLength={500} onChange={(e) => setRemarks(e.target.value)} className={inputClass} />
        </div>
      </div>

      {problems.length > 0 && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          <p className="flex items-center gap-2 font-semibold"><TriangleAlert size={16} aria-hidden /> {feedback?.text ?? "Nothing was saved."}</p>
          <ul className="mt-1 list-inside list-disc">{problems.map((p, i) => <li key={i}>{p.code}: {p.message}</li>)}</ul>
          <p className="mt-1 text-xs">Change the quantity above and save again.</p>
        </div>
      )}
      {feedback && !feedback.ok && lines.length === 0 && problems.length === 0 && (
        <p role="alert" className="flex items-center gap-2 text-sm font-medium text-[var(--danger)]"><TriangleAlert size={16} aria-hidden /> {feedback.text}</p>
      )}

      {confirming ? (
        <div role="alertdialog" aria-label="Confirm" className={`rounded-xl border-2 p-4 ${isOut ? "border-red-500 bg-red-50 dark:bg-red-950/30" : "border-green-600 bg-green-50 dark:bg-green-950/30"}`}>
          <p className="font-semibold">{needsApproval ? "Send this for approval?" : isOut ? t.confirmOut : t.confirmIn}</p>
          <p className="mt-0.5 text-sm text-muted">{lines.length} {lines.length === 1 ? "product" : "products"}, {total.toLocaleString("en-IN", { maximumFractionDigits: 3 })} in all · {reasonLabels[reason]}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={save} className={`${primaryButton} min-w-32`}>
              {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <CheckCircle2 size={16} aria-hidden />} {busy ? t.saving : "Yes, save"}
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming(false)} className={secondaryButton}>Go back</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={review} className={`${primaryButton} w-full py-3 text-base sm:w-auto`}>
          <CheckCircle2 size={18} aria-hidden /> {t.save}
        </button>
      )}
    </div>
  );
}
