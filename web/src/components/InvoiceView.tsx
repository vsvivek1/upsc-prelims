"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import { rupees } from "@/lib/i18n";

interface Invoice {
  invoice_no: string;
  issued_at: string;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_gstin: string | null;
  buyer_state: string | null;
  place_of_supply: string | null;
  taxable_minor: number;
  cgst_minor: number;
  sgst_minor: number;
  igst_minor: number;
  total_minor: number;
  payment_ref: string;
  seller: { name: string; address: string; gstin: string; state: string; state_code?: string; email?: string; sac?: string };
  course_id: string;
}

/** GST tax invoice, printable. Readable only by its owner (RLS). */
export function InvoiceView() {
  const { id } = useParams<{ id: string }>();
  const [inv, setInv] = useState<Invoice | null | undefined>(undefined);
  useEffect(() => {
    sb()
      .from("invoices")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setInv((data as Invoice) ?? null));
  }, [id]);
  if (inv === undefined) return <p className="p-6 text-muted">Loading…</p>;
  if (inv === null) return <p className="p-6">Invoice not found. Sign in with the account that paid.</p>;
  const s = inv.seller;
  const rate = inv.igst_minor > 0 ? "IGST 18%" : "CGST 9% + SGST 9%";
  return (
    <main className="mx-auto w-full max-w-3xl bg-white p-6 text-ink print:p-0 sm:p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Tax Invoice</h1>
          <p className="text-sm">Invoice no. <strong>{inv.invoice_no}</strong></p>
          <p className="text-sm">Date: {new Date(inv.issued_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
        </div>
        <button onClick={() => window.print()} className="rounded-full border border-line px-4 py-2 text-sm print:hidden">
          Print / Save PDF
        </button>
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-muted">Supplier</p>
          <p className="font-semibold">{s.name}</p>
          <p className="whitespace-pre-line text-sm">{s.address}</p>
          <p className="text-sm">GSTIN: {s.gstin}</p>
          <p className="text-sm">State: {s.state}{s.state_code ? ` (${s.state_code})` : ""}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted">Bill to</p>
          <p className="font-semibold">{inv.buyer_name || inv.buyer_email}</p>
          {inv.buyer_email && <p className="text-sm">{inv.buyer_email}</p>}
          {inv.buyer_gstin && <p className="text-sm">GSTIN: {inv.buyer_gstin}</p>}
          <p className="text-sm">Place of supply: {inv.place_of_supply ?? inv.buyer_state}</p>
        </div>
      </div>
      <table className="mt-8 w-full text-sm">
        <thead>
          <tr className="border-b border-ink text-left">
            <th className="py-2">Description</th>
            <th className="py-2">SAC</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-line">
            <td className="py-2">Algo UPSC — UPSC Prelims 2027 online course (access until the exam)</td>
            <td className="py-2">{s.sac ?? "999293"}</td>
            <td className="py-2 text-right">{rupees(inv.taxable_minor)}</td>
          </tr>
          {inv.igst_minor > 0 ? (
            <tr><td className="py-1" colSpan={2}>IGST @ 18%</td><td className="py-1 text-right">{rupees(inv.igst_minor)}</td></tr>
          ) : (
            <>
              <tr><td className="py-1" colSpan={2}>CGST @ 9%</td><td className="py-1 text-right">{rupees(inv.cgst_minor)}</td></tr>
              <tr><td className="py-1" colSpan={2}>SGST @ 9%</td><td className="py-1 text-right">{rupees(inv.sgst_minor)}</td></tr>
            </>
          )}
          <tr className="border-t-2 border-ink font-semibold">
            <td className="py-2" colSpan={2}>Total ({rate} included)</td>
            <td className="py-2 text-right">{rupees(inv.total_minor)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-6 text-xs text-muted">Paid online via Razorpay · Payment ref {inv.payment_ref}. Tax is not payable on reverse charge. This is a computer-generated invoice and needs no signature.</p>
    </main>
  );
}
