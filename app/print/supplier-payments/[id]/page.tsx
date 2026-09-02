import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "./print-button";
import "./supplier-payment-print.css";

export const instant = false;

export default async function SupplierPaymentReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase =
    await createClient();

  const {
    data: payment,
    error: paymentError,
  } = await supabase
    .from("supplier_payments")
    .select("*")
    .eq("id", id)
    .single();

  if (
    paymentError ||
    !payment
  ) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Supplier Payment not found.
          {paymentError?.message
            ? ` ${paymentError.message}`
            : ""}
        </div>
      </div>
    );
  }

  const [
    billResult,
    supplierResult,
    companyResult,
    allPaymentsResult,
  ] = await Promise.all([
    supabase
      .from("supplier_bills")
      .select(`
        id,
        bill_no,
        total_amount,
        paid_amount,
        balance_due,
        currency,
        supplier_id,
        purchase_order_id
      `)
      .eq(
        "id",
        payment.supplier_bill_id
      )
      .single(),

    supabase
      .from("suppliers")
      .select(`
        id,
        supplier_name,
        supplier_code,
        contact_name,
        phone,
        email
      `)
      .eq(
        "id",
        payment.supplier_id
      )
      .single(),

    supabase
      .from("companies")
      .select(`
        id,
        company_name,
        email,
        phone,
        address,
        logo_path
      `)
      .eq(
        "id",
        payment.company_id
      )
      .single(),

    supabase
      .from("supplier_payments")
      .select(`
        id,
        amount
      `)
      .eq(
        "supplier_bill_id",
        payment.supplier_bill_id
      ),
  ]);

  const bill =
    billResult.data;

  const supplier =
    supplierResult.data;

  const company =
    companyResult.data;

  const allPayments =
    allPaymentsResult.data || [];

  const totalPaid =
    allPayments.reduce(
      (sum, row) =>
        sum +
        Number(
          row.amount || 0
        ),
      0
    );

  const currency =
    bill?.currency || "THB";

  const balance =
    Math.max(
      0,
      Number(
        bill?.total_amount || 0
      ) - totalPaid
    );

  return (
    <div
  id="supplier-payment-receipt"
  className="min-h-screen bg-gray-100 px-4 py-8 print:bg-white"
>
      <div className="mx-auto max-w-[900px]">
        {/* TOOLBAR */}

        <div className="supplier-payment-toolbar mb-4 flex items-center justify-between">
  <Link
    href={`/supplier-bills/${payment.supplier_bill_id}`}
    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
  >
    ← Back to Supplier Bill
  </Link>

  <PrintButton />
</div>

        {/* RECEIPT */}

        <div className="supplier-payment-paper bg-white p-10 shadow-sm">
          {/* HEADER */}

          <div className="flex items-start justify-between gap-8 border-b border-gray-200 pb-7">
            <div>
              <div className="text-2xl font-semibold text-gray-900">
                {company?.company_name ||
                  "Company"}
              </div>

              {company?.address && (
                <div className="mt-2 text-sm text-gray-500">
                  {
                    company.address
                  }
                </div>
              )}

              <div className="mt-1 text-sm text-gray-500">
                {[
                  company?.phone,
                  company?.email,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                Supplier Payment Receipt
              </div>

              <div className="mt-2 text-xl font-semibold text-gray-900">
                {payment.payment_no}
              </div>

              <div className="mt-2 text-sm text-gray-500">
                Date:{" "}
                {formatDate(
                  payment.payment_date
                )}
              </div>
            </div>
          </div>

          {/* SUPPLIER / REFERENCE */}

          <div className="grid gap-8 border-b border-gray-200 py-7 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Paid To
              </div>

              <div className="mt-3 text-base font-semibold text-gray-900">
                {supplier?.supplier_name ||
                  "Supplier"}
              </div>

              {supplier?.supplier_code && (
                <div className="mt-1 text-sm text-gray-500">
                  Code:{" "}
                  {
                    supplier.supplier_code
                  }
                </div>
              )}

              {supplier?.contact_name && (
                <div className="mt-1 text-sm text-gray-500">
                  Contact:{" "}
                  {
                    supplier.contact_name
                  }
                </div>
              )}

              {supplier?.phone && (
                <div className="mt-1 text-sm text-gray-500">
                  Phone:{" "}
                  {supplier.phone}
                </div>
              )}

              {supplier?.email && (
                <div className="mt-1 text-sm text-gray-500">
                  {
                    supplier.email
                  }
                </div>
              )}
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Reference
              </div>

              <div className="mt-3 space-y-2 text-sm">
                <ReceiptRow
                  label="Supplier Bill"
                  value={
                    bill?.bill_no ||
                    "-"
                  }
                />

                <ReceiptRow
                  label="Purchase Order"
                  value={
                    bill?.purchase_order_id
                      ? `PO #${bill.purchase_order_id}`
                      : "-"
                  }
                />

                <ReceiptRow
                  label="Method"
                  value={methodLabel(
                    payment.payment_method
                  )}
                />

                <ReceiptRow
                  label="Reference No."
                  value={
                    payment.reference_no ||
                    "-"
                  }
                />
              </div>
            </div>
          </div>

          {/* AMOUNT */}

          <div className="py-8">
            <div className="rounded-xl bg-gray-50 p-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Amount Paid
              </div>

              <div className="mt-2 text-4xl font-semibold tracking-tight text-gray-900">
                {money(
                  Number(
                    payment.amount ||
                      0
                  ),
                  currency
                )}
              </div>
            </div>
          </div>

          {/* SUMMARY */}

          <div className="grid gap-6 md:grid-cols-3">
            <SummaryBox
              label="Bill Total"
              value={money(
                Number(
                  bill?.total_amount ||
                    0
                ),
                currency
              )}
            />

            <SummaryBox
              label="Total Paid"
              value={money(
                totalPaid,
                currency
              )}
            />

            <SummaryBox
              label="Balance"
              value={money(
                balance,
                currency
              )}
            />
          </div>

          {/* NOTES */}

          {payment.notes && (
            <div className="mt-8 border-t border-gray-200 pt-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Notes
              </div>

              <div className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                {payment.notes}
              </div>
            </div>
          )}

          {/* SIGNATURE */}

          <div className="mt-14 grid gap-10 md:grid-cols-2">
            <Signature
              label="Paid By"
            />

            <Signature
              label="Received By"
            />
          </div>

          {/* FOOTER */}

          <div className="mt-12 border-t border-gray-200 pt-5 text-center text-xs text-gray-400">
            This receipt confirms payment made to the supplier.
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceiptRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="text-gray-500">
        {label}
      </span>

      <span className="font-medium text-gray-900">
        {value}
      </span>
    </div>
  );
}

function SummaryBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </div>

      <div className="mt-2 text-xl font-semibold text-gray-900">
        {value}
      </div>
    </div>
  );
}

function Signature({
  label,
}: {
  label: string;
}) {
  return (
    <div className="pt-10">
      <div className="border-t border-gray-400 pt-2 text-center text-sm text-gray-600">
        {label}
      </div>

      <div className="mt-1 text-center text-xs text-gray-400">
        Signature / Date
      </div>
    </div>
  );
}

function formatDate(
  value: string
) {
  const parts =
    String(
      value || ""
    ).split("-");

  if (
    parts.length === 3
  ) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return value || "-";
}

function methodLabel(
  value: string
) {
  if (
    value ===
    "bank_transfer"
  ) {
    return "Bank Transfer";
  }

  if (value === "qr") {
    return "QR / PromptPay";
  }

  if (value === "cash") {
    return "Cash";
  }

  if (value === "card") {
    return "Card";
  }

  return String(
    value || "-"
  )
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
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