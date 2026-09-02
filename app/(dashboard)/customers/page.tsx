import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CustomersTableClient from "./customers-table-client";

export const instant = false;

type CurrencyTotals = Record<
  string,
  {
    sales: number;
    outstanding: number;
  }
>;

export default async function CustomersPage() {
  const supabase = await createClient();

  const [
    customersResult,
    salesResult,
    invoicesResult,
    paymentsResult,
  ] = await Promise.all([
    supabase
      .from("customers")
      .select(
        `
        id,
        customer_code,
        customer_name,
        contact_name,
        phone,
        email,
        tax_id,
        is_active,
        created_at
        `
      )
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("sales_orders")
      .select(
        `
        id,
        customer_id,
        order_date,
        status,
        currency,
        total_amount
        `
      )
      .order("order_date", {
        ascending: false,
      }),

    supabase
      .from("invoices")
      .select(
        `
        id,
        customer_id,
        invoice_date,
        status,
        currency,
        total_amount,
        balance_due
        `
      )
      .order("invoice_date", {
        ascending: false,
      }),

    supabase
      .from("payments")
      .select(
        `
        id,
        customer_id,
        payment_date,
        amount
        `
      )
      .order("payment_date", {
        ascending: false,
      }),
  ]);

  if (customersResult.error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Could not load customers: {customersResult.error.message}
      </div>
    );
  }

  if (salesResult.error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Could not load customer sales: {salesResult.error.message}
      </div>
    );
  }

  if (invoicesResult.error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Could not load customer invoices: {invoicesResult.error.message}
      </div>
    );
  }

  if (paymentsResult.error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Could not load customer payments: {paymentsResult.error.message}
      </div>
    );
  }

  const customerList = customersResult.data || [];
  const salesOrders = salesResult.data || [];
  const invoices = invoicesResult.data || [];
  const payments = paymentsResult.data || [];

  const totalsByCustomer = new Map<
    number,
    {
      currencies: CurrencyTotals;
      lastActivity: string | null;
    }
  >();

  function ensureCustomer(customerId: number) {
    if (!totalsByCustomer.has(customerId)) {
      totalsByCustomer.set(customerId, {
        currencies: {},
        lastActivity: null,
      });
    }

    return totalsByCustomer.get(customerId)!;
  }

  function ensureCurrency(
    customerId: number,
    currency: string
  ) {
    const customerTotals =
      ensureCustomer(customerId);

    if (!customerTotals.currencies[currency]) {
      customerTotals.currencies[currency] = {
        sales: 0,
        outstanding: 0,
      };
    }

    return customerTotals.currencies[currency];
  }

  function setLastActivity(
    customerId: number,
    date: string | null
  ) {
    if (!date) return;

    const customerTotals =
      ensureCustomer(customerId);

    if (
      !customerTotals.lastActivity ||
      date > customerTotals.lastActivity
    ) {
      customerTotals.lastActivity = date;
    }
  }

  for (const order of salesOrders) {
    if (!order.customer_id) continue;

    if (
      String(order.status || "").toLowerCase() !==
      "cancelled"
    ) {
      ensureCurrency(
        Number(order.customer_id),
        order.currency || "THB"
      ).sales += Number(order.total_amount || 0);
    }

    setLastActivity(
      Number(order.customer_id),
      order.order_date
    );
  }

  for (const invoice of invoices) {
    if (!invoice.customer_id) continue;

    ensureCurrency(
      Number(invoice.customer_id),
      invoice.currency || "THB"
    ).outstanding += Number(invoice.balance_due || 0);

    setLastActivity(
      Number(invoice.customer_id),
      invoice.invoice_date
    );
  }

  for (const payment of payments) {
    if (!payment.customer_id) continue;

    setLastActivity(
      Number(payment.customer_id),
      payment.payment_date
    );
  }

  const enrichedCustomers = customerList.map(
    (customer) => {
      const summary = totalsByCustomer.get(
        Number(customer.id)
      );

      const currencies = Object.entries(
        summary?.currencies || {}
      ).map(([currency, totals]) => ({
        currency,
        sales: totals.sales,
        outstanding: totals.outstanding,
      }));

      return {
        ...customer,
        commercial_summary: {
          currencies,
          last_activity:
            summary?.lastActivity ||
            customer.created_at?.slice(0, 10) ||
            null,
        },
      };
    }
  );

  const totalCustomers = customerList.length;

  const activeCustomers = customerList.filter(
    (customer) => customer.is_active !== false
  ).length;

  const portfolioTotals = new Map<
    string,
    {
      sales: number;
      outstanding: number;
    }
  >();

  for (const customer of enrichedCustomers) {
    for (const currency of customer.commercial_summary
      .currencies) {
      if (!portfolioTotals.has(currency.currency)) {
        portfolioTotals.set(currency.currency, {
          sales: 0,
          outstanding: 0,
        });
      }

      const row = portfolioTotals.get(
        currency.currency
      )!;

      row.sales += currency.sales;
      row.outstanding += currency.outstanding;
    }
  }

  const latestActivity =
    enrichedCustomers
      .map(
        (customer) =>
          customer.commercial_summary.last_activity
      )
      .filter(Boolean)
      .sort()
      .at(-1) || null;

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Customers
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Customer accounts, commercial activity and receivable position.
          </p>
        </div>

        <Link
          href="/customers/new"
          className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black"
        >
          + Add Customer
        </Link>
      </div>

      {/* SUMMARY */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Customers"
          value={String(totalCustomers)}
          description={`${activeCustomers} active`}
        />

        <SummaryCard
          label="Portfolio Sales"
          value={formatCurrencySummary(
            portfolioTotals,
            "sales"
          )}
          description="Sales orders, excluding cancelled"
        />

        <SummaryCard
          label="Outstanding A/R"
          value={formatCurrencySummary(
            portfolioTotals,
            "outstanding"
          )}
          description="Current customer receivables"
          tone={
            hasPositiveTotal(
              portfolioTotals,
              "outstanding"
            )
              ? "warning"
              : "positive"
          }
        />

        <SummaryCard
          label="Last Activity"
          value={
            latestActivity
              ? formatDate(latestActivity)
              : "-"
          }
          description="Latest customer transaction"
        />
      </div>

      {/* CUSTOMER TABLE */}

      <CustomersTableClient
        customers={enrichedCustomers}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
  tone = "normal",
}: {
  label: string;
  value: string;
  description: string;
  tone?: "normal" | "positive" | "warning";
}) {
  const valueClass =
    tone === "positive"
      ? "text-green-700"
      : tone === "warning"
      ? "text-amber-600"
      : "text-gray-900";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-gray-500">
        {label}
      </div>

      <div className={`mt-2 text-2xl font-semibold ${valueClass}`}>
        {value}
      </div>

      <div className="mt-1 text-xs text-gray-400">
        {description}
      </div>
    </div>
  );
}

