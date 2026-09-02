"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Category = {
  id: number;
  company_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export default function CategoriesClient() {
  const supabase = createClient();

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [name, setName] =
    useState("");

  const [description, setDescription] =
    useState("");

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);
    setError("");

    try {
      const {
        data,
        error: categoryError,
      } = await supabase
        .from("product_categories")
        .select(`
          id,
          company_id,
          name,
          description,
          is_active,
          created_at
        `)
        .order("name", {
          ascending: true,
        });

      if (categoryError) {
        throw categoryError;
      }

      setCategories(
        (data || []) as Category[]
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not load categories."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setError("");
    setSuccess("");

    const trimmedName =
      name.trim();

    if (!trimmedName) {
      setError(
        "Category name is required."
      );
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        const {
          error: updateError,
        } = await supabase
          .from("product_categories")
          .update({
            name: trimmedName,
            description:
              description.trim() ||
              null,
          })
          .eq("id", editingId);

        if (updateError) {
          throw updateError;
        }

        setSuccess(
          "Category updated successfully."
        );
      } else {
        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("company_id")
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (!profile?.company_id) {
          throw new Error(
            "Company profile not found."
          );
        }

        const {
          error: insertError,
        } = await supabase
          .from("product_categories")
          .insert({
            company_id:
              profile.company_id,
            name: trimmedName,
            description:
              description.trim() ||
              null,
            is_active: true,
          });

        if (insertError) {
          throw insertError;
        }

        setSuccess(
          "Category created successfully."
        );
      }

      resetForm();
      await loadCategories();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not save category."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(
    category: Category
  ) {
    setError("");
    setSuccess("");

    try {
      const {
        error: updateError,
      } = await supabase
        .from("product_categories")
        .update({
          is_active:
            !category.is_active,
        })
        .eq("id", category.id);

      if (updateError) {
        throw updateError;
      }

      setSuccess(
        category.is_active
          ? "Category deactivated."
          : "Category activated."
      );

      await loadCategories();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not update category."
      );
    }
  }

  function startEdit(
    category: Category
  ) {
    setEditingId(category.id);
    setName(category.name);
    setDescription(
      category.description || ""
    );
    setError("");
    setSuccess("");
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
  }

  const filteredCategories =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      if (!term) {
        return categories;
      }

      return categories.filter(
        (category) =>
          category.name
            .toLowerCase()
            .includes(term) ||
          (
            category.description ||
            ""
          )
            .toLowerCase()
            .includes(term)
      );
    }, [categories, search]);

  const activeCount =
    categories.filter(
      (category) =>
        category.is_active
    ).length;

  const inactiveCount =
    categories.length -
    activeCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Product Categories
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Organize products using company-specific categories.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Total Categories"
          value={String(
            categories.length
          )}
        />

        <SummaryCard
          label="Active"
          value={String(
            activeCount
          )}
        />

        <SummaryCard
          label="Inactive"
          value={String(
            inactiveCount
          )}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* FORM */}

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="font-semibold text-gray-900">
              {editingId
                ? "Edit Category"
                : "New Category"}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Categories are available only inside your company.
            </p>
          </div>

          <div className="mt-6 space-y-5">
            <Field label="Category Name">
              <input
                value={name}
                onChange={(e) =>
                  setName(
                    e.target.value
                  )
                }
                placeholder="e.g. Seafood"
                className={inputClass}
              />
            </Field>

            <Field label="Description">
              <textarea
                rows={4}
                value={description}
                onChange={(e) =>
                  setDescription(
                    e.target.value
                  )
                }
                placeholder="Optional description"
                className={inputClass}
              />
            </Field>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={
                  handleSave
                }
                style={{
                  backgroundColor:
                    "#111827",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding:
                    "10px 16px",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor:
                    saving
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    saving
                      ? 0.6
                      : 1,
                }}
              >
                {saving
                  ? "Saving..."
                  : editingId
                  ? "Update Category"
                  : "Add Category"}
              </button>

              {editingId && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={
                    resetForm
                  }
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        {/* LIST */}

        <div className="xl:col-span-2">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">
                  Categories
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {categories.length} categor
                  {categories.length ===
                  1
                    ? "y"
                    : "ies"}
                </p>
              </div>

              <input
                type="search"
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Search categories..."
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-400 sm:max-w-xs"
              />
            </div>

            {loading ? (
              <div className="px-6 py-10 text-center text-sm text-gray-500">
                Loading categories...
              </div>
            ) : filteredCategories.length ===
              0 ? (
              <div className="px-6 py-10 text-center text-sm text-gray-500">
                No categories found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <Header>
                        Category
                      </Header>

                      <Header>
                        Description
                      </Header>

                      <Header>
                        Status
                      </Header>

                      <Header right>
                        Actions
                      </Header>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {filteredCategories.map(
                      (category) => (
                        <tr
                          key={
                            category.id
                          }
                        >
                          <td className="px-5 py-4 text-sm font-medium text-gray-900">
                            {
                              category.name
                            }
                          </td>

                          <td className="px-5 py-4 text-sm text-gray-600">
                            {category.description ||
                              "-"}
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge
                              active={
                                category.is_active
                              }
                            />
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  startEdit(
                                    category
                                  )
                                }
                                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  toggleActive(
                                    category
                                  )
                                }
                                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                                  category.is_active
                                    ? "border-red-200 bg-white text-red-600 hover:bg-red-50"
                                    : "border-green-200 bg-white text-green-700 hover:bg-green-50"
                                }`}
                              >
                                {category.is_active
                                  ? "Deactivate"
                                  : "Activate"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-400";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-gray-700">
        {label}
      </div>

      {children}
    </label>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-gray-500">
        {label}
      </div>

      <div className="mt-2 text-2xl font-semibold text-gray-900">
        {value}
      </div>
    </div>
  );
}

function Header({
  children,
  right = false,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${
        right
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function StatusBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        active
          ? "bg-green-50 text-green-700"
          : "bg-gray-100 text-gray-600"
      }`}
    >
      {active
        ? "Active"
        : "Inactive"}
    </span>
  );
}