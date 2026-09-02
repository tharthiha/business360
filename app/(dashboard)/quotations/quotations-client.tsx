"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Quotation = {
  id: number;
  quotation_no: string;
  customer_id: number | null;
  customer_name: string;
  quotation_date: string;
  valid_until: string | null;
  status: string;
  currency: string;
  total_amount: number;
  created_at: string | null;
};

type StatusFilter =
  | "all"
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired";

type SortKey =
  | "date"
  | "amount"
  | "customer"
  | "status"
  | "validity";

type SortDirection = "asc" | "desc";

export default function QuotationsClient({
  quotations,
}: {
  quotations: Quotation[];
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");
  const [sortKey, setSortKey] =
    useState<SortKey>("date");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("desc");

  const counts = useMemo(() => {
    const now = today();

    return {
      all: quotations.length,
      draft: quotations.filter(
        (q) => normalizedStatus(q, now) === "draft"
      ).length,
      sent: quotations.filter(
        (q) => normalizedStatus(q, now) === "sent"
      ).length,
      accepted: quotations.filter(
        (q) => normalizedStatus(q, now) === "accepted"
      ).length,
      rejected: quotations.filter(
        (q) => normalizedStatus(q, now) === "rejected"
      ).length,
      expired: quotations.filter(
        (q) => normalizedStatus(q, now) === "expired"
      ).length,
    };
  }, [quotations]);

  const pipelineTotals = useMemo(() => {
    const map = new Map<
      string,
      {
        total: number;
        open: number;
        accepted: number;
      }
    >();

    const now = today();

    function ensure(currency: string) {
      if (!map.has(currency)) {
        map.set(currency, {
          total: 0,
          open: 0,
          accepted: 0,
        });
      }

      return map.get(currency)!;
    }

    for (const quotation of quotations) {
      const status = normalizedStatus(
        quotation,
        now
      );

      const row = ensure(
        quotation.currency || "THB"
      );

      row.total += quotation.total_amount;

      if (
        status === "draft" ||
        status === "sent"
      ) {
        row.open += quotation.total_amount;
      }

      if (status === "accepted") {
        row.accepted += quotation.total_amount;
      }
    }

    return map;
  }, [quotations]);

  const acceptanceRate =
    quotations.length > 0
      ? Math.round(
          (counts.accepted /
            Math.max(
              counts.accepted + counts.rejected,
              1
            )) *
            100
        )
      : 0;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const now = today();

    const rows = quotations.filter((quotation) => {
      const status = normalizedStatus(
        quotation,
        now
      );

      const haystack = [
        quotation.quotation_no,
        quotation.customer_name,
        quotation.currency,
        status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !term || haystack.includes(term);

      const matchesStatus =
        statusFilter === "all"
          ? true
          : status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    return [...rows].sort((a, b) => {
      let comparison = 0;

      if (sortKey === "date") {
        comparison = String(
          a.quotation_date || ""
        ).localeCompare(
          String(b.quotation_date || "")
        );
      }

      if (sortKey === "amount") {
        comparison =
          a.total_amount - b.total_amount;
      }

      if (sortKey === "customer") {
        comparison = a.customer_name.localeCompare(
          b.customer_name,
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          }
        );
      }

      if (sortKey === "status") {
        comparison = normalizedStatus(
          a,
          today()
        ).localeCompare(
          normalizedStatus(b, today())
        );
      }

      if (sortKey === "validity") {
        comparison = String(
          a.valid_until || ""
        ).localeCompare(
          String(b.valid_until || "")
        );
      }

      return sortDirection === "asc"
        ? comparison
        : -comparison;
    });
  }, [
    quotations,
    search,
    statusFilter,
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
    search.trim() !== "" ||
    statusFilter !== "all";

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Quotations"
          value={String(counts.all)}
          hint={`${counts.draft} draft • ${counts.sent} sent`}
        />

        <SummaryCard
          label="Open Pipeline"
          value={formatCurrencySummary(
            pipelineTotals,
            "open"
          )}
          hint="Draft + sent quotation value"
        />

        <SummaryCard
          label="Accepted Value"
          value={formatCurrencySummary(
            pipelineTotals,
            "accepted"
          )}
          hint={`${counts.accepted} accepted`}
          tone="positive"
        />

        <SummaryCard
          label="Acceptance Rate"
          value={`${acceptanceRate}%`}
          hint={`${counts.accepted} accepted • ${counts.rejected} rejected`}
        />
      </div>

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
                  placeholder="Search quotation, customer, status or currency..."
                  style={{
                    backgroundColor: "#f9fafb",
                    color: "#111827",
                    WebkitTextFillColor: "#111827",
                    colorScheme: "light",
                  }}
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:bg-white"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <FilterButton
                  active={statusFilter === "all"}
                  onClick={() =>
                    setStatusFilter("all")
                  }
                  label="All"
                  count={counts.all}
                />

                <FilterButton
                  active={statusFilter === "draft"}
                  onClick={() =>
                    setStatusFilter("draft")
                  }
                  label="Draft"
                  count={counts.draft}
                />

                <FilterButton
                  active={statusFilter === "sent"}
                  onClick={() =>
                    setStatusFilter("sent")
                  }
                  label="Sent"
                  count={counts.sent}
                />

                <FilterButton
                  active={
                    statusFilter === "accepted"
                  }
                  onClick={() =>
                    setStatusFilter("accepted")
                  }
                  label="Accepted"
                  count={counts.accepted}
                />

                <FilterButton
                  active={
                    statusFilter === "expired"
                  }
                  onClick={() =>
                    setStatusFilter("expired")
                  }
                  label="Expired"
                  count={counts.expired}
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
                  {quotations.length}
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

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full">
            <thead className="bg-gray-50/80">
              <tr className="border-b border-gray-200">
                <Header>Quotation</Header>

                <SortableHeader
                  label="Customer"
                  active={sortKey === "customer"}
                  direction={sortDirection}
                  onClick={() =>
                    handleSort("customer")
                  }
                />

                <SortableHeader
                  label="Date"
                  active={sortKey === "date"}
                  direction={sortDirection}
                  onClick={() =>
                    handleSort("date")
                  }
                />

                <SortableHeader
                  label="Valid Until"
                  active={sortKey === "validity"}
                  direction={sortDirection}
                  onClick={() =>
                    handleSort("validity")
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
                  active={sortKey === "amount"}
                  direction={sortDirection}
                  onClick={() =>
                    handleSort("amount")
                  }
                  right
                />

                <Header right>Actions</Header>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filtered.length > 0 ? (
                filtered.map((quotation) => {
                  const status = normalizedStatus(
                    quotation,
                    today()
                  );

                  return (
                    <tr
                      key={quotation.id}
                      className="group transition hover:bg-gray-50/70"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/quotations/${quotation.id}`}
                          className="font-semibold text-gray-900 group-hover:underline"
                        >
                          {quotation.quotation_no}
                        </Link>

                        <div className="mt-1 text-xs text-gray-400">
                          Quotation #{quotation.id}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {quotation.customer_id ? (
                          <Link
                            href={`/customers/${quotation.customer_id}`}
                            className="text-sm font-medium text-gray-700 hover:underline"
                          >
                            {quotation.customer_name}
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-600">
                            {quotation.customer_name}
                          </span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                        {formatDate(
                          quotation.quotation_date
                        )}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <ValidityCell
                          value={quotation.valid_until}
                          status={status}
                        />
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          status={status}
                        />
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right text-sm font-semibold text-gray-900">
                        {money(
                          quotation.total_amount,
                          quotation.currency
                        )}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <div className="inline-flex gap-2">
                          <Link
                            href={`/quotations/${quotation.id}`}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            View
                          </Link>

                          <Link
                            href={`/quotations/${quotation.id}/edit`}
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

        <div className="divide-y divide-gray-100 md:hidden">
          {filtered.length > 0 ? (
            filtered.map((quotation) => {
              const status = normalizedStatus(
                quotation,
                today()
              );

              return (
                <div
                  key={quotation.id}
                  className="p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/quotations/${quotation.id}`}
                        className="block truncate font-semibold text-gray-900"
                      >
                        {quotation.quotation_no}
                      </Link>

                      <div className="mt-1 truncate text-xs text-gray-400">
                        {quotation.customer_name}
                      </div>
                    </div>

                    <StatusBadge status={status} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <MobileMetric
                      label="Total"
                      value={money(
                        quotation.total_amount,
                        quotation.currency
                      )}
                    />

                    <MobileMetric
                      label="Date"
                      value={formatDate(
                        quotation.quotation_date
                      )}
                    />

                    <MobileMetric
                      label="Valid Until"
                      value={
                        quotation.valid_until
                          ? formatDate(
                              quotation.valid_until
                            )
                          : "—"
                      }
                    />

                    <MobileMetric
                      label="Customer"
                      value={quotation.customer_name}
                    />
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Link
                      href={`/quotations/${quotation.id}`}
                      className="flex-1 rounded-lg bg-gray-900 px-3 py-2 text-center text-sm font-medium text-white"
                    >
                      Open
                    </Link>

                    <Link
                      href={`/quotations/${quotation.id}/edit`}
                      className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700"
                    >
                      Edit
                    </Link>
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

        {filtered.length > 0 && (
          <div className="border-t border-gray-200 bg-gray-50/60 px-5 py-3 text-xs text-gray-500">
            Pipeline values are shown by quotation currency; currencies are never mixed into one converted total.
          </div>
        )}
      </section>
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
  tone?: "normal" | "positive";
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
  status,
}: {
  status: string;
}) {
  const normalized = status || "draft";

  const style =
    normalized === "accepted"
      ? "bg-green-50 text-green-700"
      : normalized === "sent"
      ? "bg-blue-50 text-blue-700"
      : normalized === "rejected"
      ? "bg-red-50 text-red-700"
      : normalized === "expired"
      ? "bg-amber-50 text-amber-700"
      : "bg-gray-100 text-gray-700";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${style}`}
    >
      {normalized}
    </span>
  );
}

function ValidityCell({
  value,
  status,
}: {
  value: string | null;
  status: string;
}) {
  if (!value) {
    return (
      <span className="text-sm text-gray-400">
        —
      </span>
    );
  }

  return (
    <div>
      <div
        className={`text-sm ${
          status === "expired"
            ? "font-medium text-amber-700"
            : "text-gray-600"
        }`}
      >
        {formatDate(value)}
      </div>

      {status === "expired" && (
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-amber-600">
          Expired
        </div>
      )}
    </div>
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
          ? "No matching quotations"
          : "No quotations yet"}
      </div>

      <p className="mt-1 text-sm text-gray-500">
        {hasFilters
          ? "Try another search term or status filter."
          : "Create your first quotation to start the sales pipeline."}
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

function normalizedStatus(
  quotation: Quotation,
  now: string
) {
  const status = String(
    quotation.status || "draft"
  ).toLowerCase();

  if (
    status !== "accepted" &&
    status !== "rejected" &&
    quotation.valid_until &&
    quotation.valid_until < now
  ) {
    return "expired";
  }

  return status;
}

function formatCurrencySummary(
  totals: Map<
    string,
    {
      total: number;
      open: number;
      accepted: number;
    }
  >,
  field: "total" | "open" | "accepted"
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

function formatDate(value: string) {
  if (!value) return "-";

  const normalized = value.slice(0, 10);
  const parts = normalized.split("-");

  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return value;
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