function formatCurrencySummary(
  totals: Map<
    string,
    {
      sales: number;
      outstanding: number;
    }
  >,
  key: "sales" | "outstanding"
) {
  const rows = Array.from(totals.entries())
    .map(([currency, value]) => ({
      currency,
      amount: value[key],
    }))
    .filter((row) => Math.abs(row.amount) > 0.000001)
    .sort((a, b) =>
      a.currency.localeCompare(b.currency)
    );

  if (rows.length === 0) {
    return "฿0.00";
  }

  if (rows.length === 1) {
    return money(rows[0].amount, rows[0].currency);
  }

  return rows
    .map((row) => money(row.amount, row.currency))
    .join(" • ");
}

function hasPositiveTotal(
  totals: Map<
    string,
    {
      sales: number;
      outstanding: number;
    }
  >,
  key: "sales" | "outstanding"
) {
  return Array.from(totals.values()).some(
    (row) => row[key] > 0.000001
  );
}

function formatDate(value: string) {
  const parts = String(value || "").split("-");

  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return value || "-";
}

function money(value: number, currency: string) {
  if (currency === "MMK") {
    return `K ${Number(value || 0).toLocaleString(
      undefined,
      {
        maximumFractionDigits: 0,
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

  return `${symbol}${Number(value || 0).toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}
