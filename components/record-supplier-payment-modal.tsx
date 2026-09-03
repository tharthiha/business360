"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  supplierBillId: number;
  companyId: number;
  balanceDue: number;
  currency: string;
  onSuccess: () => void | Promise<void>;
};

type PeriodStatus = "open" | "closed" | "reopened";

export default function RecordSupplierPaymentModal({
  supplierBillId,
  companyId,
  balanceDue,
  currency,
  onSuccess,
}: Props) {
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingPeriod, setCheckingPeriod] = useState(false);
  const [error, setError] = useState("");

  const [amount, setAmount] = useState(String(balanceDue));
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [slipFile, setSlipFile] = useState<File | null>(null);

  const [periodStatus, setPeriodStatus] =
    useState<PeriodStatus>("open");
  const [periodClosedAt, setPeriodClosedAt] =
    useState<string | null>(null);

  function resetForm() {
    setAmount(String(balanceDue));
    setPaymentDate(today());
    setPaymentMethod("cash");
    setReferenceNo("");
    setNotes("");
    setSlipFile(null);
    setPeriodStatus("open");
    setPeriodClosedAt(null);
    setError("");
  }

  async function checkPeriod(date: string): Promise<PeriodStatus> {
    setCheckingPeriod(true);

    try {
      const { data, error } = await supabase
        .from("accounting_period_closes")
        .select("status, closed_at")
        .eq("company_id", companyId)
        .eq("period_start", firstDayOfDate(date))
        .maybeSingle();

      if (error) throw error;

      const status: PeriodStatus =
        data?.status === "closed"
          ? "closed"
          : data?.status === "reopened"
          ? "reopened"
          : "open";

      setPeriodStatus(status);
      setPeriodClosedAt(data?.closed_at || null);

      return status;
    } finally {
      setCheckingPeriod(false);
    }
  }

  async function openModal() {
    resetForm();
    const date = today();
    setPaymentDate(date);

    try {
      await checkPeriod(date);
      setOpen(true);
    } catch (err) {
      setError(
        formatSupabaseError(err, "Could not check accounting period.")
      );
    }
  }

  async function savePayment() {
    setError("");

    const paymentAmount = Number(amount);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      setError("Payment amount must be greater than 0.");
      return;
    }

    if (paymentAmount > balanceDue) {
      setError("Payment amount cannot be greater than balance due.");
      return;
    }

    const requiresProof =
      paymentMethod === "bank_transfer" || paymentMethod === "qr";

    if (requiresProof && !referenceNo.trim()) {
      setError(
        "Reference No. is required for Bank Transfer or QR payment."
      );
      return;
    }

    if (requiresProof && !slipFile) {
      setError("Please upload a payment slip or proof.");
      return;
    }

    if (slipFile && slipFile.size > 10 * 1024 * 1024) {
      setError("Slip file must be 10 MB or smaller.");
      return;
    }

    setSaving(true);
    let slipPath: string | null = null;

    try {
      const latestPeriod = await checkPeriod(paymentDate);

      if (latestPeriod === "closed") {
        throw new Error(
          "The selected payment date belongs to a closed accounting period."
        );
      }

      if (slipFile && requiresProof) {
        const extension = getExtension(slipFile.name) || "file";

        slipPath =
          `company-${companyId}/supplier-bill-${supplierBillId}/${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("payment-slips")
          .upload(slipPath, slipFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: slipFile.type || undefined,
          });

        if (uploadError) throw uploadError;
      }

      const { error: rpcError } = await supabase.rpc(
        "record_supplier_bill_payment",
        {
          p_supplier_bill_id: supplierBillId,
          p_payment_date: paymentDate,
          p_amount: paymentAmount,
          p_payment_method: paymentMethod,
          p_reference_no: referenceNo.trim() || null,
          p_slip_path: slipPath,
          p_notes: notes.trim() || null,
        }
      );

      if (rpcError) throw rpcError;

      setOpen(false);
      resetForm();
      await onSuccess();
    } catch (err) {
      console.error("[supplier-payment]", err);

      if (slipPath) {
        await supabase.storage
          .from("payment-slips")
          .remove([slipPath]);
      }

      setError(
        formatSupabaseError(err, "Could not record supplier payment.")
      );
    } finally {
      setSaving(false);
    }
  }

  const requiresProof =
    paymentMethod === "bank_transfer" || paymentMethod === "qr";

  const blocked =
    saving || checkingPeriod || periodStatus === "closed";

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
      >
        Record Payment
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Record Supplier Payment
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Balance due: {money(balanceDue, currency)}
              </p>
            </div>

            <div className="space-y-5 p-6">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {periodStatus === "closed" && (
                <Notice
                  tone="closed"
                  title="Selected Payment Period Closed"
                  text={`The payment date ${formatDate(
                    paymentDate
                  )} belongs to a closed accounting period${
                    periodClosedAt
                      ? ` closed on ${formatDateTime(periodClosedAt)}`
                      : ""
                  }.`}
                />
              )}

              {periodStatus === "reopened" && (
                <Notice
                  tone="reopened"
                  title="Selected Payment Period Reopened"
                  text="Recording supplier payment is currently allowed."
                />
              )}

              <Field label="Payment Date">
                <input
                  type="date"
                  value={paymentDate}
                  onChange={async (e) => {
                    const value = e.target.value;
                    setPaymentDate(value);

                    try {
                      await checkPeriod(value);
                    } catch (err) {
                      setError(
                        formatSupabaseError(
                          err,
                          "Could not check accounting period."
                        )
                      );
                    }
                  }}
                  className={inputClass}
                />
              </Field>

              <Field label="Amount">
                <input
                  type="number"
                  min="0.01"
                  max={balanceDue}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="Payment Method">
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPaymentMethod(value);

                    if (value !== "bank_transfer" && value !== "qr") {
                      setSlipFile(null);
                    }
                  }}
                  className={inputClass}
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="qr">QR / PromptPay</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </Field>

              <Field
                label={requiresProof ? "Reference No. *" : "Reference No."}
              >
                <input
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  className={inputClass}
                  placeholder={requiresProof ? "Transaction reference" : "Optional"}
                />
              </Field>

              {requiresProof && (
                <Field label="Payment Slip / Proof *">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) =>
                      setSlipFile(e.target.files?.[0] || null)
                    }
                    className={inputClass}
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    JPG, PNG or PDF • Maximum 10 MB
                  </p>
                </Field>
              )}

              <Field label="Notes">
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={inputClass}
                  placeholder="Optional supplier payment notes..."
                />
              </Field>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={blocked}
                onClick={savePayment}
                className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {saving
                  ? "Saving..."
                  : checkingPeriod
                  ? "Checking Period..."
                  : periodStatus === "closed"
                  ? "Period Closed"
                  : "Save Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Notice({
  tone,
  title,
  text,
}: {
  tone: "closed" | "reopened";
  title: string;
  text: string;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        tone === "closed"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-blue-200 bg-blue-50 text-blue-800"
      }`}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs leading-5">{text}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-gray-700">{label}</div>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400";

function firstDayOfDate(value: string) {
  return `${String(value || "").slice(0, 7)}-01`;
}

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDate(value: string) {
  const parts = String(value || "").split("-");
  return parts.length === 3
    ? `${parts[2]}/${parts[1]}/${parts[0]}`
    : value || "-";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function getExtension(name: string) {
  const parts = name.split(".");
  return parts.length < 2 ? "" : parts.pop()?.toLowerCase() || "";
}

function formatSupabaseError(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message || fallback;

  if (err && typeof err === "object") {
    const value = err as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };

    const parts = [
      typeof value.message === "string" ? value.message : "",
      typeof value.details === "string" && value.details
        ? `Details: ${value.details}`
        : "",
      typeof value.hint === "string" && value.hint
        ? `Hint: ${value.hint}`
        : "",
      typeof value.code === "string" && value.code
        ? `Code: ${value.code}`
        : "",
    ].filter(Boolean);

    return parts.length ? parts.join(" • ") : fallback;
  }

  return fallback;
}

function money(value: number, currency: string) {
  if (currency === "MMK") {
    return `K ${Number(value || 0).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })}`;
  }

  const symbol =
    currency === "USD"
      ? "$"
      : currency === "SGD"
      ? "S$"
      : currency === "EUR"
      ? "€"
      : "฿";

  return `${symbol}${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
