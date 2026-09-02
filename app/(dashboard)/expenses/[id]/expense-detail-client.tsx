"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Expense = {
  id: number;
  company_id: number;
  expense_no: string;
  expense_date: string;
  description: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  payment_method: string;
  reference_no: string | null;
  notes: string | null;
  receipt_path: string | null;
  status: string;
  expense_category_id: number | null;
  supplier_id: number | null;
};

type PeriodStatus = "open" | "closed" | "reopened";

export default function ExpenseDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [expense, setExpense] = useState<Expense | null>(null);
  const [categoryName, setCategoryName] = useState("-");
  const [supplierName, setSupplierName] = useState("-");
  const [periodStatus, setPeriodStatus] = useState<PeriodStatus>("open");
  const [periodClosedAt, setPeriodClosedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadExpense();
  }, [id]);

  async function loadExpense() {
    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        throw new Error(error?.message || "Expense not found.");
      }

      const normalized: Expense = {
        ...data,
        company_id: Number(data.company_id),
        amount: Number(data.amount || 0),
        tax_amount: Number(data.tax_amount || 0),
        total_amount: Number(data.total_amount || 0),
      };

      setExpense(normalized);

      const { data: closeData, error: closeError } = await supabase
        .from("accounting_period_closes")
        .select("status, closed_at")
        .eq("company_id", normalized.company_id)
        .eq("period_start", firstDayOfDate(normalized.expense_date))
        .maybeSingle();

      if (closeError) throw closeError;

      setPeriodStatus(
        closeData?.status === "closed"
          ? "closed"
          : closeData?.status === "reopened"
          ? "reopened"
          : "open"
      );
      setPeriodClosedAt(closeData?.closed_at || null);

      if (normalized.expense_category_id) {
        const { data: categoryData } = await supabase
          .from("expense_categories")
          .select("name")
          .eq("id", normalized.expense_category_id)
          .single();
        setCategoryName(categoryData?.name || "-");
      } else {
        setCategoryName("-");
      }

      if (normalized.supplier_id) {
        const { data: supplierData } = await supabase
          .from("suppliers")
          .select("supplier_name")
          .eq("id", normalized.supplier_id)
          .single();
        setSupplierName(supplierData?.supplier_name || "-");
      } else {
        setSupplierName("-");
      }
    } catch (error) {
      console.error("[expense-detail]", error);
      setMessage(error instanceof Error ? error.message : "Could not load expense.");
    } finally {
      setLoading(false);
    }
  }

  async function changeStatus(status: string) {
    if (!expense) return;

    if (periodStatus === "closed") {
      setMessage("This expense belongs to a closed accounting period and is read-only.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("expenses")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", expense.id);

      if (error) throw error;

      await loadExpense();
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update status.");
    } finally {
      setSaving(false);
    }
  }

  async function viewReceipt() {
    if (!expense?.receipt_path) return;

    const { data, error } = await supabase.storage
      .from("expense-receipts")
      .createSignedUrl(expense.receipt_path, 60 * 10);

    if (error) {
      setMessage(error.message);
      return;
    }

    window.open(data.signedUrl, "_blank");
  }

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-sm text-gray-500">
        Loading expense...
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {message || "Expense not found."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {expense.expense_no}
            </h1>
            <StatusBadge status={expense.status} />
            <PeriodBadge status={periodStatus} />
          </div>
          <p className="mt-1 text-sm text-gray-500">Expense #{expense.id}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => router.push("/expenses")}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
          >
            Back
          </button>

          {periodStatus === "closed" ? (
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-lg border border-gray-200 bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-400"
            >
              Read Only
            </button>
          ) : (
            <Link
              href={`/expenses/${expense.id}/edit`}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
            >
              Edit
            </Link>
          )}
        </div>
      </div>

      {periodStatus === "closed" && (
        <PeriodNotice
          tone="closed"
          title="Period Closed • Read Only"
          text={`This transaction belongs to a closed accounting period${
            periodClosedAt ? ` closed on ${formatDateTime(periodClosedAt)}` : ""
          }. Reopen the month from Reports → Month-End Close before making changes.`}
        />
      )}

      {periodStatus === "reopened" && (
        <PeriodNotice
          tone="reopened"
          title="Period Reopened"
          text="This transaction's accounting period is currently reopened, so edits and workflow changes are allowed."
        />
      )}

      {message && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Expense Workflow</h2>
            <p className="mt-1 text-sm text-gray-500">Draft → Posted → Cancelled</p>
          </div>

          <div className="flex flex-wrap gap-3">
            {periodStatus === "closed" ? (
              <span className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-500">
                Workflow locked for closed period
              </span>
            ) : (
              <>
                {expense.status === "draft" && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => changeStatus("posted")}
                    style={{
                      backgroundColor: "#15803d",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "10px 16px",
                      fontSize: "14px",
                      fontWeight: 600,
                    }}
                  >
                    Post Expense
                  </button>
                )}

                {expense.status === "posted" && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      if (window.confirm("Cancel this expense?")) {
                        changeStatus("cancelled");
                      }
                    }}
                    className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600"
                  >
                    Cancel Expense
                  </button>
                )}

                {expense.status === "cancelled" && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => changeStatus("draft")}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
                  >
                    Reopen as Draft
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Expense Information">
            <div className="grid gap-6 md:grid-cols-2">
              <Info label="Date" value={formatDate(expense.expense_date)} />
              <Info label="Category" value={categoryName} />
              <Info label="Supplier" value={supplierName} />

              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Payment Method
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {methodLabel(expense.payment_method)}
                  </span>
                  {expense.receipt_path ? (
                    <button
                      type="button"
                      onClick={viewReceipt}
                      className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      View Receipt
                    </button>
                  ) : (
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                      No Receipt
                    </span>
                  )}
                </div>
              </div>

              <Info label="Reference No." value={expense.reference_no || "-"} />
              <Info label="Currency" value={expense.currency} />
            </div>

            <div className="mt-6">
              <Info label="Description" value={expense.description} />
            </div>
          </Section>

          <Section title="Notes">
            <div className="text-sm leading-6 text-gray-700">
              {expense.notes || "No notes."}
            </div>
          </Section>
        </div>

        <div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900">Expense Summary</h3>
            <div className="mt-5 space-y-4">
              <Summary label="Amount" value={money(expense.amount, expense.currency)} />
              <Summary label="Tax" value={money(expense.tax_amount, expense.currency)} />
              <div className="border-t border-gray-200 pt-4">
                <Summary label="Total" value={money(expense.total_amount, expense.currency)} strong />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PeriodNotice({
  tone,
  title,
  text,
}: {
  tone: "closed" | "reopened";
  title: string;
  text: string;
}) {
  const classes =
    tone === "closed"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-blue-200 bg-blue-50 text-blue-800";

  return (
    <div className={`rounded-xl border px-4 py-3 ${classes}`}>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm">{text}</div>
    </div>
  );
}

