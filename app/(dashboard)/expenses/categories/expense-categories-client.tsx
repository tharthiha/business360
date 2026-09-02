"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Category = {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
};

export default function ExpenseCategoriesClient() {
  const supabase = createClient();

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [name, setName] =
    useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    const { data, error } =
      await supabase
        .from(
          "expense_categories"
        )
        .select(`
          id,
          name,
          description,
          is_active
        `)
        .order("name");

    if (error) {
      setMessage(
        error.message
      );
      return;
    }

    setCategories(
      (data || []) as Category[]
    );
  }

  async function createCategory(
    e: FormEvent
  ) {
    e.preventDefault();

    if (!name.trim()) {
      setMessage(
        "Category name is required."
      );
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
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
        .eq("id", user.id)
        .single();

      if (
        profileError ||
        !profile?.company_id
      ) {
        throw new Error(
          "Company profile not found."
        );
      }

      const { error } =
        await supabase
          .from(
            "expense_categories"
          )
          .insert({
            company_id:
              profile.company_id,
            name:
              name.trim(),
            description:
              description.trim() ||
              null,
            is_active: true,
          });

      if (error) {
        throw error;
      }

      setName("");
      setDescription("");

      await loadCategories();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not create category."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleCategory(
    category: Category
  ) {
    const { error } =
      await supabase
        .from(
          "expense_categories"
        )
        .update({
          is_active:
            !category.is_active,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", category.id);

    if (error) {
      setMessage(
        error.message
      );
      return;
    }

    await loadCategories();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Expense Categories
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Create company-specific categories for expense reporting.
          </p>
        </div>

        <Link
          href="/expenses"
          className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
        >
          Back to Expenses
        </Link>
      </div>

      {message && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <form
          onSubmit={
            createCategory
          }
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <h2 className="font-semibold text-gray-900">
            New Category
          </h2>

          <div className="mt-5 space-y-5">
            <label className="block">
              <div className="mb-2 text-sm font-medium text-gray-700">
                Category Name
              </div>

              <input
                value={name}
                onChange={(e) =>
                  setName(
                    e.target.value
                  )
                }
                className={inputClass}
                placeholder="e.g. Rent"
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm font-medium text-gray-700">
                Description
              </div>

              <textarea
                rows={4}
                value={
                  description
                }
                onChange={(e) =>
                  setDescription(
                    e.target.value
                  )
                }
                className={inputClass}
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              style={{
                backgroundColor:
                  "#111827",
                color: "#ffffff",
                border: "none",
                borderRadius:
                  "8px",
                width: "100%",
                padding:
                  "10px 16px",
                fontSize:
                  "14px",
                fontWeight: 600,
              }}
            >
              {saving
                ? "Saving..."
                : "Add Category"}
            </button>
          </div>
        </form>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="font-semibold text-gray-900">
              Categories
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {categories.length} categories
            </p>
          </div>

          {categories.length ===
          0 ? (
            <div className="px-6 py-12 text-center text-sm text-gray-500">
              No categories yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {categories.map(
                (category) => (
                  <div
                    key={
                      category.id
                    }
                    className="flex items-center justify-between gap-4 px-6 py-4"
                  >
                    <div>
                      <div className="font-medium text-gray-900">
                        {
                          category.name
                        }
                      </div>

                      <div className="mt-1 text-sm text-gray-500">
                        {category.description ||
                          "No description"}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          category.is_active
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {category.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          toggleCategory(
                            category
                          )
                        }
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
                      >
                        {category.is_active
                          ? "Deactivate"
                          : "Activate"}
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-gray-400";