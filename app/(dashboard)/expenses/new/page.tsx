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

type PeriodStatus =
  | "open"
  | "closed"
  | "reopened";

export default function NewExpensePage() {
  const router = useRouter();
  const supabase = createClient();

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [suppliers, setSuppliers] =
    useState<Supplier[]>([]);

  const [form, setForm] =
    useState({
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
      status: "posted",
    });

  const [receipt, setReceipt] =
    useState<File | null>(null);

  const [companyId, setCompanyId] =
    useState<number | null>(
      null
    );

  const [
    periodStatus,
    setPeriodStatus,
  ] = useState<PeriodStatus>(
    "open"
  );

  const [
    periodClosedAt,
    setPeriodClosedAt,
  ] = useState<string | null>(
    null
  );

  const [
    checkingPeriod,
    setCheckingPeriod,
  ] = useState(false);

  const [saving, setSaving] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    const initialDate =
      localToday();

    setForm(
      (current) => ({
        ...current,
        expense_date:
          initialDate,
      })
    );

    loadData(
      initialDate
    );
  }, []);

  useEffect(() => {
    if (
      !companyId ||
      !form.expense_date
    ) {
      return;
    }

    checkPeriod(
      companyId,
      form.expense_date
    );
  }, [
    companyId,
    form.expense_date,
  ]);

  async function loadData(
    initialExpenseDate: string
  ) {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (
        authError ||
        !authData.user
      ) {
        throw new Error(
          authError?.message ||
            "Please login first."
        );
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("company_id")
        .eq(
          "id",
          authData.user.id
        )
        .single();

      if (
        profileError ||
        !profile?.company_id
      ) {
        throw new Error(
          profileError?.message ||
            "Company profile not found."
        );
      }

      const resolvedCompanyId =
        Number(
          profile.company_id
        );

      setCompanyId(
        resolvedCompanyId
      );

      const [
        categoryResult,
        supplierResult,
      ] = await Promise.all([
        supabase
          .from(
            "expense_categories"
          )
          .select("id, name")
          .eq(
            "is_active",
            true
          )
          .order("name"),

        supabase
          .from("suppliers")
          .select(`
            id,
            supplier_name
          `)
          .eq(
            "is_active",
            true
          )
          .order(
            "supplier_name"
          ),
      ]);

      if (
        categoryResult.error
      ) {
        throw categoryResult.error;
      }

      if (
        supplierResult.error
      ) {
        throw supplierResult.error;
      }

      setCategories(
        (categoryResult.data ||
          []) as Category[]
      );

      setSuppliers(
        (supplierResult.data ||
          []) as Supplier[]
      );

      await checkPeriod(
        resolvedCompanyId,
        initialExpenseDate
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load expense form."
      );
    } finally {
      setLoading(false);
    }
  }

  async function checkPeriod(
    targetCompanyId: number,
    expenseDate: string
  ) {
    if (
      !targetCompanyId ||
      !expenseDate
    ) {
      setPeriodStatus(
        "open"
      );
      setPeriodClosedAt(
        null
      );
      return;
    }

    setCheckingPeriod(
      true
    );

    try {
      const {
        data,
        error,
      } = await supabase
        .from(
          "accounting_period_closes"
        )
        .select(`
          status,
          closed_at
        `)
        .eq(
          "company_id",
          targetCompanyId
        )
        .eq(
          "period_start",
          firstDayOfDate(
            expenseDate
          )
        )
        .maybeSingle();

      if (error) {
        throw error;
      }

      setPeriodStatus(
        data?.status ===
          "closed"
          ? "closed"
          : data?.status ===
            "reopened"
          ? "reopened"
          : "open"
      );

      setPeriodClosedAt(
        data?.closed_at ||
          null
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not check accounting period."
      );
    } finally {
      setCheckingPeriod(
        false
      );
    }
  }

  const total =
    useMemo(() => {
      return (
        Number(
          form.amount || 0
        ) +
        Number(
          form.tax_amount || 0
        )
      );
    }, [
      form.amount,
      form.tax_amount,
    ]);

  const requiresProof =
    form.payment_method ===
      "bank_transfer" ||
    form.payment_method ===
      "qr";

  const createBlocked =
    saving ||
    checkingPeriod ||
    periodStatus ===
      "closed" ||
    categories.length ===
      0;

  function update(
    name: string,
    value: string
  ) {
    setForm(
      (current) => ({
        ...current,
        [name]: value,
      })
    );
  }

  async function handleSubmit(
    e: FormEvent
  ) {
    e.preventDefault();
    setMessage("");

    if (
      checkingPeriod
    ) {
      setMessage(
        "Please wait while the selected accounting period is checked."
      );
      return;
    }

    if (
      periodStatus ===
      "closed"
    ) {
      setMessage(
        "The selected expense date belongs to a closed accounting period. Change the date or reopen that month from Reports → Month-End Close."
      );
      return;
    }

    if (
      !form.expense_category_id
    ) {
      setMessage(
        "Please select an expense category."
      );
      return;
    }

    if (
      !form.description.trim()
    ) {
      setMessage(
        "Description is required."
      );
      return;
    }

    if (
      Number(
        form.amount
      ) <= 0
    ) {
      setMessage(
        "Expense amount must be greater than zero."
      );
      return;
    }

    if (
      requiresProof &&
      !form.reference_no.trim()
    ) {
      setMessage(
        "Reference number is required for Bank Transfer and QR / PromptPay."
      );
      return;
    }

    if (
      requiresProof &&
      !receipt
    ) {
      setMessage(
        "Receipt / payment proof is required for Bank Transfer and QR / PromptPay."
      );
      return;
    }

    if (
      receipt &&
      receipt.size >
        10 * 1024 * 1024
    ) {
      setMessage(
        "Receipt file must be 10 MB or smaller."
      );
      return;
    }

    setSaving(true);

    let uploadedPath:
      | string
      | null = null;

    let createdExpenseId:
      | number
      | null = null;

    try {
      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !user
      ) {
        throw new Error(
          "Please login first."
        );
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("company_id")
        .eq(
          "id",
          user.id
        )
        .single();

      if (
        profileError ||
        !profile?.company_id
      ) {
        throw new Error(
          "Company profile not found."
        );
      }

      const latestCompanyId =
        Number(
          profile.company_id
        );

      const {
        data: closeData,
        error: closeError,
      } = await supabase
        .from(
          "accounting_period_closes"
        )
        .select("status")
        .eq(
          "company_id",
          latestCompanyId
        )
        .eq(
          "period_start",
          firstDayOfDate(
            form.expense_date
          )
        )
        .maybeSingle();

      if (closeError) {
        throw closeError;
      }

      if (
        closeData?.status ===
        "closed"
      ) {
        setPeriodStatus(
          "closed"
        );

        throw new Error(
          "The selected expense date is now in a closed accounting period. Reopen the month or choose another date."
        );
      }

      const expenseNo =
        `EXP-${Date.now()}`;

      const {
        data: expense,
        error: expenseError,
      } = await supabase
        .from("expenses")
        .insert({
          company_id:
            latestCompanyId,

          expense_category_id:
            Number(
              form.expense_category_id
            ),

          supplier_id:
            form.supplier_id
              ? Number(
                  form.supplier_id
                )
              : null,

          expense_no:
            expenseNo,

          expense_date:
            form.expense_date,

          description:
            form.description.trim(),

          amount:
            Number(
              form.amount
            ),

          tax_amount:
            Number(
              form.tax_amount ||
                0
            ),

          total_amount:
            total,

          currency:
            form.currency,

          payment_method:
            form.payment_method,

          reference_no:
            form.reference_no.trim() ||
            null,

          notes:
            form.notes.trim() ||
            null,

          receipt_path:
            null,

          status:
            form.status,
        })
        .select("id")
        .single();

      if (expenseError) {
        throw expenseError;
      }

      createdExpenseId =
        Number(
          expense.id
        );

      if (receipt) {
        const extension =
          receipt.name
            .split(".")
            .pop()
            ?.toLowerCase() ||
          "file";

        uploadedPath =
          `company-${latestCompanyId}/expense-${expense.id}/${Date.now()}.${extension}`;

        const {
          error: uploadError,
        } = await supabase.storage
          .from(
            "expense-receipts"
          )
          .upload(
            uploadedPath,
            receipt,
            {
              cacheControl:
                "3600",
              upsert: false,
            }
          );

        if (uploadError) {
          throw uploadError;
        }

        const {
          error: updateError,
        } = await supabase
          .from("expenses")
          .update({
            receipt_path:
              uploadedPath,
          })
          .eq(
            "id",
            expense.id
          );

        if (updateError) {
          throw updateError;
        }
      }

      router.push(
        "/expenses"
      );

      router.refresh();
    } catch (error) {
      console.error(
        "[new-expense]",
        error instanceof Error
          ? error.message
          : error
      );

      if (uploadedPath) {
        await supabase.storage
          .from(
            "expense-receipts"
          )
          .remove([
            uploadedPath,
          ]);
      }

      if (
        createdExpenseId
      ) {
        await supabase
          .from(
            "expenses"
          )
          .delete()
          .eq(
            "id",
            createdExpenseId
          );
      }

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not create expense."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-sm text-gray-500">
        Loading expense form...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            New Expense
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Record operating expenses and supporting receipts.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            router.push(
              "/expenses"
            )
          }
          className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
        >
          Cancel
        </button>
      </div>

      {message && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      {periodStatus ===
        "closed" && (
        <PeriodNotice
          tone="closed"
          title="Selected Period Closed"
          text={`The selected expense date ${formatDate(
            form.expense_date
          )} belongs to a closed accounting period${
            periodClosedAt
              ? ` closed on ${formatDateTime(
                  periodClosedAt
                )}`
              : ""
          }. Change the date or reopen that month before creating this expense.`}
        />
      )}

      {periodStatus ===
        "reopened" && (
        <PeriodNotice
          tone="reopened"
          title="Selected Period Reopened"
          text="This expense date is in a reopened accounting period. Creating the expense is allowed until the month is closed again."
        />
      )}

      {categories.length ===
        0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Create at least one Expense Category before recording expenses.
        </div>
      )}

      <form
        onSubmit={
          handleSubmit
        }
        className="space-y-6"
      >
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Section
              title="Expense Information"
              description="Category, supplier and transaction details."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label="Category"
                  required
                >
                  <select
                    value={
                      form.expense_category_id
                    }
                    onChange={(e) =>
                      update(
                        "expense_category_id",
                        e.target.value
                      )
                    }
                    className={
                      inputClass
                    }
                  >
                    <option value="">
                      Select category
                    </option>

                    {categories.map(
                      (
                        category
                      ) => (
                        <option
                          key={
                            category.id
                          }
                          value={
                            category.id
                          }
                        >
                          {
                            category.name
                          }
                        </option>
                      )
                    )}
                  </select>
                </Field>

                <Field label="Supplier">
                  <select
                    value={
                      form.supplier_id
                    }
                    onChange={(e) =>
                      update(
                        "supplier_id",
                        e.target.value
                      )
                    }
                    className={
                      inputClass
                    }
                  >
                    <option value="">
                      No supplier
                    </option>

                    {suppliers.map(
                      (
                        supplier
                      ) => (
                        <option
                          key={
                            supplier.id
                          }
                          value={
                            supplier.id
                          }
                        >
                          {
                            supplier.supplier_name
                          }
                        </option>
                      )
                    )}
                  </select>
                </Field>

                <Field
                  label="Expense Date"
                  required
                >
                  <input
                    type="date"
                    value={
                      form.expense_date
                    }
                    onChange={(e) =>
                      update(
                        "expense_date",
                        e.target.value
                      )
                    }
                    className={
                      inputClass
                    }
                  />

                  <PeriodHint
                    status={
                      periodStatus
                    }
                    checking={
                      checkingPeriod
                    }
                  />
                </Field>

                <Field label="Currency">
                  <select
                    value={
                      form.currency
                    }
                    onChange={(e) =>
                      update(
                        "currency",
                        e.target.value
                      )
                    }
                    className={
                      inputClass
                    }
                  >
                    <option value="THB">
                      THB
                    </option>

                    <option value="MMK">
                      MMK
                    </option>

                    <option value="USD">
                      USD
                    </option>
                  </select>
                </Field>

                <div className="md:col-span-2">
                  <Field
                    label="Description"
                    required
                  >
                    <input
                      value={
                        form.description
                      }
                      onChange={(e) =>
                        update(
                          "description",
                          e.target.value
                        )
                      }
                      className={
                        inputClass
                      }
                      placeholder="e.g. August office internet bill"
                    />
                  </Field>
                </div>

                <Field
                  label="Amount"
                  required
                >
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.amount
                    }
                    onChange={(e) =>
                      update(
                        "amount",
                        e.target.value
                      )
                    }
                    className={
                      inputClass
                    }
                  />
                </Field>

                <Field label="Tax Amount">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.tax_amount
                    }
                    onChange={(e) =>
                      update(
                        "tax_amount",
                        e.target.value
                      )
                    }
                    className={
                      inputClass
                    }
                  />
                </Field>
              </div>
            </Section>

            <Section
              title="Payment"
              description="How the expense was paid."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Payment Method">
                  <select
                    value={
                      form.payment_method
                    }
                    onChange={(e) =>
                      update(
                        "payment_method",
                        e.target.value
                      )
                    }
                    className={
                      inputClass
                    }
                  >
                    <option value="cash">
                      Cash
                    </option>

                    <option value="bank_transfer">
                      Bank Transfer
                    </option>

                    <option value="qr">
                      QR / PromptPay
                    </option>

                    <option value="card">
                      Card
                    </option>

                    <option value="other">
                      Other
                    </option>
                  </select>
                </Field>

                <Field
                  label="Reference No."
                  required={
                    requiresProof
                  }
                >
                  <input
                    value={
                      form.reference_no
                    }
                    placeholder={
                      requiresProof
                        ? "Bank / transaction reference"
                        : "Optional reference"
                    }
                    onChange={(e) =>
                      update(
                        "reference_no",
                        e.target.value
                      )
                    }
                    className={
                      inputClass
                    }
                  />
                </Field>
              </div>
            </Section>

            <Section
              title="Receipt / Payment Proof"
              description={
                requiresProof
                  ? "Required for Bank Transfer and QR / PromptPay."
                  : "Optional for Cash, Card and Other payment methods."
              }
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-gray-700">
                  Attachment
                  {requiresProof && (
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  )}
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    requiresProof
                      ? "bg-amber-50 text-amber-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {requiresProof
                    ? "Required"
                    : "Optional"}
                </span>
              </div>

              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) =>
                  setReceipt(
                    e.target
                      .files?.[0] ||
                      null
                  )
                }
                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm"
              />

              {receipt && (
                <div className="mt-3 text-sm text-gray-500">
                  Selected:{" "}
                  <span className="font-medium text-gray-900">
                    {
                      receipt.name
                    }
                  </span>
                </div>
              )}

              <div className="mt-3 text-xs text-gray-400">
                Accepted: image or PDF • Maximum 10 MB
              </div>
            </Section>

            <Section
              title="Notes"
              description="Optional internal notes."
            >
              <textarea
                rows={4}
                value={
                  form.notes
                }
                onChange={(e) =>
                  update(
                    "notes",
                    e.target.value
                  )
                }
                className={
                  inputClass
                }
              />
            </Section>
          </div>

          <div className="space-y-6">
            <div className="sticky top-24 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900">
                Expense Summary
              </h3>

              <div className="mt-5 space-y-4">
                <Summary
                  label="Amount"
                  value={money(
                    Number(
                      form.amount ||
                        0
                    ),
                    form.currency
                  )}
                />

                <Summary
                  label="Tax"
                  value={money(
                    Number(
                      form.tax_amount ||
                        0
                    ),
                    form.currency
                  )}
                />

                <div className="border-t border-gray-200 pt-4">
                  <Summary
                    label="Total"
                    value={money(
                      total,
                      form.currency
                    )}
                    strong
                  />
                </div>
              </div>

              <div className="mt-6">
                <Field label="Status">
                  <select
                    value={
                      form.status
                    }
                    onChange={(e) =>
                      update(
                        "status",
                        e.target.value
                      )
                    }
                    className={
                      inputClass
                    }
                  >
                    <option value="posted">
                      Posted
                    </option>

                    <option value="draft">
                      Draft
                    </option>
                  </select>
                </Field>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
          <button
            type="button"
            onClick={() =>
              router.push(
                "/expenses"
              )
            }
            className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={
              createBlocked
            }
            style={{
              backgroundColor:
                createBlocked
                  ? "#d1d5db"
                  : "#111827",
              color: "#ffffff",
              border:
                "none",
              borderRadius:
                "8px",
              padding:
                "10px 20px",
              fontSize:
                "14px",
              fontWeight: 600,
              opacity:
                createBlocked
                  ? 0.65
                  : 1,
              cursor:
                createBlocked
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {saving
              ? "Saving..."
              : checkingPeriod
              ? "Checking Period..."
              : periodStatus ===
                "closed"
              ? "Selected Period Closed"
              : "Create Expense"}
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
  tone:
    | "closed"
    | "reopened";
  title: string;
  text: string;
}) {
  const classes =
    tone === "closed"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-blue-200 bg-blue-50 text-blue-800";

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${classes}`}
    >
      <div className="text-sm font-semibold">
        {title}
      </div>

      <div className="mt-1 text-sm">
        {text}
      </div>
    </div>
  );
}

function PeriodHint({
  status,
  checking,
}: {
  status: PeriodStatus;
  checking: boolean;
}) {
  if (checking) {
    return (
      <div className="mt-2 text-xs text-gray-400">
        Checking accounting period...
      </div>
    );
  }

  if (
    status ===
    "closed"
  ) {
    return (
      <div className="mt-2 text-xs font-medium text-amber-700">
        This date is in a closed accounting period.
      </div>
    );
  }

  if (
    status ===
    "reopened"
  ) {
    return (
      <div className="mt-2 text-xs font-medium text-blue-700">
        This date is in a reopened accounting period.
      </div>
    );
  }

  return (
    <div className="mt-2 text-xs font-medium text-green-700">
      Accounting period is open.
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="font-semibold text-gray-900">
          {title}
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          {description}
        </p>
      </div>

      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-gray-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </div>

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
      <span
        className={
          strong
            ? "font-semibold text-gray-900"
            : "text-sm text-gray-500"
        }
      >
        {label}
      </span>

      <span
        className={
          strong
            ? "text-lg font-semibold text-gray-900"
            : "text-sm font-semibold text-gray-900"
        }
      >
        {value}
      </span>
    </div>
  );
}

function localToday() {
  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() +
        1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

function firstDayOfDate(
  value: string
) {
  return `${String(
    value || ""
  ).slice(0, 7)}-01`;
}

function formatDate(
  value: string
) {
  const parts =
    String(
      value || ""
    ).split("-");

  if (
    parts.length === 3
  ) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return value || "-";
}

function formatDateTime(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleString();
}

function money(
  value: number,
  currency: string
) {
  const symbol =
    currency === "USD"
      ? "$"
      : currency === "MMK"
      ? "K "
      : "฿";

  return `${symbol}${Number(
    value || 0
  ).toLocaleString(undefined, {
    minimumFractionDigits:
      2,
    maximumFractionDigits:
      2,
  })}`;
}
