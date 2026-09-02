"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type CustomerForm = {
  customer_code: string;
  customer_name: string;
  contact_name: string;
  phone: string;
  email: string;
  tax_id: string;
  address: string;
};

const inputStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  color: "#111827",
  WebkitTextFillColor: "#111827",
  colorScheme: "light",
};

export default function EditCustomerClient({
  id,
}: {
  id: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState<CustomerForm>({
    customer_code: "",
    customer_name: "",
    contact_name: "",
    phone: "",
    email: "",
    tax_id: "",
    address: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadCustomer() {
      setLoading(true);
      setMessage("");

      const { data, error } = await supabase
        .from("customers")
        .select(
          `
          customer_code,
          customer_name,
          contact_name,
          phone,
          email,
          tax_id,
          address
          `
        )
        .eq("id", id)
        .single();

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      setForm({
        customer_code: data.customer_code || "",
        customer_name: data.customer_name || "",
        contact_name: data.contact_name || "",
        phone: data.phone || "",
        email: data.email || "",
        tax_id: data.tax_id || "",
        address: data.address || "",
      });

      setLoading(false);
    }

    loadCustomer();
  }, [id]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.customer_name.trim()) {
      setMessage("Customer name is required.");
      return;
    }

    setSaving(true);
    setMessage("");

    const payload = {
      customer_code: form.customer_code.trim() || null,
      customer_name: form.customer_name.trim(),
      contact_name: form.contact_name.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      tax_id: form.tax_id.trim() || null,
      address: form.address.trim() || null,
    };

    const { error } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", id);

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    router.push(`/customers/${id}`);
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="text-sm text-gray-500">
          Loading customer...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={() => router.push(`/customers/${id}`)}
          className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-gray-900"
        >
          ← Back to Customer 360°
        </button>

        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Edit Customer
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Update customer master data, contact details and billing information.
        </p>
      </div>

      {/* Form Card */}
      <form
        onSubmit={handleSubmit}
        className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
      >
        <div className="border-b border-gray-200 px-5 py-4 sm:px-6">
          <h2 className="font-semibold text-gray-900">
            Customer Information
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Fields marked with * are required.
          </p>
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Customer Code">
              <input
                name="customer_code"
                value={form.customer_code}
                onChange={handleChange}
                autoComplete="off"
                placeholder="e.g. CUST-001"
                style={inputStyle}
                className={inputClassName}
              />
            </FormField>

            <FormField label="Customer Name" required>
              <input
                name="customer_name"
                value={form.customer_name}
                onChange={handleChange}
                autoComplete="organization"
                required
                placeholder="Customer or company name"
                style={inputStyle}
                className={inputClassName}
              />
            </FormField>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Contact Name">
              <input
                name="contact_name"
                value={form.contact_name}
                onChange={handleChange}
                autoComplete="name"
                placeholder="Primary contact person"
                style={inputStyle}
                className={inputClassName}
              />
            </FormField>

            <FormField label="Phone">
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                autoComplete="tel"
                placeholder="Phone number"
                style={inputStyle}
                className={inputClassName}
              />
            </FormField>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Email">
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                placeholder="name@example.com"
                style={inputStyle}
                className={inputClassName}
              />
            </FormField>

            <FormField label="Tax ID">
              <input
                name="tax_id"
                value={form.tax_id}
                onChange={handleChange}
                autoComplete="off"
                placeholder="Tax identification number"
                style={inputStyle}
                className={inputClassName}
              />
            </FormField>
          </div>

          <FormField label="Address">
            <textarea
              name="address"
              value={form.address}
              onChange={handleChange}
              autoComplete="street-address"
              rows={5}
              placeholder="Billing or business address"
              style={inputStyle}
              className={`${inputClassName} resize-y leading-6`}
            />
          </FormField>

          {message && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {message}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          <button
            type="button"
            disabled={saving}
            onClick={() => router.push(`/customers/${id}`)}
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving || !form.customer_name.trim()}
            style={{
              backgroundColor: "#111827",
              color: "#ffffff",
            }}
            className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving Changes..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClassName =
  "block w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm shadow-sm outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500";

function FormField({
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
      <span className="mb-2 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>

      {children}
    </label>
  );
}
