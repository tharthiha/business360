import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "./print-button";
import "./receipt-print.css";

export const instant = false;

export default async function PaymentReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const paymentId = Number(id);
  const supabase = await createClient();

  const {
    data: payment,
    error: paymentError,
  } = await supabase
    .from("payments")
    .select(`
      id,
      company_id,
      customer_id,
      invoice_id,
      payment_no,
      payment_date,
      amount,
      payment_method,
      reference_no,
      notes
    `)
    .eq("id", paymentId)
    .maybeSingle();

  if (paymentError || !payment) {
    return (
      <div className="min-h-screen bg-white p-10 text-red-600">
        Payment receipt not found.
      </div>
    );
  }

  const [
    companyResult,
    customerResult,
    invoiceResult,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select(
        "name, address, phone, email, logo_path"
      )
      .eq("id", payment.company_id)
      .maybeSingle(),

    supabase
      .from("customers")
      .select(`
        customer_name,
        contact_name,
        phone,
        email
      `)
      .eq("id", payment.customer_id)
      .maybeSingle(),

    supabase
      .from("invoices")
      .select(`
        invoice_no,
        currency,
        total_amount,
        paid_amount,
        balance_due
      `)
      .eq("id", payment.invoice_id)
      .maybeSingle(),
  ]);

  const company = companyResult.data;

  let logoUrl:
    | string
    | undefined;

  if (company?.logo_path) {
    const { data: logoData } =
      supabase.storage
        .from("company-assets")
        .getPublicUrl(
          company.logo_path
        );

    logoUrl =
      logoData.publicUrl ||
      undefined;
  }

  const customer =
    customerResult.data;

  const invoice =
    invoiceResult.data;

  const currency =
    invoice?.currency ||
    "THB";

  return (
    <div className="receipt-page min-h-screen bg-gray-100 py-6 text-gray-900">
      <div
        id="receipt-toolbar"
        className="mx-auto mb-5 flex w-full max-w-[794px] items-center justify-between px-4"
      >
        <Link
          href={`/invoices/${payment.invoice_id}`}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
        >
          Back
        </Link>

        <PrintButton />
      </div>

      <main
        id="payment-receipt"
        className="mx-auto w-full max-w-[794px] bg-white px-14 py-12 shadow-sm"
      >
        {logoUrl && (
          <div className="mb-5 flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white p-1.5">
            <img
              src={logoUrl}
              alt={`${company?.name || "Company"} logo`}
              width={64}
              height={64}
              style={{
                width: "64px",
                height: "64px",
                objectFit:
                  "contain",
                borderRadius:
                  "8px",
                border:
                  "1px solid #e5e7eb",
                backgroundColor:
                  "#ffffff",
                padding:
                  "4px",
              }}
            />
          </div>
        )}

        <div className="flex items-start justify-between gap-8 border-b-2 border-gray-900 pb-7">
          <div>
            <h1 className="text-xl font-bold">
              {company?.name ||
                "Company"}
            </h1>

            {company?.address && (
              <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">
                {company.address}
              </p>
            )}

            {company?.phone && (
              <p className="mt-1 text-sm text-gray-500">
                {company.phone}
              </p>
            )}

            {company?.email && (
              <p className="text-sm text-gray-500">
                {company.email}
              </p>
            )}
          </div>

          <div className="text-right">
            <h2 className="text-3xl font-bold tracking-tight">
              RECEIPT
            </h2>

            <p className="mt-3 text-sm font-medium">
              {payment.payment_no}
            </p>

            <p className="mt-1 text-sm text-gray-500">
              {formatDate(
                payment.payment_date
              )}
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-8">
          <div className="rounded-xl bg-gray-50 p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Received From
            </div>

            <div className="mt-3 text-lg font-semibold">
              {customer?.customer_name ||
                "-"}
            </div>

            {customer?.contact_name && (
              <p className="mt-2 text-sm text-gray-500">
                Attn:{" "}
                {
                  customer.contact_name
                }
              </p>
            )}

            {customer?.phone && (
              <p className="text-sm text-gray-500">
                {customer.phone}
              </p>
            )}

            {customer?.email && (
              <p className="text-sm text-gray-500">
                {customer.email}
              </p>
            )}
          </div>

          <div className="rounded-xl bg-gray-50 p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Payment Details
            </div>

            <ReceiptRow
              label="Invoice"
              value={
                invoice?.invoice_no ||
                "-"
              }
            />

            <ReceiptRow
              label="Method"
              value={methodLabel(
                payment.payment_method
              )}
            />

            <ReceiptRow
              label="Reference"
              value={
                payment.reference_no ||
                "-"
              }
            />
          </div>
        </div>

        <div className="mt-10 rounded-xl border border-gray-200 p-6">
          <div className="text-sm text-gray-500">
            Amount Received
          </div>

          <div className="mt-2 text-4xl font-bold">
            {money(
              payment.amount,
              currency
            )}
          </div>
        </div>

        {invoice && (
          <div className="ml-auto mt-8 w-full max-w-sm">
            <ReceiptRow
              label="Invoice Total"
              value={money(
                invoice.total_amount,
                currency
              )}
            />

            <ReceiptRow
              label="Total Paid"
              value={money(
                invoice.paid_amount,
                currency
              )}
            />

            <div className="mt-3 border-t border-gray-200 pt-1">
              <ReceiptRow
                label="Balance Due"
                value={money(
                  invoice.balance_due,
                  currency
                )}
                strong
              />
            </div>
          </div>
        )}

        {payment.notes && (
          <div className="mt-8">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Notes
            </div>

            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
              {payment.notes}
            </p>
          </div>
        )}

        <div className="mt-24 grid grid-cols-2 gap-16">
          <Signature label="Received By" />
          <Signature label="Customer" />
        </div>

        <div className="mt-14 border-t border-gray-200 pt-5 text-center text-xs text-gray-400">
          {company?.name ||
            "Company"}{" "}
          · Thank you for your payment.
        </div>
      </main>
    </div>
  );
}

function ReceiptRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="mt-3 flex justify-between gap-5 text-sm">
      <span
        className={
          strong
            ? "font-semibold text-gray-900"
            : "text-gray-500"
        }
      >
        {label}
      </span>

      <span
        className={
          strong
            ? "font-bold text-gray-900"
            : "font-medium text-gray-900"
        }
      >
        {value}
      </span>
    </div>
  );
}

function Signature({
  label,
}: {
  label: string;
}) {
  return (
    <div className="border-t border-gray-900 pt-2 text-center">
      <div className="text-sm font-medium text-gray-700">
        {label}
      </div>

      <div className="mt-1 text-xs text-gray-400">
        Signature / Date
      </div>
    </div>
  );
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

  if (
    parts.length === 3
  ) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return value;
}
