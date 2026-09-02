"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  invoiceId: number;
  customerId: number;
  balanceDue: number;
  currency: string;
  onSuccess: () => void;
};

type PeriodStatus =
  | "open"
  | "closed"
  | "reopened";

export default function RecordPaymentModal({
  invoiceId,
  customerId,
  balanceDue,
  currency,
  onSuccess,
}: Props) {
  const supabase = createClient();

  const [open, setOpen] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [amount, setAmount] =
    useState(
      String(balanceDue)
    );

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState("cash");

  const [
    referenceNo,
    setReferenceNo,
  ] = useState("");

  const [notes, setNotes] =
    useState("");

  const [
    slipFile,
    setSlipFile,
  ] = useState<File | null>(
    null
  );

  const [
    paymentDate,
    setPaymentDate,
  ] = useState(today());

  const [
    companyId,
    setCompanyId,
  ] = useState<number | null>(
    null
  );

  const [
    periodStatus,
    setPeriodStatus,
  ] = useState<PeriodStatus>(
    "open"
  );

  const [
    periodClosedAt,
    setPeriodClosedAt,
  ] = useState<string | null>(
    null
  );

  const [
    checkingPeriod,
    setCheckingPeriod,
  ] = useState(false);

  function resetForm() {
    setAmount(
      String(balanceDue)
    );

    setPaymentMethod(
      "cash"
    );

    setReferenceNo("");
    setNotes("");
    setSlipFile(null);
    setPaymentDate(today());
    setPeriodStatus("open");
    setPeriodClosedAt(null);
    setError("");
  }

  async function checkPaymentPeriod(
    targetCompanyId: number,
    targetDate: string
  ) {
    if (
      !targetCompanyId ||
      !targetDate
    ) {
      return;
    }

    setCheckingPeriod(true);

    try {
      const {
        data,
        error,
      } = await supabase
        .from(
          "accounting_period_closes"
        )
        .select(`
          status,
          closed_at
        `)
        .eq(
          "company_id",
          targetCompanyId
        )
        .eq(
          "period_start",
          firstDayOfDate(
            targetDate
          )
        )
        .maybeSingle();

      if (error) {
        throw error;
      }

      setPeriodStatus(
        data?.status ===
          "closed"
          ? "closed"
          : data?.status ===
            "reopened"
          ? "reopened"
          : "open"
      );

      setPeriodClosedAt(
        data?.closed_at ||
          null
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not check payment accounting period."
      );
    } finally {
      setCheckingPeriod(false);
    }
  }

  async function openModal() {
    resetForm();

    try {
      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("company_id")
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (
        !profile?.company_id
      ) {
        throw new Error(
          "Company profile not found."
        );
      }

      const resolvedCompanyId =
        Number(
          profile.company_id
        );

      const defaultDate =
        today();

      setCompanyId(
        resolvedCompanyId
      );

      setPaymentDate(
        defaultDate
      );

      await checkPaymentPeriod(
        resolvedCompanyId,
        defaultDate
      );

      setOpen(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not open payment form."
      );
    }
  }

  async function handleSave() {
    setError("");

    if (
      checkingPeriod
    ) {
      setError(
        "Please wait while the payment accounting period is checked."
      );
      return;
    }

    if (
      periodStatus ===
      "closed"
    ) {
      setError(
        "The selected payment date belongs to a closed accounting period. Choose another date or reopen that month."
      );
      return;
    }

    const paymentAmount =
      Number(amount);

    if (
      !Number.isFinite(
        paymentAmount
      ) ||
      paymentAmount <= 0
    ) {
      setError(
        "Payment amount must be greater than 0."
      );
      return;
    }

    if (
      paymentAmount >
      balanceDue
    ) {
      setError(
        "Payment amount cannot be greater than balance due."
      );
      return;
    }

    const requiresProof =
      paymentMethod ===
        "bank_transfer" ||
      paymentMethod === "qr";

    if (
      requiresProof &&
      !referenceNo.trim()
    ) {
      setError(
        "Reference No. is required for Bank Transfer or QR payment."
      );
      return;
    }

    if (
      requiresProof &&
      !slipFile
    ) {
      setError(
        "Please upload a payment slip or proof."
      );
      return;
    }

    if (
      slipFile &&
      slipFile.size >
        10 * 1024 * 1024
    ) {
      setError(
        "Slip file must be 10 MB or smaller."
      );
      return;
    }

    setSaving(true);

    try {
      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("company_id")
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (
        !profile?.company_id
      ) {
        throw new Error(
          "Company profile not found."
        );
      }

      const resolvedCompanyId =
        Number(
          profile.company_id
        );

      setCompanyId(
        resolvedCompanyId
      );

      const {
        data: closeData,
        error: closeError,
      } = await supabase
        .from(
          "accounting_period_closes"
        )
        .select(`
          status,
          closed_at
        `)
        .eq(
          "company_id",
          resolvedCompanyId
        )
        .eq(
          "period_start",
          firstDayOfDate(
            paymentDate
          )
        )
        .maybeSingle();

      if (closeError) {
        throw closeError;
      }

      if (
        closeData?.status ===
        "closed"
      ) {
        setPeriodStatus(
          "closed"
        );

        setPeriodClosedAt(
          closeData.closed_at ||
            null
        );

        throw new Error(
          "The selected payment date is now in a closed accounting period. Reopen the month or choose another payment date."
        );
      }

      let slipPath:
        | string
        | null = null;

      if (
        slipFile &&
        requiresProof
      ) {
        const fileExtension =
          getFileExtension(
            slipFile.name
          );

        const safeExtension =
          fileExtension ||
          "file";

        slipPath =
          `company-${resolvedCompanyId}/invoice-${invoiceId}/${Date.now()}.${safeExtension}`;

        const {
          error: uploadError,
        } =
          await supabase.storage
            .from(
              "payment-slips"
            )
            .upload(
              slipPath,
              slipFile,
              {
                cacheControl:
                  "3600",
                upsert: false,
                contentType:
                  slipFile.type ||
                  undefined,
              }
            );

        if (uploadError) {
          throw uploadError;
        }
      }

      const paymentNo =
        `PAY-${Date.now()}`;

      const {
        error: paymentError,
      } = await supabase
        .from("payments")
        .insert({
          company_id:
            resolvedCompanyId,

          customer_id:
            customerId,

          invoice_id:
            invoiceId,

          payment_no:
            paymentNo,

          payment_date:
            paymentDate,

          amount:
            paymentAmount,

          payment_method:
            paymentMethod,

          reference_no:
            referenceNo.trim() ||
            null,

          slip_path:
            slipPath,

          notes:
            notes.trim() ||
            null,
        });

      if (paymentError) {
        if (slipPath) {
          await supabase.storage
            .from(
              "payment-slips"
            )
            .remove([
              slipPath,
            ]);
        }

        throw paymentError;
      }

      const {
        data: invoice,
        error: invoiceError,
      } = await supabase
        .from("invoices")
        .select(`
          total_amount,
          paid_amount
        `)
        .eq(
          "id",
          invoiceId
        )
        .maybeSingle();

      if (invoiceError) {
        throw invoiceError;
      }

      if (!invoice) {
        throw new Error(
          "Invoice not found."
        );
      }

      const oldPaidAmount =
        Number(
          invoice.paid_amount ||
            0
        );

      const totalAmount =
        Number(
          invoice.total_amount ||
            0
        );

      const newPaidAmount =
        oldPaidAmount +
        paymentAmount;

      const newBalance =
        Math.max(
          totalAmount -
            newPaidAmount,
          0
        );

      const newStatus =
        newBalance <= 0
          ? "paid"
          : "partially_paid";

      const {
        error: updateError,
      } = await supabase
        .from("invoices")
        .update({
          paid_amount:
            newPaidAmount,

          balance_due:
            newBalance,

          status:
            newStatus,
        })
        .eq(
          "id",
          invoiceId
        );

      if (updateError) {
        throw updateError;
      }

      setOpen(false);
      resetForm();
      onSuccess();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not record payment."
      );
    } finally {
      setSaving(false);
    }
  }

  const requiresProof =
    paymentMethod ===
      "bank_transfer" ||
    paymentMethod === "qr";

  const saveBlocked =
    saving ||
    checkingPeriod ||
    periodStatus ===
      "closed";

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        style={{
          backgroundColor:
            "#111827",
          color: "#ffffff",
          border: "none",
          borderRadius:
            "8px",
          padding:
            "10px 16px",
          width: "100%",
          marginTop:
            "16px",
          fontSize:
            "14px",
          fontWeight: 600,
          cursor:
            "pointer",
        }}
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
                Balance due:{" "}
                {money(
                  balanceDue,
                  currency
                )}
              </p>
            </div>

            <div className="space-y-5 p-6">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {periodStatus ===
                "closed" && (
                <PeriodNotice
                  tone="closed"
                  title="Selected Payment Period Closed"
                  text={`The payment date ${formatDate(
                    paymentDate
                  )} belongs to a closed accounting period${
                    periodClosedAt
                      ? ` closed on ${formatDateTime(
                          periodClosedAt
                        )}`
                      : ""
                  }. Choose another date or reopen that month before saving the payment.`}
                />
              )}

              {periodStatus ===
                "reopened" && (
                <PeriodNotice
                  tone="reopened"
                  title="Selected Payment Period Reopened"
                  text="This payment date is in a reopened accounting period. Recording the payment is currently allowed."
                />
              )}

              <Field label="Payment Date">
                <input
                  type="date"
                  value={
                    paymentDate
                  }
                  onChange={async (
                    e
                  ) => {
                    const nextDate =
                      e.target.value;

                    setPaymentDate(
                      nextDate
                    );

                    if (companyId) {
                      await checkPaymentPeriod(
                        companyId,
                        nextDate
                      );
                    }
                  }}
                  className={
                    inputClass
                  }
                />

                <PeriodHint
                  status={
                    periodStatus
                  }
                  checking={
                    checkingPeriod
                  }
                />
              </Field>

              <Field label="Amount">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) =>
                    setAmount(
                      e.target.value
                    )
                  }
                  className={
                    inputClass
                  }
                />
              </Field>

              <Field label="Payment Method">
                <select
                  value={
                    paymentMethod
                  }
                  onChange={(e) => {
                    const nextMethod =
                      e.target.value;

                    setPaymentMethod(
                      nextMethod
                    );

                    if (
                      nextMethod !==
                        "bank_transfer" &&
                      nextMethod !==
                        "qr"
                    ) {
                      setSlipFile(
                        null
                      );
                    }
                  }}
                  className={
                    inputClass
                  }
                >
                  <option value="cash">
                    Cash
                  </option>

                  <option value="bank_transfer">
                    Bank Transfer
                  </option>

                  <option value="qr">
                    QR / PromptPay
                  </option>

                  <option value="card">
                    Card
                  </option>

                  <option value="other">
                    Other
                  </option>
                </select>
              </Field>

              <Field
                label={
                  requiresProof
                    ? "Reference No. *"
                    : "Reference No."
                }
              >
                <input
                  value={
                    referenceNo
                  }
                  onChange={(e) =>
                    setReferenceNo(
                      e.target.value
                    )
                  }
                  className={
                    inputClass
                  }
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
                    onChange={(e) => {
                      const file =
                        e.target
                          .files?.[0] ||
                        null;

                      setSlipFile(
                        file
                      );
                    }}
                    className={
                      inputClass
                    }
                  />

                  <p className="mt-2 text-xs leading-5 text-gray-500">
                    Upload bank transfer slip, QR payment proof, screenshot, JPG, PNG or PDF. Maximum 10 MB.
                  </p>

                  {slipFile && (
                    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                      <div className="text-sm font-medium text-gray-700">
                        {
                          slipFile.name
                        }
                      </div>

                      <div className="mt-1 text-xs text-gray-500">
                        {formatFileSize(
                          slipFile.size
                        )}
                      </div>
                    </div>
                  )}
                </Field>
              )}

              <Field label="Notes">
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) =>
                    setNotes(
                      e.target.value
                    )
                  }
                  className={
                    inputClass
                  }
                  placeholder="Optional payment notes..."
                />
              </Field>

              {requiresProof && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-700">
                  Bank Transfer and QR payments require a reference number and payment proof for future verification.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                disabled={
                  saving
                }
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
                disabled={
                  saveBlocked
                }
                onClick={
                  handleSave
                }
                style={{
                  backgroundColor:
                    saveBlocked
                      ? "#d1d5db"
                      : "#111827",
                  color:
                    "#ffffff",
                  border:
                    "none",
                  borderRadius:
                    "8px",
                  padding:
                    "10px 16px",
                  fontSize:
                    "14px",
                  fontWeight:
                    600,
                  cursor:
                    saveBlocked
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    saveBlocked
                      ? 0.7
                      : 1,
                }}
              >
                {saving
                  ? "Saving..."
                  : checkingPeriod
                  ? "Checking Period..."
                  : periodStatus ===
                    "closed"
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
  tone:
    | "closed"
    | "reopened";
  title: string;
  text: string;
}) {
  const classes =
    tone === "closed"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-blue-200 bg-blue-50 text-blue-800";

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${classes}`}
    >
      <div className="text-sm font-semibold">
        {title}
      </div>

      <div className="mt-1 text-xs leading-5">
        {text}
      </div>
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

  if (
    status ===
    "closed"
  ) {
    return (
      <p className="mt-2 text-xs font-medium text-amber-700">
        This payment date is in a closed accounting period.
      </p>
    );
  }

  if (
    status ===
    "reopened"
  ) {
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
      <div className="mb-2 text-sm font-medium text-gray-700">
        {label}
      </div>

      {children}
    </label>
  );
}

function firstDayOfDate(
  value: string
) {
  return `${String(
    value || ""
  ).slice(0, 7)}-01`;
}

function today() {
  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(
  value: string
) {
  const parts =
    String(
      value || ""
    ).split("-");

  return parts.length === 3
    ? `${parts[2]}/${parts[1]}/${parts[0]}`
    : value || "-";
}

function formatDateTime(
  value: string
) {
  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? value
    : date.toLocaleString();
}

function getFileExtension(
  fileName: string
) {
  const parts =
    fileName.split(".");

  if (
    parts.length < 2
  ) {
    return "";
  }

  return (
    parts
      .pop()
      ?.toLowerCase() ||
    ""
  );
}

function formatFileSize(
  bytes: number
) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function money(
  value: number,
  currency: string
) {
  return `${currencySymbol(
    currency
  )}${Number(
    value || 0
  ).toLocaleString(undefined, {
    minimumFractionDigits:
      2,
    maximumFractionDigits:
      2,
  })}`;
}

function currencySymbol(
  currency: string
) {
  if (
    currency === "MMK"
  ) {
    return "K ";
  }

  if (
    currency === "USD"
  ) {
    return "$";
  }

  if (
    currency === "EUR"
  ) {
    return "€";
  }

  if (
    currency === "SGD"
  ) {
    return "S$";
  }

  return "฿";
}
