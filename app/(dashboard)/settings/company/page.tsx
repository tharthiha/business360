"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CompanyForm = {
  name: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  tax_id: string;
  default_currency: string;
  default_quote_template: string;
  country_code: string;
  timezone: string;
};

const COMPANY_BUCKET = "company-assets";

export default function CompanySettingsPage() {
  const supabase = createClient();

  const [companyId, setCompanyId] = useState<number | null>(null);
  const [onboardingCompletedAt, setOnboardingCompletedAt] =
    useState<string | null>(null);

  const [form, setForm] = useState<CompanyForm>({
    name: "",
    email: "",
    phone: "",
    address: "",
    website: "",
    tax_id: "",
    default_currency: "THB",
    default_quote_template: "classic",
    country_code: "TH",
    timezone: "Asia/Bangkok",
  });

  const [logoPath, setLogoPath] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [newLogo, setNewLogo] = useState<File | null>(null);
  const [newLogoPreview, setNewLogoPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    void loadCompany();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCompany() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please login first.");
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.company_id) {
        throw new Error("Company profile not found.");
      }

      const id = Number(profile.company_id);
      setCompanyId(id);

      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select(`
          id,
          name,
          email,
          phone,
          address,
          logo_path,
          website,
          tax_id,
          default_currency,
          default_quote_template,
          country_code,
          timezone,
          onboarding_completed_at
        `)
        .eq("id", id)
        .single();

      if (companyError || !company) {
        throw companyError || new Error("Company not found.");
      }

      setForm({
        name: company.name || "",
        email: company.email || "",
        phone: company.phone || "",
        address: company.address || "",
        website: company.website || "",
        tax_id: company.tax_id || "",
        default_currency: company.default_currency || "THB",
        default_quote_template: company.default_quote_template || "classic",
        country_code: company.country_code || "TH",
        timezone: company.timezone || "Asia/Bangkok",
      });

      setOnboardingCompletedAt(company.onboarding_completed_at || null);

      const existingLogoPath = company.logo_path || "";
      setLogoPath(existingLogoPath);

      if (existingLogoPath) {
        const { data, error } = await supabase.storage
          .from(COMPANY_BUCKET)
          .createSignedUrl(existingLogoPath, 3600);

        if (!error && data?.signedUrl) {
          setLogoUrl(data.signedUrl);
        }
      }
    } catch (err) {
      setMessage(formatError(err, "Could not load company settings."));
    } finally {
      setLoading(false);
    }
  }

  function handleChange(
    event:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>
      | React.ChangeEvent<HTMLSelectElement>
  ) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function handleCountryChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const country = event.target.value;

    const defaults: Record<string, { currency: string; timezone: string }> = {
      TH: { currency: "THB", timezone: "Asia/Bangkok" },
      MM: { currency: "MMK", timezone: "Asia/Yangon" },
      SG: { currency: "SGD", timezone: "Asia/Singapore" },
      MY: { currency: "MYR", timezone: "Asia/Kuala_Lumpur" },
      US: { currency: "USD", timezone: "America/New_York" },
      GB: { currency: "GBP", timezone: "Europe/London" },
      AU: { currency: "AUD", timezone: "Australia/Sydney" },
    };

    setForm((current) => ({
      ...current,
      country_code: country,
      default_currency: defaults[country]?.currency || current.default_currency,
      timezone: defaults[country]?.timezone || current.timezone,
    }));
  }

  function handleLogo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setMessage("");
    setSuccessMessage("");

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Logo must be JPG, PNG or WEBP.");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setMessage("Logo must be smaller than 3 MB.");
      return;
    }

    if (newLogoPreview) {
      URL.revokeObjectURL(newLogoPreview);
    }

    setNewLogo(file);
    setNewLogoPreview(URL.createObjectURL(file));
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();

    if (!companyId) {
      setMessage("Company ID not found.");
      return;
    }

    if (!form.name.trim()) {
      setMessage("Company name is required.");
      return;
    }

    if (!form.country_code || !form.default_currency || !form.timezone) {
      setMessage("Country, currency and timezone are required.");
      return;
    }

    setSaving(true);
    setMessage("");
    setSuccessMessage("");

    let uploadedPath: string | null = null;

    try {
      let finalLogoPath = logoPath;

      if (newLogo) {
        const extension =
          newLogo.name.split(".").pop()?.toLowerCase() || "png";

        uploadedPath =
          `company-${companyId}/logo-${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from(COMPANY_BUCKET)
          .upload(uploadedPath, newLogo, {
            cacheControl: "3600",
            upsert: false,
            contentType: newLogo.type || undefined,
          });

        if (uploadError) throw uploadError;
        finalLogoPath = uploadedPath;
      }

      const completedAt =
        onboardingCompletedAt || new Date().toISOString();

      const { error: updateError } = await supabase
        .from("companies")
        .update({
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          website: form.website.trim() || null,
          tax_id: form.tax_id.trim() || null,
          default_currency: form.default_currency,
          default_quote_template: form.default_quote_template,
          country_code: form.country_code,
          timezone: form.timezone,
          onboarding_completed_at: completedAt,
          logo_path: finalLogoPath || null,
        })
        .eq("id", companyId);

      if (updateError) throw updateError;

      if (uploadedPath && logoPath && logoPath !== uploadedPath) {
        await supabase.storage.from(COMPANY_BUCKET).remove([logoPath]);
      }

      setLogoPath(finalLogoPath);
      setOnboardingCompletedAt(completedAt);

      if (finalLogoPath) {
        const { data, error } = await supabase.storage
          .from(COMPANY_BUCKET)
          .createSignedUrl(finalLogoPath, 3600);

        if (!error && data?.signedUrl) {
          setLogoUrl(data.signedUrl);
        }
      }

      if (newLogoPreview) URL.revokeObjectURL(newLogoPreview);
      setNewLogo(null);
      setNewLogoPreview("");

      setSuccessMessage(
        onboardingCompletedAt
          ? "Company settings saved successfully."
          : "Company setup completed. Business360 is ready for this company."
      );
    } catch (err) {
      if (uploadedPath) {
        await supabase.storage.from(COMPANY_BUCKET).remove([uploadedPath]);
      }

      setMessage(formatError(err, "Could not save company settings."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-sm text-gray-500">
        Loading company settings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          {onboardingCompletedAt ? "Company Settings" : "Company Setup"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {onboardingCompletedAt
            ? "Manage your company profile, operating defaults and branding."
            : "Complete these business details before using Business360."}
        </p>
      </div>

      {!onboardingCompletedAt && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-800">
          <div className="font-semibold">Initial company setup</div>
          <div className="mt-1 leading-6">
            Company name, country, currency and timezone are required. These defaults keep every company isolated and consistent across Sales, Purchase and Accounting.
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <Section
          title="Company Information"
          description="Core legal and contact details used on business documents."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="Company Name"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
            />

            <Field
              label="Tax ID"
              name="tax_id"
              value={form.tax_id}
              onChange={handleChange}
            />

            <Field
              label="Email"
              name="email"
              value={form.email}
              onChange={handleChange}
              type="email"
            />

            <Field
              label="Phone"
              name="phone"
              value={form.phone}
              onChange={handleChange}
            />

            <Field
              label="Website"
              name="website"
              value={form.website}
              onChange={handleChange}
              placeholder="https://example.com"
            />

            <label className="block md:col-span-2">
              <div className="mb-1.5 text-sm font-medium text-gray-700">
                Address
              </div>
              <textarea
                name="address"
                value={form.address}
                onChange={handleChange}
                rows={4}
                className={inputClass}
                placeholder="Company address"
              />
            </label>
          </div>
        </Section>

        <Section
          title="Business Defaults"
          description="These defaults are stored per company for the multi-company SaaS model."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <SelectField
              label="Country"
              name="country_code"
              value={form.country_code}
              onChange={handleCountryChange}
            >
              <option value="TH">Thailand</option>
              <option value="MM">Myanmar</option>
              <option value="SG">Singapore</option>
              <option value="MY">Malaysia</option>
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
              <option value="AU">Australia</option>
            </SelectField>

            <SelectField
              label="Default Currency"
              name="default_currency"
              value={form.default_currency}
              onChange={handleChange}
            >
              <option value="THB">THB — Thai Baht</option>
              <option value="MMK">MMK — Myanmar Kyat</option>
              <option value="SGD">SGD — Singapore Dollar</option>
              <option value="MYR">MYR — Malaysian Ringgit</option>
              <option value="USD">USD — US Dollar</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="AUD">AUD — Australian Dollar</option>
              <option value="EUR">EUR — Euro</option>
            </SelectField>

            <SelectField
              label="Timezone"
              name="timezone"
              value={form.timezone}
              onChange={handleChange}
            >
              <option value="Asia/Bangkok">Asia/Bangkok</option>
              <option value="Asia/Yangon">Asia/Yangon</option>
              <option value="Asia/Singapore">Asia/Singapore</option>
              <option value="Asia/Kuala_Lumpur">Asia/Kuala Lumpur</option>
              <option value="America/New_York">America/New York</option>
              <option value="America/Los_Angeles">America/Los Angeles</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Australia/Sydney">Australia/Sydney</option>
            </SelectField>

            <SelectField
              label="Default Quotation Template"
              name="default_quote_template"
              value={form.default_quote_template}
              onChange={handleChange}
            >
              <option value="classic">Classic Corporate</option>
              <option value="modern">Modern Minimal</option>
              <option value="commercial">Retail / Commercial</option>
            </SelectField>
          </div>
        </Section>

        <Section
          title="Company Logo"
          description="Displayed on company documents when document settings allow it."
        >
          <div className="grid gap-6 md:grid-cols-[220px_1fr]">
            <div className="flex h-44 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
              {newLogoPreview || logoUrl ? (
                <img
                  src={newLogoPreview || logoUrl}
                  alt="Company logo"
                  className="max-h-[150px] max-w-[190px] object-contain"
                />
              ) : (
                <div className="text-sm text-gray-400">No Logo</div>
              )}
            </div>

            <div>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-center hover:bg-gray-100">
                <div className="text-sm font-medium text-gray-900">
                  Choose Company Logo
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  JPG, PNG or WEBP • Max 3 MB
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleLogo}
                  className="hidden"
                />
              </label>

              {newLogo && (
                <button
                  type="button"
                  onClick={() => {
                    if (newLogoPreview) URL.revokeObjectURL(newLogoPreview);
                    setNewLogo(null);
                    setNewLogoPreview("");
                  }}
                  className="mt-3 text-sm font-medium text-red-600"
                >
                  Remove selected logo
                </button>
              )}
            </div>
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
            className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : onboardingCompletedAt
              ? "Save Settings"
              : "Complete Company Setup"}
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
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  required = false,
  type = "text",
  placeholder = "",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </div>
      <input
        type={type}
        name={name}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={onChange}
        className={inputClass}
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  children,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-medium text-gray-700">{label}</div>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className={inputClass}
      >
        {children}
      </select>
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400";

function formatError(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message || fallback;

  if (err && typeof err === "object") {
    const value = err as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };

    const parts = [
      typeof value.message === "string" ? value.message : "",
      typeof value.details === "string" && value.details
        ? `Details: ${value.details}`
        : "",
      typeof value.hint === "string" && value.hint
        ? `Hint: ${value.hint}`
        : "",
      typeof value.code === "string" && value.code
        ? `Code: ${value.code}`
        : "",
    ].filter(Boolean);

    if (parts.length) return parts.join(" • ");
  }

  return fallback;
}
