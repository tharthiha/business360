"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import RecordPaymentModal from "@/components/record-payment-modal";
import PaymentHistory from "@/components/payment-history";

type PeriodStatus = "open" | "closed" | "reopened";

type Invoice = {
  id: number;
  company_id: number;
  customer_id: number;
  sales_order_id: number | null;
  invoice_no: string;
  invoice_date: string;
  due_date: string | null;
  status: string;
  currency: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  notes: string | null;
  terms: string | null;
};

type Customer = {
  id: number;
  customer_name: string;
  customer_code: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_id: string | null;
};

type InvoiceItem = {
  id: number;
  description: string;
  qty: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  line_total: number;
};

export default function InvoiceDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [periodStatus, setPeriodStatus] = useState<PeriodStatus>("open");
  const [periodClosedAt, setPeriodClosedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    void loadInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadInvoice(showLoader = true) {
    if (showLoader) setLoading(true);
    setError("");

    try {
      const invoiceId = Number(id);

      if (!Number.isFinite(invoiceId)) {
        throw new Error("Invalid invoice ID.");
      }

      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .select(`
          id,
          company_id,
          customer_id,
          sales_order_id,
          invoice_no,
          invoice_date,
          due_date,
          status,
          currency,
          subtotal,
          discount_amount,
          tax_amount,
          total_amount,
          paid_amount,
          balance_due,
          notes,
          terms
        `)
        .eq("id", invoiceId)
        .maybeSingle();

      if (invoiceError) throw invoiceError;
      if (!invoiceData) throw new Error("Invoice not found.");

      const currentInvoice: Invoice = {
        ...invoiceData,
        company_id: Number(invoiceData.company_id),
        customer_id: Number(invoiceData.customer_id),
        sales_order_id: invoiceData.sales_order_id
          ? Number(invoiceData.sales_order_id)
          : null,
        subtotal: Number(invoiceData.subtotal || 0),
        discount_amount: Number(invoiceData.discount_amount || 0),
        tax_amount: Number(invoiceData.tax_amount || 0),
        total_amount: Number(invoiceData.total_amount || 0),
        paid_amount: Number(invoiceData.paid_amount || 0),
        balance_due: Number(invoiceData.balance_due || 0),
      };

      setInvoice(currentInvoice);

      const [customerResult, itemResult, closeResult] = await Promise.all([
        supabase
          .from("customers")
          .select(`
            id,
            customer_name,
            customer_code,
            contact_name,
            phone,
            email,
            address,
            tax_id
          `)
          .eq("id", currentInvoice.customer_id)
          .maybeSingle(),

        supabase
          .from("invoice_items")
          .select(`
            id,
            description,
            qty,
            unit_price,
            discount_percent,
            tax_percent,
            line_total
          `)
          .eq("invoice_id", invoiceId)
          .order("sort_order", { ascending: true }),

        supabase
          .from("accounting_period_closes")
          .select("status, closed_at")
          .eq("company_id", currentInvoice.company_id)
          .eq("period_start", firstDayOfDate(currentInvoice.invoice_date))
          .maybeSingle(),
      ]);

      if (customerResult.error) throw customerResult.error;
      if (itemResult.error) throw itemResult.error;
      if (closeResult.error) throw closeResult.error;

      setCustomer(customerResult.data as Customer | null);

      setItems(
        (itemResult.data || []).map((item: any) => ({
          id: Number(item.id),
          description: item.description,
          qty: Number(item.qty || 0),
          unit_price: Number(item.unit_price || 0),
          discount_percent: Number(item.discount_percent || 0),
          tax_percent: Number(item.tax_percent || 0),
          line_total: Number(item.line_total || 0),
        }))
      );

      setPeriodStatus(
        closeResult.data?.status === "closed"
          ? "closed"
          : closeResult.data?.status === "reopened"
          ? "reopened"
          : "open"
      );

      setPeriodClosedAt(closeResult.data?.closed_at || null);
    } catch (err) {
      console.error("[invoice-load]", err);
      setError(formatSupabaseError(err, "Could not load invoice."));
    } finally {
      if (showLoader) setLoading(false);
    }
  }


  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-sm text-gray-500">
        Loading invoice...
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Invoice not found.
      </div>
    );
  }

  const currency = invoice.currency || "THB";
  const canRecordPayment =
    periodStatus !== "closed" &&
    ["draft", "sent", "partially_paid", "overdue"].includes(invoice.status) &&
    invoice.balance_due > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {invoice.invoice_no}
            </h1>
            <StatusBadge status={invoice.status} />
            <PeriodBadge status={periodStatus} />
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
            <span>Invoice ID #{invoice.id}</span>
            {invoice.sales_order_id && (
              <span>From Sales Order #{invoice.sales_order_id}</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {invoice.sales_order_id && (
            <button
              type="button"
              onClick={() => router.push(`/sales/${invoice.sales_order_id}`)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              View Sales Order
            </button>
          )}

          <button
            type="button"
            onClick={() => router.push("/invoices")}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
        </div>
      </div>

      {periodStatus === "closed" && (
        <PeriodNotice
          tone="closed"
          title="Period Closed • Read Only"
          text={`This Invoice belongs to a closed accounting period${
            periodClosedAt ? ` closed on ${formatDateTime(periodClosedAt)}` : ""
          }. Status changes and customer payments are locked until the month is reopened.`}
        />
      )}

      {periodStatus === "reopened" && (
        <PeriodNotice
          tone="reopened"
          title="Period Reopened"
          text="Invoice workflow and customer payments are currently allowed. Close the month again when corrections are complete."
        />
      )}

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Customer" value={customer?.customer_name || "-"} />
        <SummaryCard label="Invoice Date" value={formatDate(invoice.invoice_date)} />
        <SummaryCard
          label="Due Date"
          value={invoice.due_date ? formatDate(invoice.due_date) : "-"}
        />
        <SummaryCard
          label="Balance Due"
          value={money(invoice.balance_due, currency)}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Invoice Workflow</h2>
            <p className="mt-1 text-sm text-gray-500">
              Open the invoice, record customer payments, and close it automatically when fully paid.
            </p>
          </div>

          {periodStatus === "closed" ? (
            <span className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-500">
              Workflow locked for closed period
            </span>
          ) : invoice.status === "paid" ? (
            <span className="rounded-lg bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700">
              Fully Paid
            </span>
          ) : (
            <span className="rounded-lg bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700">
              Ready for Payment
            </span>
          )}
        </div>

        <InvoiceWorkflowSteps status={invoice.status} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section title="Customer Information">
            <div className="grid gap-6 md:grid-cols-2">
              <InfoItem label="Customer" value={customer?.customer_name} />
              <InfoItem label="Customer Code" value={customer?.customer_code} />
              <InfoItem label="Contact" value={customer?.contact_name} />
              <InfoItem label="Phone" value={customer?.phone} />
              <InfoItem label="Email" value={customer?.email} />
              <InfoItem label="Tax ID" value={customer?.tax_id} />
              <div className="md:col-span-2">
                <InfoItem label="Address" value={customer?.address} />
              </div>
            </div>
          </Section>

          <Section title={`Invoice Items • ${items.length}`}>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <TableHeader>Description</TableHeader>
                    <TableHeader right>Qty</TableHeader>
                    <TableHeader right>Unit Price</TableHeader>
                    <TableHeader right>Discount</TableHeader>
                    <TableHeader right>Tax</TableHeader>
                    <TableHeader right>Total</TableHeader>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-4 text-sm font-medium text-gray-900">
                        {item.description}
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-gray-600">
                        {formatQty(item.qty)}
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-gray-600">
                        {money(item.unit_price, currency)}
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-gray-600">
                        {formatPercent(item.discount_percent)}
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-gray-600">
                        {formatPercent(item.tax_percent)}
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-semibold text-gray-900">
                        {money(item.line_total, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <PaymentHistory invoiceId={invoice.id} currency={currency} />

          {(invoice.notes || invoice.terms) && (
            <div className="grid gap-6 md:grid-cols-2">
              <TextCard title="Notes" value={invoice.notes} />
              <TextCard title="Terms & Conditions" value={invoice.terms} />
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Section title="Invoice Summary">
            <div className="space-y-4">
              <Metric label="Subtotal" value={money(invoice.subtotal, currency)} />
              <Metric
                label="Discount"
                value={`-${money(invoice.discount_amount, currency)}`}
              />
              <Metric label="Tax" value={money(invoice.tax_amount, currency)} />
              <div className="border-t border-gray-200 pt-4">
                <Metric
                  label="Total"
                  value={money(invoice.total_amount, currency)}
                  strong
                />
              </div>
            </div>
          </Section>

          <Section title="Payment Summary">
            <div className="space-y-4">
              <InfoRow label="Total" value={money(invoice.total_amount, currency)} />
              <InfoRow label="Paid" value={money(invoice.paid_amount, currency)} />
              <div className="border-t border-gray-200 pt-4">
                <Metric
                  label="Balance Due"
                  value={money(invoice.balance_due, currency)}
                  strong
                />
              </div>
            </div>
          </Section>

          <Section title="Document">
            <div className="space-y-4">
              <InfoRow label="Invoice" value={invoice.invoice_no} />
              <InfoRow label="Currency" value={currency} />
              <InfoRow label="Status" value={invoiceStatusLabel(invoice.status)} />
            </div>
          </Section>

          <Section title="Next Step">
            <p className="text-sm leading-6 text-gray-500">
              {periodStatus === "closed"
                ? "This invoice is read-only because its accounting period is closed."
                : invoice.status === "paid"
                ? "This invoice has been fully paid."
                : "Record customer payment against this invoice."}
            </p>

            {periodStatus === "closed" ? (
              <button
                type="button"
                disabled
                className="mt-4 w-full cursor-not-allowed rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-400"
              >
                Period Closed • Payment Locked
              </button>
            ) : canRecordPayment ? (
              <RecordPaymentModal
                invoiceId={invoice.id}
                companyId={invoice.company_id}
                balanceDue={invoice.balance_due}
                currency={currency}
                onSuccess={async () => {
                  await loadInvoice(false);
                  router.refresh();
                }}
              />
            ) : (
              <button
                type="button"
                disabled
                className="mt-4 w-full cursor-not-allowed rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-400"
              >
                Record Payment
              </button>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function InvoiceWorkflowSteps({ status }: { status: string }) {
  const normalized = status || "draft";
  const paymentActive = ["draft", "sent", "partially_paid", "overdue", "paid"].includes(
    normalized
  );
  const paidActive = normalized === "paid";

  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      <WorkflowStep
        number="1"
        label="Invoice"
        active
      />
      <WorkflowStep number="2" label="Payment" active={paymentActive} />
      <WorkflowStep number="3" label="Paid" active={paidActive} />
    </div>
  );
}

function WorkflowStep({
  number,
  label,
  active,
}: {
  number: string;
  label: string;
  active: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        active ? "border-gray-900 bg-gray-50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
            active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"
          }`}
        >
          {number}
        </div>
        <div className="text-sm font-semibold text-gray-900">{label}</div>
      </div>
    </div>
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
    <div className={`rounded-xl border px-4 py-3 ${classes}`}>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm">{text}</div>
    </div>
  );
}

function PeriodBadge({ status }: { status: PeriodStatus }) {
  if (status === "open") return null;

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        status === "closed"
          ? "bg-gray-900 text-white"
          : "bg-blue-50 text-blue-700"
      }`}
    >
      {status === "closed" ? "Period Closed" : "Period Reopened"}
    </span>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div className="mt-2 whitespace-pre-line text-sm font-medium text-gray-900">
        {value || "-"}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

function TextCard({
  title,
  value,
}: {
  title: string;
  value: string | null;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-600">
        {value || "-"}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className={
          strong ? "font-semibold text-gray-900" : "text-sm text-gray-500"
        }
      >
        {label}
      </span>
      <span
        className={
          strong
            ? "text-xl font-semibold text-gray-900"
            : "font-medium text-gray-900"
        }
      >
        {value}
      </span>
    </div>
  );
}

function TableHeader({
  children,
  right = false,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status || "draft";

  const style =
    normalized === "paid"
      ? "bg-green-50 text-green-700"
      : normalized === "sent"
      ? "bg-blue-50 text-blue-700"
      : normalized === "partially_paid"
      ? "bg-amber-50 text-amber-700"
      : normalized === "overdue"
      ? "bg-red-50 text-red-700"
      : "bg-gray-100 text-gray-700";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>
      {invoiceStatusLabel(normalized)}
    </span>
  );
}

function invoiceStatusLabel(status: string) {
  if (status === "draft") return "Unpaid";
  if (status === "sent") return "Unpaid";
  if (status === "partially_paid") return "Partially Paid";
  if (status === "overdue") return "Overdue";
  return capitalize(status);
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

function firstDayOfDate(value: string) {
  return `${String(value || "").slice(0, 7)}-01`;
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

function formatQty(value: number) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 3,
  });
}

function formatPercent(value: number) {
  return `${Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}%`;
}

function capitalize(value: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ");
}
