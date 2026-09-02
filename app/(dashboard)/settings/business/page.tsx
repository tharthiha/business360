"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type BusinessSettingsForm = {
  timezone: string;
  date_format: string;
  default_currency: string;
  fiscal_year_start_month: string;
  document_language: string;
  week_starts_on: string;
  negative_stock_policy: string;
  auto_generate_document_numbers: boolean;
};

const initialForm: BusinessSettingsForm = {
  timezone: "Asia/Bangkok",
  date_format: "DD/MM/YYYY",
  default_currency: "THB",
  fiscal_year_start_month: "1",
  document_language: "en",
  week_starts_on: "monday",
  negative_stock_policy: "warn",
  auto_generate_document_numbers: true,
};

export default function BusinessSettingsPage() {
  const supabase = createClient();

  const [companyId, setCompanyId] = useState<number | null>(null);
  const [form, setForm] = useState<BusinessSettingsForm>(initialForm);
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
            default_currency,
            timezone,
            date_format,
            fiscal_year_start_month,
            document_language,
            week_starts_on,
            negative_stock_policy,
            auto_generate_document_numbers
          `)
          .eq("id", id)
          .single();

        if (companyError || !company) {
          setMessage(companyError?.message || "Could not load business settings.");
          return;
        }

        setForm({
          timezone: company.timezone || "Asia/Bangkok",
          date_format: company.date_format || "DD/MM/YYYY",
          default_currency: company.default_currency || "THB",
          fiscal_year_start_month: String(company.fiscal_year_start_month || 1),
          document_language: company.document_language || "en",
          week_starts_on: company.week_starts_on || "monday",
          negative_stock_policy: company.negative_stock_policy || "warn",
          auto_generate_document_numbers:
            company.auto_generate_document_numbers !== false,
        });
      } catch (error) {
        console.error(error);
        setMessage("Unexpected error while loading business settings.");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  function updateField(
    key: keyof BusinessSettingsForm,
    value: string | boolean
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

    setSaving(true);
    setMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase
        .from("companies")
        .update({
          timezone: form.timezone,
          date_format: form.date_format,
          default_currency: form.default_currency,
          fiscal_year_start_month: Number(form.fiscal_year_start_month),
          document_language: form.document_language,
          week_starts_on: form.week_starts_on,
          negative_stock_policy: form.negative_stock_policy,
          auto_generate_document_numbers: form.auto_generate_document_numbers,
        })
        .eq("id", companyId);

      if (error) {
        setMessage(error.message);
        return;
      }

      setSuccessMessage("Business settings saved successfully.");
    } catch (error) {
      console.error(error);
      setMessage("Unexpected error while saving business settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="text-sm text-gray-500">
          Loading business settings...
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
            <span>Business Settings</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Business Settings
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Configure company-wide operational defaults used across Business360.
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
          title="Regional Preferences"
          description="Controls how dates, currency and business time are presented."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <SelectField
              label="Timezone"
              value={form.timezone}
              onChange={(value) => updateField("timezone", value)}
              options={[
                ["Asia/Bangkok", "Asia/Bangkok — Thailand"],
                ["Asia/Yangon", "Asia/Yangon — Myanmar"],
                ["Asia/Singapore", "Asia/Singapore — Singapore"],
                ["UTC", "UTC"],
              ]}
            />

            <SelectField
              label="Date Format"
              value={form.date_format}
              onChange={(value) => updateField("date_format", value)}
              options={[
                ["DD/MM/YYYY", "DD/MM/YYYY"],
                ["MM/DD/YYYY", "MM/DD/YYYY"],
                ["YYYY-MM-DD", "YYYY-MM-DD"],
              ]}
            />

            <SelectField
              label="Default Currency"
              value={form.default_currency}
              onChange={(value) => updateField("default_currency", value)}
              options={[
                ["THB", "THB — Thai Baht"],
                ["MMK", "MMK — Myanmar Kyat"],
                ["USD", "USD — US Dollar"],
                ["SGD", "SGD — Singapore Dollar"],
                ["EUR", "EUR — Euro"],
              ]}
            />

            <SelectField
              label="Week Starts On"
              value={form.week_starts_on}
              onChange={(value) => updateField("week_starts_on", value)}
              options={[
                ["monday", "Monday"],
                ["sunday", "Sunday"],
              ]}
            />
          </div>
        </Section>

        <Section
          title="Financial Year"
          description="Choose when your company financial year begins."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <SelectField
              label="Fiscal Year Start Month"
              value={form.fiscal_year_start_month}
              onChange={(value) =>
                updateField("fiscal_year_start_month", value)
              }
              options={MONTH_OPTIONS}
            />

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Example
              </div>
              <div className="mt-2 text-sm font-medium text-gray-900">
                {fiscalYearExample(Number(form.fiscal_year_start_month))}
              </div>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                This preference will be used by future fiscal-year reporting and
                period views.
              </p>
            </div>
          </div>
        </Section>

        <Section
          title="Documents & Language"
          description="Default behavior for business documents created by the system."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <SelectField
              label="Document Language"
              value={form.document_language}
              onChange={(value) => updateField("document_language", value)}
              options={[
                ["en", "English"],
                ["my", "Myanmar"],
              ]}
            />

            <ToggleCard
              title="Automatic Document Numbers"
              description="Automatically generate quotation, sales, invoice, purchase and expense numbers."
              checked={form.auto_generate_document_numbers}
              onChange={(checked) =>
                updateField("auto_generate_document_numbers", checked)
              }
            />
          </div>
        </Section>

        <Section
          title="Inventory Behavior"
          description="Choose how the system should respond when a transaction could create negative stock."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <PolicyCard
              title="Allow"
              description="Allow the transaction without warning."
              active={form.negative_stock_policy === "allow"}
              onClick={() => updateField("negative_stock_policy", "allow")}
            />
            <PolicyCard
              title="Warn"
              description="Show a warning but allow an authorized user to continue."
              active={form.negative_stock_policy === "warn"}
              recommended
              onClick={() => updateField("negative_stock_policy", "warn")}
            />
            <PolicyCard
              title="Block"
              description="Prevent transactions that would make stock negative."
              active={form.negative_stock_policy === "block"}
              onClick={() => updateField("negative_stock_policy", "block")}
            />
          </div>
        </Section>

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
            {saving ? "Saving..." : "Save Business Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

const MONTH_OPTIONS = [
  ["1", "January"],
  ["2", "February"],
  ["3", "March"],
  ["4", "April"],
  ["5", "May"],
  ["6", "June"],
  ["7", "July"],
  ["8", "August"],
  ["9", "September"],
  ["10", "October"],
  ["11", "November"],
  ["12", "December"],
] as const;

function fiscalYearExample(startMonth: number) {
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const start = names[Math.max(0, Math.min(11, startMonth - 1))];
  const end = names[(Math.max(1, startMonth) + 10) % 12];

  return `${start} → ${end}`;
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
  options: readonly (readonly [string, string])[] | [string, string][];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-gray-400"
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

function ToggleCard({
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
      className="flex w-full items-start justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-left"
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

function PolicyCard({
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
          ? "border-gray-900 bg-gray-900 text-white"
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
              active
                ? "bg-white/15 text-white"
                : "bg-green-50 text-green-700"
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
