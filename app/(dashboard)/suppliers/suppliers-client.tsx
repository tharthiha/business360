"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Supplier = {
  id: number;
  supplier_code: string | null;
  supplier_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
  payment_terms: string | null;
  is_active: boolean;
};

type CurrencySummary = {
  currency: string;
  purchases: number;
  outstanding: number;
};

type SupplierRow = Supplier & {
  purchase_order_count: number;
  supplier_bill_count: number;
  last_activity: string | null;
  currencies: CurrencySummary[];
};

type StatusFilter = "all" | "active" | "inactive";
type SortKey =
  | "name"
  | "purchases"
  | "outstanding"
  | "activity"
  | "status";
type SortDirection = "asc" | "desc";

export default function SuppliersClient() {
  const supabase = createClient();

  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");
  const [sortKey, setSortKey] =
    useState<SortKey>("activity");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("desc");

  useEffect(() => {
    loadSupplierDirectory();
  }, []);

  async function loadSupplierDirectory() {
    setLoading(true);
    setError("");

    try {
      const [
        supplierResult,
        purchaseResult,
        billResult,
      ] = await Promise.all([
        supabase
          .from("suppliers")
          .select(`
            id,
            supplier_code,
            supplier_name,
            contact_name,
            phone,
            email,
            city,
            country,
            payment_terms,
            is_active
          `)
          .order("supplier_name", {
            ascending: true,
          }),

        supabase
          .from("purchase_orders")
          .select(`
            id,
            supplier_id,
            order_date,
            status,
            currency,
            total_amount
          `),

        // Select the full row so this screen remains compatible with
        // existing supplier-bill schemas while we normalize the common
        // commercial fields below.
        supabase
          .from("supplier_bills")
          .select("*"),
      ]);

      if (supplierResult.error) {
        throw supplierResult.error;
      }

      if (purchaseResult.error) {
        throw purchaseResult.error;
      }

      if (billResult.error) {
        throw billResult.error;
      }

      const summaryMap = new Map<
        number,
        {
          purchaseOrderCount: number;
          supplierBillCount: number;
          lastActivity: string | null;
          currencies: Map<
            string,
            {
              purchases: number;
              outstanding: number;
            }
          >;
        }
      >();

      function ensureSupplier(supplierId: number) {
        if (!summaryMap.has(supplierId)) {
          summaryMap.set(supplierId, {
            purchaseOrderCount: 0,
            supplierBillCount: 0,
            lastActivity: null,
            currencies: new Map(),
          });
        }

        return summaryMap.get(supplierId)!;
      }

      function ensureCurrency(
        supplierId: number,
        currency: string
      ) {
        const row = ensureSupplier(supplierId);

        if (!row.currencies.has(currency)) {
          row.currencies.set(currency, {
            purchases: 0,
            outstanding: 0,
          });
        }

        return row.currencies.get(currency)!;
      }

      function updateLastActivity(
        supplierId: number,
        value: unknown
      ) {
        if (!value) return;

        const date = String(value).slice(0, 10);
        const row = ensureSupplier(supplierId);

        if (
          !row.lastActivity ||
          date > row.lastActivity
        ) {
          row.lastActivity = date;
        }
      }

      for (const raw of purchaseResult.data || []) {
        const row = raw as any;
        const supplierId = Number(row.supplier_id);

        if (!Number.isFinite(supplierId)) {
          continue;
        }

        const summary = ensureSupplier(supplierId);
        summary.purchaseOrderCount += 1;

        const status = String(
          row.status || ""
        ).toLowerCase();

        if (status !== "cancelled") {
          ensureCurrency(
            supplierId,
            row.currency || "THB"
          ).purchases += Number(
            row.total_amount || 0
          );
        }

        updateLastActivity(
          supplierId,
          row.order_date
        );
      }

      for (const raw of billResult.data || []) {
        const row = raw as any;
        const supplierId = Number(row.supplier_id);

        if (!Number.isFinite(supplierId)) {
          continue;
        }

        const summary = ensureSupplier(supplierId);
        summary.supplierBillCount += 1;

        const total = numberFrom(
          row.total_amount,
          row.bill_total,
          row.amount
        );

        const paid = numberFrom(
          row.paid_amount,
          row.amount_paid,
          row.payment_amount
        );

        const outstanding = numberFromNullable(
          row.balance_due,
          row.outstanding_amount,
          row.balance_amount
        );

        const resolvedOutstanding =
          outstanding !== null
            ? outstanding
            : Math.max(total - paid, 0);

        ensureCurrency(
          supplierId,
          row.currency || "THB"
        ).outstanding += resolvedOutstanding;

        updateLastActivity(
          supplierId,
          row.bill_date ||
            row.invoice_date ||
            row.created_at
        );
      }

      const normalized: SupplierRow[] = (
        supplierResult.data || []
      ).map((supplier: any) => {
        const summary = summaryMap.get(
          Number(supplier.id)
        );

        const currencies = summary
          ? Array.from(
              summary.currencies.entries()
            ).map(([currency, value]) => ({
              currency,
              purchases: value.purchases,
              outstanding: value.outstanding,
            }))
          : [];

        return {
          id: Number(supplier.id),
          supplier_code:
            supplier.supplier_code || null,
          supplier_name:
            supplier.supplier_name || "-",
          contact_name:
            supplier.contact_name || null,
          phone: supplier.phone || null,
          email: supplier.email || null,
          city: supplier.city || null,
          country: supplier.country || null,
          payment_terms:
            supplier.payment_terms || null,
          is_active:
            supplier.is_active !== false,
          purchase_order_count:
            summary?.purchaseOrderCount || 0,
          supplier_bill_count:
            summary?.supplierBillCount || 0,
          last_activity:
            summary?.lastActivity || null,
          currencies,
        };
      });

      setSuppliers(normalized);
    } catch (err) {
      console.error(
        "[suppliers-directory]",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Could not load suppliers."
      );
    } finally {
      setLoading(false);
    }
  }

  const counts = useMemo(
    () => ({
      all: suppliers.length,
      active: suppliers.filter(
        (supplier) => supplier.is_active
      ).length,
      inactive: suppliers.filter(
        (supplier) => !supplier.is_active
      ).length,
    }),
    [suppliers]
  );

  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLowerCase();

    const rows = suppliers.filter((supplier) => {
      const haystack = [
        supplier.supplier_name,
        supplier.supplier_code,
        supplier.contact_name,
        supplier.phone,
        supplier.email,
        supplier.city,
        supplier.country,
        supplier.payment_terms,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !term || haystack.includes(term);

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
          ? supplier.is_active
          : !supplier.is_active;

      return matchesSearch && matchesStatus;
    });

    return [...rows].sort((a, b) => {
      let comparison = 0;

      if (sortKey === "name") {
        comparison = a.supplier_name.localeCompare(
          b.supplier_name,
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          }
        );
      }

      if (sortKey === "purchases") {
        comparison =
          aggregate(a.currencies, "purchases") -
          aggregate(b.currencies, "purchases");
      }

      if (sortKey === "outstanding") {
        comparison =
          aggregate(a.currencies, "outstanding") -
          aggregate(b.currencies, "outstanding");
      }

      if (sortKey === "activity") {
        comparison = String(
          a.last_activity || ""
        ).localeCompare(
          String(b.last_activity || "")
        );
      }

      if (sortKey === "status") {
        comparison = String(
          a.is_active ? "active" : "inactive"
        ).localeCompare(
          String(
            b.is_active ? "active" : "inactive"
          )
        );
      }

      return sortDirection === "asc"
        ? comparison
        : -comparison;
    });
  }, [
    suppliers,
    search,
    statusFilter,
    sortKey,
    sortDirection,
  ]);

  const portfolio = useMemo(() => {
    const currencies = new Map<
      string,
      {
        purchases: number;
        outstanding: number;
      }
    >();

    let purchaseOrders = 0;
    let supplierBills = 0;
    let lastActivity: string | null = null;

    for (const supplier of suppliers) {
      purchaseOrders +=
        supplier.purchase_order_count;
      supplierBills +=
        supplier.supplier_bill_count;

      if (
        supplier.last_activity &&
        (!lastActivity ||
          supplier.last_activity > lastActivity)
      ) {
        lastActivity = supplier.last_activity;
      }

      for (const row of supplier.currencies) {
        if (!currencies.has(row.currency)) {
          currencies.set(row.currency, {
            purchases: 0,
            outstanding: 0,
          });
        }

        const total = currencies.get(
          row.currency
        )!;

        total.purchases += row.purchases;
        total.outstanding += row.outstanding;
      }
    }

    return {
      currencies,
      purchaseOrders,
      supplierBills,
      lastActivity,
    };
  }, [suppliers]);

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
    setStatusFilter("all");
  }

  const hasFilters =
    search.trim() !== "" ||
    statusFilter !== "all";

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Suppliers
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Vendor accounts, purchasing activity and accounts payable position.
          </p>
        </div>

        <Link
          href="/suppliers/new"
          style={{
            backgroundColor: "#111827",
            color: "#ffffff",
          }}
          className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold"
        >
          + Add Supplier
        </Link>
      </div>

      {/* SUMMARY */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Suppliers"
          value={String(counts.all)}
          hint={`${counts.active} active`}
        />

        <SummaryCard
          label="Purchase Orders"
          value={String(portfolio.purchaseOrders)}
          hint={`${portfolio.supplierBills} supplier bills`}
        />

        <SummaryCard
          label="Portfolio Purchases"
          value={formatCurrencySummary(
            portfolio.currencies,
            "purchases"
          )}
          hint="Purchase orders excluding cancelled"
        />

        <SummaryCard
          label="Outstanding A/P"
          value={formatCurrencySummary(
            portfolio.currencies,
            "outstanding"
          )}
          hint={
            portfolio.lastActivity
              ? `Last activity ${formatDate(
                  portfolio.lastActivity
                )}`
              : "No supplier activity yet"
          }
          tone={
            hasPositiveTotal(
              portfolio.currencies,
              "outstanding"
            )
              ? "warning"
              : "positive"
          }
        />
      </div>

      {/* DIRECTORY */}

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
                  placeholder="Search supplier, contact, phone, location or payment terms..."
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
                  active={
                    statusFilter === "active"
                  }
                  onClick={() =>
                    setStatusFilter("active")
                  }
                  label="Active"
                  count={counts.active}
                />

                <FilterButton
                  active={
                    statusFilter === "inactive"
                  }
                  onClick={() =>
                    setStatusFilter("inactive")
                  }
                  label="Inactive"
                  count={counts.inactive}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>
                Showing{" "}
                <strong className="font-semibold text-gray-900">
                  {filteredSuppliers.length}
                </strong>{" "}
                of{" "}
                <strong className="font-semibold text-gray-900">
                  {suppliers.length}
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

        {loading ? (
          <div className="px-6 py-14 text-center text-sm text-gray-500">
            Loading supplier directory...
          </div>
        ) : error ? (
          <div className="px-6 py-14 text-center text-sm text-red-600">
            {error}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full">
                <thead className="bg-gray-50/80">
                  <tr className="border-b border-gray-200">
                    <SortableHeader
                      label="Supplier"
                      active={sortKey === "name"}
                      direction={sortDirection}
                      onClick={() =>
                        handleSort("name")
                      }
                    />

                    <Header>Contact</Header>

                    <SortableHeader
                      label="Purchases"
                      active={sortKey === "purchases"}
                      direction={sortDirection}
                      onClick={() =>
                        handleSort("purchases")
                      }
                    />

                    <SortableHeader
                      label="Outstanding A/P"
                      active={
                        sortKey === "outstanding"
                      }
                      direction={sortDirection}
                      onClick={() =>
                        handleSort("outstanding")
                      }
                    />

                    <Header>PO / Bills</Header>

                    <SortableHeader
                      label="Last Activity"
                      active={sortKey === "activity"}
                      direction={sortDirection}
                      onClick={() =>
                        handleSort("activity")
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

                    <Header right>Actions</Header>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredSuppliers.length > 0 ? (
                    filteredSuppliers.map(
                      (supplier) => {
                        const hasOutstanding =
                          supplier.currencies.some(
                            (row) =>
                              row.outstanding >
                              0.000001
                          );

                        return (
                          <tr
                            key={supplier.id}
                            className="group transition hover:bg-gray-50/70"
                          >
                            <td className="px-5 py-4">
                              <Link
                                href={`/suppliers/${supplier.id}`}
                                className="flex min-w-[220px] items-center gap-3"
                              >
                                <SupplierAvatar
                                  name={
                                    supplier.supplier_name
                                  }
                                  active={
                                    supplier.is_active
                                  }
                                />

                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-gray-900 group-hover:underline">
                                    {
                                      supplier.supplier_name
                                    }
                                  </div>

                                  <div className="mt-1 text-xs text-gray-400">
                                    {supplier.supplier_code ||
                                      `Supplier #${supplier.id}`}
                                  </div>
                                </div>
                              </Link>
                            </td>

                            <td className="px-5 py-4">
                              <div className="min-w-[190px]">
                                <div className="text-sm font-medium text-gray-700">
                                  {supplier.contact_name ||
                                    "—"}
                                </div>

                                <div className="mt-1 truncate text-xs text-gray-400">
                                  {supplier.email ||
                                    supplier.phone ||
                                    formatLocation(
                                      supplier.city,
                                      supplier.country
                                    )}
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <CurrencyStack
                                rows={
                                  supplier.currencies
                                }
                                field="purchases"
                              />
                            </td>

                            <td className="px-5 py-4">
                              <CurrencyStack
                                rows={
                                  supplier.currencies
                                }
                                field="outstanding"
                                warning={
                                  hasOutstanding
                                }
                              />
                            </td>

                            <td className="whitespace-nowrap px-5 py-4">
                              <div className="text-sm font-medium text-gray-800">
                                {
                                  supplier.purchase_order_count
                                }{" "}
                                PO
                              </div>

                              <div className="mt-1 text-xs text-gray-400">
                                {
                                  supplier.supplier_bill_count
                                }{" "}
                                bills
                              </div>
                            </td>

                            <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                              {supplier.last_activity
                                ? formatDate(
                                    supplier.last_activity
                                  )
                                : "—"}
                            </td>

                            <td className="px-5 py-4">
                              <StatusBadge
                                active={
                                  supplier.is_active
                                }
                              />
                            </td>

                            <td className="whitespace-nowrap px-5 py-4 text-right">
                              <div className="inline-flex gap-2">
                                <Link
                                  href={`/suppliers/${supplier.id}`}
                                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                  360° View
                                </Link>

                                <Link
                                  href={`/suppliers/${supplier.id}/edit`}
                                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                                >
                                  Edit
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    )
                  ) : (
                    <tr>
                      <td colSpan={8}>
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
              {filteredSuppliers.length > 0 ? (
                filteredSuppliers.map((supplier) => {
                  const hasOutstanding =
                    supplier.currencies.some(
                      (row) =>
                        row.outstanding > 0.000001
                    );

                  return (
                    <div
                      key={supplier.id}
                      className="p-4"
                    >
                      <div className="flex items-start gap-3">
                        <SupplierAvatar
                          name={supplier.supplier_name}
                          active={supplier.is_active}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Link
                                href={`/suppliers/${supplier.id}`}
                                className="block truncate font-semibold text-gray-900"
                              >
                                {supplier.supplier_name}
                              </Link>

                              <div className="mt-1 text-xs text-gray-400">
                                {supplier.supplier_code ||
                                  `Supplier #${supplier.id}`}
                              </div>
                            </div>

                            <StatusBadge
                              active={supplier.is_active}
                            />
                          </div>

                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <MobileMetric
                              label="Purchases"
                              value={
                                <CurrencyStack
                                  rows={
                                    supplier.currencies
                                  }
                                  field="purchases"
                                />
                              }
                            />

                            <MobileMetric
                              label="Outstanding"
                              value={
                                <CurrencyStack
                                  rows={
                                    supplier.currencies
                                  }
                                  field="outstanding"
                                  warning={
                                    hasOutstanding
                                  }
                                />
                              }
                            />

                            <MobileMetric
                              label="PO / Bills"
                              value={`${supplier.purchase_order_count} / ${supplier.supplier_bill_count}`}
                            />

                            <MobileMetric
                              label="Last Activity"
                              value={
                                supplier.last_activity
                                  ? formatDate(
                                      supplier.last_activity
                                    )
                                  : "—"
                              }
                            />
                          </div>

                          <div className="mt-4 flex gap-2">
                            <Link
                              href={`/suppliers/${supplier.id}`}
                              className="flex-1 rounded-lg bg-gray-900 px-3 py-2 text-center text-sm font-medium text-white"
                            >
                              Open 360°
                            </Link>

                            <Link
                              href={`/suppliers/${supplier.id}/edit`}
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
          </>
        )}

        {!loading &&
          !error &&
          filteredSuppliers.length > 0 && (
            <div className="border-t border-gray-200 bg-gray-50/60 px-5 py-3 text-xs text-gray-500">
              Commercial values are displayed by transaction currency; currencies are never mixed into one converted total.
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

      <div
        className={`mt-2 text-2xl font-semibold ${valueClass}`}
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

function SupplierAvatar({
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
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        active
          ? "bg-green-50 text-green-700"
          : "bg-gray-100 text-gray-600"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function CurrencyStack({
  rows,
  field,
  warning = false,
}: {
  rows: CurrencySummary[];
  field: "purchases" | "outstanding";
  warning?: boolean;
}) {
  const visible = rows
    .filter(
      (row) =>
        Math.abs(Number(row[field] || 0)) >
        0.000001
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
        {field === "outstanding"
          ? "฿0.00"
          : "—"}
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
          ? "No matching suppliers"
          : "No suppliers yet"}
      </div>

      <p className="mt-1 text-sm text-gray-500">
        {hasFilters
          ? "Try another search or status filter."
          : "Add your first supplier to start purchasing workflows."}
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
  field: "purchases" | "outstanding"
) {
  return rows.reduce(
    (sum, row) =>
      sum + Number(row[field] || 0),
    0
  );
}

function formatCurrencySummary(
  totals: Map<
    string,
    {
      purchases: number;
      outstanding: number;
    }
  >,
  field: "purchases" | "outstanding"
) {
  const rows = Array.from(
    totals.entries()
  )
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
      purchases: number;
      outstanding: number;
    }
  >,
  field: "purchases" | "outstanding"
) {
  return Array.from(totals.values()).some(
    (row) => row[field] > 0.000001
  );
}

function numberFrom(...values: unknown[]) {
  for (const value of values) {
    const parsed = Number(value);

    if (
      value !== null &&
      value !== undefined &&
      value !== "" &&
      Number.isFinite(parsed)
    ) {
      return parsed;
    }
  }

  return 0;
}

function numberFromNullable(
  ...values: unknown[]
) {
  for (const value of values) {
    const parsed = Number(value);

    if (
      value !== null &&
      value !== undefined &&
      value !== "" &&
      Number.isFinite(parsed)
    ) {
      return parsed;
    }
  }

  return null;
}

function formatLocation(
  city: string | null,
  country: string | null
) {
  const parts = [city, country].filter(Boolean);

  return parts.length > 0
    ? parts.join(", ")
    : "No location";
}

function formatDate(value: string) {
  const parts = String(value || "").split("-");

  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return value || "-";
}

function initials(value: string) {
  const parts = String(value || "S")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return (
    parts
      .slice(0, 2)
      .map(
        (part) =>
          part[0]?.toUpperCase() || ""
      )
      .join("") || "S"
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
