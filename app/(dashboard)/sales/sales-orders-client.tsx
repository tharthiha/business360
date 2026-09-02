"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type InvoiceInfo = {
  id: number;
  sales_order_id: number | null;
  invoice_no: string;
  status: string;
  currency: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  invoice_date: string;
};

type SalesOrder = {
  id: number;
  sales_order_no: string;
  order_date: string;
  status: string;
  currency: string;
  total_amount: number;
  is_fulfilled: boolean;
  order_source: string | null;
  quotation_id: number | null;
  customer_id: number;
  fulfilled_at: string | null;
  customer_name: string;
  invoice: InvoiceInfo | null;
  source: string;
  last_activity: string;
};

type StatusFilter =
  | "all"
  | "draft"
  | "confirmed"
  | "fulfilled"
  | "cancelled"
  | "not_invoiced"
  | "outstanding";

type SortKey =
  | "date"
  | "customer"
  | "amount"
  | "status"
  | "activity";

type SortDirection = "asc" | "desc";

export default function SalesOrdersClient({
  orders,
}: {
  orders: SalesOrder[];
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] =
    useState<StatusFilter>("all");
  const [sortKey, setSortKey] =
    useState<SortKey>("activity");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("desc");

  const counts = useMemo(
    () => ({
      all: orders.length,
      draft: orders.filter(
        (order) =>
          order.status === "draft"
      ).length,
      confirmed: orders.filter(
        (order) =>
          order.status === "confirmed" &&
          !order.is_fulfilled
      ).length,
      fulfilled: orders.filter(
        (order) => order.is_fulfilled
      ).length,
      cancelled: orders.filter(
        (order) =>
          order.status === "cancelled"
      ).length,
      notInvoiced: orders.filter(
        (order) =>
          order.status !== "cancelled" &&
          !order.invoice
      ).length,
      outstanding: orders.filter(
        (order) =>
          Boolean(
            order.invoice &&
              order.invoice.balance_due >
                0.000001
          )
      ).length,
    }),
    [orders]
  );

  const currencyTotals = useMemo(() => {
    const map = new Map<
      string,
      {
        sales: number;
        invoiced: number;
        paid: number;
        outstanding: number;
      }
    >();

    function ensure(currency: string) {
      if (!map.has(currency)) {
        map.set(currency, {
          sales: 0,
          invoiced: 0,
          paid: 0,
          outstanding: 0,
        });
      }

      return map.get(currency)!;
    }

    for (const order of orders) {
      if (order.status !== "cancelled") {
        ensure(order.currency).sales +=
          order.total_amount;
      }

      if (order.invoice) {
        const row = ensure(
          order.invoice.currency
        );

        row.invoiced +=
          order.invoice.total_amount;
        row.paid +=
          order.invoice.paid_amount;
        row.outstanding +=
          order.invoice.balance_due;
      }
    }

    return map;
  }, [orders]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    const rows = orders.filter((order) => {
      const haystack = [
        order.sales_order_no,
        order.customer_name,
        order.source,
        order.status,
        order.invoice?.invoice_no,
        order.invoice?.status,
        order.currency,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !term || haystack.includes(term);

      let matchesFilter = true;

      if (filter === "draft") {
        matchesFilter =
          order.status === "draft";
      } else if (filter === "confirmed") {
        matchesFilter =
          order.status === "confirmed" &&
          !order.is_fulfilled;
      } else if (filter === "fulfilled") {
        matchesFilter = order.is_fulfilled;
      } else if (filter === "cancelled") {
        matchesFilter =
          order.status === "cancelled";
      } else if (filter === "not_invoiced") {
        matchesFilter =
          order.status !== "cancelled" &&
          !order.invoice;
      } else if (filter === "outstanding") {
        matchesFilter = Boolean(
          order.invoice &&
            order.invoice.balance_due >
              0.000001
        );
      }

      return matchesSearch && matchesFilter;
    });

    return [...rows].sort((a, b) => {
      let comparison = 0;

      if (sortKey === "date") {
        comparison = a.order_date.localeCompare(
          b.order_date
        );
      }

      if (sortKey === "customer") {
        comparison =
          a.customer_name.localeCompare(
            b.customer_name,
            undefined,
            {
              numeric: true,
              sensitivity: "base",
            }
          );
      }

      if (sortKey === "amount") {
        comparison =
          a.total_amount - b.total_amount;
      }

      if (sortKey === "status") {
        comparison = lifecycleLabel(
          a
        ).localeCompare(lifecycleLabel(b));
      }

      if (sortKey === "activity") {
        comparison =
          a.last_activity.localeCompare(
            b.last_activity
          );
      }

      return sortDirection === "asc"
        ? comparison
        : -comparison;
    });
  }, [
    orders,
    search,
    filter,
    sortKey,
    sortDirection,
  ]);

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection(
        sortDirection === "asc"
          ? "desc"
          : "asc"
      );
      return;
    }

    setSortKey(nextKey);
    setSortDirection(
      nextKey === "customer" ||
        nextKey === "status"
        ? "asc"
        : "desc"
    );
  }

  const hasFilters =
    search.trim() !== "" || filter !== "all";

  function clearFilters() {
    setSearch("");
    setFilter("all");
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Orders"
          value={String(counts.all)}
          hint={`${counts.fulfilled} fulfilled`}
        />

        <SummaryCard
          label="Sales Value"
          value={formatCurrencySummary(
            currencyTotals,
            "sales"
          )}
          hint="Non-cancelled sales orders"
        />

        <SummaryCard
          label="Outstanding A/R"
          value={formatCurrencySummary(
            currencyTotals,
            "outstanding"
          )}
          hint={`${counts.outstanding} invoices still open`}
          tone={
            hasPositiveTotal(
              currencyTotals,
              "outstanding"
            )
              ? "warning"
              : "positive"
          }
        />

        <SummaryCard
          label="Pending Workflow"
          value={String(
            counts.confirmed +
              counts.notInvoiced
          )}
          hint={`${counts.confirmed} awaiting delivery • ${counts.notInvoiced} not invoiced`}
          tone={
            counts.confirmed +
              counts.notInvoiced >
            0
              ? "warning"
              : "positive"
          }
        />
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4 sm:px-6">
          <h2 className="font-semibold text-gray-900">
            Sales by Currency
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Sales, invoicing, collections and receivables are kept separate by currency.
          </p>
        </div>

        {currencyTotals.size === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500">
            No financial data yet.
          </div>
        ) : (
          <div className="grid gap-4 p-5 sm:p-6 xl:grid-cols-2">
            {Array.from(
              currencyTotals.entries()
            )
              .sort(([a], [b]) =>
                a.localeCompare(b)
              )
              .map(([currency, totals]) => (
                <CurrencyCard
                  key={currency}
                  currency={currency}
                  sales={totals.sales}
                  invoiced={totals.invoiced}
                  paid={totals.paid}
                  outstanding={
                    totals.outstanding
                  }
                />
              ))}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative w-full max-w-xl">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                >
                  <path
                    d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>

                <input
                  type="search"
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="Search order, customer, invoice, source or status..."
                  style={{
                    backgroundColor: "#f9fafb",
                    color: "#111827",
                    WebkitTextFillColor:
                      "#111827",
                    colorScheme: "light",
                  }}
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:bg-white"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <FilterButton
                  active={filter === "all"}
                  label="All"
                  count={counts.all}
                  onClick={() =>
                    setFilter("all")
                  }
                />

                <FilterButton
                  active={filter === "draft"}
                  label="Draft"
                  count={counts.draft}
                  onClick={() =>
                    setFilter("draft")
                  }
                />

                <FilterButton
                  active={
                    filter === "confirmed"
                  }
                  label="Pending Delivery"
                  count={counts.confirmed}
                  onClick={() =>
                    setFilter("confirmed")
                  }
                />

                <FilterButton
                  active={
                    filter === "fulfilled"
                  }
                  label="Fulfilled"
                  count={counts.fulfilled}
                  onClick={() =>
                    setFilter("fulfilled")
                  }
                />

                <FilterButton
                  active={
                    filter === "outstanding"
                  }
                  label="A/R Open"
                  count={counts.outstanding}
                  onClick={() =>
                    setFilter("outstanding")
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>
                Showing{" "}
                <strong className="font-semibold text-gray-900">
                  {filtered.length}
                </strong>{" "}
                of{" "}
                <strong className="font-semibold text-gray-900">
                  {orders.length}
                </strong>
              </span>

              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-lg px-3 py-2 font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-[1320px] w-full">
            <thead className="bg-gray-50/80">
              <tr className="border-b border-gray-200">
                <Header>Sales Order</Header>

                <SortableHeader
                  label="Customer"
                  active={sortKey === "customer"}
                  direction={sortDirection}
                  onClick={() =>
                    handleSort("customer")
                  }
                />

                <Header>Source</Header>

                <SortableHeader
                  label="Date"
                  active={sortKey === "date"}
                  direction={sortDirection}
                  onClick={() =>
                    handleSort("date")
                  }
                />

                <SortableHeader
                  label="Workflow"
                  active={sortKey === "status"}
                  direction={sortDirection}
                  onClick={() =>
                    handleSort("status")
                  }
                />

                <Header>Invoice</Header>
                <Header>Payment</Header>

                <SortableHeader
                  label="Total"
                  active={sortKey === "amount"}
                  direction={sortDirection}
                  onClick={() =>
                    handleSort("amount")
                  }
                  right
                />

                <Header right>Balance</Header>

                <SortableHeader
                  label="Last Activity"
                  active={
                    sortKey === "activity"
                  }
                  direction={sortDirection}
                  onClick={() =>
                    handleSort("activity")
                  }
                />

                <Header right>
                  Next Action
                </Header>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filtered.length > 0 ? (
                filtered.map((order) => (
                  <tr
                    key={order.id}
                    className="group transition hover:bg-gray-50/70"
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/sales/${order.id}`}
                        className="text-sm font-semibold text-gray-900 group-hover:underline"
                      >
                        {order.sales_order_no}
                      </Link>

                      <div className="mt-1 text-xs text-gray-400">
                        Order #{order.id}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <Link
                        href={`/customers/${order.customer_id}`}
                        className="text-sm font-medium text-gray-700 hover:underline"
                      >
                        {order.customer_name}
                      </Link>
                    </td>

                    <td className="px-5 py-4">
                      <SourceBadge
                        source={order.source}
                        quotationId={
                          order.quotation_id
                        }
                      />
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                      {formatDate(
                        order.order_date
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <LifecycleBadge
                        order={order}
                      />
                    </td>

                    <td className="px-5 py-4">
                      {order.invoice ? (
                        <Link
                          href={`/invoices/${order.invoice.id}`}
                          className="text-sm font-medium text-gray-900 underline decoration-gray-300 underline-offset-4"
                        >
                          {order.invoice.invoice_no}
                        </Link>
                      ) : (
                        <Badge
                          label="Not Invoiced"
                          tone="amber"
                        />
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <PaymentStatus
                        invoice={order.invoice}
                      />
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-gray-900">
                      {money(
                        order.total_amount,
                        order.currency
                      )}
                    </td>

                    <td
                      className={`whitespace-nowrap px-5 py-4 text-right text-sm font-semibold ${
                        order.invoice &&
                        order.invoice.balance_due >
                          0.000001
                          ? "text-amber-600"
                          : order.invoice
                          ? "text-green-700"
                          : "text-gray-400"
                      }`}
                    >
                      {order.invoice
                        ? money(
                            order.invoice
                              .balance_due,
                            order.invoice
                              .currency
                          )
                        : "—"}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                      {formatDate(
                        order.last_activity
                      )}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <SmartAction
                        order={order}
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11}>
                    <EmptyState
                      hasFilters={hasFilters}
                      onClear={clearFilters}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-gray-100 lg:hidden">
          {filtered.length > 0 ? (
            filtered.map((order) => (
              <div
                key={order.id}
                className="p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/sales/${order.id}`}
                      className="block truncate font-semibold text-gray-900"
                    >
                      {order.sales_order_no}
                    </Link>

                    <Link
                      href={`/customers/${order.customer_id}`}
                      className="mt-1 block truncate text-xs text-gray-400"
                    >
                      {order.customer_name}
                    </Link>
                  </div>

                  <LifecycleBadge
                    order={order}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MobileMetric
                    label="Total"
                    value={money(
                      order.total_amount,
                      order.currency
                    )}
                  />

                  <MobileMetric
                    label="Balance"
                    value={
                      order.invoice
                        ? money(
                            order.invoice
                              .balance_due,
                            order.invoice
                              .currency
                          )
                        : "—"
                    }
                  />

                  <MobileMetric
                    label="Invoice"
                    value={
                      order.invoice
                        ? order.invoice
                            .invoice_no
                        : "Not Invoiced"
                    }
                  />

                  <MobileMetric
                    label="Last Activity"
                    value={formatDate(
                      order.last_activity
                    )}
                  />
                </div>

                <div className="mt-4">
                  <SmartAction
                    order={order}
                    full
                  />
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              hasFilters={hasFilters}
              onClear={clearFilters}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function SmartAction({
  order,
  full = false,
}: {
  order: SalesOrder;
  full?: boolean;
}) {
  const base = full
    ? "block w-full text-center"
    : "inline-flex";

  if (order.status === "cancelled") {
    return (
      <Link
        href={`/sales/${order.id}`}
        className={`${base} rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700`}
      >
        View
      </Link>
    );
  }

  if (order.status === "draft") {
    return (
      <Link
        href={`/sales/${order.id}`}
        className={`${base} rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white`}
      >
        Confirm Order
      </Link>
    );
  }

  if (
    order.status === "confirmed" &&
    !order.is_fulfilled
  ) {
    return (
      <Link
        href={`/sales/${order.id}`}
        className={`${base} rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white`}
      >
        Deliver
      </Link>
    );
  }

  if (
    order.is_fulfilled &&
    !order.invoice
  ) {
    return (
      <Link
        href={`/sales/${order.id}`}
        className={`${base} rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white`}
      >
        Create Invoice
      </Link>
    );
  }

  if (
    order.invoice &&
    order.invoice.balance_due > 0.000001
  ) {
    return (
      <Link
        href={`/invoices/${order.invoice.id}`}
        className={`${base} rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white`}
      >
        Record Payment
      </Link>
    );
  }

  if (order.invoice) {
    return (
      <Link
        href={`/invoices/${order.invoice.id}`}
        className={`${base} rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700`}
      >
        View Invoice
      </Link>
    );
  }

  return (
    <Link
      href={`/sales/${order.id}`}
      className={`${base} rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700`}
    >
      View
    </Link>
  );
}

function CurrencyCard({
  currency,
  sales,
  invoiced,
  paid,
  outstanding,
}: {
  currency: string;
  sales: number;
  invoiced: number;
  paid: number;
  outstanding: number;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Currency
          </div>
          <div className="mt-1 text-xl font-semibold text-gray-900">
            {currency}
          </div>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            outstanding > 0.000001
              ? "bg-amber-50 text-amber-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {outstanding > 0.000001
            ? "A/R Open"
            : "Settled"}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CurrencyMetric
          label="Sales"
          value={money(
            sales,
            currency
          )}
        />

        <CurrencyMetric
          label="Invoiced"
          value={money(
            invoiced,
            currency
          )}
        />

        <CurrencyMetric
          label="Collected"
          value={money(
            paid,
            currency
          )}
          tone="positive"
        />

        <CurrencyMetric
          label="Outstanding"
          value={money(
            outstanding,
            currency
          )}
          tone={
            outstanding > 0.000001
              ? "warning"
              : "positive"
          }
        />
      </div>
    </div>
  );
}

function CurrencyMetric({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string;
  tone?:
    | "normal"
    | "positive"
    | "warning";
}) {
  return (
    <div className="rounded-lg bg-white p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </div>

      <div
        className={`mt-2 text-sm font-semibold ${
          tone === "positive"
            ? "text-green-700"
            : tone === "warning"
            ? "text-amber-600"
            : "text-gray-900"
        }`}
      >
        {value}
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
  tone?:
    | "normal"
    | "positive"
    | "warning";
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-gray-500">
        {label}
      </div>

      <div
        className={`mt-2 text-2xl font-semibold ${
          tone === "positive"
            ? "text-green-700"
            : tone === "warning"
            ? "text-amber-600"
            : "text-gray-900"
        }`}
      >
        {value}
      </div>

      <div className="mt-2 text-xs text-gray-400">
        {hint}
      </div>
    </div>
  );
}

function FilterButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
        active
          ? "border-gray-900 bg-gray-900 text-white"
          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      <span>{label}</span>

      <span
        className={`rounded-md px-1.5 py-0.5 text-[10px] ${
          active
            ? "bg-white/15 text-white"
            : "bg-gray-100 text-gray-500"
        }`}
      >
        {count}
      </span>
    </button>
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
      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function SortableHeader({
  label,
  active,
  direction,
  onClick,
  right = false,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  right?: boolean;
}) {
  return (
    <th
      className={`px-5 py-3 ${
        right ? "text-right" : "text-left"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-900"
      >
        {label}

        <span
          className={
            active
              ? "text-gray-900"
              : "text-gray-300"
          }
        >
          {active
            ? direction === "asc"
              ? "↑"
              : "↓"
            : "↕"}
        </span>
      </button>
    </th>
  );
}

function LifecycleBadge({
  order,
}: {
  order: SalesOrder;
}) {
  if (order.status === "cancelled") {
    return (
      <Badge
        label="Cancelled"
        tone="red"
      />
    );
  }

  if (order.is_fulfilled) {
    return (
      <Badge
        label="Fulfilled"
        tone="green"
      />
    );
  }

  if (order.status === "confirmed") {
    return (
      <Badge
        label="Pending Delivery"
        tone="amber"
      />
    );
  }

  return (
    <Badge
      label="Draft"
      tone="gray"
    />
  );
}

function PaymentStatus({
  invoice,
}: {
  invoice: InvoiceInfo | null;
}) {
  if (!invoice) {
    return (
      <Badge
        label="No Invoice"
        tone="gray"
      />
    );
  }

  if (invoice.balance_due <= 0.000001) {
    return (
      <Badge
        label="Paid"
        tone="green"
      />
    );
  }

  if (invoice.paid_amount > 0.000001) {
    return (
      <Badge
        label="Partially Paid"
        tone="amber"
      />
    );
  }

  return (
    <Badge
      label="Unpaid"
      tone="red"
    />
  );
}

function SourceBadge({
  source,
  quotationId,
}: {
  source: string;
  quotationId: number | null;
}) {
  if (
    source === "quotation" &&
    quotationId
  ) {
    return (
      <Link
        href={`/quotations/${quotationId}`}
      >
        <Badge
          label="Quotation"
          tone="blue"
        />
      </Link>
    );
  }

  return (
    <Badge
      label={sourceLabel(source)}
      tone="gray"
    />
  );
}

function Badge({
  label,
  tone,
}: {
  label: string;
  tone:
    | "green"
    | "amber"
    | "red"
    | "gray"
    | "blue";
}) {
  const styles = {
    green:
      "bg-green-50 text-green-700",
    amber:
      "bg-amber-50 text-amber-700",
    red:
      "bg-red-50 text-red-700",
    gray:
      "bg-gray-100 text-gray-600",
    blue:
      "bg-blue-50 text-blue-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles[tone]}`}
    >
      {label}
    </span>
  );
}

function MobileMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </div>

      <div className="mt-2 text-sm font-medium text-gray-800">
        {value}
      </div>
    </div>
  );
}

function EmptyState({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="font-semibold text-gray-900">
        {hasFilters
          ? "No matching Sales Orders"
          : "No Sales Orders yet"}
      </div>

      <p className="mt-1 text-sm text-gray-500">
        {hasFilters
          ? "Try another search term or workflow filter."
          : "Create your first Sales Order to start the fulfillment workflow."}
      </p>

      {hasFilters && (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function lifecycleLabel(order: SalesOrder) {
  if (order.status === "cancelled") {
    return "cancelled";
  }

  if (order.is_fulfilled) {
    return "fulfilled";
  }

  if (order.status === "confirmed") {
    return "pending delivery";
  }

  return "draft";
}

function formatCurrencySummary(
  totals: Map<
    string,
    {
      sales: number;
      invoiced: number;
      paid: number;
      outstanding: number;
    }
  >,
  field:
    | "sales"
    | "invoiced"
    | "paid"
    | "outstanding"
) {
  const rows = Array.from(totals.entries())
    .map(([currency, value]) => ({
      currency,
      amount: value[field],
    }))
    .filter(
      (row) =>
        Math.abs(row.amount) > 0.000001
    )
    .sort((a, b) =>
      a.currency.localeCompare(b.currency)
    );

  if (rows.length === 0) {
    return "฿0.00";
  }

  return rows
    .map((row) =>
      money(row.amount, row.currency)
    )
    .join(" • ");
}

function hasPositiveTotal(
  totals: Map<
    string,
    {
      sales: number;
      invoiced: number;
      paid: number;
      outstanding: number;
    }
  >,
  field:
    | "sales"
    | "invoiced"
    | "paid"
    | "outstanding"
) {
  return Array.from(
    totals.values()
  ).some(
    (row) => row[field] > 0.000001
  );
}

function sourceLabel(value: string) {
  if (value === "walk_in") {
    return "Walk-in";
  }

  if (value === "direct") {
    return "Direct";
  }

  return String(value || "Direct")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function money(
  value: number,
  currency: string
) {
  if (currency === "MMK") {
    return `K ${Number(
      value || 0
    ).toLocaleString(undefined, {
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

  return `${symbol}${Number(
    value || 0
  ).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string) {
  if (!value) return "-";

  const normalized =
    String(value).slice(0, 10);

  const parts =
    normalized.split("-");

  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return value;
}
