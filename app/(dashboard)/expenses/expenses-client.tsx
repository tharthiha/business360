"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

type PeriodStatus = "open" | "closed" | "reopened";

type Expense = {
  id: number;
  expense_no: string;
  expense_date: string;
  description: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  payment_method: string;
  status: string;
  expense_category_id: number | null;
  supplier_id: number | null;
  category_name: string;
  supplier_name: string;
  has_proof: boolean;
  period_status: PeriodStatus;
  period_closed_at: string | null;
};

type CategoryOption = {
  id: number;
  name: string;
};

type PeriodRow = {
  period_start: string;
  status: string;
  closed_at: string | null;
};

type Filter = "all" | "posted" | "draft" | "this_month" | "cancelled";
type SortKey = "date" | "category" | "amount";
type SortDirection = "asc" | "desc";

type CurrencySummary = {
  currency: string;
  posted: number;
  monthly: number;
  draft: number;
  postedCount: number;
};

type CategorySummary = {
  category: string;
  currency: string;
  amount: number;
  count: number;
};

type MethodSummary = {
  method: string;
  currency: string;
  amount: number;
  count: number;
};

export default function ExpensesClient() {
  const supabase = createClient();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadExpenses() {
    setLoading(true);
    setMessage("");

    try {
      const { data: expenseRows, error: expenseError } = await supabase
        .from("expenses")
        .select(`
          id,
          expense_no,
          expense_date,
          description,
          amount,
          tax_amount,
          total_amount,
          currency,
          payment_method,
          status,
          expense_category_id,
          supplier_id
        `)
        .order("expense_date", { ascending: false })
        .order("id", { ascending: false });

      if (expenseError) {
        throw new Error(expenseError.message || "Could not load expenses.");
      }

      const rows = expenseRows || [];

      const categoryIds = Array.from(
        new Set(
          rows
            .map((row: any) =>
              row.expense_category_id ? Number(row.expense_category_id) : null
            )
            .filter((value): value is number => value !== null)
        )
      );

      const supplierIds = Array.from(
        new Set(
          rows
            .map((row: any) => (row.supplier_id ? Number(row.supplier_id) : null))
            .filter((value): value is number => value !== null)
        )
      );

      const userResult = await supabase.auth.getUser();
      const userId = userResult.data.user?.id || null;

      let companyId: number | null = null;

      if (userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", userId)
          .maybeSingle();

        if (profile?.company_id) {
          companyId = Number(profile.company_id);
        }
      }

      const [categoryResult, supplierResult, periodResult, proofMap] =
        await Promise.all([
          categoryIds.length
            ? supabase
                .from("expense_categories")
                .select("id, name")
                .in("id", categoryIds)
            : Promise.resolve({ data: [], error: null } as any),

          supplierIds.length
            ? supabase
                .from("suppliers")
                .select("id, supplier_name")
                .in("id", supplierIds)
            : Promise.resolve({ data: [], error: null } as any),

          companyId
            ? supabase
                .from("accounting_period_closes")
                .select("period_start, status, closed_at")
                .eq("company_id", companyId)
            : Promise.resolve({ data: [], error: null } as any),

          loadExpenseProofMap(
            supabase,
            rows.map((row: any) => Number(row.id))
          ),
        ]);

      if (categoryResult.error) {
        throw new Error(
          categoryResult.error.message || "Could not load expense categories."
        );
      }

      if (supplierResult.error) {
        throw new Error(
          supplierResult.error.message || "Could not load suppliers."
        );
      }

      const categoryMap = new Map<number, string>();
      for (const category of categoryResult.data || []) {
        categoryMap.set(Number(category.id), category.name || "-");
      }

      const supplierMap = new Map<number, string>();
      for (const supplier of supplierResult.data || []) {
        supplierMap.set(Number(supplier.id), supplier.supplier_name || "-");
      }

      const periodMap = new Map<string, PeriodRow>();
      for (const period of periodResult.data || []) {
        const month = String(period.period_start || "").slice(0, 7);
        if (!month) continue;
        periodMap.set(month, {
          period_start: period.period_start,
          status: period.status || "open",
          closed_at: period.closed_at || null,
        });
      }

      const normalized: Expense[] = rows.map((row: any) => {
        const date = String(row.expense_date || "");
        const month = date.slice(0, 7);
        const period = periodMap.get(month);

        return {
          id: Number(row.id),
          expense_no: row.expense_no || "-",
          expense_date: date,
          description: row.description || "-",
          amount: Number(row.amount || 0),
          tax_amount: Number(row.tax_amount || 0),
          total_amount: Number(row.total_amount || 0),
          currency: row.currency || "THB",
          payment_method: row.payment_method || "other",
          status: row.status || "draft",
          expense_category_id: row.expense_category_id
            ? Number(row.expense_category_id)
            : null,
          supplier_id: row.supplier_id ? Number(row.supplier_id) : null,
          category_name: row.expense_category_id
            ? categoryMap.get(Number(row.expense_category_id)) || "-"
            : "-",
          supplier_name: row.supplier_id
            ? supplierMap.get(Number(row.supplier_id)) || "-"
            : "-",
          has_proof: proofMap.get(Number(row.id)) === true,
          period_status: normalizePeriodStatus(period?.status),
          period_closed_at: period?.closed_at || null,
        };
      });

      setExpenses(normalized);

      setCategories(
        Array.from(categoryMap.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "Could not load expenses.";

      console.error("[expenses]", text);
      setMessage(text);
    } finally {
      setLoading(false);
    }
  }

  const posted = useMemo(
    () => expenses.filter((expense) => expense.status === "posted"),
    [expenses]
  );

  const draft = useMemo(
    () => expenses.filter((expense) => expense.status === "draft"),
    [expenses]
  );

  const cancelled = useMemo(
    () => expenses.filter((expense) => expense.status === "cancelled"),
    [expenses]
  );

  const monthlyPrefix = currentMonthPrefix();

  const thisMonthPosted = useMemo(
    () =>
      posted.filter((expense) =>
        expense.expense_date.startsWith(monthlyPrefix)
      ),
    [posted, monthlyPrefix]
  );

  const currencySummaries = useMemo(() => {
    const currencies = new Set<string>();

    for (const expense of expenses) {
      currencies.add(expense.currency || "THB");
    }

    if (currencies.size === 0) currencies.add("THB");

    return Array.from(currencies)
      .map((currency): CurrencySummary => {
        const currencyPosted = posted.filter(
          (expense) => expense.currency === currency
        );

        const currencyDraft = draft.filter(
          (expense) => expense.currency === currency
        );

        return {
          currency,
          posted: currencyPosted.reduce(
            (sum, expense) => sum + expense.total_amount,
            0
          ),
          monthly: currencyPosted
            .filter((expense) =>
              expense.expense_date.startsWith(monthlyPrefix)
            )
            .reduce((sum, expense) => sum + expense.total_amount, 0),
          draft: currencyDraft.reduce(
            (sum, expense) => sum + expense.total_amount,
            0
          ),
          postedCount: currencyPosted.length,
        };
      })
      .sort((a, b) => a.currency.localeCompare(b.currency));
  }, [expenses, posted, draft, monthlyPrefix]);

  const categorySummaries = useMemo(() => {
    const map = new Map<string, CategorySummary>();

    for (const expense of posted) {
      const key = `${expense.currency}::${expense.category_name}`;
      const current = map.get(key) || {
        category: expense.category_name || "Uncategorized",
        currency: expense.currency,
        amount: 0,
        count: 0,
      };

      current.amount += expense.total_amount;
      current.count += 1;
      map.set(key, current);
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.currency !== b.currency) return a.currency.localeCompare(b.currency);
      return b.amount - a.amount;
    });
  }, [posted]);

  const methodSummaries = useMemo(() => {
    const map = new Map<string, MethodSummary>();

    for (const expense of posted) {
      const label = methodLabel(expense.payment_method);
      const key = `${expense.currency}::${label}`;
      const current = map.get(key) || {
        method: label,
        currency: expense.currency,
        amount: 0,
        count: 0,
      };

      current.amount += expense.total_amount;
      current.count += 1;
      map.set(key, current);
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.currency !== b.currency) return a.currency.localeCompare(b.currency);
      return b.amount - a.amount;
    });
  }, [posted]);

  const counts = useMemo(
    () => ({
      all: expenses.length,
      posted: posted.length,
      draft: draft.length,
      cancelled: cancelled.length,
      thisMonth: thisMonthPosted.length,
    }),
    [expenses.length, posted.length, draft.length, cancelled.length, thisMonthPosted.length]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    const rows = expenses.filter((expense) => {
      const matchesSearch =
        !term ||
        expense.expense_no.toLowerCase().includes(term) ||
        expense.description.toLowerCase().includes(term) ||
        expense.category_name.toLowerCase().includes(term) ||
        expense.supplier_name.toLowerCase().includes(term) ||
        methodLabel(expense.payment_method).toLowerCase().includes(term) ||
        expense.currency.toLowerCase().includes(term);

      let matchesFilter = true;

      if (filter === "posted") matchesFilter = expense.status === "posted";
      if (filter === "draft") matchesFilter = expense.status === "draft";
      if (filter === "cancelled") matchesFilter = expense.status === "cancelled";
      if (filter === "this_month") {
        matchesFilter =
          expense.status === "posted" &&
          expense.expense_date.startsWith(monthlyPrefix);
      }

      const matchesCategory =
        categoryFilter === "all" ||
        String(expense.expense_category_id) === categoryFilter;

      return matchesSearch && matchesFilter && matchesCategory;
    });

    return [...rows].sort((a, b) => {
      let comparison = 0;

      if (sortKey === "date") {
        comparison = a.expense_date.localeCompare(b.expense_date);
      }

      if (sortKey === "category") {
        comparison = a.category_name.localeCompare(b.category_name);
      }

      if (sortKey === "amount") {
        comparison = a.total_amount - b.total_amount;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [
    expenses,
    search,
    filter,
    categoryFilter,
    sortKey,
    sortDirection,
    monthlyPrefix,
  ]);

  function changeSort(next: SortKey) {
    if (sortKey === next) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      return;
    }

    setSortKey(next);
    setSortDirection(next === "category" ? "asc" : "desc");
  }

  const hasFilters =
    search.trim() !== "" || filter !== "all" || categoryFilter !== "all";

  return (
    <div className="space-y-7">
      {/* HEADER */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Expenses
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage operating costs, categories, payment methods, evidence and
            accounting-period status.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/expenses/categories"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Expense Categories
          </Link>

          <Link
            href="/expenses/new"
            className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            + New Expense
          </Link>
        </div>
      </div>

      {/* TOP SUMMARY */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Expenses"
          value={formatCurrencySummary(currencySummaries, "posted")}
          hint={`${posted.length} posted records • cancelled excluded`}
        />

        <SummaryCard
          label="Posted"
          value={String(posted.length)}
          hint="Included in P&L"
          tone="positive"
        />

        <SummaryCard
          label="Draft"
          value={String(draft.length)}
          hint="Not yet posted"
          tone={draft.length > 0 ? "warning" : "normal"}
        />

        <SummaryCard
          label={`This Month • ${monthLabel(monthlyPrefix)}`}
          value={formatCurrencySummary(currencySummaries, "monthly")}
          hint={`${thisMonthPosted.length} posted this month`}
          tone={thisMonthPosted.length > 0 ? "danger" : "normal"}
        />
      </div>

      {/* CATEGORY + PAYMENT METHOD */}



      <div className="grid gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="font-semibold text-gray-900">
              Posted Expenses by Category
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Posted-only values. Draft and cancelled records are excluded.
            </p>
          </div>

          <div className="p-5">
            {categorySummaries.length === 0 ? (
              <EmptySummary text="No posted expense categories yet." />
            ) : (
              <div className="space-y-3">
                {categorySummaries.map((row) => (
                  <BreakdownRow
                    key={`${row.currency}-${row.category}`}
                    label={row.category}
                    meta={`${row.count} record${row.count === 1 ? "" : "s"} • ${row.currency}`}
                    value={money(row.amount, row.currency)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="font-semibold text-gray-900">
              Payment Method Summary
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Cash, card, bank transfer, QR and other posted expenses.
            </p>
          </div>

          <div className="p-5">
            {methodSummaries.length === 0 ? (
              <EmptySummary text="No posted payment-method activity yet." />
            ) : (
              <div className="space-y-3">
                {methodSummaries.map((row) => (
                  <BreakdownRow
                    key={`${row.currency}-${row.method}`}
                    label={row.method}
                    meta={`${row.count} record${row.count === 1 ? "" : "s"} • ${row.currency}`}
                    value={money(row.amount, row.currency)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* REGISTER */}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Expense Register</h2>
              <p className="mt-1 text-sm text-gray-500">
                Showing {filtered.length} of {expenses.length} records
              </p>
            </div>

            <div className="flex flex-1 flex-col gap-3 xl:max-w-4xl xl:flex-row xl:justify-end">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search expense, category, payee, method or currency..."
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-400 focus:bg-white xl:max-w-sm"
              />

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none"
              >
                <option value="all">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <FilterButton
              label="All"
              count={counts.all}
              active={filter === "all"}
              onClick={() => setFilter("all")}
            />
            <FilterButton
              label="Posted"
              count={counts.posted}
              active={filter === "posted"}
              onClick={() => setFilter("posted")}
            />
            <FilterButton
              label="Draft"
              count={counts.draft}
              active={filter === "draft"}
              onClick={() => setFilter("draft")}
            />
            <FilterButton
              label="This Month"
              count={counts.thisMonth}
              active={filter === "this_month"}
              onClick={() => setFilter("this_month")}
            />
            <FilterButton
              label="Cancelled"
              count={counts.cancelled}
              active={filter === "cancelled"}
              onClick={() => setFilter("cancelled")}
            />

            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                  setCategoryFilter("all");
                }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            Loading expenses...
          </div>
        ) : message ? (
          <div className="px-6 py-12 text-center text-sm text-red-600">
            {message}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="text-sm font-medium text-gray-900">
              No expenses found
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Adjust your filters or create a new expense.
            </p>
          </div>
        ) : (
          <>
            {/* DESKTOP */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-[1220px] w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <Header>Expense</Header>

                    <SortableHeader
                      label="Date"
                      active={sortKey === "date"}
                      direction={sortDirection}
                      onClick={() => changeSort("date")}
                    />

                    <SortableHeader
                      label="Category"
                      active={sortKey === "category"}
                      direction={sortDirection}
                      onClick={() => changeSort("category")}
                    />

                    <Header>Supplier / Payee</Header>
                    <Header>Method</Header>
                    <Header>Proof</Header>
                    <Header>Period</Header>
                    <Header>Status</Header>

                    <SortableHeader
                      label="Amount"
                      active={sortKey === "amount"}
                      direction={sortDirection}
                      onClick={() => changeSort("amount")}
                      right
                    />

                    <Header right>Action</Header>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filtered.map((expense) => (
                    <tr
                      key={expense.id}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/expenses/${expense.id}`}
                          className="text-sm font-semibold text-gray-900 hover:underline"
                        >
                          {expense.expense_no}
                        </Link>

                        <div className="mt-1 max-w-[280px] truncate text-xs text-gray-500">
                          {expense.description}
                        </div>

                        <div className="mt-1 text-[10px] text-gray-400">
                          Expense #{expense.id}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {formatDate(expense.expense_date)}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                          {expense.category_name}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {expense.supplier_name}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {methodLabel(expense.payment_method)}
                      </td>

                      <td className="px-5 py-4">
                        <ProofBadge
                          hasProof={expense.has_proof}
                          required={proofRequired(expense.payment_method)}
                        />
                      </td>

                      <td className="px-5 py-4">
                        <PeriodBadge
                          status={expense.period_status}
                          closedAt={expense.period_closed_at}
                        />
                      </td>

                      <td className="px-5 py-4">
                        <Status status={expense.status} />
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {money(expense.total_amount, expense.currency)}
                        </div>

                        {expense.tax_amount > 0 && (
                          <div className="mt-1 text-[10px] text-gray-400">
                            Tax {money(expense.tax_amount, expense.currency)}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <SmartAction expense={expense} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE */}
            <div className="divide-y divide-gray-100 lg:hidden">
              {filtered.map((expense) => (
                <div key={expense.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/expenses/${expense.id}`}
                        className="block truncate font-semibold text-gray-900"
                      >
                        {expense.expense_no}
                      </Link>

                      <div className="mt-1 line-clamp-2 text-xs text-gray-500">
                        {expense.description}
                      </div>
                    </div>

                    <Status status={expense.status} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <MobileMetric
                      label="Amount"
                      value={money(expense.total_amount, expense.currency)}
                    />
                    <MobileMetric
                      label="Date"
                      value={formatDate(expense.expense_date)}
                    />
                    <MobileMetric
                      label="Category"
                      value={expense.category_name}
                    />
                    <MobileMetric
                      label="Method"
                      value={methodLabel(expense.payment_method)}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <ProofBadge
                      hasProof={expense.has_proof}
                      required={proofRequired(expense.payment_method)}
                    />
                    <PeriodBadge
                      status={expense.period_status}
                      closedAt={expense.period_closed_at}
                    />
                  </div>

                  <div className="mt-4">
                    <SmartAction expense={expense} full />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-500">
        P&amp;L rule: only <strong className="text-gray-700">Posted</strong>{" "}
        expenses are included in expense totals. Draft and Cancelled records are
        excluded from posted/category/payment-method summaries.
      </div>
    </div>
  );
}

/* ==========================================
   COMPONENTS
========================================== */

function SmartAction({
  expense,
  full = false,
}: {
  expense: Expense;
  full?: boolean;
}) {
  const base = full ? "block w-full text-center" : "inline-flex";

  const canEdit =
    expense.status === "draft" && expense.period_status !== "closed";

  if (canEdit) {
    return (
      <div className={`flex gap-2 ${full ? "w-full" : "justify-end"}`}>
        <Link
          href={`/expenses/${expense.id}`}
          className={`${full ? "flex-1 text-center" : ""} rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50`}
        >
          View
        </Link>

        <Link
          href={`/expenses/${expense.id}/edit`}
          className={`${full ? "flex-1 text-center" : ""} rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white`}
        >
          Edit
        </Link>
      </div>
    );
  }

  return (
    <Link
      href={`/expenses/${expense.id}`}
      className={`${base} rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50`}
    >
      {expense.period_status === "closed" ? "View • Locked" : "View"}
    </Link>
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
      <div className={`mt-2 text-2xl font-semibold ${valueClass}`}>{value}</div>
      <div className="mt-2 text-xs text-gray-400">{hint}</div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string;
  tone?: "normal" | "warning" | "danger";
}) {
  const valueClass =
    tone === "danger"
      ? "text-red-600"
      : tone === "warning"
      ? "text-amber-600"
      : "text-gray-900";

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </div>
      <div className={`mt-2 text-base font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}

function BreakdownRow({
  label,
  meta,
  value,
}: {
  label: string;
  meta: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-gray-900">{label}</div>
        <div className="mt-1 text-xs text-gray-400">{meta}</div>
      </div>
      <div className="shrink-0 text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function EmptySummary({ text }: { text: string }) {
  return (
    <div className="rounded-lg bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
      {text}
    </div>
  );
}

function FilterButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
        active
          ? "border-gray-900 bg-gray-900 text-white"
          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      {label}
      <span
        className={`rounded-md px-1.5 py-0.5 text-[10px] ${
          active ? "bg-white/15 text-white" : "bg-gray-100 text-gray-500"
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
      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${
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
    <th className={`px-5 py-3 ${right ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-900"
      >
        {label}
        <span className={active ? "text-gray-900" : "text-gray-300"}>
          {active ? (direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

function Status({ status }: { status: string }) {
  const tone =
    status === "posted"
      ? "bg-green-50 text-green-700"
      : status === "cancelled"
      ? "bg-red-50 text-red-700"
      : "bg-gray-100 text-gray-700";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
      {labelize(status)}
    </span>
  );
}

function ProofBadge({
  hasProof,
  required,
}: {
  hasProof: boolean;
  required: boolean;
}) {
  if (hasProof) {
    return (
      <span className="inline-flex rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
        ✓ Proof
      </span>
    );
  }

  if (required) {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        Proof Required
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
      Optional
    </span>
  );
}

function PeriodBadge({
  status,
  closedAt,
}: {
  status: PeriodStatus;
  closedAt: string | null;
}) {
  if (status === "closed") {
    return (
      <span
        title={closedAt ? `Closed ${formatDateTime(closedAt)}` : "Closed period"}
        className="inline-flex rounded-full bg-gray-900 px-2.5 py-1 text-xs font-medium text-white"
      >
        Closed
      </span>
    );
  }

  if (status === "reopened") {
    return (
      <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
        Reopened
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
      Open
    </span>
  );
}

function MobileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </div>
      <div className="mt-2 truncate text-sm font-medium text-gray-800">
        {value}
      </div>
    </div>
  );
}

/* ==========================================
   HELPERS
========================================== */

async function loadExpenseProofMap(
  supabase: ReturnType<typeof createClient>,
  expenseIds: number[]
) {
  const result = new Map<number, boolean>();
  for (const id of expenseIds) result.set(id, false);

  if (expenseIds.length === 0) return result;

  // Business360 has used receipt/proof uploads in the expense workflow.
  // This probe keeps the register compatible if the deployed DB uses one
  // of several common column names. Unknown columns are ignored safely.
  const candidateColumns = [
    "receipt_path",
    "receipt_url",
    "proof_path",
    "proof_url",
    "attachment_path",
  ];

  for (const column of candidateColumns) {
    const { data, error } = await supabase
      .from("expenses")
      .select(`id, ${column}`)
      .in("id", expenseIds);

    if (error) continue;

    for (const row of data || []) {
      const value = (row as any)[column];
      result.set(Number((row as any).id), Boolean(value));
    }

    return result;
  }

  return result;
}

function normalizePeriodStatus(value?: string | null): PeriodStatus {
  if (value === "closed") return "closed";
  if (value === "reopened") return "reopened";
  return "open";
}

function proofRequired(method: string) {
  return method === "bank_transfer" || method === "qr";
}

function methodLabel(method: string) {
  if (method === "bank_transfer") return "Bank Transfer";
  if (method === "qr") return "QR / PromptPay";
  if (method === "card") return "Card";
  if (method === "cash") return "Cash";
  return labelize(method || "other");
}

function labelize(value: string) {
  return String(value || "-")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function currentMonthPrefix() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function monthLabel(prefix: string) {
  const [year, month] = prefix.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  return date.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function formatCurrencySummary(
  summaries: CurrencySummary[],
  field: "posted" | "monthly" | "draft"
) {
  const rows = summaries
    .map((summary) => ({
      currency: summary.currency,
      amount: summary[field],
    }))
    .filter((row) => Math.abs(row.amount) > 0.000001);

  if (rows.length === 0) return "฿0.00";

  return rows
    .map((row) => money(row.amount, row.currency))
    .join(" • ");
}

function money(value: number, currency = "THB") {
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

function formatDate(value: string) {
  const parts = String(value || "").slice(0, 10).split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return value || "-";
}

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}
