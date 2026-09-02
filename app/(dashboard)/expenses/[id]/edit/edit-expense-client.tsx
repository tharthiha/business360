"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Category = {
  id: number;
  name: string;
};

type Supplier = {
  id: number;
  supplier_name: string;
};

type PeriodStatus = "open" | "closed" | "reopened";

export default function EditExpenseClient({ id }: { id: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [form, setForm] = useState({
    expense_category_id: "",
    supplier_id: "",
    expense_date: "",
    description: "",
    amount: "",
    tax_amount: "0",
    currency: "THB",
    payment_method: "cash",
    reference_no: "",
    notes: "",
    status: "draft",
  });

  const [receipt, setReceipt] = useState<File | null>(null);
  const [oldReceiptPath, setOldReceiptPath] = useState<string | null>(null);
  const [periodStatus, setPeriodStatus] = useState<PeriodStatus>("open");
  const [periodClosedAt, setPeriodClosedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const [expenseResult, categoryResult, supplierResult] = await Promise.all([
        supabase.from("expenses").select("*").eq("id", id).single(),
        supabase
          .from("expense_categories")
          .select("id, name")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("suppliers")
          .select("id, supplier_name")
          .eq("is_active", true)
          .order("supplier_name"),
      ]);

      if (expenseResult.error || !expenseResult.data) {
        throw new Error(expenseResult.error?.message || "Expense not found.");
      }
      if (categoryResult.error) throw categoryResult.error;
      if (supplierResult.error) throw supplierResult.error;

      const expense = expenseResult.data;

      const { data: closeData, error: closeError } = await supabase
        .from("accounting_period_closes")
        .select("status, closed_at")
        .eq("company_id", expense.company_id)
        .eq("period_start", firstDayOfDate(expense.expense_date))
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

      setForm({
        expense_category_id: expense.expense_category_id
          ? String(expense.expense_category_id)
          : "",
        supplier_id: expense.supplier_id ? String(expense.supplier_id) : "",
        expense_date: expense.expense_date,
        description: expense.description,
        amount: String(expense.amount || ""),
        tax_amount: String(expense.tax_amount || 0),
        currency: expense.currency,
        payment_method: expense.payment_method,
        reference_no: expense.reference_no || "",
        notes: expense.notes || "",
        status: expense.status,
      });

      setOldReceiptPath(expense.receipt_path || null);
      setCategories((categoryResult.data || []) as Category[]);
      setSuppliers((supplierResult.data || []) as Supplier[]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load expense.");
    } finally {
      setLoading(false);
    }
  }

  const total = useMemo(
    () => Number(form.amount || 0) + Number(form.tax_amount || 0),
    [form.amount, form.tax_amount]
  );

  function update(name: string, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage("");

    if (periodStatus === "closed") {
      setMessage("This expense belongs to a closed accounting period and cannot be edited.");
      return;
    }

    if (!form.expense_category_id) {
      setMessage("Please select a category.");
      return;
    }
    if (!form.description.trim()) {
      setMessage("Description is required.");
      return;
    }
    if (Number(form.amount) <= 0) {
      setMessage("Amount must be greater than zero.");
      return;
    }

    setSaving(true);

    try {
      let newReceiptPath = oldReceiptPath;

      if (receipt) {
        if (receipt.size > 10 * 1024 * 1024) {
          throw new Error("Receipt file must be 10 MB or smaller.");
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) throw new Error("Please login first.");

        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .single();

        if (!profile?.company_id) {
          throw new Error("Company profile not found.");
        }

        const extension = receipt.name.split(".").pop()?.toLowerCase() || "file";
        newReceiptPath = `company-${profile.company_id}/expense-${id}/${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("expense-receipts")
          .upload(newReceiptPath, receipt);

        if (uploadError) throw uploadError;

        if (oldReceiptPath) {
          await supabase.storage.from("expense-receipts").remove([oldReceiptPath]);
        }
      }

      const { error } = await supabase
        .from("expenses")
        .update({
          expense_category_id: Number(form.expense_category_id),
          supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
          expense_date: form.expense_date,
          description: form.description.trim(),
          amount: Number(form.amount),
          tax_amount: Number(form.tax_amount || 0),
          total_amount: total,
          currency: form.currency,
          payment_method: form.payment_method,
          reference_no: form.reference_no.trim() || null,
          notes: form.notes.trim() || null,
          receipt_path: newReceiptPath,
          status: form.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      router.push(`/expenses/${id}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update expense.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-sm text-gray-500">
        Loading expense...
      </div>
    );
  }

  const readOnly = periodStatus === "closed";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Edit Expense
          </h1>
          <PeriodBadge status={periodStatus} />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Update expense details, status and receipt.
        </p>
      </div>

      {readOnly && (
        <PeriodNotice
          tone="closed"
          title="Period Closed • Read Only"
          text={`This expense belongs to a closed accounting period${
            periodClosedAt ? ` closed on ${formatDateTime(periodClosedAt)}` : ""
          }. Reopen the month from Reports → Month-End Close before editing.`}
        />
      )}

      {periodStatus === "reopened" && (
        <PeriodNotice
          tone="reopened"
          title="Period Reopened"
          text="Editing is currently allowed. Close the month again when corrections are complete."
        />
      )}

      {message && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset disabled={readOnly} className={readOnly ? "space-y-6 opacity-75" : "space-y-6"}>
          <div className="grid gap-6 xl:grid-cols-3">
            <div className="space-y-6 xl:col-span-2">
              <Section title="Expense Information">
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Category">
                    <select
                      value={form.expense_category_id}
                      onChange={(e) => update("expense_category_id", e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Supplier">
                    <select
                      value={form.supplier_id}
                      onChange={(e) => update("supplier_id", e.target.value)}
                      className={inputClass}
                    >
                      <option value="">No supplier</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.supplier_name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Expense Date">
                    <input
                      type="date"
                      value={form.expense_date}
                      onChange={(e) => update("expense_date", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Currency">
                    <select
                      value={form.currency}
                      onChange={(e) => update("currency", e.target.value)}
                      className={inputClass}
                    >
                      <option value="THB">THB</option>
                      <option value="MMK">MMK</option>
                      <option value="USD">USD</option>
                    </select>
                  </Field>

                  <div className="md:col-span-2">
                    <Field label="Description">
                      <input
                        value={form.description}
                        onChange={(e) => update("description", e.target.value)}
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  <Field label="Amount">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => update("amount", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Tax Amount">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.tax_amount}
                      onChange={(e) => update("tax_amount", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </Section>

              <Section title="Payment">
                <div className="grid gap-5 md:grid-cols-2">
                  <Field label="Payment Method">
                    <select
                      value={form.payment_method}
                      onChange={(e) => update("payment_method", e.target.value)}
                      className={inputClass}
                    >
                      <option value="cash">Cash</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="qr">QR / PromptPay</option>
                      <option value="card">Card</option>
                      <option value="other">Other</option>
                    </select>
                  </Field>

                  <Field label="Reference No.">
                    <input
                      value={form.reference_no}
                      onChange={(e) => update("reference_no", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </Section>

              <Section title="Receipt">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setReceipt(e.target.files?.[0] || null)}
                  className="block w-full rounded-lg border border-gray-200 px-3 py-3 text-sm"
                />
                {oldReceiptPath && (
                  <div className="mt-3 text-sm text-gray-500">
                    Existing receipt attached. Uploading a new file will replace it.
                  </div>
                )}
              </Section>

              <Section title="Notes">
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  className={inputClass}
                />
              </Section>
            </div>

            <div>
              <div className="sticky top-24 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-gray-900">Expense Summary</h3>
                <div className="mt-5 space-y-4">
                  <Summary label="Amount" value={money(Number(form.amount || 0), form.currency)} />
                  <Summary label="Tax" value={money(Number(form.tax_amount || 0), form.currency)} />
                  <div className="border-t border-gray-200 pt-4">
                    <Summary label="Total" value={money(total, form.currency)} strong />
                  </div>
                </div>

                <div className="mt-6">
                  <Field label="Status">
                    <select
                      value={form.status}
                      onChange={(e) => update("status", e.target.value)}
                      className={inputClass}
                    >
                      <option value="draft">Draft</option>
                      <option value="posted">Posted</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </Field>
                </div>
              </div>
            </div>
          </div>
        </fieldset>

        <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
          <button
            type="button"
            onClick={() => router.push(`/expenses/${id}`)}
            className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving || readOnly}
            style={{
              backgroundColor: "#111827",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              opacity: saving || readOnly ? 0.5 : 1,
            }}
          >
            {readOnly ? "Read Only" : saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
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

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-500";

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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-gray-700">{label}</div>
      {children}
    </label>
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
