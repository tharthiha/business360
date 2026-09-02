"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Invoice = {
  id: number;
  customer_id: number;
  sales_order_id: number | null;
  invoice_no: string;
  invoice_date: string;
  due_date: string | null;
  status: string;
  currency: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  customer_name: string;
};

type Filter =
  | "all"
  | "open"
  | "partial"
  | "paid"
  | "overdue"
  | "draft";

type SortKey =
  | "date"
  | "due"
  | "customer"
  | "status"
  | "total"
  | "balance";

type SortDirection = "asc" | "desc";

export default function InvoicesClient({
  invoices,
}: {
  invoices: Invoice[];
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] =
    useState<Filter>("all");
  const [sortKey, setSortKey] =
    useState<SortKey>("date");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("desc");

  const now = today();

  const counts = useMemo(() => {
    return {
      all: invoices.length,
      open: invoices.filter((invoice) =>
        isOpen(invoice)
      ).length,
      partial: invoices.filter(
        (invoice) =>
          invoice.status ===
          "partially_paid"
      ).length,
      paid: invoices.filter(
        (invoice) =>
          invoice.balance_due <=
            0.000001 ||
          invoice.status === "paid"
      ).length,
      overdue: invoices.filter(
        (invoice) =>
          isOverdue(invoice, now)
      ).length,
      draft: invoices.filter(
        (invoice) =>
          invoice.status === "draft"
      ).length,
    };
  }, [invoices, now]);

  const currencyTotals = useMemo(() => {
    const map = new Map<
      string,
      {
        invoiced: number;
        collected: number;
        outstanding: number;
        overdue: number;
      }
    >();

    function ensure(currency: string) {
      if (!map.has(currency)) {
        map.set(currency, {
          invoiced: 0,
          collected: 0,
          outstanding: 0,
          overdue: 0,
        });
      }

      return map.get(currency)!;
    }

    for (const invoice of invoices) {
      const row = ensure(
        invoice.currency || "THB"
      );

      row.invoiced += invoice.total_amount;
      row.collected += invoice.paid_amount;

      if (
        invoice.status !== "draft" &&
        invoice.balance_due > 0.000001
      ) {
        row.outstanding +=
          invoice.balance_due;
      }

      if (isOverdue(invoice, now)) {
        row.overdue += invoice.balance_due;
      }
    }

    return map;
  }, [invoices, now]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    const rows = invoices.filter((invoice) => {
      const lifecycle = statusLabel(
        invoice,
        now
      ).toLowerCase();

      const haystack = [
        invoice.invoice_no,
        invoice.customer_name,
        invoice.currency,
        lifecycle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !term || haystack.includes(term);

      let matchesFilter = true;

      if (filter === "open") {
        matchesFilter = isOpen(invoice);
      } else if (filter === "partial") {
        matchesFilter =
          invoice.status ===
          "partially_paid";
      } else if (filter === "paid") {
        matchesFilter =
          invoice.balance_due <=
            0.000001 ||
          invoice.status === "paid";
      } else if (filter === "overdue") {
        matchesFilter = isOverdue(
          invoice,
          now
        );
      } else if (filter === "draft") {
        matchesFilter =
          invoice.status === "draft";
      }

      return matchesSearch && matchesFilter;
    });

    return [...rows].sort((a, b) => {
      let comparison = 0;

      if (sortKey === "date") {
        comparison =
          a.invoice_date.localeCompare(
            b.invoice_date
          );
      }

      if (sortKey === "due") {
        comparison = String(
          a.due_date || ""
        ).localeCompare(
          String(b.due_date || "")
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

      if (sortKey === "status") {
        comparison = statusLabel(
          a,
          now
        ).localeCompare(
          statusLabel(b, now)
        );
      }

      if (sortKey === "total") {
        comparison =
          a.total_amount - b.total_amount;
      }

      if (sortKey === "balance") {
        comparison =
          a.balance_due - b.balance_due;
      }

      return sortDirection === "asc"
        ? comparison
        : -comparison;
    });
  }, [
    invoices,
    search,
    filter,
    sortKey,
    sortDirection,
    now,
  ]);

  function handleSort(next: SortKey) {
    if (sortKey === next) {
      setSortDirection(
        sortDirection === "asc"
          ? "desc"
          : "asc"
      );
      return;
    }

    setSortKey(next);
    setSortDirection(
      next === "customer" ||
        next === "status"
        ? "asc"
        : "desc"
    );
  }

  const hasFilters =
    search.trim() !== "" ||
    filter !== "all";

  function clearFilters() {
    setSearch("");
    setFilter("all");
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Invoices"
          value={String(counts.all)}
          hint={`${counts.open} open`}
        />

        <SummaryCard
          label="Outstanding A/R"
          value={formatCurrencySummary(
            currencyTotals,
            "outstanding"
          )}
          hint={`${counts.open} invoices still open`}
          tone={
            hasPositive(
              currencyTotals,
              "outstanding"
            )
              ? "warning"
              : "positive"
          }
        />

        <SummaryCard
          label="Collected"
          value={formatCurrencySummary(
            currencyTotals,
            "collected"
          )}
          hint={`${counts.paid} fully paid`}
          tone="positive"
        />

        <SummaryCard
          label="Overdue"
          value={formatCurrencySummary(
            currencyTotals,
            "overdue"
          )}
          hint={`${counts.overdue} overdue invoices`}
          tone={
            counts.overdue > 0
              ? "danger"
              : "positive"
          }
        />
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-4 sm:px-6">
          <h2 className="font-semibold text-gray-900">
            Receivables by Currency
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Invoiced, collected and outstanding balances remain separate by transaction currency.
          </p>
        </div>

        {currencyTotals.size === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500">
            No invoice financial data yet.
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
                  invoiced={totals.invoiced}
                  collected={
                    totals.collected
                  }
                  outstanding={
                    totals.outstanding
                  }
                  overdue={totals.overdue}
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
                  placeholder="Search invoice, customer, status or currency..."
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
                  active={filter === "open"}
                  label="Open"
                  count={counts.open}
                  onClick={() =>
                    setFilter("open")
                  }
                />
                <FilterButton
                  active={
                    filter === "partial"
                  }
                  label="Partially Paid"
                  count={counts.partial}
                  onClick={() =>
                    setFilter("partial")
                  }
                />
                <FilterButton
                  active={filter === "paid"}
                  label="Paid"
                  count={counts.paid}
                  onClick={() =>
                    setFilter("paid")
                  }
                />
                <FilterButton
                  active={
                    filter === "overdue"
                  }
                  label="Overdue"
                  count={counts.overdue}
                  onClick={() =>
                    setFilter("overdue")
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
                  {invoices.length}
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
          <table className="min-w-[1220px] w-full">
            <thead className="bg-gray-50/80">
              <tr className="border-b border-gray-200">
                <Header>Invoice</Header>

                <SortableHeader
                  label="Customer"
                  active={sortKey === "customer"}
                  direction={sortDirection}
                  onClick={() =>
                    handleSort("customer")
                  }
                />

                <SortableHeader
                  label="Invoice Date"
                  active={sortKey === "date"}
                  direction={sortDirection}
                  onClick={() =>
                    handleSort("date")
                  }
                />

                <SortableHeader
                  label="Due Date"
                  active={sortKey === "due"}
                  direction={sortDirection}
                  onClick={() =>
                    handleSort("due")
                  }
                />

                <SortableHeader
                  label="Status"
                  active={sortKey === "status"}
                  direction={sortDirection}
                  onClick={() =>
                    handleSort("status")
                  }
                />

                <SortableHeader
                  label="Total"
                  active={sortKey === "total"}
                  direction={sortDirection}
                  onClick={() =>
                    handleSort("total")
                  }
                  right
                />

                <Header right>Paid</Header>

                <SortableHeader
                  label="Balance"
                  active={
                    sortKey === "balance"
                  }
                  direction={sortDirection}
                  onClick={() =>
                    handleSort("balance")
                  }
                  right
                />

                <Header>Source</Header>
                <Header right>
                  Next Action
                </Header>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filtered.length > 0 ? (
                filtered.map((invoice) => {
                  const overdue =
                    isOverdue(invoice, now);

                  return (
                    <tr
                      key={invoice.id}
                      className="group transition hover:bg-gray-50/70"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/invoices/${invoice.id}`}
                          className="text-sm font-semibold text-gray-900 group-hover:underline"
                        >
                          {invoice.invoice_no}
                        </Link>

                        <div className="mt-1 text-xs text-gray-400">
                          Invoice #{invoice.id}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <Link
                          href={`/customers/${invoice.customer_id}`}
                          className="text-sm font-medium text-gray-700 hover:underline"
                        >
                          {invoice.customer_name}
                        </Link>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                        {formatDate(
                          invoice.invoice_date
                        )}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <div
                          className={`text-sm ${
                            overdue
                              ? "font-medium text-red-600"
                              : "text-gray-600"
                          }`}
                        >
                          {invoice.due_date
                            ? formatDate(
                                invoice.due_date
                              )
                            : "—"}
                        </div>

                        {overdue && (
                          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-red-500">
                            Overdue
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          invoice={invoice}
                          now={now}
                        />
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-gray-900">
                        {money(
                          invoice.total_amount,
                          invoice.currency
                        )}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-green-700">
                        {money(
                          invoice.paid_amount,
                          invoice.currency
                        )}
                      </td>

                      <td
                        className={`whitespace-nowrap px-5 py-4 text-right text-sm font-semibold ${
                          overdue
                            ? "text-red-600"
                            : invoice.balance_due >
                              0.000001
                            ? "text-amber-600"
                            : "text-green-700"
                        }`}
                      >
                        {money(
                          invoice.balance_due,
                          invoice.currency
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {invoice.sales_order_id ? (
                          <Link
                            href={`/sales/${invoice.sales_order_id}`}
                            className="text-sm font-medium text-gray-700 underline decoration-gray-300 underline-offset-4"
                          >
                            Sales Order #
                            {invoice.sales_order_id}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-400">
                            Manual
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <SmartAction
                          invoice={invoice}
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10}>
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
            filtered.map((invoice) => (
              <div
                key={invoice.id}
                className="p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/invoices/${invoice.id}`}
                      className="block truncate font-semibold text-gray-900"
                    >
                      {invoice.invoice_no}
                    </Link>

                    <Link
                      href={`/customers/${invoice.customer_id}`}
                      className="mt-1 block truncate text-xs text-gray-400"
                    >
                      {invoice.customer_name}
                    </Link>
                  </div>

                  <StatusBadge
                    invoice={invoice}
                    now={now}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MobileMetric
                    label="Total"
                    value={money(
                      invoice.total_amount,
                      invoice.currency
                    )}
                  />

                  <MobileMetric
                    label="Balance"
                    value={money(
                      invoice.balance_due,
                      invoice.currency
                    )}
                  />

                  <MobileMetric
                    label="Invoice Date"
                    value={formatDate(
                      invoice.invoice_date
                    )}
                  />

                  <MobileMetric
                    label="Due Date"
                    value={
                      invoice.due_date
                        ? formatDate(
                            invoice.due_date
                          )
                        : "—"
                    }
                  />
                </div>

                <div className="mt-4">
                  <SmartAction
                    invoice={invoice}
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
  invoice,
  full = false,
}: {
  invoice: Invoice;
  full?: boolean;
}) {
  const base = full
    ? "block w-full text-center"
    : "inline-flex";

  if (invoice.status === "draft") {
    return (
      <Link
        href={`/invoices/${invoice.id}`}
        className={`${base} rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white`}
      >
        Open Invoice
      </Link>
    );
  }

  if (
    invoice.balance_due > 0.000001
  ) {
    return (
      <Link
        href={`/invoices/${invoice.id}`}
        className={`${base} rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white`}
      >
        Record Payment
      </Link>
    );
  }

  return (
    <Link
      href={`/invoices/${invoice.id}`}
      className={`${base} rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700`}
    >
      View
    </Link>
  );
}

function CurrencyCard({
  currency,
  invoiced,
  collected,
  outstanding,
  overdue,
}: {
  currency: string;
  invoiced: number;
  collected: number;
  outstanding: number;
  overdue: number;
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
          label="Invoiced"
          value={money(
            invoiced,
            currency
          )}
        />

        <CurrencyMetric
          label="Collected"
          value={money(
            collected,
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

        <CurrencyMetric
          label="Overdue"
          value={money(
            overdue,
            currency
          )}
          tone={
            overdue > 0.000001
              ? "danger"
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
    | "warning"
    | "danger";
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
            : tone === "danger"
            ? "text-red-600"
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
    | "warning"
    | "danger";
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
            : tone === "danger"
            ? "text-red-600"
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

function StatusBadge({
  invoice,
  now,
}: {
  invoice: Invoice;
  now: string;
}) {
  const label = statusLabel(
    invoice,
    now
  );

  const style =
    label === "Paid"
      ? "bg-green-50 text-green-700"
      : label === "Open"
      ? "bg-blue-50 text-blue-700"
      : label === "Partially Paid"
      ? "bg-amber-50 text-amber-700"
      : label === "Overdue"
      ? "bg-red-50 text-red-700"
      : "bg-gray-100 text-gray-700";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${style}`}
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
          ? "No matching invoices"
          : "No invoices yet"}
      </div>

      <p className="mt-1 text-sm text-gray-500">
        {hasFilters
          ? "Try another search term or receivables filter."
          : "Invoices created from fulfilled Sales Orders will appear here."}
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

function isOpen(invoice: Invoice) {
  return (
    invoice.status !== "draft" &&
    invoice.status !== "paid" &&
    invoice.balance_due > 0.000001
  );
}

function isOverdue(
  invoice: Invoice,
  now: string
) {
  return Boolean(
    invoice.due_date &&
      invoice.due_date < now &&
      invoice.balance_due > 0.000001 &&
      invoice.status !== "draft"
  );
}

function statusLabel(
  invoice: Invoice,
  now: string
) {
  if (
    invoice.balance_due <= 0.000001 ||
    invoice.status === "paid"
  ) {
    return "Paid";
  }

  if (isOverdue(invoice, now)) {
    return "Overdue";
  }

  if (
    invoice.status === "partially_paid" ||
    invoice.paid_amount > 0.000001
  ) {
    return "Partially Paid";
  }

  if (invoice.status === "sent") {
    return "Open";
  }

  return "Draft";
}

function formatCurrencySummary(
  totals: Map<
    string,
    {
      invoiced: number;
      collected: number;
      outstanding: number;
      overdue: number;
    }
  >,
  field:
    | "invoiced"
    | "collected"
    | "outstanding"
    | "overdue"
) {
  const rows = Array.from(totals.entries())
    .map(([currency, values]) => ({
      currency,
      amount: values[field],
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

function hasPositive(
  totals: Map<
    string,
    {
      invoiced: number;
      collected: number;
      outstanding: number;
      overdue: number;
    }
  >,
  field:
    | "invoiced"
    | "collected"
    | "outstanding"
    | "overdue"
) {
  return Array.from(
    totals.values()
  ).some(
    (row) => row[field] > 0.000001
  );
}

function today() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
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
