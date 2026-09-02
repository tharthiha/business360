"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  open: boolean;
  onClose: () => void;

  billId: number;
  companyId: number;
  supplierId: number;

  currency: string;

  totalAmount: number;
  paidAmount: number;
  balanceDue: number;

  onSaved: () => Promise<void> | void;
};

export default function RecordSupplierPaymentModal({
  open,
  onClose,
  billId,
  companyId,
  supplierId,
  currency,
  totalAmount,
  paidAmount,
  balanceDue,
  onSaved,
}: Props) {
  const supabase = createClient();

  const [amount, setAmount] =
    useState(
      String(balanceDue || "")
    );

  const [method, setMethod] =
    useState("cash");

  const [
    referenceNo,
    setReferenceNo,
  ] = useState("");

  const [notes, setNotes] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  if (!open) {
    return null;
  }

  async function savePayment() {
    const paymentAmount =
      Number(amount || 0);

    if (
      !Number.isFinite(
        paymentAmount
      ) ||
      paymentAmount <= 0
    ) {
      setMessage(
        "Enter a valid payment amount."
      );

      return;
    }

    if (
      paymentAmount >
      balanceDue
    ) {
      setMessage(
        "Payment amount cannot exceed the outstanding balance."
      );

      return;
    }

    if (
      (
        method ===
          "bank_transfer" ||
        method === "qr"
      ) &&
      !referenceNo.trim()
    ) {
      setMessage(
        "Reference number is required for Bank Transfer or QR payment."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Record supplier payment of ${money(
          paymentAmount,
          currency
        )}?`
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const paymentNo =
        `SPAY-${Date.now()}`;

      const {
        error:
          paymentError,
      } = await supabase
        .from(
          "supplier_payments"
        )
        .insert({
          company_id:
            companyId,

          supplier_id:
            supplierId,

          supplier_bill_id:
            billId,

          payment_no:
            paymentNo,

          payment_date:
            today(),

          amount:
            paymentAmount,

          payment_method:
            method,

          reference_no:
            referenceNo.trim() ||
            null,

          notes:
            notes.trim() ||
            null,
        });

      if (paymentError) {
        throw new Error(
          paymentError.message ||
            "Could not record supplier payment."
        );
      }

      const newPaidAmount =
        Number(
          paidAmount || 0
        ) + paymentAmount;

      const newBalance =
        Math.max(
          0,
          Number(
            totalAmount || 0
          ) -
            newPaidAmount
        );

      const newStatus =
        newBalance <= 0
          ? "paid"
          : "partially_paid";

      const {
        error:
          billUpdateError,
      } = await supabase
        .from(
          "supplier_bills"
        )
        .update({
          paid_amount:
            newPaidAmount,

          balance_due:
            newBalance,

          status:
            newStatus,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          billId
        );

      if (
        billUpdateError
      ) {
        throw new Error(
          billUpdateError.message ||
            "Payment saved, but bill balance could not be updated."
        );
      }

      setAmount("");
      setReferenceNo("");
      setNotes("");
      setMethod("cash");

      await onSaved();

      onClose();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save supplier payment."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Record Supplier Payment
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Record money paid to the supplier against this bill.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-gray-500 hover:text-gray-900"
          >
            Close
          </button>
        </div>

        <div className="p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Summary
              label="Bill Total"
              value={money(
                totalAmount,
                currency
              )}
            />

            <Summary
              label="Already Paid"
              value={money(
                paidAmount,
                currency
              )}
            />

            <Summary
              label="Balance"
              value={money(
                balanceDue,
                currency
              )}
              emphasis
            />
          </div>

          {message && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {message}
            </div>
          )}

          <div className="mt-6 space-y-5">
            <label className="block">
              <div className="mb-2 text-sm font-medium text-gray-700">
                Payment Amount *
              </div>

              <input
                type="number"
                min="0.01"
                max={
                  balanceDue
                }
                step="0.01"
                value={amount}
                onChange={(e) =>
                  setAmount(
                    e.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400"
              />

              <div className="mt-1 text-xs text-gray-400">
                Maximum{" "}
                {money(
                  balanceDue,
                  currency
                )}
              </div>
            </label>

            <label className="block">
              <div className="mb-2 text-sm font-medium text-gray-700">
                Payment Method *
              </div>

              <select
                value={method}
                onChange={(e) =>
                  setMethod(
                    e.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-400"
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
            </label>

            <label className="block">
              <div className="mb-2 text-sm font-medium text-gray-700">
                Reference Number
                {(method ===
                  "bank_transfer" ||
                  method === "qr") && (
                  <span className="text-red-500">
                    {" "}
                    *
                  </span>
                )}
              </div>

              <input
                type="text"
                value={
                  referenceNo
                }
                onChange={(e) =>
                  setReferenceNo(
                    e.target.value
                  )
                }
                placeholder="Bank reference / transaction ID"
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400"
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm font-medium text-gray-700">
                Notes
              </div>

              <textarea
                rows={3}
                value={notes}
                onChange={(e) =>
                  setNotes(
                    e.target.value
                  )
                }
                placeholder="Optional payment note"
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-gray-400"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={
              savePayment
            }
            style={{
              backgroundColor:
                "#111827",
              color:
                "#ffffff",
              border: "none",
              borderRadius:
                "8px",
              padding:
                "10px 18px",
              fontSize:
                "14px",
              fontWeight:
                600,
              opacity:
                saving
                  ? 0.6
                  : 1,
            }}
          >
            {saving
              ? "Saving..."
              : "Record Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </div>

      <div
        className={`mt-2 font-semibold ${
          emphasis
            ? "text-lg text-amber-600"
            : "text-gray-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function today() {
  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() +
        1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function money(
  value: number,
  currency: string
) {
  if (
    currency === "MMK"
  ) {
    return `K ${Number(
      value || 0
    ).toLocaleString(
      undefined,
      {
        maximumFractionDigits:
          0,
      }
    )}`;
  }

  const symbol =
    currency === "USD"
      ? "$"
      : currency === "SGD"
      ? "S$"
      : currency === "EUR"
      ? "€"
      : "฿";

  return `${symbol}${Number(
    value || 0
  ).toLocaleString(
    undefined,
    {
      minimumFractionDigits:
        2,
      maximumFractionDigits:
        2,
    }
  )}`;
}