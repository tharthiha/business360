"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Payment = {
  id: number;
  payment_no: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_no: string | null;
  notes: string | null;
  slip_path: string | null;
};

export default function PaymentHistory({
  invoiceId,
  currency,
}: {
  invoiceId: number;
  currency: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [openingSlipId, setOpeningSlipId] =
    useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPayments() {
      setLoading(true);
      setError("");

      try {
        const {
          data,
          error: paymentError,
        } = await supabase
          .from("payments")
          .select(`
            id,
            payment_no,
            payment_date,
            amount,
            payment_method,
            reference_no,
            notes,
            slip_path
          `)
          .eq("invoice_id", invoiceId)
          .order("payment_date", {
            ascending: false,
          })
          .order("id", {
            ascending: false,
          });

        if (paymentError) {
          throw paymentError;
        }

        if (!cancelled) {
          setPayments(
            (data || []) as Payment[]
          );
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load payment history."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPayments();

    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  async function openSlip(
    payment: Payment
  ) {
    if (!payment.slip_path) {
      return;
    }

    setOpeningSlipId(payment.id);
    setError("");

    try {
      const {
        data,
        error: signedUrlError,
      } = await supabase.storage
        .from("payment-slips")
        .createSignedUrl(
          payment.slip_path,
          60 * 10
        );

      if (signedUrlError) {
        throw signedUrlError;
      }

      if (!data?.signedUrl) {
        throw new Error(
          "Could not create payment slip URL."
        );
      }

      window.open(
        data.signedUrl,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not open payment slip."
      );
    } finally {
      setOpeningSlipId(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="font-semibold text-gray-900">
          Payment History
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Payments and supporting documents recorded
          against this invoice.
        </p>
      </div>

      {error && (
        <div className="m-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="px-6 py-10 text-center text-sm text-gray-500">
          Loading payments...
        </div>
      ) : payments.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <div className="font-medium text-gray-900">
            No payments yet
          </div>

          <p className="mt-1 text-sm text-gray-500">
            Recorded payments will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <Header>
                  Payment No.
                </Header>

                <Header>
                  Date
                </Header>

                <Header>
                  Method
                </Header>

                <Header>
                  Reference
                </Header>

                <Header right>
                  Amount
                </Header>

                <Header right>
                  Actions
                </Header>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {payments.map(
                (payment) => (
                  <tr key={payment.id}>
                    <td className="px-5 py-4 text-sm font-medium text-gray-900">
                      {
                        payment.payment_no
                      }
                    </td>

                    <td className="px-5 py-4 text-sm text-gray-600">
                      {formatDate(
                        payment.payment_date
                      )}
                    </td>

                    <td className="px-5 py-4 text-sm text-gray-600">
                      {methodLabel(
                        payment.payment_method
                      )}
                    </td>

                    <td className="px-5 py-4 text-sm text-gray-600">
                      {payment.reference_no ||
                        "-"}
                    </td>

                    <td className="px-5 py-4 text-right text-sm font-semibold text-gray-900">
                      {money(
                        payment.amount,
                        currency
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        {payment.slip_path && (
                          <button
                            type="button"
                            disabled={
                              openingSlipId ===
                              payment.id
                            }
                            onClick={() =>
                              openSlip(
                                payment
                              )
                            }
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {openingSlipId ===
                            payment.id
                              ? "Opening..."
                              : "View Slip"}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/print/payments/${payment.id}`
                            )
                          }
                          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Receipt
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Header({
  children,
  right = false,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${
        right
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function methodLabel(
  value: string
) {
  if (
    value === "bank_transfer"
  ) {
    return "Bank Transfer";
  }

  if (value === "card") {
    return "Card";
  }

  if (value === "qr") {
    return "QR / PromptPay";
  }

  if (value === "cash") {
    return "Cash";
  }

  return "Other";
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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function currencySymbol(
  currency: string
) {
  if (currency === "MMK") {
    return "K ";
  }

  if (currency === "USD") {
    return "$";
  }

  if (currency === "EUR") {
    return "€";
  }

  if (currency === "SGD") {
    return "S$";
  }

  return "฿";
}

function formatDate(
  value: string
) {
  const parts =
    value.split("-");

  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return value;
}