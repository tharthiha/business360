"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type SupplierBill = {
  id: number;
  bill_no: string;
  supplier_id: number;
  supplier_name: string;
  supplier_code: string | null;
  purchase_order_id: number | null;
  bill_date: string;
  due_date: string | null;
  status: string;
  currency: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  supplier_invoice_no: string | null;
};

type Filter = "all" | "open" | "partial" | "paid" | "overdue" | "draft";
type SortKey = "date" | "due" | "supplier" | "status" | "total" | "balance";
type SortDirection = "asc" | "desc";

export default function SupplierBillsClient({ bills }: { bills: SupplierBill[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const now = today();

  const counts = useMemo(() => ({
    all: bills.length,
    open: bills.filter((b) => isOpen(b)).length,
    partial: bills.filter((b) => b.status === "partially_paid").length,
    paid: bills.filter((b) => b.status === "paid" || b.balance_due <= 0.000001).length,
    overdue: bills.filter((b) => isOverdue(b, now)).length,
    draft: bills.filter((b) => b.status === "draft").length,
  }), [bills, now]);

  const currencyTotals = useMemo(() => {
    const map = new Map<string, { payable: number; paid: number; outstanding: number; overdue: number }>();
    const ensure = (currency: string) => {
      if (!map.has(currency)) map.set(currency, { payable: 0, paid: 0, outstanding: 0, overdue: 0 });
      return map.get(currency)!;
    };

    for (const bill of bills) {
      const row = ensure(bill.currency);
      row.payable += bill.total_amount;
      row.paid += bill.paid_amount;
      if (bill.status !== "draft" && bill.balance_due > 0.000001) row.outstanding += bill.balance_due;
      if (isOverdue(bill, now)) row.overdue += bill.balance_due;
    }
    return map;
  }, [bills, now]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    const rows = bills.filter((bill) => {
      const haystack = [
        bill.bill_no,
        bill.supplier_name,
        bill.supplier_code,
        bill.supplier_invoice_no,
        bill.currency,
        statusLabel(bill, now),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchOk = !term || haystack.includes(term);

      let filterOk = true;
      if (filter === "open") filterOk = isOpen(bill);
      if (filter === "partial") filterOk = bill.status === "partially_paid";
      if (filter === "paid") filterOk = bill.status === "paid" || bill.balance_due <= 0.000001;
      if (filter === "overdue") filterOk = isOverdue(bill, now);
      if (filter === "draft") filterOk = bill.status === "draft";

      return searchOk && filterOk;
    });

    return [...rows].sort((a, b) => {
      let comparison = 0;
      if (sortKey === "date") comparison = a.bill_date.localeCompare(b.bill_date);
      if (sortKey === "due") comparison = String(a.due_date || "").localeCompare(String(b.due_date || ""));
      if (sortKey === "supplier") comparison = a.supplier_name.localeCompare(b.supplier_name);
      if (sortKey === "status") comparison = statusLabel(a, now).localeCompare(statusLabel(b, now));
      if (sortKey === "total") comparison = a.total_amount - b.total_amount;
      if (sortKey === "balance") comparison = a.balance_due - b.balance_due;
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [bills, search, filter, sortKey, sortDirection, now]);

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
      <div className="flex flex-wrap justify-end gap-3">
        <Link href="/purchase" className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700">
          Purchase Orders
        </Link>
        <Link href="/suppliers" className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700">
          Suppliers
        </Link>
        <Link href="/purchase/new" className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white">
          + New Purchase Order
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Bills" value={String(counts.all)} hint={`${counts.paid} paid`} />
        <SummaryCard label="Outstanding A/P" value={summary(currencyTotals, "outstanding")} hint={`${counts.open} bills open`} tone={hasPositive(currencyTotals, "outstanding") ? "warning" : "positive"} />
        <SummaryCard label="Paid" value={summary(currencyTotals, "paid")} hint={`${counts.paid} fully settled`} tone="positive" />
        <SummaryCard label="Overdue" value={summary(currencyTotals, "overdue")} hint={`${counts.overdue} overdue bills`} tone={counts.overdue > 0 ? "danger" : "positive"} />
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <h2 className="font-semibold text-gray-900">Accounts Payable by Currency</h2>
          <p className="mt-1 text-sm text-gray-500">
            Supplier liabilities and payments remain separate by transaction currency.
          </p>
        </div>

        <div className="grid gap-4 p-6 xl:grid-cols-2">
          {Array.from(currencyTotals.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([currency, totals]) => (
              <div key={currency} className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">Currency</div>
                    <div className="mt-1 text-xl font-semibold text-gray-900">{currency}</div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${totals.outstanding > 0.000001 ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>
                    {totals.outstanding > 0.000001 ? "A/P Open" : "Settled"}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MiniMetric label="Payable" value={money(totals.payable, currency)} />
                  <MiniMetric label="Paid" value={money(totals.paid, currency)} tone="positive" />
                  <MiniMetric label="Outstanding" value={money(totals.outstanding, currency)} tone={totals.outstanding > 0.000001 ? "warning" : "positive"} />
                  <MiniMetric label="Overdue" value={money(totals.overdue, currency)} tone={totals.overdue > 0.000001 ? "danger" : "positive"} />
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
                placeholder="Search bill, supplier, reference, status or currency..."
                className="w-full max-w-xl rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-400 focus:bg-white"
              />

              <div className="flex flex-wrap gap-2">
                <FilterButton label="All" count={counts.all} active={filter === "all"} onClick={() => setFilter("all")} />
                <FilterButton label="Open" count={counts.open} active={filter === "open"} onClick={() => setFilter("open")} />
                <FilterButton label="Partially Paid" count={counts.partial} active={filter === "partial"} onClick={() => setFilter("partial")} />
                <FilterButton label="Paid" count={counts.paid} active={filter === "paid"} onClick={() => setFilter("paid")} />
                <FilterButton label="Overdue" count={counts.overdue} active={filter === "overdue"} onClick={() => setFilter("overdue")} />
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm text-gray-500">
              Showing <strong className="text-gray-900">{filtered.length}</strong> of{" "}
              <strong className="text-gray-900">{bills.length}</strong>
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
          <table className="min-w-[1240px] w-full">
            <thead className="bg-gray-50/80">
              <tr className="border-b border-gray-200">
                <Header>Supplier Bill</Header>
                <SortableHeader label="Supplier" active={sortKey === "supplier"} direction={sortDirection} onClick={() => sort("supplier")} />
                <Header>Purchase Order</Header>
                <SortableHeader label="Bill Date" active={sortKey === "date"} direction={sortDirection} onClick={() => sort("date")} />
                <SortableHeader label="Due Date" active={sortKey === "due"} direction={sortDirection} onClick={() => sort("due")} />
                <SortableHeader label="Status" active={sortKey === "status"} direction={sortDirection} onClick={() => sort("status")} />
                <SortableHeader label="Total" active={sortKey === "total"} direction={sortDirection} onClick={() => sort("total")} right />
                <Header right>Paid</Header>
                <SortableHeader label="Balance" active={sortKey === "balance"} direction={sortDirection} onClick={() => sort("balance")} right />
                <Header right>Next Action</Header>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filtered.map((bill) => {
                const overdue = isOverdue(bill, now);
                return (
                  <tr key={bill.id} className="hover:bg-gray-50/70">
                    <td className="px-5 py-4">
                      <Link href={`/supplier-bills/${bill.id}`} className="font-semibold text-gray-900 hover:underline">
                        {bill.bill_no}
                      </Link>
                      <div className="mt-1 text-xs text-gray-400">Bill #{bill.id}</div>
                      {bill.supplier_invoice_no && (
                        <div className="mt-1 text-xs text-gray-500">Ref: {bill.supplier_invoice_no}</div>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <Link href={`/suppliers/${bill.supplier_id}`} className="text-sm font-medium text-gray-700 hover:underline">
                        {bill.supplier_name}
                      </Link>
                      <div className="mt-1 text-xs text-gray-400">{bill.supplier_code || "-"}</div>
                    </td>

                    <td className="px-5 py-4">
                      {bill.purchase_order_id ? (
                        <Link href={`/purchase/${bill.purchase_order_id}`} className="text-sm font-medium text-gray-700 underline decoration-gray-300 underline-offset-4">
                          PO #{bill.purchase_order_id}
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-400">Manual</span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-sm text-gray-600">{formatDate(bill.bill_date)}</td>

                    <td className="px-5 py-4">
                      <div className={`text-sm ${overdue ? "font-medium text-red-600" : "text-gray-600"}`}>
                        {bill.due_date ? formatDate(bill.due_date) : "—"}
                      </div>
                    </td>

                    <td className="px-5 py-4"><BillStatusBadge bill={bill} now={now} /></td>
                    <td className="px-5 py-4 text-right text-sm font-semibold text-gray-900">{money(bill.total_amount, bill.currency)}</td>
                    <td className="px-5 py-4 text-right text-sm font-semibold text-green-700">{money(bill.paid_amount, bill.currency)}</td>
                    <td className={`px-5 py-4 text-right text-sm font-semibold ${overdue ? "text-red-600" : bill.balance_due > 0.000001 ? "text-amber-600" : "text-green-700"}`}>
                      {money(bill.balance_due, bill.currency)}
                    </td>
                    <td className="px-5 py-4 text-right"><SmartAction bill={bill} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-gray-100 lg:hidden">
          {filtered.map((bill) => (
            <div key={bill.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/supplier-bills/${bill.id}`} className="font-semibold text-gray-900">{bill.bill_no}</Link>
                  <div className="mt-1 text-xs text-gray-400">{bill.supplier_name}</div>
                </div>
                <BillStatusBadge bill={bill} now={now} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniMetric label="Total" value={money(bill.total_amount, bill.currency)} />
                <MiniMetric label="Balance" value={money(bill.balance_due, bill.currency)} tone={bill.balance_due > 0.000001 ? "warning" : "positive"} />
              </div>

              <div className="mt-4"><SmartAction bill={bill} full /></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SmartAction({ bill, full = false }: { bill: SupplierBill; full?: boolean }) {
  const base = full ? "block w-full text-center" : "inline-flex";

  if (bill.status === "draft") {
    return <Link href={`/supplier-bills/${bill.id}`} className={`${base} rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white`}>Open & Pay</Link>;
  }

  if (bill.balance_due > 0.000001) {
    return <Link href={`/supplier-bills/${bill.id}`} className={`${base} rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white`}>Record Payment</Link>;
  }

  return <Link href={`/supplier-bills/${bill.id}`} className={`${base} rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700`}>View</Link>;
}

function BillStatusBadge({ bill, now }: { bill: SupplierBill; now: string }) {
  const label = statusLabel(bill, now);
  const style =
    label === "Paid" ? "bg-green-50 text-green-700" :
    label === "Open" ? "bg-blue-50 text-blue-700" :
    label === "Partially Paid" ? "bg-amber-50 text-amber-700" :
    label === "Overdue" ? "bg-red-50 text-red-700" :
    "bg-gray-100 text-gray-700";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>{label}</span>;
}

function statusLabel(bill: SupplierBill, now: string) {
  if (bill.status === "paid" || bill.balance_due <= 0.000001) return "Paid";
  if (isOverdue(bill, now)) return "Overdue";
  if (bill.status === "partially_paid" || bill.paid_amount > 0.000001) return "Partially Paid";
  if (bill.status === "open") return "Open";
  return "Draft";
}

function isOpen(bill: SupplierBill) {
  return bill.status !== "draft" && bill.status !== "paid" && bill.balance_due > 0.000001;
}

function isOverdue(bill: SupplierBill, now: string) {
  return Boolean(
    bill.due_date &&
    bill.due_date < now &&
    bill.balance_due > 0.000001 &&
    bill.status !== "draft"
  );
}

function SummaryCard({ label, value, hint, tone = "normal" }: { label: string; value: string; hint: string; tone?: "normal" | "positive" | "warning" | "danger" }) {
  const cls = tone === "positive" ? "text-green-700" : tone === "warning" ? "text-amber-600" : tone === "danger" ? "text-red-600" : "text-gray-900";
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${cls}`}>{value}</div>
      <div className="mt-2 text-xs text-gray-400">{hint}</div>
    </div>
  );
}

function MiniMetric({ label, value, tone = "normal" }: { label: string; value: string; tone?: "normal" | "positive" | "warning" | "danger" }) {
  const cls = tone === "positive" ? "text-green-700" : tone === "warning" ? "text-amber-600" : tone === "danger" ? "text-red-600" : "text-gray-900";
  return (
    <div className="rounded-lg bg-white p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</div>
      <div className={`mt-2 text-sm font-semibold ${cls}`}>{value}</div>
    </div>
  );
}

function FilterButton({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${active ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
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

function summary(map: Map<string, { payable: number; paid: number; outstanding: number; overdue: number }>, field: "payable" | "paid" | "outstanding" | "overdue") {
  const rows = Array.from(map.entries())
    .map(([currency, totals]) => ({ currency, amount: totals[field] }))
    .filter((row) => Math.abs(row.amount) > 0.000001)
    .sort((a, b) => a.currency.localeCompare(b.currency));

  return rows.length ? rows.map((row) => money(row.amount, row.currency)).join(" • ") : "฿0.00";
}

function hasPositive(map: Map<string, { payable: number; paid: number; outstanding: number; overdue: number }>, field: "payable" | "paid" | "outstanding" | "overdue") {
  return Array.from(map.values()).some((row) => row[field] > 0.000001);
}

function today() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
