"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ReturnRow = {
  id: number;
  return_no: string;
  return_date: string;
  invoice_id: number;
  sales_order_id: number;
  customer_id: number;
  currency: string;
  total_amount: number;
  reason: string | null;
};

type Item = {
  id: number;
  description: string;
  return_qty: number;
  unit_price: number;
  credit_amount: number;
  unit_cost: number;
  cogs_reversal: number;
  product_id: number | null;
};

type CreditNote = {
  id: number;
  credit_note_no: string;
  credit_date: string;
  status: string;
  amount: number;
  refund_due: number;
  refunded_amount: number;
  balance_due: number;
};

type Refund = {
  id: number;
  refund_no: string;
  refund_date: string;
  amount: number;
  refund_method: string;
  reference_no: string | null;
};

export default function SalesReturnDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [row, setRow] = useState<ReturnRow | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [credit, setCredit] = useState<CreditNote | null>(null);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState("cash");
  const [referenceNo, setReferenceNo] = useState("");
  const [refundDate, setRefundDate] = useState(today());
  const [notes, setNotes] = useState("");

  useEffect(() => {
    void loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const returnId = Number(id);

      const { data: returnData, error: returnError } = await supabase
        .from("sales_returns")
        .select(`
          id,
          return_no,
          return_date,
          invoice_id,
          sales_order_id,
          customer_id,
          currency,
          total_amount,
          reason
        `)
        .eq("id", returnId)
        .maybeSingle();

      if (returnError) throw returnError;
      if (!returnData) throw new Error("Sales Return not found.");

      const normalized: ReturnRow = {
        ...returnData,
        id: Number(returnData.id),
        invoice_id: Number(returnData.invoice_id),
        sales_order_id: Number(returnData.sales_order_id),
        customer_id: Number(returnData.customer_id),
        total_amount: Number(returnData.total_amount || 0),
      };

      setRow(normalized);

      const [itemsResult, creditResult] = await Promise.all([
        supabase
          .from("sales_return_items")
          .select(`
            id,
            description,
            return_qty,
            unit_price,
            credit_amount,
            unit_cost,
            cogs_reversal,
            product_id
          `)
          .eq("sales_return_id", returnId)
          .order("id", { ascending: true }),

        supabase
          .from("credit_notes")
          .select(`
            id,
            credit_note_no,
            credit_date,
            status,
            amount,
            refund_due,
            refunded_amount,
            balance_due
          `)
          .eq("sales_return_id", returnId)
          .maybeSingle(),
      ]);

      if (itemsResult.error) throw itemsResult.error;
      if (creditResult.error) throw creditResult.error;

      setItems(
        (itemsResult.data || []).map((item: any) => ({
          ...item,
          id: Number(item.id),
          return_qty: Number(item.return_qty || 0),
          unit_price: Number(item.unit_price || 0),
          credit_amount: Number(item.credit_amount || 0),
          unit_cost: Number(item.unit_cost || 0),
          cogs_reversal: Number(item.cogs_reversal || 0),
          product_id: item.product_id ? Number(item.product_id) : null,
        }))
      );

      const note = creditResult.data
        ? {
            ...creditResult.data,
            id: Number(creditResult.data.id),
            amount: Number(creditResult.data.amount || 0),
            refund_due: Number(creditResult.data.refund_due || 0),
            refunded_amount: Number(creditResult.data.refunded_amount || 0),
            balance_due: Number(creditResult.data.balance_due || 0),
          }
        : null;

      setCredit(note);

      if (note) {
        setRefundAmount(String(note.balance_due || 0));

        const { data: refundData, error: refundError } = await supabase
          .from("customer_refunds")
          .select(`
            id,
            refund_no,
            refund_date,
            amount,
            refund_method,
            reference_no
          `)
          .eq("credit_note_id", note.id)
          .order("refund_date", { ascending: false })
          .order("id", { ascending: false });

        if (refundError) throw refundError;

        setRefunds(
          (refundData || []).map((refund: any) => ({
            ...refund,
            id: Number(refund.id),
            amount: Number(refund.amount || 0),
          }))
        );
      }
    } catch (err) {
      setError(formatError(err, "Could not load Sales Return."));
    } finally {
      setLoading(false);
    }
  }

  async function recordRefund() {
    if (!credit || saving) return;

    const amount = Number(refundAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Refund amount must be greater than 0.");
      return;
    }

    if (amount > credit.balance_due) {
      setError("Refund amount cannot exceed refundable balance.");
      return;
    }

    if ((refundMethod === "bank_transfer" || refundMethod === "qr") && !referenceNo.trim()) {
      setError("Reference No. is required for Bank Transfer or QR refund.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { data, error } = await supabase.rpc("record_customer_refund", {
        p_credit_note_id: credit.id,
        p_refund_date: refundDate,
        p_amount: amount,
        p_refund_method: refundMethod,
        p_reference_no: referenceNo.trim() || null,
        p_slip_path: null,
        p_notes: notes.trim() || null,
      });

      if (error) throw error;

      const result = data && typeof data === "object"
        ? (data as Record<string, unknown>)
        : {};

      setSuccess(
        typeof result.refund_no === "string"
          ? `Refund ${result.refund_no} recorded successfully.`
          : "Customer refund recorded successfully."
      );

      setReferenceNo("");
      setNotes("");
      await loadData();
      router.refresh();
    } catch (err) {
      setError(formatError(err, "Could not record customer refund."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-gray-500">Loading Sales Return...</div>;
  }

  if (!row) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error || "Sales Return not found."}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {row.return_no}
            </h1>
            <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
              Processed
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Sales Return #{row.id} • {formatDate(row.return_date)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.push(`/invoices/${row.invoice_id}`)}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
          >
            View Invoice
          </button>
          <button
            type="button"
            onClick={() => router.push("/sales-returns")}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
          >
            Back
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card label="Return Credit" value={money(row.total_amount, row.currency)} />
        <Card label="Credit Note" value={credit?.credit_note_no || "-"} />
        <Card
          label="Refunded"
          value={money(credit?.refunded_amount || 0, row.currency)}
        />
        <Card
          label="Refund Due"
          value={money(credit?.balance_due || 0, row.currency)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section title="Returned Items">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <Header>Description</Header>
                    <Header right>Qty</Header>
                    <Header right>Credit</Header>
                    <Header right>Cost Restore</Header>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-4 text-sm font-medium text-gray-900">
                        {item.description}
                      </td>
                      <td className="px-5 py-4 text-right text-sm">
                        {formatQty(item.return_qty)}
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-semibold">
                        {money(item.credit_amount, row.currency)}
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-gray-600">
                        {money(item.cogs_reversal, row.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Refund History">
            {refunds.length === 0 ? (
              <div className="rounded-lg bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                No customer refund recorded.
              </div>
            ) : (
              <div className="space-y-3">
                {refunds.map((refund) => (
                  <div
                    key={refund.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-4"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{refund.refund_no}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {formatDate(refund.refund_date)} • {labelize(refund.refund_method)}
                      </div>
                    </div>
                    <div className="font-semibold text-gray-900">
                      {money(refund.amount, row.currency)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Credit Note">
            {credit ? (
              <div className="space-y-4">
                <InfoRow label="Credit Note" value={credit.credit_note_no} />
                <InfoRow label="Date" value={formatDate(credit.credit_date)} />
                <InfoRow label="Status" value={labelize(credit.status)} />
                <InfoRow label="Amount" value={money(credit.amount, row.currency)} />
                <InfoRow label="Refund Due" value={money(credit.balance_due, row.currency)} />
              </div>
            ) : (
              <p className="text-sm text-gray-500">Credit Note not found.</p>
            )}
          </Section>

          {credit && credit.balance_due > 0 && (
            <Section title="Record Refund">
              <div className="space-y-4">
                <Field label="Refund Date">
                  <input
                    type="date"
                    value={refundDate}
                    onChange={(event) => setRefundDate(event.target.value)}
                    className={inputClass}
                  />
                </Field>

                <Field label="Amount">
                  <input
                    type="number"
                    min="0.01"
                    max={credit.balance_due}
                    step="0.01"
                    value={refundAmount}
                    onChange={(event) => setRefundAmount(event.target.value)}
                    className={inputClass}
                  />
                </Field>

                <Field label="Method">
                  <select
                    value={refundMethod}
                    onChange={(event) => setRefundMethod(event.target.value)}
                    className={inputClass}
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="qr">QR / PromptPay</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>
                </Field>

                <Field label={refundMethod === "bank_transfer" || refundMethod === "qr" ? "Reference No. *" : "Reference No."}>
                  <input
                    value={referenceNo}
                    onChange={(event) => setReferenceNo(event.target.value)}
                    className={inputClass}
                  />
                </Field>

                <Field label="Notes">
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className={inputClass}
                  />
                </Field>

                <button
                  type="button"
                  disabled={saving}
                  onClick={recordRefund}
                  className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-gray-300"
                >
                  {saving ? "Saving..." : "Record Refund"}
                </button>
              </div>
            </Section>
          )}

          {credit && credit.balance_due <= 0 && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-sm font-medium text-green-700">
              ✓ Credit Note settled. No refund remains.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function Header({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-gray-700">{label}</div>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400";

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function labelize(value: string) {
  return String(value || "-").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  const parts = String(value || "").split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value || "-";
}

function formatQty(value: number) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function money(value: number, currency: string) {
  if (currency === "MMK") {
    return `K ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }

  const symbol = currency === "USD" ? "$" : currency === "SGD" ? "S$" : currency === "EUR" ? "€" : "฿";
  return `${symbol}${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatError(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message || fallback;

  if (err && typeof err === "object") {
    const value = err as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [
      typeof value.message === "string" ? value.message : "",
      typeof value.details === "string" && value.details ? `Details: ${value.details}` : "",
      typeof value.hint === "string" && value.hint ? `Hint: ${value.hint}` : "",
      typeof value.code === "string" && value.code ? `Code: ${value.code}` : "",
    ].filter(Boolean);
    if (parts.length) return parts.join(" • ");
  }

  return fallback;
}
