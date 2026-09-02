"use client";

import {
  ChangeEvent,
  FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewSupplierPage() {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    supplier_code: "",
    supplier_name: "",
    contact_name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    country: "",
    tax_id: "",
    payment_terms: "",
    notes: "",
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function handleChange(
    e:
      | ChangeEvent<HTMLInputElement>
      | ChangeEvent<HTMLTextAreaElement>
      | ChangeEvent<HTMLSelectElement>
  ) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  async function handleSubmit(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    setMessage("");

    if (!form.supplier_name.trim()) {
      setMessage("Supplier name is required.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Please login first.");
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.company_id) {
        throw new Error("Company profile not found.");
      }

      const {
        data: supplier,
        error: insertError,
      } = await supabase
        .from("suppliers")
        .insert({
          company_id: profile.company_id,
          supplier_code:
            form.supplier_code.trim() || null,
          supplier_name:
            form.supplier_name.trim(),
          contact_name:
            form.contact_name.trim() || null,
          phone:
            form.phone.trim() || null,
          email:
            form.email.trim() || null,
          address:
            form.address.trim() || null,
          city:
            form.city.trim() || null,
          country:
            form.country.trim() || null,
          tax_id:
            form.tax_id.trim() || null,
          payment_terms:
            form.payment_terms.trim() || null,
          notes:
            form.notes.trim() || null,
          is_active: true,
        })
        .select("id")
        .single();

      if (insertError) {
        throw insertError;
      }

      router.push(`/suppliers/${supplier.id}`);
      router.refresh();
    } catch (err) {
      console.error(err);

      setMessage(
        err instanceof Error
          ? err.message
          : "Could not create supplier."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            New Supplier
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Add a supplier for purchasing and inventory operations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/suppliers")}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>

      {message && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Section
              title="Supplier Information"
              description="Basic supplier identification and contact information."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label="Supplier Name"
                  required
                >
                  <input
                    name="supplier_name"
                    value={form.supplier_name}
                    onChange={handleChange}
                    placeholder="e.g. ABC Trading Co., Ltd."
                    className={inputClass}
                  />
                </Field>

                <Field label="Supplier Code">
                  <input
                    name="supplier_code"
                    value={form.supplier_code}
                    onChange={handleChange}
                    placeholder="e.g. SUP-001"
                    className={inputClass}
                  />
                </Field>

                <Field label="Contact Person">
                  <input
                    name="contact_name"
                    value={form.contact_name}
                    onChange={handleChange}
                    placeholder="Contact person"
                    className={inputClass}
                  />
                </Field>

                <Field label="Phone">
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="Phone number"
                    className={inputClass}
                  />
                </Field>

                <div className="md:col-span-2">
                  <Field label="Email">
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="supplier@example.com"
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>
            </Section>

            <Section
              title="Address"
              description="Supplier billing and business location."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Field label="Address">
                    <textarea
                      rows={3}
                      name="address"
                      value={form.address}
                      onChange={handleChange}
                      placeholder="Street address"
                      className={inputClass}
                    />
                  </Field>
                </div>

                <Field label="City">
                  <input
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    placeholder="City"
                    className={inputClass}
                  />
                </Field>

                <Field label="Country">
                  <input
                    name="country"
                    value={form.country}
                    onChange={handleChange}
                    placeholder="Country"
                    className={inputClass}
                  />
                </Field>
              </div>
            </Section>

            <Section
              title="Commercial Information"
              description="Tax and payment information used for purchasing."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Tax ID">
                  <input
                    name="tax_id"
                    value={form.tax_id}
                    onChange={handleChange}
                    placeholder="Tax identification number"
                    className={inputClass}
                  />
                </Field>

                <Field label="Payment Terms">
                  <select
                    name="payment_terms"
                    value={form.payment_terms}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="">
                      Select payment terms
                    </option>

                    <option value="Due on Receipt">
                      Due on Receipt
                    </option>

                    <option value="7 Days">
                      7 Days
                    </option>

                    <option value="15 Days">
                      15 Days
                    </option>

                    <option value="30 Days">
                      30 Days
                    </option>

                    <option value="45 Days">
                      45 Days
                    </option>

                    <option value="60 Days">
                      60 Days
                    </option>
                  </select>
                </Field>

                <div className="md:col-span-2">
                  <Field label="Notes">
                    <textarea
                      rows={4}
                      name="notes"
                      value={form.notes}
                      onChange={handleChange}
                      placeholder="Internal notes about this supplier"
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>
            </Section>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900">
                Supplier Status
              </h3>

              <div className="mt-4 flex items-center gap-3">
                <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                  Active
                </span>

                <span className="text-sm text-gray-500">
                  New suppliers are active by default.
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900">
                Purchasing
              </h3>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Once created, this supplier can be selected when creating purchase orders.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
          <button
            type="button"
            disabled={saving}
            onClick={() => router.push("/suppliers")}
            className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            style={{
              backgroundColor: "#111827",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: saving
                ? "not-allowed"
                : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving
              ? "Saving..."
              : "Create Supplier"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-400";

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
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
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
