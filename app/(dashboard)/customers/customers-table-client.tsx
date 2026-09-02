"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type CurrencySummary = {
  currency: string;
  sales: number;
  outstanding: number;
};

type Customer = {
  id: number;
  customer_code: string | null;
  customer_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  tax_id: string | null;
  is_active: boolean;
  created_at?: string | null;
  commercial_summary: {
    currencies: CurrencySummary[];
    last_activity: string | null;
  };
};

type StatusFilter = "all" | "active" | "inactive";
type SortKey =
  | "name"
  | "sales"
  | "outstanding"
  | "activity"
  | "status";
type SortDirection = "asc" | "desc";

export default function CustomersTableClient({
  customers,
}: {
  customers: Customer[];
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
      all: customers.length,
      active: customers.filter(
        (customer) => customer.is_active !== false
      ).length,
      inactive: customers.filter(
        (customer) => customer.is_active === false
      ).length,
    }),
    [customers]
  );

  const filteredCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const rows = customers.filter((customer) => {
      const haystack = [
        customer.customer_name,
        customer.customer_code,
        customer.contact_name,
        customer.phone,
        customer.email,
        customer.tax_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        keyword === "" || haystack.includes(keyword);

      const matchesFilter =
        filter === "all"
          ? true
          : filter === "active"
          ? customer.is_active !== false
          : customer.is_active === false;

      return matchesSearch && matchesFilter;
    });

    return [...rows].sort((a, b) => {
      let comparison = 0;

      if (sortKey === "name") {
        comparison = a.customer_name.localeCompare(
          b.customer_name,
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          }
        );
      }

      if (sortKey === "sales") {
        comparison =
          aggregate(a.commercial_summary.currencies, "sales") -
          aggregate(b.commercial_summary.currencies, "sales");
      }

      if (sortKey === "outstanding") {
        comparison =
          aggregate(
            a.commercial_summary.currencies,
            "outstanding"
          ) -
          aggregate(
            b.commercial_summary.currencies,
            "outstanding"
          );
      }

      if (sortKey === "activity") {
        comparison = String(
          a.commercial_summary.last_activity || ""
        ).localeCompare(
          String(
            b.commercial_summary.last_activity || ""
          )
        );
      }

      if (sortKey === "status") {
        const left =
          a.is_active === false ? "inactive" : "active";
        const right =
          b.is_active === false ? "inactive" : "active";

        comparison = left.localeCompare(right);
      }

      return sortDirection === "asc"
        ? comparison
        : -comparison;
    });
  }, [
    customers,
    search,
    filter,
    sortKey,
    sortDirection,
  ]);

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection(
        sortDirection === "asc" ? "desc" : "asc"
      );
      return;
    }

    setSortKey(nextKey);
    setSortDirection(
      nextKey === "name" || nextKey === "status"
        ? "asc"
        : "desc"
    );
  }

  function clearFilters() {
    setSearch("");
    setFilter("all");
  }

  const hasFilters =
    search.trim() !== "" || filter !== "all";

  return (
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
                placeholder="Search name, code, contact, phone, email or Tax ID..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <FilterButton
                active={filter === "all"}
                onClick={() => setFilter("all")}
                label="All"
                count={counts.all}
              />
              <FilterButton
                active={filter === "active"}
                onClick={() => setFilter("active")}
                label="Active"
                count={counts.active}
              />
              <FilterButton
                active={filter === "inactive"}
                onClick={() => setFilter("inactive")}
                label="Inactive"
                count={counts.inactive}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>
              Showing{" "}
              <strong className="font-semibold text-gray-900">
                {filteredCustomers.length}
              </strong>{" "}
              of{" "}
              <strong className="font-semibold text-gray-900">
                {customers.length}
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
        <table className="min-w-full">
          <thead className="bg-gray-50/80">
            <tr className="border-b border-gray-200">
              <SortableHeader
                label="Customer"
                active={sortKey === "name"}
                direction={sortDirection}
                onClick={() => handleSort("name")}
              />
              <Header>Contact</Header>
              <SortableHeader
                label="Sales"
                active={sortKey === "sales"}
                direction={sortDirection}
                onClick={() => handleSort("sales")}
              />
              <SortableHeader
                label="Outstanding A/R"
                active={sortKey === "outstanding"}
                direction={sortDirection}
                onClick={() =>
                  handleSort("outstanding")
                }
              />
              <SortableHeader
                label="Last Activity"
                active={sortKey === "activity"}
                direction={sortDirection}
                onClick={() => handleSort("activity")}
              />
              <SortableHeader
                label="Status"
                active={sortKey === "status"}
                direction={sortDirection}
                onClick={() => handleSort("status")}
              />
              <Header align="right">Actions</Header>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((customer) => {
                const hasOutstanding =
                  customer.commercial_summary.currencies.some(
                    (row) => row.outstanding > 0.000001
                  );

                return (
                  <tr
                    key={customer.id}
                    className="group transition hover:bg-gray-50/70"
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="flex min-w-[220px] items-center gap-3"
                      >
                        <CustomerAvatar
                          name={customer.customer_name}
                          active={
                            customer.is_active !== false
                          }
                        />

                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-gray-900 group-hover:underline">
                            {customer.customer_name}
                          </div>

                          <div className="mt-1 text-xs text-gray-400">
                            {customer.customer_code ||
                              `Customer #${customer.id}`}
                          </div>
                        </div>
                      </Link>
                    </td>

                    <td className="px-5 py-4">
                      <div className="min-w-[200px]">
                        <div className="text-sm font-medium text-gray-700">
                          {customer.contact_name || "—"}
                        </div>

                        <div className="mt-1 truncate text-xs text-gray-400">
                          {customer.email ||
                            customer.phone ||
                            "No contact details"}
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <CurrencyStack
                        rows={
                          customer.commercial_summary
                            .currencies
                        }
                        field="sales"
                      />
                    </td>

                    <td className="px-5 py-4">
                      <CurrencyStack
                        rows={
                          customer.commercial_summary
                            .currencies
                        }
                        field="outstanding"
                        warning={hasOutstanding}
                      />
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                      {customer.commercial_summary
                        .last_activity
                        ? formatDate(
                            customer
                              .commercial_summary
                              .last_activity
                          )
                        : "—"}
                    </td>

                    <td className="px-5 py-4">
                      {customer.is_active === false ? (
                        <Badge tone="default">
                          Inactive
                        </Badge>
                      ) : (
                        <Badge tone="success">
                          Active
                        </Badge>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <div className="inline-flex gap-2">
                        <Link
                          href={`/customers/${customer.id}`}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          360° View
                        </Link>

                        <Link
                          href={`/customers/${customer.id}/edit`}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                        >
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7}>
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
        {filteredCustomers.length > 0 ? (
          filteredCustomers.map((customer) => {
            const hasOutstanding =
              customer.commercial_summary.currencies.some(
                (row) => row.outstanding > 0.000001
              );

            return (
              <div key={customer.id} className="p-4">
                <div className="flex items-start gap-3">
                  <CustomerAvatar
                    name={customer.customer_name}
                    active={customer.is_active !== false}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/customers/${customer.id}`}
                          className="block truncate font-semibold text-gray-900"
                        >
                          {customer.customer_name}
                        </Link>

                        <div className="mt-1 text-xs text-gray-400">
                          {customer.customer_code ||
                            `Customer #${customer.id}`}
                        </div>
                      </div>

                      {customer.is_active === false ? (
                        <Badge tone="default">
                          Inactive
                        </Badge>
                      ) : (
                        <Badge tone="success">
                          Active
                        </Badge>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <MobileMetric
                        label="Sales"
                        value={
                          <CurrencyStack
                            rows={
                              customer.commercial_summary
                                .currencies
                            }
                            field="sales"
                          />
                        }
                      />

                      <MobileMetric
                        label="Outstanding"
                        value={
                          <CurrencyStack
                            rows={
                              customer.commercial_summary
                                .currencies
                            }
                            field="outstanding"
                            warning={hasOutstanding}
                          />
                        }
                      />

                      <MobileMetric
                        label="Contact"
                        value={
                          customer.contact_name ||
                          customer.email ||
                          "—"
                        }
                      />

                      <MobileMetric
                        label="Last Activity"
                        value={
                          customer.commercial_summary
                            .last_activity
                            ? formatDate(
                                customer
                                  .commercial_summary
                                  .last_activity
                              )
                            : "—"
                        }
                      />
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="flex-1 rounded-lg bg-gray-900 px-3 py-2 text-center text-sm font-medium text-white"
                      >
                        Open 360°
                      </Link>

                      <Link
                        href={`/customers/${customer.id}/edit`}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState
            hasFilters={hasFilters}
            onClear={clearFilters}
          />
        )}
      </div>

      {filteredCustomers.length > 0 && (
        <div className="border-t border-gray-200 bg-gray-50/60 px-5 py-3 text-xs text-gray-500">
          Commercial values are shown by transaction currency; currencies are never mixed into a single converted total.
        </div>
      )}
    </section>
  );
}

function FilterButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
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

function CustomerAvatar({
  name,
  active,
}: {
  name: string;
  active: boolean;
}) {
  return (
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-xs font-semibold text-white">
      {initials(name)}
      <span
        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${
          active ? "bg-green-500" : "bg-gray-300"
        }`}
      />
    </div>
  );
}

function Header({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 ${
        align === "right" ? "text-right" : "text-left"
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
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  return (
    <th className="px-5 py-3 text-left">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-900"
      >
        {label}
        <span className={active ? "text-gray-900" : "text-gray-300"}>
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

function CurrencyStack({
  rows,
  field,
  warning = false,
}: {
  rows: CurrencySummary[];
  field: "sales" | "outstanding";
  warning?: boolean;
}) {
  const visible = rows
    .filter(
      (row) => Math.abs(Number(row[field] || 0)) > 0.000001
    )
    .sort((a, b) =>
      a.currency.localeCompare(b.currency)
    );

  if (visible.length === 0) {
    return (
      <span
        className={
          field === "outstanding"
            ? "text-sm font-semibold text-green-700"
            : "text-sm text-gray-400"
        }
      >
        {field === "outstanding" ? "฿0.00" : "—"}
      </span>
    );
  }

  return (
    <div className="space-y-1">
      {visible.map((row) => (
        <div
          key={row.currency}
          className={`whitespace-nowrap text-sm font-semibold ${
            field === "outstanding" && warning
              ? "text-amber-600"
              : field === "outstanding"
              ? "text-green-700"
              : "text-gray-900"
          }`}
        >
          {money(row[field], row.currency)}
        </div>
      ))}
    </div>
  );
}

function MobileMetric({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
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
          ? "No matching customers"
          : "No customers yet"}
      </div>

      <p className="mt-1 text-sm text-gray-500">
        {hasFilters
          ? "Try another search or status filter."
          : "Add your first customer to start sales workflows."}
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

function aggregate(
  rows: CurrencySummary[],
  field: "sales" | "outstanding"
) {
  return rows.reduce(
    (sum, row) => sum + Number(row[field] || 0),
    0
  );
}

function formatDate(value: string) {
  const parts = String(value || "").split("-");

  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return value || "-";
}

function initials(value: string) {
  const parts = String(value || "C")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "C"
  );
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
