"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  invoiceId: number;
  companyId: number;
  balanceDue: number;
  currency: string;
  onSuccess: () => void | Promise<void>;
};

type PeriodStatus = "open" | "closed" | "reopened";

export default function RecordPaymentModal({
  invoiceId,
  companyId,
  balanceDue,
  currency,
  onSuccess,
}: Props) {
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState(String(balanceDue));
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [referenceNo, setReferenceNo] = useState("");
  const [notes, setNotes] = useState("");
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [paymentDate, setPaymentDate] = useState(today());
  const [periodStatus, setPeriodStatus] = useState<PeriodStatus>("open");
  const [periodClosedAt, setPeriodClosedAt] = useState<string | null>(null);
  const [checkingPeriod, setCheckingPeriod] = useState(false);

  function resetForm() {
    setAmount(String(balanceDue));
    setPaymentMethod("cash");
    setReferenceNo("");
    setNotes("");
    setSlipFile(null);
    setPaymentDate(today());
    setPeriodStatus("open");
    setPeriodClosedAt(null);
    setError("");
  }

  async function checkPaymentPeriod(
    targetDate: string
  ): Promise<PeriodStatus> {
    if (!companyId || !targetDate) return "open";

    setCheckingPeriod(true);
    setError("");

    try {
      const { data, error: closeError } = await supabase
        .from("accounting_period_closes")
        .select("status, closed_at")
        .eq("company_id", companyId)
        .eq("period_start", firstDayOfDate(targetDate))
        .maybeSingle();

      if (closeError) throw closeError;

      const nextStatus: PeriodStatus =
        data?.status === "closed"
          ? "closed"
          : data?.status === "reopened"
          ? "reopened"
          : "open";

      setPeriodStatus(nextStatus);
      setPeriodClosedAt(data?.closed_at || null);

      return nextStatus;
    } catch (err) {
      setError(
        formatSupabaseError(
          err,
          "Could not check payment accounting period."
        )
      );
      throw err;
    } finally {
      setCheckingPeriod(false);
    }
  }

  async function openModal() {
    resetForm();

    const defaultDate = today();
    setPaymentDate(defaultDate);

    await checkPaymentPeriod(defaultDate);
    setOpen(true);
  }

  async function handleSave() {
    setError("");

    if (checkingPeriod) {
      setError("Please wait while the payment accounting period is checked.");
      return;
    }

    if (periodStatus === "closed") {
      setError(
        "The selected payment date belongs to a closed accounting period. Choose another date or reopen that month."
      );
      return;
    }

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
      /*
        The company comes from the already-loaded invoice, not from a
        non-unique profiles query. This is safer for SaaS/multi-user tenants.
      */
      const latestPeriodStatus =
        await checkPaymentPeriod(paymentDate);

      if (latestPeriodStatus === "closed") {
        throw new Error(
          "The selected payment date belongs to a closed accounting period."
        );
      }

      if (slipFile && requiresProof) {
        const safeExtension = getFileExtension(slipFile.name) || "file";

        slipPath =
          `company-${companyId}/invoice-${invoiceId}/${Date.now()}.${safeExtension}`;

        const { error: uploadError } = await supabase.storage
          .from("payment-slips")
          .upload(slipPath, slipFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: slipFile.type || undefined,
          });

        if (uploadError) throw uploadError;
      }

      const { error: paymentError } = await supabase.rpc(
        "record_invoice_payment",
        {
          p_invoice_id: invoiceId,
          p_payment_date: paymentDate,
          p_amount: paymentAmount,
          p_payment_method: paymentMethod,
          p_reference_no: referenceNo.trim() || null,
          p_slip_path: slipPath,
          p_notes: notes.trim() || null,
        }
      );

      if (paymentError) throw paymentError;

      setOpen(false);
      resetForm();
      await onSuccess();
    } catch (err) {
      console.error("[record-invoice-payment]", err);

      /*
        Storage upload cannot participate in the PostgreSQL transaction.
        If the DB payment fails, remove the just-uploaded proof so we do not
        leave an orphaned file.
      */
      if (slipPath) {
        await supabase.storage
          .from("payment-slips")
          .remove([slipPath]);
      }

      setError(formatSupabaseError(err, "Could not record payment."));
    } finally {
      setSaving(false);
    }
  }

  const requiresProof =
    paymentMethod === "bank_transfer" || paymentMethod === "qr";

  const saveBlocked =
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
                Record Payment
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
                <PeriodNotice
                  tone="closed"
                  title="Selected Payment Period Closed"
                  text={`The payment date ${formatDate(
                    paymentDate
                  )} belongs to a closed accounting period${
                    periodClosedAt
                      ? ` closed on ${formatDateTime(periodClosedAt)}`
                      : ""
                  }. Choose another date or reopen that month before saving the payment.`}
                />
              )}

              {periodStatus === "reopened" && (
                <PeriodNotice
                  tone="reopened"
                  title="Selected Payment Period Reopened"
                  text="This payment date is in a reopened accounting period. Recording the payment is currently allowed."
                />
              )}

              <Field label="Payment Date">
                <input
                  type="date"
                  value={paymentDate}
                  onChange={async (e) => {
                    const nextDate = e.target.value;
                    setPaymentDate(nextDate);
                    await checkPaymentPeriod(nextDate);
                  }}
                  className={inputClass}
                />

                <PeriodHint
                  status={periodStatus}
                  checking={checkingPeriod}
                />
              </Field>

              <Field label="Amount">
                <input
                  type="number"
                  min="0.01"
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
                    const nextMethod = e.target.value;
                    setPaymentMethod(nextMethod);

                    if (
                      nextMethod !== "bank_transfer" &&
                      nextMethod !== "qr"
                    ) {
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
                  placeholder={
                    requiresProof
                      ? "Transaction / transfer reference"
                      : "Optional"
                  }
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

                  <p className="mt-2 text-xs leading-5 text-gray-500">
                    Upload bank transfer slip, QR payment proof, screenshot,
                    JPG, PNG or PDF. Maximum 10 MB.
                  </p>

                  {slipFile && (
                    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                      <div className="text-sm font-medium text-gray-700">
                        {slipFile.name}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        {formatFileSize(slipFile.size)}
                      </div>
                    </div>
                  )}
                </Field>
              )}

              <Field label="Notes">
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={inputClass}
                  placeholder="Optional payment notes..."
                />
              </Field>

              {requiresProof && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-700">
                  Bank Transfer and QR payments require a reference number and
                  payment proof for future verification.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={saveBlocked}
                onClick={handleSave}
                className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {saving
                  ? "Saving..."
                  : checkingPeriod
                  ? "Checking Period..."
                  : periodStatus === "closed"
                  ? "Selected Period Closed"
                  : "Save Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PeriodNotice({
  tone,
  title,
  text,
}: {
  tone: "closed" | "reopened";
  title: string;
  text: string;
}) {
  const classes =
    tone === "closed"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-blue-200 bg-blue-50 text-blue-800";

  return (
    <div className={`rounded-lg border px-4 py-3 ${classes}`}>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs leading-5">{text}</div>
    </div>
  );
}

