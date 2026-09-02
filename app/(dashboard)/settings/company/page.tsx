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
};

const COMPANY_BUCKET = "company-assets";

export default function CompanySettingsPage() {
  const supabase = createClient();

  const [companyId, setCompanyId] =
    useState<number | null>(null);

  const [form, setForm] =
    useState<CompanyForm>({
      name: "",
      email: "",
      phone: "",
      address: "",
      website: "",
      tax_id: "",
      default_currency: "THB",
      default_quote_template: "classic",
    });

  const [logoPath, setLogoPath] =
    useState("");

  const [logoUrl, setLogoUrl] =
    useState("");

  const [newLogo, setNewLogo] =
    useState<File | null>(null);

  const [newLogoPreview, setNewLogoPreview] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  // =========================================================
  // LOAD COMPANY
  // =========================================================

  useEffect(() => {
    async function loadCompany() {
      setLoading(true);
      setMessage("");

      try {
        const {
          data: { user },
          error: userError,
        } =
          await supabase.auth.getUser();

        if (userError || !user) {
          setMessage(
            "Please login first."
          );
          return;
        }

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .single();

        if (
          profileError ||
          !profile?.company_id
        ) {
          setMessage(
            "Company profile not found."
          );
          return;
        }

        const id =
          profile.company_id;

        setCompanyId(id);

        const {
          data: company,
          error: companyError,
        } = await supabase
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
            default_quote_template
          `)
          .eq("id", id)
          .single();

        if (
          companyError ||
          !company
        ) {
          setMessage(
            companyError?.message ||
              "Company not found."
          );
          return;
        }

        setForm({
          name:
            company.name || "",

          email:
            company.email || "",

          phone:
            company.phone || "",

          address:
            company.address || "",

          website:
            company.website || "",

          tax_id:
            company.tax_id || "",

          default_currency:
            company.default_currency ||
            "THB",

          default_quote_template:
            company.default_quote_template ||
            "classic",
        });

        const existingLogoPath =
          company.logo_path || "";

        setLogoPath(
          existingLogoPath
        );

        if (existingLogoPath) {
          const {
            data,
            error,
          } =
            await supabase.storage
              .from(COMPANY_BUCKET)
              .createSignedUrl(
                existingLogoPath,
                3600
              );

          if (
            !error &&
            data?.signedUrl
          ) {
            setLogoUrl(
              data.signedUrl
            );
          }
        }
      } catch (error) {
        console.error(error);

        setMessage(
          "Unexpected error while loading company settings."
        );
      } finally {
        setLoading(false);
      }
    }

    loadCompany();
  }, []);

  // =========================================================
  // FORM
  // =========================================================

  function handleChange(
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>
      | React.ChangeEvent<HTMLSelectElement>
  ) {
    setForm({
      ...form,
      [e.target.name]:
        e.target.value,
    });
  }

  // =========================================================
  // LOGO
  // =========================================================

  function handleLogo(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      e.target.files?.[0];

    if (!file) return;

    setMessage("");
    setSuccessMessage("");

    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (
      !validTypes.includes(file.type)
    ) {
      setMessage(
        "Logo must be JPG, PNG or WEBP."
      );
      return;
    }

    if (
      file.size >
      3 * 1024 * 1024
    ) {
      setMessage(
        "Logo must be smaller than 3 MB."
      );
      return;
    }

    if (newLogoPreview) {
      URL.revokeObjectURL(
        newLogoPreview
      );
    }

    setNewLogo(file);

    setNewLogoPreview(
      URL.createObjectURL(file)
    );
  }

  function cancelNewLogo() {
    if (newLogoPreview) {
      URL.revokeObjectURL(
        newLogoPreview
      );
    }

    setNewLogo(null);
    setNewLogoPreview("");
  }

  // =========================================================
  // SAVE
  // =========================================================

  async function handleSave(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!companyId) {
      setMessage(
        "Company ID not found."
      );
      return;
    }

    if (!form.name.trim()) {
      setMessage(
        "Company name is required."
      );
      return;
    }

    setSaving(true);
    setMessage("");
    setSuccessMessage("");

    try {
      let finalLogoPath =
        logoPath;

      // -------------------------
      // UPLOAD NEW LOGO
      // -------------------------

      if (newLogo) {
        const extension =
          newLogo.name
            .split(".")
            .pop()
            ?.toLowerCase() ||
          "png";

        const newPath =
          `company-${companyId}/logo-${Date.now()}.${extension}`;

        const {
          error: uploadError,
        } =
          await supabase.storage
            .from(COMPANY_BUCKET)
            .upload(
              newPath,
              newLogo,
              {
                cacheControl:
                  "3600",
                upsert: false,
              }
            );

        if (uploadError) {
          if (
            uploadError.message
              .toLowerCase()
              .includes(
                "bucket not found"
              )
          ) {
            setMessage(
              'Storage bucket "company-assets" was not found. Create it in Supabase Storage first.'
            );
          } else {
            setMessage(
              uploadError.message
            );
          }

          return;
        }

        if (logoPath) {
          await supabase.storage
            .from(COMPANY_BUCKET)
            .remove([
              logoPath,
            ]);
        }

        finalLogoPath =
          newPath;
      }

      // -------------------------
      // UPDATE COMPANY
      // -------------------------

      const {
        error: updateError,
      } = await supabase
        .from("companies")
        .update({
          name:
            form.name.trim(),

          email:
            form.email.trim() ||
            null,

          phone:
            form.phone.trim() ||
            null,

          address:
            form.address.trim() ||
            null,

          website:
            form.website.trim() ||
            null,

          tax_id:
            form.tax_id.trim() ||
            null,

          default_currency:
            form.default_currency,

          default_quote_template:
            form.default_quote_template,

          logo_path:
            finalLogoPath ||
            null,
        })
        .eq(
          "id",
          companyId
        );

      if (updateError) {
        setMessage(
          updateError.message
        );
        return;
      }

      setLogoPath(
        finalLogoPath
      );

      if (finalLogoPath) {
        const {
          data,
          error,
        } =
          await supabase.storage
            .from(COMPANY_BUCKET)
            .createSignedUrl(
              finalLogoPath,
              3600
            );

        if (
          !error &&
          data?.signedUrl
        ) {
          setLogoUrl(
            data.signedUrl
          );
        }
      }

      if (newLogoPreview) {
        URL.revokeObjectURL(
          newLogoPreview
        );
      }

      setNewLogo(null);
      setNewLogoPreview("");

      setSuccessMessage(
        "Company settings saved successfully."
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "Unexpected error while saving company settings."
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="text-sm text-gray-500">
          Loading company settings...
        </div>
      </div>
    );
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Company Settings
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Manage company branding and document templates.
        </p>
      </div>

      <form onSubmit={handleSave}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* LEFT */}

          <div className="space-y-6 lg:col-span-2">
            {/* COMPANY INFO */}

            <Section
              title="Company Information"
              description="This information will appear on quotations and invoices."
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

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Address
                  </label>

                  <textarea
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Company address"
                    className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-400"
                  />
                </div>
              </div>
            </Section>

            {/* LOGO */}

            <Section
              title="Company Logo"
              description="Your logo will appear on quotations, invoices and reports."
            >
              <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                <div className="flex h-44 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                  {newLogoPreview ? (
                    <img
                      src={
                        newLogoPreview
                      }
                      alt="New logo"
                      className="max-h-[150px] max-w-[190px] object-contain"
                    />
                  ) : logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Company logo"
                      className="max-h-[150px] max-w-[190px] object-contain"
                    />
                  ) : (
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-600">
                        No Logo
                      </div>

                      <div className="mt-1 text-xs text-gray-400">
                        Upload company logo
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-center hover:bg-gray-100">
                    <div className="text-xl">
                      +
                    </div>

                    <div className="mt-2 text-sm font-medium text-gray-900">
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
                    <div className="mt-3 flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                      <span className="truncate text-xs text-gray-600">
                        {newLogo.name}
                      </span>

                      <button
                        type="button"
                        onClick={
                          cancelNewLogo
                        }
                        className="text-xs font-medium text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Section>

            {/* DOCUMENT DEFAULTS */}

            <Section
              title="Document Defaults"
              description="Choose your currency and default quotation design."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Default Currency
                  </label>

                  <select
                    name="default_currency"
                    value={
                      form.default_currency
                    }
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="THB">
                      THB — Thai Baht
                    </option>

                    <option value="USD">
                      USD — US Dollar
                    </option>

                    <option value="MMK">
                      MMK — Myanmar Kyat
                    </option>

                    <option value="SGD">
                      SGD — Singapore Dollar
                    </option>

                    <option value="EUR">
                      EUR — Euro
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Default Quotation Template
                  </label>

                  <select
                    name="default_quote_template"
                    value={
                      form.default_quote_template
                    }
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="classic">
                      Classic Corporate
                    </option>

                    <option value="modern">
                      Modern Minimal
                    </option>

                    <option value="commercial">
                      Retail / Commercial
                    </option>
                  </select>
                </div>
              </div>

              {/* REAL TEMPLATE PREVIEWS */}

              <div className="mt-6 grid gap-5 xl:grid-cols-3">
                <QuotationTemplateCard
                  title="Classic Corporate"
                  subtitle="Traditional B2B"
                  active={
                    form.default_quote_template ===
                    "classic"
                  }
                  onClick={() =>
                    setForm({
                      ...form,
                      default_quote_template:
                        "classic",
                    })
                  }
                >
                  <ClassicPreview />
                </QuotationTemplateCard>

                <QuotationTemplateCard
                  title="Modern Minimal"
                  subtitle="Clean & premium"
                  active={
                    form.default_quote_template ===
                    "modern"
                  }
                  onClick={() =>
                    setForm({
                      ...form,
                      default_quote_template:
                        "modern",
                    })
                  }
                >
                  <ModernPreview />
                </QuotationTemplateCard>

                <QuotationTemplateCard
                  title="Retail / Commercial"
                  subtitle="Bold product quote"
                  active={
                    form.default_quote_template ===
                    "commercial"
                  }
                  onClick={() =>
                    setForm({
                      ...form,
                      default_quote_template:
                        "commercial",
                    })
                  }
                >
                  <CommercialPreview />
                </QuotationTemplateCard>
              </div>
            </Section>
          </div>

          {/* RIGHT */}

          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900">
                Branding Preview
              </h3>

              <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-5">
                <div className="flex min-h-20 items-center justify-center">
                  {newLogoPreview ||
                  logoUrl ? (
                    <img
                      src={
                        newLogoPreview ||
                        logoUrl
                      }
                      alt="Logo preview"
                      className="max-h-16 max-w-[160px] object-contain"
                    />
                  ) : (
                    <span className="text-xs text-gray-400">
                      Company Logo
                    </span>
                  )}
                </div>

                <div className="mt-4 border-t border-gray-200 pt-4">
                  <div className="font-semibold text-gray-900">
                    {form.name ||
                      "Company Name"}
                  </div>

                  <div className="mt-2 text-xs leading-5 text-gray-500">
                    {form.address ||
                      "Company address"}

                    <br />

                    {form.phone ||
                      "Phone"}

                    <br />

                    {form.email ||
                      "Email"}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900">
                Selected Template
              </h3>

              <div className="mt-3 text-sm text-gray-500">
                {form.default_quote_template ===
                "classic"
                  ? "Classic Corporate"
                  : form.default_quote_template ===
                    "modern"
                  ? "Modern Minimal"
                  : "Retail / Commercial"}
              </div>

              <p className="mt-3 text-xs leading-5 text-gray-400">
                This will be automatically selected when a new quotation is created. You can still change the template per quotation later.
              </p>
            </div>
          </div>
        </div>

        {/* ERROR */}

        {message && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        )}

        {/* SUCCESS */}

        {successMessage && (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        {/* SAVE */}

        <div className="mt-6 flex justify-end border-t border-gray-200 pt-6">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
          >
            {saving
              ? "Saving Settings..."
              : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

// =========================================================
// TEMPLATE CARD
// =========================================================

function QuotationTemplateCard({
  title,
  subtitle,
  active,
  onClick,
  children,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`overflow-hidden rounded-xl border bg-white text-left transition ${
        active
          ? "border-gray-900 ring-2 ring-gray-900/10"
          : "border-gray-200 hover:border-gray-400"
      }`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">
            {title}
          </div>

          <div className="mt-0.5 text-xs text-gray-500">
            {subtitle}
          </div>
        </div>

        {active && (
          <span className="rounded-full bg-gray-900 px-2 py-1 text-[9px] font-medium text-white">
            Selected
          </span>
        )}
      </div>

      <div className="bg-gray-100 p-4">
        {children}
      </div>
    </button>
  );
}

// =========================================================
// CLASSIC TEMPLATE
// =========================================================

function ClassicPreview() {
  return (
    <div className="mx-auto aspect-[0.707/1] max-w-[220px] bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between border-b-2 border-gray-800 pb-2">
        <div>
          <div className="h-5 w-10 rounded bg-gray-800" />
          <div className="mt-1 h-1.5 w-20 rounded bg-gray-200" />
        </div>

        <div className="text-right">
          <div className="text-[10px] font-bold text-gray-800">
            QUOTATION
          </div>

          <div className="mt-1 h-1.5 w-12 rounded bg-gray-200" />
        </div>
      </div>

      <div className="mt-3 flex justify-between">
        <div>
          <div className="h-1.5 w-12 rounded bg-gray-300" />
          <div className="mt-1 h-1.5 w-20 rounded bg-gray-100" />
          <div className="mt-1 h-1.5 w-16 rounded bg-gray-100" />
        </div>

        <div>
          <div className="h-1.5 w-12 rounded bg-gray-300" />
          <div className="mt-1 h-1.5 w-16 rounded bg-gray-100" />
        </div>
      </div>

      <div className="mt-4 border border-gray-300">
        <div className="grid grid-cols-4 bg-gray-800 p-1">
          <div className="h-1 bg-white/70" />
          <div className="h-1 bg-white/70" />
          <div className="h-1 bg-white/70" />
          <div className="h-1 bg-white/70" />
        </div>

        {[1, 2, 3, 4].map(
          (row) => (
            <div
              key={row}
              className="grid grid-cols-4 gap-1 border-t border-gray-100 p-1.5"
            >
              <div className="h-1 bg-gray-100" />
              <div className="h-1 bg-gray-100" />
              <div className="h-1 bg-gray-100" />
              <div className="h-1 bg-gray-100" />
            </div>
          )
        )}
      </div>

      <div className="mt-4 ml-auto w-24 space-y-1">
        <div className="flex justify-between">
          <div className="h-1 w-8 bg-gray-200" />
          <div className="h-1 w-6 bg-gray-300" />
        </div>

        <div className="flex justify-between">
          <div className="h-1 w-8 bg-gray-200" />
          <div className="h-1 w-6 bg-gray-300" />
        </div>

        <div className="border-t border-gray-800 pt-1">
          <div className="ml-auto h-2 w-12 bg-gray-800" />
        </div>
      </div>
    </div>
  );
}

// =========================================================
// MODERN TEMPLATE
// =========================================================

function ModernPreview() {
  return (
    <div className="mx-auto aspect-[0.707/1] max-w-[220px] bg-white p-4 shadow-sm">
      <div className="flex justify-between">
        <div>
          <div className="h-7 w-7 rounded-full bg-gray-900" />
        </div>

        <div className="text-right">
          <div className="text-[12px] font-light tracking-[0.2em] text-gray-700">
            QUOTE
          </div>

          <div className="mt-2 h-1.5 w-14 rounded bg-gray-100" />
        </div>
      </div>

      <div className="mt-7">
        <div className="h-2 w-24 rounded bg-gray-800" />
        <div className="mt-2 h-1.5 w-32 rounded bg-gray-100" />
        <div className="mt-1 h-1.5 w-24 rounded bg-gray-100" />
      </div>

      <div className="mt-6">
        <div className="grid grid-cols-4 gap-2 border-b border-gray-300 pb-2">
          <div className="h-1 bg-gray-400" />
          <div className="h-1 bg-gray-400" />
          <div className="h-1 bg-gray-400" />
          <div className="h-1 bg-gray-400" />
        </div>

        {[1, 2, 3].map(
          (row) => (
            <div
              key={row}
              className="grid grid-cols-4 gap-2 border-b border-gray-100 py-3"
            >
              <div className="h-1 bg-gray-100" />
              <div className="h-1 bg-gray-100" />
              <div className="h-1 bg-gray-100" />
              <div className="h-1 bg-gray-100" />
            </div>
          )
        )}
      </div>

      <div className="mt-6 ml-auto w-28 rounded-lg bg-gray-900 p-3">
        <div className="h-1 w-10 bg-white/50" />
        <div className="mt-2 h-3 w-16 bg-white" />
      </div>
    </div>
  );
}

// =========================================================
// COMMERCIAL TEMPLATE
// =========================================================

function CommercialPreview() {
  return (
    <div className="mx-auto aspect-[0.707/1] max-w-[220px] overflow-hidden bg-white shadow-sm">
      <div className="bg-gray-900 p-3 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-5 w-10 rounded bg-white" />
          </div>

          <div className="text-[11px] font-bold">
            QUOTATION
          </div>
        </div>

        <div className="mt-2 h-1 w-24 bg-white/30" />
      </div>

      <div className="p-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded bg-gray-100 p-2">
            <div className="h-1 w-10 bg-gray-400" />
            <div className="mt-2 h-1 w-16 bg-gray-200" />
            <div className="mt-1 h-1 w-12 bg-gray-200" />
          </div>

          <div className="rounded bg-gray-100 p-2">
            <div className="h-1 w-10 bg-gray-400" />
            <div className="mt-2 h-1 w-16 bg-gray-200" />
          </div>
        </div>

        <div className="mt-4 rounded border border-gray-200">
          <div className="grid grid-cols-4 bg-gray-100 p-2">
            <div className="h-1 bg-gray-500" />
            <div className="h-1 bg-gray-500" />
            <div className="h-1 bg-gray-500" />
            <div className="h-1 bg-gray-500" />
          </div>

          {[1, 2, 3].map(
            (row) => (
              <div
                key={row}
                className="grid grid-cols-4 gap-1 border-t border-gray-100 p-2"
              >
                <div className="h-1 bg-gray-100" />
                <div className="h-1 bg-gray-100" />
                <div className="h-1 bg-gray-100" />
                <div className="h-1 bg-gray-100" />
              </div>
            )
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <div className="w-28 rounded border-2 border-gray-900 p-2">
            <div className="h-1 w-12 bg-gray-300" />
            <div className="mt-2 h-3 w-20 bg-gray-900" />
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================
// COMMON COMPONENTS
// =========================================================

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
  required?: boolean;
  type?: string;
  placeholder?: string;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={onChange}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-400"
      />
    </div>
  );
}