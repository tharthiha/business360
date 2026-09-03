"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Invoice = {
  id: number;
  invoice_no: string;
  invoice_date: string;
  customer_id: number;
  sales_order_id: number | null;
  currency: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  status: string;
};

type InvoiceItem = {
  id: number;
  product_id: number | null;
  description: string;
  qty: number;
  unit_price: number;
  line_total: number;
};

export default function NewSalesReturnPage() {
  const router = useRouter();
  const supabase = createClient();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [returnQty, setReturnQty] = useState<Record<number, string>>({});
  const [returnDate, setReturnDate] = useState(today());
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef<string | null>(null);

  useEffect(() => {
    void loadInvoices();
  }, []);

  async function loadInvoices() {
    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          id,
          invoice_no,
          invoice_date,
          customer_id,
          sales_order_id,
          currency,
          total_amount,
          paid_amount,
          balance_due,
          status
        `)
        .not("sales_order_id", "is", null)
        .order("invoice_date", { ascending: false })
        .order("id", { ascending: false })
        .limit(100);

      if (error) throw error;

      setInvoices(
        (data || []).map((row: any) => ({
          ...row,
          id: Number(row.id),
          customer_id: Number(row.customer_id),
          sales_order_id: row.sales_order_id ? Number(row.sales_order_id) : null,
          total_amount: Number(row.total_amount || 0),
          paid_amount: Number(row.paid_amount || 0),
          balance_due: Number(row.balance_due || 0),
        }))
      );
    } catch (err) {
      setError(formatError(err, "Could not load invoices."));
    } finally {
      setLoading(false);
    }
  }

  async function selectInvoice(value: string) {
    setInvoiceId(value);
    setItems([]);
    setReturnQty({});
    requestIdRef.current = null;
    setError("");

    if (!value) return;

    setLoadingItems(true);

    try {
      const { data, error } = await supabase
        .from("invoice_items")
        .select(`
          id,
          product_id,
          description,
          qty,
          unit_price,
          line_total
        `)
        .eq("invoice_id", Number(value))
        .order("sort_order", { ascending: true });

      if (error) throw error;

      const normalized = (data || []).map((row: any) => ({
        id: Number(row.id),
        product_id: row.product_id ? Number(row.product_id) : null,
        description: row.description,
        qty: Number(row.qty || 0),
        unit_price: Number(row.unit_price || 0),
        line_total: Number(row.line_total || 0),
      }));

      setItems(normalized);

      const defaults: Record<number, string> = {};
      normalized.forEach((item) => {
        defaults[item.id] = "0";
      });
      setReturnQty(defaults);
    } catch (err) {
      setError(formatError(err, "Could not load invoice items."));
    } finally {
      setLoadingItems(false);
    }
  }

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === Number(invoiceId)) || null,
    [invoices, invoiceId]
  );

  const previewTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = Number(returnQty[item.id] || 0);
      if (!Number.isFinite(qty) || qty <= 0 || item.qty <= 0) return sum;
      return sum + (item.line_total * qty) / item.qty;
    }, 0);
  }, [items, returnQty]);

  async function processReturn() {
    if (!selectedInvoice || saving) return;

    const rows = items
      .map((item) => ({
        invoice_item_id: item.id,
        return_qty: Number(returnQty[item.id] || 0),
      }))
      .filter((row) => Number.isFinite(row.return_qty) && row.return_qty > 0);

    if (rows.length === 0) {
      setError("Enter at least one quantity to return.");
      return;
    }

    for (const row of rows) {
      const item = items.find((value) => value.id === row.invoice_item_id);
      if (!item || row.return_qty > item.qty) {
        setError("Return quantity cannot exceed the sold quantity.");
        return;
      }
    }

    if (!window.confirm("Process this Sales Return now?\n\nStock will be restored and a Credit Note will be created in one transaction.")) {
      return;
    }

    const requestId = requestIdRef.current || crypto.randomUUID();
    requestIdRef.current = requestId;

    setSaving(true);
    setError("");

    try {
      const { data, error } = await supabase.rpc("process_sales_return", {
        p_invoice_id: selectedInvoice.id,
        p_return_date: returnDate,
        p_items: rows,
        p_reason: reason.trim() || null,
        p_request_id: requestId,
      });

      if (error) throw error;

      const result = data && typeof data === "object"
        ? (data as Record<string, unknown>)
        : {};

      const returnId = Number(result.sales_return_id || 0);
      if (!returnId) throw new Error("Sales Return ID was not returned.");

      requestIdRef.current = null;
      router.push(`/sales-returns/${returnId}`);
      router.refresh();
    } catch (err) {
      setError(formatError(err, "Could not process Sales Return."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            New Sales Return
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Return goods, restore stock and create the Credit Note in one step.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/sales-returns")}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
        >
          Back
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section title="Invoice">
            <label className="block">
              <div className="mb-2 text-sm font-medium text-gray-700">
                Select Invoice
              </div>
              <select
                value={invoiceId}
                disabled={loading}
                onChange={(event) => void selectInvoice(event.target.value)}
                className={inputClass}
              >
                <option value="">Select an invoice...</option>
                {invoices.map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_no} • {formatDate(invoice.invoice_date)} • {money(invoice.total_amount, invoice.currency)}
                  </option>
                ))}
              </select>
            </label>
          </Section>

          {selectedInvoice && (
            <Section title="Return Items">
              {loadingItems ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  Loading invoice items...
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-4 rounded-lg border border-gray-200 p-4 md:grid-cols-[1fr_120px_140px]"
                    >
                      <div>
                        <div className="font-medium text-gray-900">
                          {item.description}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          Sold {formatQty(item.qty)} • Line {money(item.line_total, selectedInvoice.currency)}
                        </div>
                      </div>

                      <label>
                        <div className="mb-1 text-xs text-gray-500">
                          Return Qty
                        </div>
                        <input
                          type="number"
                          min="0"
                          max={item.qty}
                          step="0.001"
                          value={returnQty[item.id] || "0"}
                          onChange={(event) => {
                            requestIdRef.current = null;
                            setReturnQty((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }));
                          }}
                          className={inputClass}
                        />
                      </label>

                      <div className="text-right">
                        <div className="text-xs text-gray-500">Credit Preview</div>
                        <div className="mt-2 font-semibold text-gray-900">
                          {money(
                            item.qty > 0
                              ? (item.line_total * Number(returnQty[item.id] || 0)) / item.qty
                              : 0,
                            selectedInvoice.currency
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}
        </div>

        <div className="space-y-6">
          <Section title="Return Details">
            <div className="space-y-4">
              <label className="block">
                <div className="mb-2 text-sm font-medium text-gray-700">
                  Return Date
                </div>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(event) => {
                    requestIdRef.current = null;
                    setReturnDate(event.target.value);
                  }}
                  className={inputClass}
                />
              </label>

              <label className="block">
                <div className="mb-2 text-sm font-medium text-gray-700">
                  Reason
                </div>
                <textarea
                  rows={4}
                  value={reason}
                  onChange={(event) => {
                    requestIdRef.current = null;
                    setReason(event.target.value);
                  }}
                  placeholder="Why is the customer returning these goods?"
                  className={inputClass}
                />
              </label>
            </div>
          </Section>

          {selectedInvoice && (
            <Section title="Credit Note Preview">
              <div className="space-y-4">
                <InfoRow
                  label="Invoice"
                  value={selectedInvoice.invoice_no}
                />
                <InfoRow
                  label="Credit Amount"
                  value={money(previewTotal, selectedInvoice.currency)}
                />
                <InfoRow
                  label="Paid on Invoice"
                  value={money(selectedInvoice.paid_amount, selectedInvoice.currency)}
                />
              </div>

              <button
                type="button"
                disabled={saving || previewTotal <= 0}
                onClick={processReturn}
                className="mt-5 w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {saving ? "Processing..." : "Process Return"}
              </button>
            </Section>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400";

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
