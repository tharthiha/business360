"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import RecordSupplierPaymentModal from "@/components/record-supplier-payment-modal";

type SupplierBill = {
  id: number;
  company_id: number;
  supplier_id: number;
  purchase_order_id: number | null;
  bill_no: string;
  bill_date: string;
  due_date: string | null;
  status: string;
  currency: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  supplier_invoice_no: string | null;
  notes: string | null;
  created_at: string;
};

type Supplier = {
  id: number;
  supplier_name: string;
  supplier_code: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
};

type BillItem = {
  id: number;
  product_id: number | null;
  description: string;
  qty: number;
  unit_cost: number;
  discount_percent: number;
  tax_percent: number;
  line_total: number;
  product_name: string | null;
  product_code: string | null;
};

type SupplierPayment = {
  id: number;
  payment_no: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_no: string | null;
  notes: string | null;
  slip_path: string | null;
};

export default function SupplierBillDetailClient({
  id,
}: {
  id: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [bill, setBill] = useState<SupplierBill | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [items, setItems] = useState<BillItem[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] =
    useState<"success" | "error">("error");

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadData(showLoader = true) {
    if (showLoader) setLoading(true);
    setMessage("");

    try {
      const billId = Number(id);

      if (!Number.isFinite(billId)) {
        throw new Error("Invalid Supplier Bill ID.");
      }

      const { data: billData, error: billError } = await supabase
        .from("supplier_bills")
        .select("*")
        .eq("id", billId)
        .maybeSingle();

      if (billError) throw billError;
      if (!billData) throw new Error("Supplier Bill not found.");

      const normalizedBill = normalizeBill(billData);
      setBill(normalizedBill);

      const [supplierResult, itemsResult, paymentsResult] =
        await Promise.all([
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
            .eq("id", normalizedBill.supplier_id)
            .maybeSingle(),

          supabase
            .from("supplier_bill_items")
            .select(`
              id,
              product_id,
              description,
              qty,
              unit_cost,
              discount_percent,
              tax_percent,
              line_total,
              sort_order,
              products (
                product_name,
                product_code
              )
            `)
            .eq("supplier_bill_id", billId)
            .order("sort_order", { ascending: true }),

          supabase
            .from("supplier_payments")
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
            .eq("supplier_bill_id", billId)
            .order("payment_date", { ascending: false })
            .order("id", { ascending: false }),
        ]);

      if (supplierResult.error) throw supplierResult.error;
      if (itemsResult.error) throw itemsResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      setSupplier(supplierResult.data as Supplier | null);

      setItems(
        (itemsResult.data || []).map((row: any) => {
          const product = Array.isArray(row.products)
            ? row.products[0]
            : row.products;

          return {
            id: Number(row.id),
            product_id: row.product_id ? Number(row.product_id) : null,
            description: row.description,
            qty: Number(row.qty || 0),
            unit_cost: Number(row.unit_cost || 0),
            discount_percent: Number(row.discount_percent || 0),
            tax_percent: Number(row.tax_percent || 0),
            line_total: Number(row.line_total || 0),
            product_name: product?.product_name || null,
            product_code: product?.product_code || null,
          };
        })
      );

      setPayments(
        (paymentsResult.data || []).map((row: any) => ({
          id: Number(row.id),
          payment_no: row.payment_no,
          payment_date: row.payment_date,
          amount: Number(row.amount || 0),
          payment_method: row.payment_method,
          reference_no: row.reference_no,
          notes: row.notes,
          slip_path: row.slip_path,
        }))
      );
    } catch (err) {
      console.error("[supplier-bill-load]", err);
      setMessageType("error");
      setMessage(
        formatSupabaseError(err, "Could not load Supplier Bill.")
      );
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  const paymentProgress = useMemo(() => {
    if (!bill || bill.total_amount <= 0) return 0;

    return Math.min(
      100,
      Math.max(0, (bill.paid_amount / bill.total_amount) * 100)
    );
  }, [bill]);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-gray-500">
        Loading Supplier Bill...
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {message || "Supplier Bill not found."}
      </div>
    );
  }

  const isPaid =
    bill.status === "paid" || bill.balance_due <= 0;

  const canRecordPayment =
    !isPaid &&
    ["draft", "open", "partially_paid", "overdue"].includes(bill.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {bill.bill_no}
            </h1>
            <BillStatusBadge status={bill.status} />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
            <span>Supplier Bill #{bill.id}</span>

            {bill.purchase_order_id && (
              <>
                <span>•</span>
                <Link
                  href={`/purchase/${bill.purchase_order_id}`}
                  className="font-medium text-gray-700 underline underline-offset-4"
                >
                  From Purchase Order #{bill.purchase_order_id}
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {bill.purchase_order_id && (
            <Link
              href={`/purchase/${bill.purchase_order_id}`}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              View Purchase Order
            </Link>
          )}

          <Link
            href="/supplier-bills"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back
          </Link>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            messageType === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">
              Accounts Payable Workflow
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Supplier Bill → Payment → Paid
            </p>
          </div>

          {isPaid ? (
            <span className="rounded-lg bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700">
              ✓ Fully Paid
            </span>
          ) : (
            <span className="rounded-lg bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700">
              Ready for Payment
            </span>
          )}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <WorkflowStep
            number="1"
            label="Supplier Bill"
            text="Created and ready"
            active
            complete={bill.status === "partially_paid" || isPaid}
          />
          <WorkflowStep
            number="2"
            label="Payment"
            text={
              bill.paid_amount > 0
                ? money(bill.paid_amount, bill.currency)
                : "No payment yet"
            }
            active={!isPaid}
            complete={isPaid}
          />
          <WorkflowStep
            number="3"
            label="Paid"
            text={isPaid ? "Supplier settled" : "Balance remaining"}
            active={isPaid}
            complete={isPaid}
          />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Bill Total"
          value={money(bill.total_amount, bill.currency)}
          hint={bill.currency}
        />
        <SummaryCard
          label="Paid"
          value={money(bill.paid_amount, bill.currency)}
          hint={`${paymentProgress.toFixed(0)}% settled`}
          tone="positive"
        />
        <SummaryCard
          label="Balance Due"
          value={money(bill.balance_due, bill.currency)}
          hint={isPaid ? "Fully settled" : "Amount still payable"}
          tone={isPaid ? "positive" : "warning"}
        />
        <SummaryCard
          label="Due Date"
          value={bill.due_date ? formatDate(bill.due_date) : "-"}
          hint={
            bill.due_date && bill.due_date < today() && bill.balance_due > 0
              ? "Overdue"
              : "Payment deadline"
          }
          tone={
            bill.due_date && bill.due_date < today() && bill.balance_due > 0
              ? "danger"
              : "normal"
          }
        />
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-900">
              Payment Progress
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Track how much has been paid to the supplier.
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-gray-900">
              {paymentProgress.toFixed(0)}%
            </div>
            <div className="mt-1 text-xs text-gray-400">settled</div>
          </div>
        </div>

        <div className="mt-5 h-3 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-green-500"
            style={{ width: `${paymentProgress}%` }}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Supplier Bill Items">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <Header>Product</Header>
                    <Header right>Qty</Header>
                    <Header right>Unit Cost</Header>
                    <Header right>Discount</Header>
                    <Header right>Tax</Header>
                    <Header right>Total</Header>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-4">
                        <div className="font-medium text-gray-900">
                          {item.product_name || item.description}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {item.product_code || item.description}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right text-sm">
                        {number(item.qty)}
                      </td>
                      <td className="px-5 py-4 text-right text-sm">
                        {money(item.unit_cost, bill.currency)}
                      </td>
                      <td className="px-5 py-4 text-right text-sm">
                        {item.discount_percent}%
                      </td>
                      <td className="px-5 py-4 text-right text-sm">
                        {item.tax_percent}%
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-semibold">
                        {money(item.line_total, bill.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title="Supplier Payment History">
            {payments.length === 0 ? (
              <div className="rounded-lg bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                No supplier payments recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <Header>Payment</Header>
                      <Header>Date</Header>
                      <Header>Method</Header>
                      <Header>Reference</Header>
                      <Header right>Amount</Header>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-5 py-4 text-sm font-medium">
                          {payment.payment_no}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600">
                          {formatDate(payment.payment_date)}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600">
                          {methodLabel(payment.payment_method)}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600">
                          {payment.reference_no || "-"}
                        </td>
                        <td className="px-5 py-4 text-right text-sm font-semibold text-green-700">
                          {money(payment.amount, bill.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Bill Summary">
            <div className="space-y-4">
              <Metric
                label="Subtotal"
                value={money(bill.subtotal, bill.currency)}
              />
              <Metric
                label="Discount"
                value={money(bill.discount_amount, bill.currency)}
              />
              <Metric
                label="Tax"
                value={money(bill.tax_amount, bill.currency)}
              />
              <div className="border-t border-gray-200 pt-4">
                <Metric
                  label="Total"
                  value={money(bill.total_amount, bill.currency)}
                  strong
                />
              </div>
              <Metric
                label="Paid"
                value={money(bill.paid_amount, bill.currency)}
                positive
              />
              <div className="border-t border-gray-200 pt-4">
                <Metric
                  label="Balance Due"
                  value={money(bill.balance_due, bill.currency)}
                  strong
                />
              </div>
            </div>

            {canRecordPayment && (
              <RecordSupplierPaymentModal
                supplierBillId={bill.id}
                companyId={bill.company_id}
                balanceDue={bill.balance_due}
                currency={bill.currency}
                onSuccess={async () => {
                  await loadData(false);
                  setMessageType("success");
                  setMessage("Supplier payment recorded successfully.");
                  router.refresh();
                }}
              />
            )}
          </Section>

          <Section title="Supplier">
            <div className="space-y-4">
              <InfoItem
                label="Supplier"
                value={supplier?.supplier_name || "-"}
              />
              <InfoItem
                label="Code"
                value={supplier?.supplier_code || "-"}
              />
              <InfoItem
                label="Contact"
                value={supplier?.contact_name || "-"}
              />
              <InfoItem
                label="Phone"
                value={supplier?.phone || "-"}
              />
              <InfoItem
                label="Email"
                value={supplier?.email || "-"}
              />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function WorkflowStep({
  number,
  label,
  text,
  active,
  complete,
}: {
  number: string;
  label: string;
  text: string;
  active: boolean;
  complete: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        active || complete
          ? "border-gray-900 bg-gray-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            active || complete
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-400"
          }`}
        >
          {complete ? "✓" : number}
        </div>
        <div>
          <div className="text-sm font-semibold">{label}</div>
          <div className="mt-1 text-xs text-gray-500">{text}</div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = "normal",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "normal" | "positive" | "warning" | "danger";
}) {
  const valueClass =
    tone === "positive"
      ? "text-green-700"
      : tone === "warning"
      ? "text-amber-600"
      : tone === "danger"
      ? "text-red-600"
      : "text-gray-900";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`mt-2 text-xl font-semibold ${valueClass}`}>
        {value}
      </div>
      <div className="mt-2 text-xs text-gray-400">{hint}</div>
    </div>
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
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium">{value}</div>
    </div>
  );
}

function Metric({
  label,
  value,
  strong = false,
  positive = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? "font-semibold" : "text-sm text-gray-500"}>
        {label}
      </span>
      <span
        className={`font-semibold ${
          strong ? "text-lg" : "text-sm"
        } ${positive ? "text-green-700" : ""}`}
      >
        {value}
      </span>
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
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function BillStatusBadge({ status }: { status: string }) {
  const tone =
    status === "paid"
      ? "bg-green-50 text-green-700"
      : status === "partially_paid"
      ? "bg-amber-50 text-amber-700"
      : "bg-blue-50 text-blue-700";

  const label =
    status === "draft"
      ? "Unpaid"
      : status === "open"
      ? "Unpaid"
      : labelize(status);

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

function normalizeBill(row: any): SupplierBill {
  return {
    ...row,
    id: Number(row.id),
    company_id: Number(row.company_id),
    supplier_id: Number(row.supplier_id),
    purchase_order_id: row.purchase_order_id
      ? Number(row.purchase_order_id)
      : null,
    subtotal: Number(row.subtotal || 0),
    discount_amount: Number(row.discount_amount || 0),
    tax_amount: Number(row.tax_amount || 0),
    total_amount: Number(row.total_amount || 0),
    paid_amount: Number(row.paid_amount || 0),
    balance_due: Number(row.balance_due || 0),
  };
}

function labelize(value: string) {
  return String(value || "-")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function methodLabel(value: string) {
  if (value === "bank_transfer") return "Bank Transfer";
  if (value === "qr") return "QR / PromptPay";
  if (value === "cash") return "Cash";
  if (value === "card") return "Card";
  return labelize(value);
}

function number(value: number) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 3,
  });
}

function formatDate(value: string) {
  const parts = String(value || "").split("-");
  return parts.length === 3
    ? `${parts[2]}/${parts[1]}/${parts[0]}`
    : value || "-";
}

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
