"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AccountingSettingsForm = {
  default_tax_rate: string;
  tax_price_mode: "exclusive" | "inclusive";
  default_customer_payment_terms_days: string;
  default_supplier_payment_terms_days: string;
  allow_period_reopen: boolean;
  require_close_note: boolean;
  lock_posted_expenses_in_closed_period: boolean;
  accounting_basis: "accrual" | "cash";
};

const initialForm: AccountingSettingsForm = {
  default_tax_rate: "7",
  tax_price_mode: "exclusive",
  default_customer_payment_terms_days: "30",
  default_supplier_payment_terms_days: "30",
  allow_period_reopen: true,
  require_close_note: true,
  lock_posted_expenses_in_closed_period: true,
  accounting_basis: "accrual",
};

export default function AccountingSettingsPage() {
  const supabase = createClient();

  const [companyId, setCompanyId] = useState<number | null>(null);
  const [form, setForm] = useState<AccountingSettingsForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      setMessage("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          setMessage("Please login first.");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .single();

        if (profileError || !profile?.company_id) {
          setMessage("Company profile not found.");
          return;
        }

        const id = Number(profile.company_id);
        setCompanyId(id);

        const { data: company, error: companyError } = await supabase
          .from("companies")
          .select(`
            default_tax_rate,
            tax_price_mode,
            default_customer_payment_terms_days,
            default_supplier_payment_terms_days,
            allow_period_reopen,
            require_close_note,
            lock_posted_expenses_in_closed_period,
            accounting_basis
          `)
          .eq("id", id)
          .single();

        if (companyError || !company) {
          setMessage(companyError?.message || "Could not load accounting settings.");
          return;
        }

        setForm({
          default_tax_rate: String(company.default_tax_rate ?? 7),
          tax_price_mode:
            company.tax_price_mode === "inclusive" ? "inclusive" : "exclusive",
          default_customer_payment_terms_days: String(
            company.default_customer_payment_terms_days ?? 30
          ),
          default_supplier_payment_terms_days: String(
            company.default_supplier_payment_terms_days ?? 30
          ),
          allow_period_reopen: company.allow_period_reopen !== false,
          require_close_note: company.require_close_note !== false,
          lock_posted_expenses_in_closed_period:
            company.lock_posted_expenses_in_closed_period !== false,
          accounting_basis:
            company.accounting_basis === "cash" ? "cash" : "accrual",
        });
      } catch (error) {
        console.error(error);
        setMessage("Unexpected error while loading accounting settings.");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  function updateField<K extends keyof AccountingSettingsForm>(
    key: K,
    value: AccountingSettingsForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (!companyId) {
      setMessage("Company ID not found.");
      return;
    }

    const taxRate = Number(form.default_tax_rate);
    const customerTerms = Number(form.default_customer_payment_terms_days);
    const supplierTerms = Number(form.default_supplier_payment_terms_days);

    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      setMessage("Default tax rate must be between 0 and 100.");
      return;
    }

    if (
      !Number.isInteger(customerTerms) ||
      customerTerms < 0 ||
      customerTerms > 365
    ) {
      setMessage("Customer payment terms must be between 0 and 365 days.");
      return;
    }

    if (
      !Number.isInteger(supplierTerms) ||
      supplierTerms < 0 ||
      supplierTerms > 365
    ) {
      setMessage("Supplier payment terms must be between 0 and 365 days.");
      return;
    }

    setSaving(true);
    setMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase
        .from("companies")
        .update({
          default_tax_rate: taxRate,
          tax_price_mode: form.tax_price_mode,
          default_customer_payment_terms_days: customerTerms,
          default_supplier_payment_terms_days: supplierTerms,
          allow_period_reopen: form.allow_period_reopen,
          require_close_note: form.require_close_note,
          lock_posted_expenses_in_closed_period:
            form.lock_posted_expenses_in_closed_period,
          accounting_basis: form.accounting_basis,
        })
        .eq("id", companyId);

      if (error) {
        setMessage(error.message);
        return;
      }

      setSuccessMessage("Accounting settings saved successfully.");
    } catch (error) {
      console.error(error);
      setMessage("Unexpected error while saving accounting settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="text-sm text-gray-500">
          Loading accounting settings...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-400">
            <Link href="/settings" className="hover:text-gray-700">
              Settings
            </Link>
            <span>/</span>
            <span>Accounting Settings</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Accounting Settings
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Configure tax defaults, payment terms, accounting basis and month-end controls.
          </p>
        </div>

        <Link
          href="/settings"
          className="inline-flex w-fit rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Settings
        </Link>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Section
          title="Tax Defaults"
          description="Used as the company default when new business documents are created."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <NumberField
              label="Default Tax / VAT Rate"
              value={form.default_tax_rate}
              suffix="%"
              min="0"
              max="100"
              step="0.01"
              onChange={(value) => updateField("default_tax_rate", value)}
            />

            <SelectField
              label="Default Price Mode"
              value={form.tax_price_mode}
              onChange={(value) =>
                updateField(
                  "tax_price_mode",
                  value === "inclusive" ? "inclusive" : "exclusive"
                )
              }
              options={[
                ["exclusive", "Tax Exclusive"],
                ["inclusive", "Tax Inclusive"],
              ]}
            />
          </div>

          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
            Existing quotations, invoices, purchase orders and historical
            transactions are not recalculated when these defaults change.
          </div>
        </Section>

        <Section
          title="Payment Terms"
          description="Default due-date terms for new customer and supplier documents."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <NumberField
              label="Customer Payment Terms"
              value={form.default_customer_payment_terms_days}
              suffix="days"
              min="0"
              max="365"
              step="1"
              onChange={(value) =>
                updateField("default_customer_payment_terms_days", value)
              }
            />

            <NumberField
              label="Supplier Payment Terms"
              value={form.default_supplier_payment_terms_days}
              suffix="days"
              min="0"
              max="365"
              step="1"
              onChange={(value) =>
                updateField("default_supplier_payment_terms_days", value)
              }
            />
          </div>
        </Section>

        <Section
          title="Accounting Basis"
          description="Controls the preferred reporting interpretation for your business."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <ChoiceCard
              title="Accrual Basis"
              description="Revenue and expenses are recognized when earned or incurred. Recommended for Business360."
              active={form.accounting_basis === "accrual"}
              recommended
              onClick={() => updateField("accounting_basis", "accrual")}
            />

            <ChoiceCard
              title="Cash Basis"
              description="Revenue and expenses are recognized when cash is received or paid."
              active={form.accounting_basis === "cash"}
              onClick={() => updateField("accounting_basis", "cash")}
            />
          </div>

          <p className="mt-4 text-xs leading-5 text-gray-500">
            Current Business360 operational reports primarily use transaction and
            document status logic. This preference prepares the workspace for
            future basis-aware reporting.
          </p>
        </Section>

        <Section
          title="Month-End Controls"
          description="Company-level guardrails for closing and reopening accounting periods."
        >
          <div className="space-y-4">
            <ToggleRow
              title="Allow Period Reopen"
              description="Owners may reopen a previously closed accounting month when a correction is required."
              checked={form.allow_period_reopen}
              onChange={(checked) => updateField("allow_period_reopen", checked)}
            />

            <ToggleRow
              title="Require Close / Reopen Note"
              description="Require a reason or note for accounting close and reopen actions."
              checked={form.require_close_note}
              onChange={(checked) => updateField("require_close_note", checked)}
            />

            <ToggleRow
              title="Lock Posted Expenses in Closed Periods"
              description="Treat posted expenses in closed months as locked accounting records."
              checked={form.lock_posted_expenses_in_closed_period}
              onChange={(checked) =>
                updateField("lock_posted_expenses_in_closed_period", checked)
              }
            />
          </div>
        </Section>

        <section className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
          <div className="text-sm font-semibold text-gray-900">
            Existing accounting close protection remains active
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            These settings are company preferences. Your database-level
            accounting-period safeguards and owner checks remain the final source
            of protection.
          </p>
        </section>

        {message && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        )}

        {successMessage && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        <div className="flex justify-end border-t border-gray-200 pt-6">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Accounting Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

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
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
        style={{ colorScheme: "light", backgroundColor: "#ffffff", color: "#111827" }}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberField({
  label,
  value,
  suffix,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: string;
  suffix: string;
  min: string;
  max: string;
  step: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>

      <div
        className="flex overflow-hidden rounded-lg border border-gray-200 bg-white focus-within:border-gray-400"
        style={{ backgroundColor: "#ffffff", colorScheme: "light" }}
      >
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 border-0 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none"
          style={{
            backgroundColor: "#ffffff",
            color: "#111827",
            WebkitTextFillColor: "#111827",
            colorScheme: "light",
          }}
        />

        <div
          className="flex items-center border-l border-gray-200 bg-gray-50 px-3 text-xs font-medium text-gray-500"
          style={{ backgroundColor: "#f9fafb", color: "#6b7280" }}
        >
          {suffix}
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({
  title,
  description,
  active,
  recommended = false,
  onClick,
}: {
  title: string;
  description: string;
  active: boolean;
  recommended?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-5 text-left transition ${
        active
          ? "border-gray-900 bg-gray-900"
          : "border-gray-200 bg-white hover:border-gray-400"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className={`font-semibold ${active ? "text-white" : "text-gray-900"}`}>
          {title}
        </div>

        {recommended && (
          <span
            className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-wide ${
              active ? "bg-white/15 text-white" : "bg-green-50 text-green-700"
            }`}
          >
            Recommended
          </span>
        )}
      </div>

      <p
        className={`mt-2 text-sm leading-6 ${
          active ? "text-gray-300" : "text-gray-500"
        }`}
      >
        {description}
      </p>
    </button>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-start justify-between gap-5 rounded-lg border border-gray-200 bg-gray-50 p-4 text-left hover:bg-gray-100"
    >
      <div>
        <div className="text-sm font-medium text-gray-900">{title}</div>
        <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
      </div>

      <span
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-gray-900" : "bg-gray-300"
        }`}
      >
        <span
          className={`mt-1 h-4 w-4 rounded-full bg-white transition ${
            checked ? "ml-6" : "ml-1"
          }`}
        />
      </span>
    </button>
  );
}