function PeriodBadge({ status }: { status: PeriodStatus }) {
  if (status === "open") return null;

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        status === "closed"
          ? "bg-gray-900 text-white"
          : "bg-blue-50 text-blue-700"
      }`}
    >
      {status === "closed" ? "Period Closed" : "Period Reopened"}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-2 text-sm font-medium text-gray-900">{value}</div>
    </div>
  );
}

function Summary({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={strong ? "font-semibold text-gray-900" : "text-sm text-gray-500"}>
        {label}
      </span>
      <span className={strong ? "text-lg font-semibold text-gray-900" : "text-sm font-semibold text-gray-900"}>
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "posted"
      ? "bg-green-50 text-green-700"
      : status === "cancelled"
      ? "bg-red-50 text-red-700"
      : "bg-gray-100 text-gray-700";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function methodLabel(method: string) {
  if (method === "bank_transfer") return "Bank Transfer";
  if (method === "qr") return "QR / PromptPay";
  if (method === "card") return "Card";
  if (method === "cash") return "Cash";
  return "Other";
}

function money(value: number, currency: string) {
  const symbol = currency === "USD" ? "$" : currency === "MMK" ? "K " : "฿";
  return `${symbol}${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function firstDayOfDate(value: string) {
  return `${String(value || "").slice(0, 7)}-01`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatDate(value: string) {
  const parts = value.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}
