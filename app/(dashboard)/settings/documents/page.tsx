"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type DocumentSettingsForm = {
  quotation_prefix: string;
  sales_order_prefix: string;
  invoice_prefix: string;
  purchase_order_prefix: string;
  supplier_bill_prefix: string;
  expense_prefix: string;
  default_quotation_validity_days: string;
  default_document_terms: string;
  default_document_footer: string;
  show_company_tax_id_on_documents: boolean;
  show_company_logo_on_documents: boolean;
};

const initialForm: DocumentSettingsForm = {
  quotation_prefix: "QT",
  sales_order_prefix: "SO",
  invoice_prefix: "INV",
  purchase_order_prefix: "PO",
  supplier_bill_prefix: "BILL",
  expense_prefix: "EXP",
  default_quotation_validity_days: "30",
  default_document_terms: "",
  default_document_footer: "",
  show_company_tax_id_on_documents: true,
  show_company_logo_on_documents: true,
};

export default function DocumentSettingsPage() {
  const supabase = createClient();

  const [companyId, setCompanyId] = useState<number | null>(null);
  const [form, setForm] = useState<DocumentSettingsForm>(initialForm);
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
            quotation_prefix,
            sales_order_prefix,
            invoice_prefix,
            purchase_order_prefix,
            supplier_bill_prefix,
            expense_prefix,
            default_quotation_validity_days,
            default_document_terms,
            default_document_footer,
            show_company_tax_id_on_documents,
            show_company_logo_on_documents
          `)
          .eq("id", id)
          .single();

        if (companyError || !company) {
          setMessage(companyError?.message || "Could not load document settings.");
          return;
        }

        setForm({
          quotation_prefix: company.quotation_prefix || "QT",
          sales_order_prefix: company.sales_order_prefix || "SO",
          invoice_prefix: company.invoice_prefix || "INV",
          purchase_order_prefix: company.purchase_order_prefix || "PO",
          supplier_bill_prefix: company.supplier_bill_prefix || "BILL",
          expense_prefix: company.expense_prefix || "EXP",
          default_quotation_validity_days: String(
            company.default_quotation_validity_days ?? 30
          ),
          default_document_terms: company.default_document_terms || "",
          default_document_footer: company.default_document_footer || "",
          show_company_tax_id_on_documents:
            company.show_company_tax_id_on_documents !== false,
          show_company_logo_on_documents:
            company.show_company_logo_on_documents !== false,
        });
      } catch (error) {
        console.error(error);
        setMessage("Unexpected error while loading document settings.");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  function updateField<K extends keyof DocumentSettingsForm>(
    key: K,
    value: DocumentSettingsForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  const previewNumbers = useMemo(
    () => ({
      quotation: `${cleanPrefix(form.quotation_prefix)}-2026-0001`,
      sales: `${cleanPrefix(form.sales_order_prefix)}-2026-0001`,
      invoice: `${cleanPrefix(form.invoice_prefix)}-2026-0001`,
      purchase: `${cleanPrefix(form.purchase_order_prefix)}-2026-0001`,
      bill: `${cleanPrefix(form.supplier_bill_prefix)}-2026-0001`,
      expense: `${cleanPrefix(form.expense_prefix)}-2026-0001`,
    }),
    [
      form.quotation_prefix,
      form.sales_order_prefix,
      form.invoice_prefix,
      form.purchase_order_prefix,
      form.supplier_bill_prefix,
      form.expense_prefix,
    ]
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (!companyId) {
      setMessage("Company ID not found.");
      return;
    }

    const prefixes = [
      form.quotation_prefix,
      form.sales_order_prefix,
      form.invoice_prefix,
      form.purchase_order_prefix,
      form.supplier_bill_prefix,
      form.expense_prefix,
    ].map(cleanPrefix);

    if (prefixes.some((prefix) => prefix.length < 1 || prefix.length > 12)) {
      setMessage("Each document prefix must be between 1 and 12 characters.");
      return;
    }

    const validityDays = Number(form.default_quotation_validity_days);

    if (
      !Number.isInteger(validityDays) ||
      validityDays < 1 ||
      validityDays > 365
    ) {
      setMessage("Quotation validity must be between 1 and 365 days.");
      return;
    }

    setSaving(true);
    setMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase
        .from("companies")
        .update({
          quotation_prefix: prefixes[0],
          sales_order_prefix: prefixes[1],
          invoice_prefix: prefixes[2],
          purchase_order_prefix: prefixes[3],
          supplier_bill_prefix: prefixes[4],
          expense_prefix: prefixes[5],
          default_quotation_validity_days: validityDays,
          default_document_terms: form.default_document_terms.trim() || null,
          default_document_footer: form.default_document_footer.trim() || null,
          show_company_tax_id_on_documents:
            form.show_company_tax_id_on_documents,
          show_company_logo_on_documents: form.show_company_logo_on_documents,
        })
        .eq("id", companyId);

      if (error) {
        setMessage(error.message);
        return;
      }

      setForm((current) => ({
        ...current,
        quotation_prefix: prefixes[0],
        sales_order_prefix: prefixes[1],
        invoice_prefix: prefixes[2],
        purchase_order_prefix: prefixes[3],
        supplier_bill_prefix: prefixes[4],
        expense_prefix: prefixes[5],
      }));

      setSuccessMessage("Document settings saved successfully.");
    } catch (error) {
      console.error(error);
      setMessage("Unexpected error while saving document settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="text-sm text-gray-500">
          Loading document settings...
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
            <span>Document Settings</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Document Settings
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Configure document numbering, quotation defaults, terms and branding.
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
          title="Document Number Prefixes"
          description="Control the prefix used when Business360 generates new document numbers."
        >
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <PrefixField
              label="Quotation"
              value={form.quotation_prefix}
              preview={previewNumbers.quotation}
              onChange={(value) => updateField("quotation_prefix", value)}
            />
            <PrefixField
              label="Sales Order"
              value={form.sales_order_prefix}
              preview={previewNumbers.sales}
              onChange={(value) => updateField("sales_order_prefix", value)}
            />
            <PrefixField
              label="Invoice"
              value={form.invoice_prefix}
              preview={previewNumbers.invoice}
              onChange={(value) => updateField("invoice_prefix", value)}
            />
            <PrefixField
              label="Purchase Order"
              value={form.purchase_order_prefix}
              preview={previewNumbers.purchase}
              onChange={(value) => updateField("purchase_order_prefix", value)}
            />
            <PrefixField
              label="Supplier Bill"
              value={form.supplier_bill_prefix}
              preview={previewNumbers.bill}
              onChange={(value) => updateField("supplier_bill_prefix", value)}
            />
            <PrefixField
              label="Expense"
              value={form.expense_prefix}
              preview={previewNumbers.expense}
              onChange={(value) => updateField("expense_prefix", value)}
            />
          </div>

          <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">
            Prefix settings are defaults. Existing historical document numbers
            are never renamed.
          </div>
        </Section>

        <Section
          title="Quotation Defaults"
          description="Default rules applied when new quotations are created."
        >
          <div className="max-w-md">
            <NumberField
              label="Default Quotation Validity"
              value={form.default_quotation_validity_days}
              suffix="days"
              min="1"
              max="365"
              step="1"
              onChange={(value) =>
                updateField("default_quotation_validity_days", value)
              }
            />
          </div>
        </Section>

        <Section
          title="Terms & Footer"
          description="Reusable text that can be shown on customer and supplier documents."
        >
          <div className="grid gap-5 xl:grid-cols-2">
            <TextAreaField
              label="Default Terms & Conditions"
              value={form.default_document_terms}
              placeholder="Payment terms, validity, delivery conditions, warranty or other standard terms..."
              onChange={(value) => updateField("default_document_terms", value)}
            />

            <TextAreaField
              label="Default Footer"
              value={form.default_document_footer}
              placeholder="Thank you for your business."
              onChange={(value) => updateField("default_document_footer", value)}
            />
          </div>
        </Section>

        <Section
          title="Document Branding"
          description="Choose which company identity elements appear on generated documents."
        >
          <div className="space-y-4">
            <ToggleRow
              title="Show Company Logo"
              description="Display the company logo on supported quotations, invoices, receipts and reports."
              checked={form.show_company_logo_on_documents}
              onChange={(checked) =>
                updateField("show_company_logo_on_documents", checked)
              }
            />

            <ToggleRow
              title="Show Company Tax ID"
              description="Display the company tax ID on supported business documents."
              checked={form.show_company_tax_id_on_documents}
              onChange={(checked) =>
                updateField("show_company_tax_id_on_documents", checked)
              }
            />
          </div>
        </Section>

        <section className="rounded-xl border border-gray-200 bg-gray-50 p-5">
          <div className="text-sm font-semibold text-gray-900">
            Numbering integration note
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            These values establish the company document defaults. Existing
            document creation flows can be connected to these prefixes
            incrementally without changing historical records.
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
            {saving ? "Saving..." : "Save Document Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

function cleanPrefix(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 12);
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

function PrefixField({
  label,
  value,
  preview,
  onChange,
}: {
  label: string;
  value: string;
  preview: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label} Prefix
      </label>

      <input
        type="text"
        value={value}
        maxLength={12}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold uppercase text-gray-900 outline-none focus:border-gray-400"
        style={{
          backgroundColor: "#ffffff",
          color: "#111827",
          WebkitTextFillColor: "#111827",
          colorScheme: "light",
        }}
      />

      <div className="mt-2 text-xs text-gray-400">
        Example: <span className="font-medium text-gray-600">{preview}</span>
      </div>
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

        <div className="flex items-center border-l border-gray-200 bg-gray-50 px-3 text-xs font-medium text-gray-500">
          {suffix}
        </div>
      </div>
    </div>
  );
}

function TextAreaField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>

      <textarea
        value={value}
        rows={7}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-400"
        style={{
          backgroundColor: "#ffffff",
          color: "#111827",
          WebkitTextFillColor: "#111827",
          colorScheme: "light",
        }}
      />
    </div>
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