function PeriodHint({
  status,
  checking,
}: {
  status: PeriodStatus;
  checking: boolean;
}) {
  if (checking) {
    return (
      <p className="mt-2 text-xs text-gray-400">
        Checking accounting period...
      </p>
    );
  }

  if (status === "closed") {
    return (
      <p className="mt-2 text-xs font-medium text-amber-700">
        This payment date is in a closed accounting period.
      </p>
    );
  }

  if (status === "reopened") {
    return (
      <p className="mt-2 text-xs font-medium text-blue-700">
        This payment date is in a reopened accounting period.
      </p>
    );
  }

  return (
    <p className="mt-2 text-xs font-medium text-green-700">
      Accounting period is open.
    </p>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-400";

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

function firstDayOfDate(value: string) {
  return `${String(value || "").slice(0, 7)}-01`;
}

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function getFileExtension(fileName: string) {
  const parts = fileName.split(".");
  return parts.length < 2 ? "" : parts.pop()?.toLowerCase() || "";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatSupabaseError(err: unknown, fallback: string) {
  if (err instanceof Error) {
    return err.message || fallback;
  }

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

    if (parts.length) return parts.join(" • ");
  }

  return fallback;
}

function money(value: number, currency: string) {
  return `${currencySymbol(currency)}${Number(value || 0).toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

function currencySymbol(currency: string) {
  if (currency === "MMK") return "K ";
  if (currency === "USD") return "$";
  if (currency === "EUR") return "€";
  if (currency === "SGD") return "S$";
  return "฿";
}
