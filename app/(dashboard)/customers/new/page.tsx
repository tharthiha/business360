"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewCustomerPage() {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    customer_code: "",
    customer_name: "",
    contact_name: "",
    phone: "",
    email: "",
    tax_id: "",
    address: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
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

      const { error } = await supabase.from("customers").insert({
        company_id: profile.company_id,
        customer_code: form.customer_code || null,
        customer_name: form.customer_name,
        contact_name: form.contact_name || null,
        phone: form.phone || null,
        email: form.email || null,
        tax_id: form.tax_id || null,
        address: form.address || null,
        is_active: true,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      router.push("/customers");
      router.refresh();
    } catch {
      setMessage("Unexpected error while saving customer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Add Customer
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Create a new customer account and contact profile.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="font-semibold text-gray-900">
                  Customer Information
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Basic details used for sales, quotations and invoices.
                </p>
              </div>

              <div className="grid gap-5 p-6 md:grid-cols-2">
                <Field
                  label="Customer Code"
                  name="customer_code"
                  value={form.customer_code}
                  onChange={handleChange}
                  placeholder="e.g. C0001"
                />

                <Field
                  label="Customer Name"
                  name="customer_name"
                  value={form.customer_name}
                  onChange={handleChange}
                  placeholder="Company or customer name"
                  required
                />

                <Field
                  label="Contact Person"
                  name="contact_name"
                  value={form.contact_name}
                  onChange={handleChange}
                  placeholder="Contact person name"
                />

                <Field
                  label="Phone"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+66 ..."
                />

                <Field
                  label="Email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="customer@example.com"
                  type="email"
                />

                <Field
                  label="Tax ID"
                  name="tax_id"
                  value={form.tax_id}
                  onChange={handleChange}
                  placeholder="Tax identification number"
                />

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Address
                  </label>

                  <textarea
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    rows={5}
                    placeholder="Customer address"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Side Panel */}
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900">
                Customer Status
              </h3>

              <div className="mt-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    Active
                  </div>

                  <div className="text-xs text-gray-500">
                    Customer can be used in sales documents.
                  </div>
                </div>

                <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                  Active
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900">
                Quick Tips
              </h3>

              <div className="mt-3 space-y-3 text-sm text-gray-500">
                <p>
                  Customer codes help identify records quickly.
                </p>

                <p>
                  Tax ID is useful for quotations and invoices.
                </p>

                <p>
                  Contact details can be updated later.
                </p>
              </div>
            </div>
          </div>
        </div>

        {message && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        )}

        {/* Bottom Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-6">
          <button
            type="button"
            onClick={() => router.push("/customers")}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Customer"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  placeholder = "",
  required = false,
  type = "text",
}: {
  label: string;
  name: string;
  value: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
      />
    </div>
  );
}