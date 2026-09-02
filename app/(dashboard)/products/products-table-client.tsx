"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Category = {
  id: number;
  name: string;
};

type Product = {
  id: number;
  product_code: string | null;
  sku: string | null;
  barcode: string | null;
  product_name: string;
  category_id?: number | null;
  cost_price: number | null;
  selling_price: number | null;
  current_stock: number | null;
  min_stock: number | null;
  is_active: boolean;
  created_at?: string | null;
  image_url?: string | null;
  category_name?: string | null;
};

export default function ProductsTableClient({
  products: initialProducts,
}: {
  products: Product[];
}) {
  const supabase = createClient();

  const [products, setProducts] =
    useState<Product[]>(
      initialProducts
    );

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState("all");

  useEffect(() => {
    async function loadCategories() {
      setLoading(true);
      setError("");

      try {
        const productIds =
          initialProducts.map(
            (product) =>
              product.id
          );

        const [
          categoryResult,
          relationResult,
        ] = await Promise.all([
          supabase
            .from(
              "product_categories"
            )
            .select("id, name")
            .eq(
              "is_active",
              true
            )
            .order("name", {
              ascending: true,
            }),

          productIds.length > 0
            ? supabase
                .from("products")
                .select(`
                  id,
                  category_id,
                  product_categories (
                    name
                  )
                `)
                .in(
                  "id",
                  productIds
                )
            : Promise.resolve({
                data: [],
                error: null,
              }),
        ]);

        if (
          categoryResult.error
        ) {
          throw categoryResult.error;
        }

        if (
          relationResult.error
        ) {
          throw relationResult.error;
        }

        const categoryByProduct =
          new Map<
            number,
            {
              category_id:
                number | null;
              category_name:
                string | null;
            }
          >();

        for (
          const row of
            relationResult.data ||
          []
        ) {
          const relation =
            Array.isArray(
              row.product_categories
            )
              ? row
                  .product_categories[0]
              : row.product_categories;

          categoryByProduct.set(
            Number(row.id),
            {
              category_id:
                row.category_id ===
                null
                  ? null
                  : Number(
                      row.category_id
                    ),

              category_name:
                relation?.name ||
                null,
            }
          );
        }

        setProducts(
          initialProducts.map(
            (product) => {
              const category =
                categoryByProduct.get(
                  product.id
                );

              return {
                ...product,

                category_id:
                  category?.category_id ??
                  product.category_id ??
                  null,

                category_name:
                  category?.category_name ??
                  product.category_name ??
                  null,
              };
            }
          )
        );

        setCategories(
          (categoryResult.data ||
            []) as Category[]
        );
      } catch (err) {
        console.error(
          "Products category load error:",
          err
        );

        setProducts(
          initialProducts
        );

        setError(
          err instanceof Error
            ? err.message
            : "Could not load product categories."
        );
      } finally {
        setLoading(false);
      }
    }

    loadCategories();
  }, [initialProducts]);

  const filteredProducts =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      return products.filter(
        (product) => {
          const matchesSearch =
            !term ||
            product.product_name
              .toLowerCase()
              .includes(term) ||
            (
              product.product_code ||
              ""
            )
              .toLowerCase()
              .includes(term) ||
            (
              product.sku ||
              ""
            )
              .toLowerCase()
              .includes(term) ||
            (
              product.barcode ||
              ""
            )
              .toLowerCase()
              .includes(term) ||
            (
              product.category_name ||
              ""
            )
              .toLowerCase()
              .includes(term);

          const matchesStatus =
            statusFilter ===
            "all"
              ? true
              : statusFilter ===
                "active"
              ? product.is_active
              : !product.is_active;

          const matchesCategory =
            categoryFilter ===
            "all"
              ? true
              : String(
                  product.category_id
                ) ===
                categoryFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesCategory
          );
        }
      );
    }, [
      products,
      search,
      statusFilter,
      categoryFilter,
    ]);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
        Loading products...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">
                Products
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {
                  filteredProducts.length
                }{" "}
                of {products.length} products
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search products..."
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-gray-400 sm:w-64"
              />

              <select
                value={
                  categoryFilter
                }
                onChange={(event) =>
                  setCategoryFilter(
                    event.target.value
                  )
                }
                className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-gray-400"
              >
                <option value="all">
                  All Categories
                </option>

                {categories.map(
                  (category) => (
                    <option
                      key={
                        category.id
                      }
                      value={
                        category.id
                      }
                    >
                      {category.name}
                    </option>
                  )
                )}
              </select>

              <select
                value={
                  statusFilter
                }
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-gray-400"
              >
                <option value="all">
                  All Status
                </option>

                <option value="active">
                  Active
                </option>

                <option value="inactive">
                  Inactive
                </option>
              </select>

              <Link
                href="/products/categories"
                className="whitespace-nowrap rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Categories
              </Link>

              <Link
                href="/products/new"
                className="whitespace-nowrap rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
              >
                + New Product
              </Link>
            </div>
          </div>
        </div>

        {error && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-700">
            {error}
          </div>
        )}

        {filteredProducts.length ===
        0 ? (
          <div className="px-6 py-12 text-center">
            <div className="text-sm font-medium text-gray-900">
              No products found
            </div>

            <div className="mt-1 text-sm text-gray-500">
              Try changing your search or filters.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <Header>
                    Product
                  </Header>

                  <Header>
                    Category
                  </Header>

                  <Header>
                    SKU
                  </Header>

                  <Header right>
                    Cost
                  </Header>

                  <Header right>
                    Selling
                  </Header>

                  <Header right>
                    Stock
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
                {filteredProducts.map(
                  (product) => {
                    const stock =
                      Number(
                        product.current_stock ||
                          0
                      );

                    const minStock =
                      Number(
                        product.min_stock ||
                          0
                      );

                    const lowStock =
                      stock <=
                      minStock;

                    return (
                      <tr
                        key={
                          product.id
                        }
                        className="transition hover:bg-gray-50"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {product.image_url ? (
                              <img
                                src={
                                  product.image_url
                                }
                                alt=""
                                className="h-10 w-10 rounded-lg border border-gray-200 object-cover"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">
                                —
                              </div>
                            )}

                            <div>
                              <div className="font-medium text-gray-900">
                                {
                                  product.product_name
                                }
                              </div>

                              <div className="mt-1 text-xs text-gray-500">
                                {product.product_code ||
                                  `Product #${product.id}`}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {product.category_name ? (
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                              {
                                product.category_name
                              }
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">
                              -
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {product.sku ||
                            "-"}
                        </td>

                        <td className="px-5 py-4 text-right text-sm text-gray-600">
                          {money(
                            product.cost_price
                          )}
                        </td>

                        <td className="px-5 py-4 text-right text-sm font-medium text-gray-900">
                          {money(
                            product.selling_price
                          )}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div
                            className={
                              lowStock
                                ? "text-sm font-semibold text-amber-700"
                                : "text-sm font-medium text-gray-900"
                            }
                          >
                            {stock}
                          </div>

                          {lowStock && (
                            <div className="mt-1 text-[11px] text-amber-600">
                              Low stock
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <StatusBadge
                            active={
                              product.is_active
                            }
                          />
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <Link
                              href={`/products/${product.id}`}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              View
                            </Link>

                            <Link
                              href={`/products/${product.id}/edit`}
                              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Edit
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
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

function money(
  value: number | null
) {
  return `฿${Number(
    value || 0
  ).toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}
