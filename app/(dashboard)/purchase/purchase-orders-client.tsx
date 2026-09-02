"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type SupplierBill = {
  id: number;
  bill_no: string;
  status: string;
  balance_due: number;
} | null;

type PurchaseOrder = {
  id: number;
  purchase_order_no: string;
  supplier_id: number;
  supplier_name: string;
  supplier_code: string | null;
  order_date: string;
  expected_date: string | null;
  status: string;
  currency: string;
  total_amount: number;
  supplier_bill: SupplierBill;
};

type Filter = "all" | "draft" | "receiving" | "received" | "billed" | "cancelled";
type SortKey = "date" | "supplier" | "status" | "total";
type SortDirection = "asc" | "desc";

export default function PurchaseOrdersClient({
  orders,
}: {
  orders: PurchaseOrder[];
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const counts = useMemo(() => ({
    all: orders.length,
    draft: orders.filter((o) => o.status === "draft").length,
    receiving: orders.filter((o) =>
      o.status === "ordered" || o.status === "partially_received"
    ).length,
    received: orders.filter((o) => o.status === "received" && !o.supplier_bill).length,
    billed: orders.filter((o) => Boolean(o.supplier_bill)).length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  }), [orders]);

  const currencyTotals = useMemo(() => {
    const map = new Map<string, { purchases: number; received: number; billed: number }>();

    const ensure = (currency: string) => {
      if (!map.has(currency)) {
        map.set(currency, { purchases: 0, received: 0, billed: 0 });
      }
      return map.get(currency)!;
    };

    for (const order of orders) {
      if (order.status !== "cancelled") {
        ensure(order.currency).purchases += order.total_amount;
      }
      if (order.status === "received") {
        ensure(order.currency).received += order.total_amount;
      }
      if (order.supplier_bill) {
        ensure(order.currency).billed += order.total_amount;
      }
    }

    return map;
  }, [orders]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    const rows = orders.filter((order) => {
      const haystack = [
        order.purchase_order_no,
        order.supplier_name,
        order.supplier_code,
        order.status,
        order.currency,
        order.supplier_bill?.bill_no,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchOk = !term || haystack.includes(term);

      let filterOk = true;
      if (filter === "draft") filterOk = order.status === "draft";
      if (filter === "receiving") {
        filterOk = order.status === "ordered" || order.status === "partially_received";
      }
      if (filter === "received") {
        filterOk = order.status === "received" && !order.supplier_bill;
      }
      if (filter === "billed") filterOk = Boolean(order.supplier_bill);
      if (filter === "cancelled") filterOk = order.status === "cancelled";

      return searchOk && filterOk;
    });

    return [...rows].sort((a, b) => {
      let comparison = 0;
      if (sortKey === "date") comparison = a.order_date.localeCompare(b.order_date);
      if (sortKey === "supplier") comparison = a.supplier_name.localeCompare(b.supplier_name);
      if (sortKey === "status") comparison = workflowLabel(a).localeCompare(workflowLabel(b));
      if (sortKey === "total") comparison = a.total_amount - b.total_amount;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [orders, search, filter, sortKey, sortDirection]);

  function sort(next: SortKey) {
    if (sortKey === next) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(next);
    setSortDirection(next === "supplier" || next === "status" ? "asc" : "desc");
  }

  const hasFilters = search.trim() !== "" || filter !== "all";

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link
          href="/purchase/new"
          className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white"
        >
          + New Purchase Order
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Orders" value={String(counts.all)} hint={`${counts.billed} billed`} />
        <SummaryCard label="Purchase Value" value={summary(currencyTotals, "purchases")} hint="Non-cancelled orders" />
        <SummaryCard
          label="Ready to Bill"
          value={String(counts.received)}
          hint="Received, not yet billed"
          tone={counts.received > 0 ? "warning" : "positive"}
        />
        <SummaryCard
          label="Receiving"
          value={String(counts.draft + counts.receiving)}
          hint={`${counts.draft} draft • ${counts.receiving} in receiving`}
          tone={counts.draft + counts.receiving > 0 ? "warning" : "positive"}
        />
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <h2 className="font-semibold text-gray-900">Purchasing by Currency</h2>
          <p className="mt-1 text-sm text-gray-500">
            Purchase values stay separated by transaction currency.
          </p>
        </div>

        <div className="grid gap-4 p-6 xl:grid-cols-2">
          {Array.from(currencyTotals.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([currency, totals]) => (
              <div key={currency} className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Currency</div>
                <div className="mt-1 text-xl font-semibold text-gray-900">{currency}</div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <MiniMetric label="Purchases" value={money(totals.purchases, currency)} />
                  <MiniMetric label="Received" value={money(totals.received, currency)} tone="positive" />
                  <MiniMetric label="Billed" value={money(totals.billed, currency)} />
                </div>
              </div>
            ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search PO, supplier, bill, status or currency..."
                className="w-full max-w-xl rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-400 focus:bg-white"
              />

              <div className="flex flex-wrap gap-2">
                <FilterButton label="All" count={counts.all} active={filter === "all"} onClick={() => setFilter("all")} />
                <FilterButton label="Draft" count={counts.draft} active={filter === "draft"} onClick={() => setFilter("draft")} />
                <FilterButton label="Receiving" count={counts.receiving} active={filter === "receiving"} onClick={() => setFilter("receiving")} />
                <FilterButton label="Ready to Bill" count={counts.received} active={filter === "received"} onClick={() => setFilter("received")} />
                <FilterButton label="Billed" count={counts.billed} active={filter === "billed"} onClick={() => setFilter("billed")} />
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm text-gray-500">
              Showing <strong className="text-gray-900">{filtered.length}</strong> of{" "}
              <strong className="text-gray-900">{orders.length}</strong>
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                  className="font-medium hover:text-gray-900"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-[1180px] w-full">
            <thead className="bg-gray-50/80">
              <tr className="border-b border-gray-200">
                <Header>Purchase Order</Header>
                <SortableHeader label="Supplier" active={sortKey === "supplier"} direction={sortDirection} onClick={() => sort("supplier")} />
                <SortableHeader label="Date" active={sortKey === "date"} direction={sortDirection} onClick={() => sort("date")} />
                <Header>Expected</Header>
                <SortableHeader label="Workflow" active={sortKey === "status"} direction={sortDirection} onClick={() => sort("status")} />
                <Header>Supplier Bill</Header>
                <SortableHeader label="Total" active={sortKey === "total"} direction={sortDirection} onClick={() => sort("total")} right />
                <Header right>Next Action</Header>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filtered.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50/70">
                  <td className="px-5 py-4">
                    <Link href={`/purchase/${order.id}`} className="font-semibold text-gray-900 hover:underline">
                      {order.purchase_order_no}
                    </Link>
                    <div className="mt-1 text-xs text-gray-400">PO #{order.id}</div>
                  </td>

                  <td className="px-5 py-4">
                    <Link href={`/suppliers/${order.supplier_id}`} className="text-sm font-medium text-gray-700 hover:underline">
                      {order.supplier_name}
                    </Link>
                    <div className="mt-1 text-xs text-gray-400">{order.supplier_code || "-"}</div>
                  </td>

                  <td className="px-5 py-4 text-sm text-gray-600">{formatDate(order.order_date)}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">
                    {order.expected_date ? formatDate(order.expected_date) : "—"}
                  </td>

                  <td className="px-5 py-4">
                    <WorkflowBadge order={order} />
                  </td>

                  <td className="px-5 py-4">
                    {order.supplier_bill ? (
                      <Link
                        href={`/supplier-bills/${order.supplier_bill.id}`}
                        className="text-sm font-medium text-gray-900 underline decoration-gray-300 underline-offset-4"
                      >
                        {order.supplier_bill.bill_no}
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-400">Not billed</span>
                    )}
                  </td>

                  <td className="px-5 py-4 text-right text-sm font-semibold text-gray-900">
                    {money(order.total_amount, order.currency)}
                  </td>

                  <td className="px-5 py-4 text-right">
                    <SmartAction order={order} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-gray-100 lg:hidden">
          {filtered.map((order) => (
            <div key={order.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/purchase/${order.id}`} className="font-semibold text-gray-900">
                    {order.purchase_order_no}
                  </Link>
                  <div className="mt-1 text-xs text-gray-400">{order.supplier_name}</div>
                </div>
                <WorkflowBadge order={order} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniMetric label="Total" value={money(order.total_amount, order.currency)} />
                <MiniMetric label="Date" value={formatDate(order.order_date)} />
              </div>

              <div className="mt-4">
                <SmartAction order={order} full />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SmartAction({ order, full = false }: { order: PurchaseOrder; full?: boolean }) {
  const base = full ? "block w-full text-center" : "inline-flex";

  if (order.status === "cancelled") {
    return <Link href={`/purchase/${order.id}`} className={`${base} rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700`}>View</Link>;
  }

  if (order.status === "draft" || order.status === "ordered" || order.status === "partially_received") {
    return <Link href={`/purchase/${order.id}`} className={`${base} rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white`}>Receive Stock</Link>;
  }

  if (order.status === "received" && !order.supplier_bill) {
    return <Link href={`/purchase/${order.id}`} className={`${base} rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white`}>Create Bill</Link>;
  }

  if (order.supplier_bill && order.supplier_bill.balance_due > 0.000001) {
    return <Link href={`/supplier-bills/${order.supplier_bill.id}`} className={`${base} rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white`}>Pay Supplier</Link>;
  }

  if (order.supplier_bill) {
    return <Link href={`/supplier-bills/${order.supplier_bill.id}`} className={`${base} rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700`}>View Bill</Link>;
  }

  return <Link href={`/purchase/${order.id}`} className={`${base} rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700`}>View</Link>;
}

function WorkflowBadge({ order }: { order: PurchaseOrder }) {
  if (order.status === "cancelled") return <Badge label="Cancelled" tone="red" />;
  if (order.supplier_bill) return <Badge label="Billed" tone="blue" />;
  if (order.status === "received") return <Badge label="Ready to Bill" tone="green" />;
  if (order.status === "partially_received") return <Badge label="Partially Received" tone="amber" />;
  if (order.status === "ordered") return <Badge label="Receiving" tone="amber" />;
  return <Badge label="Draft" tone="gray" />;
}

function workflowLabel(order: PurchaseOrder) {
  if (order.status === "cancelled") return "cancelled";
  if (order.supplier_bill) return "billed";
  if (order.status === "received") return "ready to bill";
  if (order.status === "partially_received") return "partially received";
  if (order.status === "ordered") return "receiving";
  return "draft";
}

function Badge({ label, tone }: { label: string; tone: "green" | "amber" | "red" | "gray" | "blue" }) {
  const styles = {
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    gray: "bg-gray-100 text-gray-600",
    blue: "bg-blue-50 text-blue-700",
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[tone]}`}>{label}</span>;
}

function SummaryCard({ label, value, hint, tone = "normal" }: { label: string; value: string; hint: string; tone?: "normal" | "positive" | "warning" }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${tone === "positive" ? "text-green-700" : tone === "warning" ? "text-amber-600" : "text-gray-900"}`}>{value}</div>
      <div className="mt-2 text-xs text-gray-400">{hint}</div>
    </div>
  );
}

function MiniMetric({ label, value, tone = "normal" }: { label: string; value: string; tone?: "normal" | "positive" }) {
  return (
    <div className="rounded-lg bg-white p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</div>
      <div className={`mt-2 text-sm font-semibold ${tone === "positive" ? "text-green-700" : "text-gray-900"}`}>{value}</div>
    </div>
  );
}

function FilterButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
        active ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      {label}
      <span className={`rounded-md px-1.5 py-0.5 text-[10px] ${active ? "bg-white/15" : "bg-gray-100 text-gray-500"}`}>{count}</span>
    </button>
  );
}

function Header({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

function SortableHeader({ label, active, direction, onClick, right = false }: { label: string; active: boolean; direction: SortDirection; onClick: () => void; right?: boolean }) {
  return (
    <th className={`px-5 py-3 ${right ? "text-right" : "text-left"}`}>
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-900">
        {label}
        <span className={active ? "text-gray-900" : "text-gray-300"}>{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );
}

function summary(map: Map<string, { purchases: number; received: number; billed: number }>, field: "purchases" | "received" | "billed") {
  const rows = Array.from(map.entries())
    .map(([currency, totals]) => ({ currency, amount: totals[field] }))
    .filter((row) => Math.abs(row.amount) > 0.000001)
    .sort((a, b) => a.currency.localeCompare(b.currency));

  return rows.length ? rows.map((row) => money(row.amount, row.currency)).join(" • ") : "฿0.00";
}

function money(value: number, currency: string) {
  if (currency === "MMK") return `K ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const symbol = currency === "USD" ? "$" : currency === "SGD" ? "S$" : currency === "EUR" ? "€" : "฿";
  return `${symbol}${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string) {
  const parts = String(value || "").slice(0, 10).split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value || "-";
}
