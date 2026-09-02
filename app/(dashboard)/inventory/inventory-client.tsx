"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: number;
  category_id: number | null;
  category_name: string;
  product_name: string;
  product_code: string | null;
  sku: string | null;
  current_stock: number;
  min_stock: number;
  cost_price: number;
  selling_price: number;
  is_active: boolean;
};

type Movement = {
  id: number;
  product_id: number;
  movement_date: string;
  movement_type: string;
  qty_change: number;
  stock_before: number;
  stock_after: number;
  reference_no: string | null;
  reason: string | null;
  product_name: string;
  product_code: string | null;
  unit_cost: number | null;
  cost_amount: number | null;
};

type AdjustmentForm = {
  product_id: string;
  direction: "in" | "out";
  movement_type: string;
  quantity: string;
  reason: string;
  notes: string;
};

type StockStatus =
  | "healthy"
  | "low"
  | "out";

type PeriodStatus =
  | "open"
  | "closed"
  | "reopened";

export default function InventoryClient() {
  const supabase = createClient();

  const [products, setProducts] =
    useState<Product[]>([]);

  const [movements, setMovements] =
    useState<Movement[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [stockFilter, setStockFilter] =
    useState<
      "all" | StockStatus
    >("all");

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState("all");

  const [
    showAdjustment,
    setShowAdjustment,
  ] = useState(false);

  const [
    periodStatus,
    setPeriodStatus,
  ] = useState<PeriodStatus>("open");

  const [
    periodClosedAt,
    setPeriodClosedAt,
  ] = useState<string | null>(null);

  const [form, setForm] =
    useState<AdjustmentForm>({
      product_id: "",
      direction: "in",
      movement_type:
        "adjustment_in",
      quantity: "",
      reason: "",
      notes: "",
    });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !authData.user) {
        throw new Error(
          authError?.message ||
            "Please login first."
        );
      }

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", authData.user.id)
        .single();

      if (
        profileError ||
        !profile?.company_id
      ) {
        throw new Error(
          profileError?.message ||
            "Company profile not found."
        );
      }

      const companyId =
        Number(profile.company_id);

      const currentPeriodStart =
        firstDayOfDate(today());

      const [
        productResult,
        movementResult,
        closeResult,
      ] = await Promise.all([
        supabase
          .from("products")
          .select(`
            id,
            category_id,
            product_name,
            product_code,
            sku,
            current_stock,
            min_stock,
            cost_price,
            selling_price,
            is_active,
            product_categories (
              name
            )
          `)
          .order("product_name"),

        supabase
          .from(
            "inventory_movements"
          )
          .select(`
            id,
            product_id,
            movement_date,
            movement_type,
            qty_change,
            stock_before,
            stock_after,
            reference_no,
            reason,
            unit_cost,
            cost_amount,
            products (
              product_name,
              product_code
            )
          `)
          .order(
            "movement_date",
            {
              ascending: false,
            }
          )
          .limit(100),

        supabase
          .from("accounting_period_closes")
          .select("status, closed_at")
          .eq("company_id", companyId)
          .eq("period_start", currentPeriodStart)
          .maybeSingle(),
      ]);

      if (
        productResult.error
      ) {
        throw productResult.error;
      }

      if (
        movementResult.error
      ) {
        throw movementResult.error;
      }

      if (
        closeResult.error
      ) {
        throw closeResult.error;
      }

      setPeriodStatus(
        closeResult.data?.status === "closed"
          ? "closed"
          : closeResult.data?.status === "reopened"
          ? "reopened"
          : "open"
      );

      setPeriodClosedAt(
        closeResult.data?.closed_at || null
      );

      const normalizedProducts =
        (
          productResult.data ||
          []
        ).map((row: any) => {
          const category =
            Array.isArray(
              row.product_categories
            )
              ? row
                  .product_categories[0]
              : row.product_categories;

          return {
            id: row.id,

            category_id:
              row.category_id,

            category_name:
              category?.name ||
              "Uncategorized",

            product_name:
              row.product_name,

            product_code:
              row.product_code,

            sku:
              row.sku,

            current_stock:
              Number(
                row.current_stock ||
                  0
              ),

            min_stock:
              Number(
                row.min_stock ||
                  0
              ),

            cost_price:
              Number(
                row.cost_price || 0
              ),

            selling_price:
              Number(
                row.selling_price ||
                  0
              ),

            is_active:
              row.is_active !==
              false,
          };
        });

      const normalizedMovements =
        (
          movementResult.data ||
          []
        ).map((row: any) => {
          const product =
            Array.isArray(
              row.products
            )
              ? row.products[0]
              : row.products;

          return {
            id:
              row.id,

            product_id:
              row.product_id,

            movement_date:
              row.movement_date,

            movement_type:
              row.movement_type,

            qty_change:
              Number(
                row.qty_change || 0
              ),

            stock_before:
              Number(
                row.stock_before ||
                  0
              ),

            stock_after:
              Number(
                row.stock_after ||
                  0
              ),

            reference_no:
              row.reference_no,

            reason:
              row.reason,

            unit_cost:
              row.unit_cost === null ||
              row.unit_cost === undefined
                ? null
                : Number(
                    row.unit_cost
                  ),

            cost_amount:
              row.cost_amount === null ||
              row.cost_amount === undefined
                ? null
                : Number(
                    row.cost_amount
                  ),

            product_name:
              product?.product_name ||
              `Product #${row.product_id}`,

            product_code:
              product?.product_code ||
              null,
          };
        });

      setProducts(
        normalizedProducts
      );

      setMovements(
        normalizedMovements
      );
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load inventory."
      );
    } finally {
      setLoading(false);
    }
  }

  const healthyProducts =
    products.filter(
      (product) =>
        getStockStatus(
          product
        ) === "healthy"
    );

  const lowProducts =
    products.filter(
      (product) =>
        getStockStatus(
          product
        ) === "low"
    );

  const outProducts =
    products.filter(
      (product) =>
        getStockStatus(
          product
        ) === "out"
    );

  const totalUnits =
    products.reduce(
      (sum, product) =>
        sum +
        product.current_stock,
      0
    );

  const inventoryValue =
    products.reduce(
      (sum, product) =>
        sum +
        product.current_stock *
          product.cost_price,
      0
    );

  const categoryStats =
    useMemo(() => {
      const map =
        new Map<
          string,
          {
            name: string;
            total: number;
            healthy: number;
            low: number;
            out: number;
            stockValue: number;
          }
        >();

      for (const product of products) {
        const name =
          product.category_name ||
          "Uncategorized";

        if (!map.has(name)) {
          map.set(name, {
            name,
            total: 0,
            healthy: 0,
            low: 0,
            out: 0,
            stockValue: 0,
          });
        }

        const row =
          map.get(name)!;

        row.total += 1;

        row.stockValue +=
          product.current_stock *
          product.cost_price;

        const status =
          getStockStatus(
            product
          );

        if (
          status === "healthy"
        ) {
          row.healthy += 1;
        }

        if (status === "low") {
          row.low += 1;
        }

        if (status === "out") {
          row.out += 1;
        }
      }

      return Array.from(
        map.values()
      ).sort((a, b) => {
        const attentionA =
          a.out + a.low;

        const attentionB =
          b.out + b.low;

        if (
          attentionA !==
          attentionB
        ) {
          return (
            attentionB -
            attentionA
          );
        }

        return a.name.localeCompare(
          b.name
        );
      });
    }, [products]);

  const attentionProducts =
    useMemo(() => {
      return [...products]
        .filter(
          (product) =>
            getStockStatus(
              product
            ) !== "healthy"
        )
        .sort((a, b) => {
          const aStatus =
            getStockStatus(a);

          const bStatus =
            getStockStatus(b);

          if (
            aStatus === "out" &&
            bStatus !== "out"
          ) {
            return -1;
          }

          if (
            bStatus === "out" &&
            aStatus !== "out"
          ) {
            return 1;
          }

          return (
            a.current_stock -
            b.current_stock
          );
        });
    }, [products]);

  const lastMovementByProduct =
    useMemo(() => {
      const map =
        new Map<
          number,
          Movement
        >();

      for (const movement of movements) {
        if (
          !map.has(
            movement.product_id
          )
        ) {
          map.set(
            movement.product_id,
            movement
          );
        }
      }

      return map;
    }, [movements]);

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
            product.category_name
              .toLowerCase()
              .includes(term);

          const matchesStatus =
            stockFilter === "all" ||
            getStockStatus(
              product
            ) === stockFilter;

          const matchesCategory =
            categoryFilter ===
              "all" ||
            product.category_name ===
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
      stockFilter,
      categoryFilter,
    ]);

  function chooseStatus(
    status:
      | "all"
      | StockStatus
  ) {
    setStockFilter(
      status
    );

    window.setTimeout(() => {
      document
        .getElementById(
          "inventory-products"
        )
        ?.scrollIntoView({
          behavior:
            "smooth",
        });
    }, 50);
  }

  function chooseCategory(
    category: string
  ) {
    setCategoryFilter(
      category
    );

    window.setTimeout(() => {
      document
        .getElementById(
          "inventory-products"
        )
        ?.scrollIntoView({
          behavior:
            "smooth",
        });
    }, 50);
  }

  function clearFilters() {
    setStockFilter("all");
    setCategoryFilter("all");
    setSearch("");
  }

  function openAdjustment(
    product?: Product
  ) {
    setMessage("");

    if (periodStatus === "closed") {
      setMessage(
        "Manual stock adjustments are locked for the current closed accounting period. Reopen the month from Reports → Month-End Close before posting an adjustment."
      );
      return;
    }

    setForm({
      product_id:
        product
          ? String(
              product.id
            )
          : "",

      direction:
        "in",

      movement_type:
        "adjustment_in",

      quantity:
        "",

      reason:
        "",

      notes:
        "",
    });

    setShowAdjustment(true);
  }

  function changeDirection(
    direction:
      | "in"
      | "out"
  ) {
    setForm(
      (current) => ({
        ...current,

        direction,

        movement_type:
          direction === "in"
            ? "adjustment_in"
            : "adjustment_out",
      })
    );
  }

  async function submitAdjustment(
    e: FormEvent
  ) {
    e.preventDefault();

    setMessage("");

    if (periodStatus === "closed") {
      setMessage(
        "Manual stock adjustments cannot be recorded while the current accounting period is closed."
      );
      return;
    }

    if (
      !form.product_id
    ) {
      setMessage(
        "Please select a product."
      );
      return;
    }

    const quantity =
      Number(
        form.quantity
      );

    if (
      !Number.isFinite(
        quantity
      ) ||
      quantity <= 0
    ) {
      setMessage(
        "Quantity must be greater than zero."
      );
      return;
    }

    if (
      !form.reason.trim()
    ) {
      setMessage(
        "Reason is required."
      );
      return;
    }

    const qtyChange =
      form.direction ===
      "out"
        ? -quantity
        : quantity;

    setSaving(true);

    try {
      const { error } =
        await supabase.rpc(
          "adjust_inventory_stock",
          {
            p_product_id:
              Number(
                form.product_id
              ),

            p_qty_change:
              qtyChange,

            p_movement_type:
              form.movement_type,

            p_reason:
              form.reason.trim(),

            p_notes:
              form.notes.trim() ||
              null,
          }
        );

      if (error) {
        throw error;
      }

      setShowAdjustment(
        false
      );

      await loadData();
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not adjust stock."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-gray-500">
        Loading inventory...
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* HEADER */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Inventory Control
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            See which products and categories need attention.
          </p>
        </div>

        <button
          type="button"
          disabled={periodStatus === "closed"}
          onClick={() =>
            openAdjustment()
          }
          className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white ${
            periodStatus === "closed"
              ? "cursor-not-allowed bg-gray-300"
              : "bg-gray-900"
          }`}
        >
          {periodStatus === "closed"
            ? "Adjustments Locked"
            : "+ Stock Adjustment"}
        </button>
      </div>

      {periodStatus === "closed" && (
        <PeriodNotice
          tone="closed"
          title="Manual Adjustments Locked"
          text={`The current accounting month is closed${
            periodClosedAt
              ? ` since ${formatDateTime(periodClosedAt)}`
              : ""
          }. Inventory remains viewable; only manual adjustments are locked until the month is reopened.`}
        />
      )}

      {periodStatus === "reopened" && (
        <PeriodNotice
          tone="reopened"
          title="Period Reopened"
          text="Manual inventory adjustments are allowed while corrections are being completed."
        />
      )}

      {message && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      {/* FINANCIAL SUMMARY */}

      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard
          label="Inventory Value"
          value={money(
            inventoryValue
          )}
          hint="Current stock × cost price"
        />

        <SummaryCard
          label="Total Units"
          value={number(
            totalUnits
          )}
          hint={`${products.length} products`}
        />
      </div>

      {/* STOCK HEALTH */}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">
            Stock Health
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Click a section to see the affected products.
          </p>
        </div>

        <div className="grid gap-4 p-6 xl:grid-cols-3">
          <StockHealthCard
            title="Healthy"
            count={
              healthyProducts.length
            }
            products={
              healthyProducts
            }
            tone="healthy"
            active={
              stockFilter ===
              "healthy"
            }
            onClick={() =>
              chooseStatus(
                "healthy"
              )
            }
          />

          <StockHealthCard
            title="Low Stock"
            count={
              lowProducts.length
            }
            products={
              lowProducts
            }
            tone="low"
            active={
              stockFilter ===
              "low"
            }
            onClick={() =>
              chooseStatus(
                "low"
              )
            }
          />

          <StockHealthCard
            title="Out of Stock"
            count={
              outProducts.length
            }
            products={
              outProducts
            }
            tone="out"
            active={
              stockFilter ===
              "out"
            }
            onClick={() =>
              chooseStatus(
                "out"
              )
            }
          />
        </div>
      </div>

      {/* CATEGORY HEALTH */}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">
            Category Stock Health
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Identify which product categories need restocking.
          </p>
        </div>

        {categoryStats.length ===
        0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500">
            No categories found.
          </div>
        ) : (
          <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
            {categoryStats.map(
              (category) => (
                <button
                  key={
                    category.name
                  }
                  type="button"
                  onClick={() =>
                    chooseCategory(
                      category.name
                    )
                  }
                  className={`rounded-xl border p-5 text-left transition ${
                    categoryFilter ===
                    category.name
                      ? "border-gray-900 ring-1 ring-gray-900"
                      : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {
                          category.name
                        }
                      </div>

                      <div className="mt-1 text-xs text-gray-500">
                        {
                          category.total
                        }{" "}
                        products
                      </div>
                    </div>

                    {category.out >
                    0 ? (
                      <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                        {
                          category.out
                        }{" "}
                        out
                      </span>
                    ) : category.low >
                      0 ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                        {
                          category.low
                        }{" "}
                        low
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                        Healthy
                      </span>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <CategoryMetric
                      label="Healthy"
                      value={
                        category.healthy
                      }
                      tone="healthy"
                    />

                    <CategoryMetric
                      label="Low"
                      value={
                        category.low
                      }
                      tone="low"
                    />

                    <CategoryMetric
                      label="Out"
                      value={
                        category.out
                      }
                      tone="out"
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
                    <span className="text-xs text-gray-500">
                      Stock Value
                    </span>

                    <span className="text-sm font-semibold text-gray-900">
                      {money(
                        category.stockValue
                      )}
                    </span>
                  </div>
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* NEEDS ATTENTION */}

      {attentionProducts.length >
        0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-gray-900">
                  Needs Attention
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Out-of-stock and low-stock products requiring action.
                </p>
              </div>

              <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700">
                {
                  attentionProducts.length
                }{" "}
                products
              </span>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {attentionProducts
              .slice(0, 12)
              .map(
                (product) => (
                  <AttentionRow
                    key={
                      product.id
                    }
                    product={
                      product
                    }
                    onCategory={() =>
                      chooseCategory(
                        product.category_name
                      )
                    }
                    onAdjust={() =>
                      openAdjustment(
                        product
                      )
                    }
                  />
                )
              )}

            {attentionProducts.length >
              12 && (
              <div className="px-6 py-4 text-center">
                <button
                  type="button"
                  onClick={() =>
                    chooseStatus(
                      "out"
                    )
                  }
                  className="text-sm font-medium text-gray-700 underline"
                >
                  View all{" "}
                  {
                    attentionProducts.length
                  }{" "}
                  products
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INVENTORY FILTERS */}

      <div
        id="inventory-products"
        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">
              Products
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {
                filteredProducts.length
              }{" "}
              of{" "}
              {
                products.length
              }{" "}
              products
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row">
            <input
              type="search"
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Search product, code, SKU, category..."
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-gray-400 lg:w-72"
            />

            <select
              value={
                categoryFilter
              }
              onChange={(e) =>
                setCategoryFilter(
                  e.target.value
                )
              }
              className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"
            >
              <option value="all">
                All Categories
              </option>

              {categoryStats.map(
                (category) => (
                  <option
                    key={
                      category.name
                    }
                    value={
                      category.name
                    }
                  >
                    {
                      category.name
                    }
                  </option>
                )
              )}
            </select>

            <select
              value={
                stockFilter
              }
              onChange={(e) =>
                setStockFilter(
                  e.target
                    .value as
                    | "all"
                    | StockStatus
                )
              }
              className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"
            >
              <option value="all">
                All Stock
              </option>

              <option value="healthy">
                Healthy
              </option>

              <option value="low">
                Low Stock
              </option>

              <option value="out">
                Out of Stock
              </option>
            </select>

            {(stockFilter !==
              "all" ||
              categoryFilter !==
                "all" ||
              search) && (
              <button
                type="button"
                onClick={
                  clearFilters
                }
                className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PRODUCT REGISTER */}

      {filteredProducts.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
          No products match the selected filters.
        </div>
      ) : (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-[1120px] w-full">
              <thead className="bg-gray-50">
                <tr>
                  <Header>Product</Header>
                  <Header>Category</Header>
                  <Header>Status</Header>
                  <Header right>On Hand</Header>
                  <Header right>Minimum</Header>
                  <Header right>Unit Cost</Header>
                  <Header right>Stock Value</Header>
                  <Header right>Selling Price</Header>
                  <Header>Last Movement</Header>
                  <Header right>Action</Header>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map((product) => {
                  const movement =
                    lastMovementByProduct.get(product.id);

                  const status =
                    getStockStatus(product);

                  const stockValue =
                    product.current_stock *
                    product.cost_price;

                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-gray-50/70"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/products/${product.id}`}
                          className="font-semibold text-gray-900 hover:underline"
                        >
                          {product.product_name}
                        </Link>

                        <div className="mt-1 text-xs text-gray-400">
                          {product.product_code ||
                            `Product #${product.id}`}
                          {product.sku
                            ? ` • SKU ${product.sku}`
                            : ""}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            chooseCategory(
                              product.category_name
                            )
                          }
                          className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600"
                        >
                          {product.category_name}
                        </button>
                      </td>

                      <td className="px-5 py-4">
                        <StockBadge status={status} />
                      </td>

                      <td className="px-5 py-4 text-right text-sm font-semibold text-gray-900">
                        {number(product.current_stock)}
                      </td>

                      <td className="px-5 py-4 text-right text-sm text-gray-500">
                        {number(product.min_stock)}
                      </td>

                      <td className="px-5 py-4 text-right text-sm text-gray-700">
                        {money(product.cost_price)}
                      </td>

                      <td className="px-5 py-4 text-right text-sm font-semibold text-gray-900">
                        {money(stockValue)}
                      </td>

                      <td className="px-5 py-4 text-right text-sm text-gray-700">
                        {money(product.selling_price)}
                      </td>

                      <td className="px-5 py-4">
                        {movement ? (
                          <div>
                            <MovementBadge
                              type={movement.movement_type}
                            />
                            <div className="mt-1 text-[10px] text-gray-400">
                              {formatDateTime(
                                movement.movement_date
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">
                            No history
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex gap-2">
                          <Link
                            href={`/products/${product.id}`}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700"
                          >
                            View
                          </Link>

                          <button
                            type="button"
                            disabled={periodStatus === "closed"}
                            onClick={() =>
                              openAdjustment(product)
                            }
                            className={`rounded-lg px-3 py-2 text-sm font-semibold text-white ${
                              periodStatus === "closed"
                                ? "cursor-not-allowed bg-gray-300"
                                : "bg-gray-900"
                            }`}
                          >
                            {periodStatus === "closed"
                              ? "Locked"
                              : "Adjust"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-gray-100 lg:hidden">
            {filteredProducts.map((product) => {
              const movement =
                lastMovementByProduct.get(product.id);

              return (
                <InventoryProductCard
                  key={product.id}
                  product={product}
                  movement={movement}
                  onCategory={() =>
                    chooseCategory(
                      product.category_name
                    )
                  }
                  onAdjust={() =>
                    openAdjustment(product)
                  }
                  canAdjust={
                    periodStatus !== "closed"
                  }
                  compact
                />
              );
            })}
          </div>
        </section>
      )}

      {/* MOVEMENTS */}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">
            Recent Stock Movements
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Latest purchase receipts and manual stock adjustments.
          </p>
        </div>

        {movements.length ===
        0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            No stock movements yet.
          </div>
        ) : (
          <>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[1120px] w-full">
              <thead className="bg-gray-50">
                <tr>
                  <Header>
                    Date
                  </Header>

                  <Header>
                    Product
                  </Header>

                  <Header>
                    Movement
                  </Header>

                  <Header right>
                    Change
                  </Header>

                  <Header right>
                    Before
                  </Header>

                  <Header right>
                    After
                  </Header>

                  <Header>
                    Reference
                  </Header>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {movements
                  .slice(0, 15)
                  .map(
                    (
                      movement
                    ) => (
                      <tr
                        key={
                          movement.id
                        }
                      >
                        <td className="px-5 py-4 text-sm text-gray-600">
                          {formatDateTime(
                            movement.movement_date
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {
                              movement.product_name
                            }
                          </div>

                          <div className="mt-1 text-xs text-gray-400">
                            {movement.product_code ||
                              `Product #${movement.product_id}`}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <MovementBadge
                            type={
                              movement.movement_type
                            }
                          />
                        </td>

                        <td
                          className={`px-5 py-4 text-right text-sm font-semibold ${
                            movement.qty_change >
                            0
                              ? "text-green-700"
                              : "text-red-600"
                          }`}
                        >
                          {movement.qty_change >
                          0
                            ? "+"
                            : ""}
                          {number(
                            movement.qty_change
                          )}
                        </td>

                        <td className="px-5 py-4 text-right text-sm text-gray-500">
                          {number(
                            movement.stock_before
                          )}
                        </td>

                        <td className="px-5 py-4 text-right text-sm font-semibold text-gray-900">
                          {number(
                            movement.stock_after
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {movement.reference_no ||
                            movement.reason ||
                            "-"}
                        </td>
                      </tr>
                    )
                  )}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-gray-100 md:hidden">
            {movements.slice(0, 15).map((movement) => (
              <div key={movement.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-gray-900">
                      {movement.product_name}
                    </div>
                    <div className="mt-1 text-xs text-gray-400">
                      {formatDateTime(movement.movement_date)}
                    </div>
                  </div>
                  <MovementBadge type={movement.movement_type} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <CompactMetric
                    label="Change"
                    value={`${movement.qty_change > 0 ? "+" : ""}${number(
                      movement.qty_change
                    )}`}
                  />
                  <CompactMetric
                    label="After"
                    value={number(movement.stock_after)}
                  />
                  <CompactMetric
                    label="Unit Cost"
                    value={
                      movement.unit_cost === null
                        ? "—"
                        : money(movement.unit_cost)
                    }
                  />
                  <CompactMetric
                    label="Cost Value"
                    value={
                      movement.cost_amount === null
                        ? "—"
                        : money(
                            Math.abs(
                              movement.cost_amount
                            )
                          )
                    }
                  />
                </div>

                <div className="mt-3 text-xs text-gray-500">
                  {movement.reference_no ||
                    movement.reason ||
                    "No reference"}
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>

      {/* ADJUSTMENT MODAL */}

      {showAdjustment && periodStatus !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Stock Adjustment
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Correct inventory while keeping an audit trail.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowAdjustment(
                    false
                  )
                }
                className="text-sm text-gray-500"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={
                submitAdjustment
              }
              className="space-y-5 p-6"
            >
              <Field
                label="Product"
                required
              >
                <select
                  value={
                    form.product_id
                  }
                  onChange={(e) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,
                        product_id:
                          e.target
                            .value,
                      })
                    )
                  }
                  className={
                    inputClass
                  }
                >
                  <option value="">
                    Select product
                  </option>

                  {products.map(
                    (
                      product
                    ) => (
                      <option
                        key={
                          product.id
                        }
                        value={
                          product.id
                        }
                      >
                        {
                          product.product_name
                        }{" "}
                        —{" "}
                        {
                          product.category_name
                        }{" "}
                        —{" "}
                        {number(
                          product.current_stock
                        )}{" "}
                        in stock
                      </option>
                    )
                  )}
                </select>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Direction"
                  required
                >
                  <select
                    value={
                      form.direction
                    }
                    onChange={(e) =>
                      changeDirection(
                        e.target
                          .value as
                          | "in"
                          | "out"
                      )
                    }
                    className={
                      inputClass
                    }
                  >
                    <option value="in">
                      Stock In
                    </option>

                    <option value="out">
                      Stock Out
                    </option>
                  </select>
                </Field>

                <Field
                  label="Movement Type"
                  required
                >
                  <select
                    value={
                      form.movement_type
                    }
                    onChange={(e) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          movement_type:
                            e.target
                              .value,
                        })
                      )
                    }
                    className={
                      inputClass
                    }
                  >
                    {form.direction ===
                    "in" ? (
                      <>
                        <option value="adjustment_in">
                          Adjustment In
                        </option>

                        <option value="opening_stock">
                          Opening Stock
                        </option>

                        <option value="return_in">
                          Return In
                        </option>
                      </>
                    ) : (
                      <>
                        <option value="adjustment_out">
                          Adjustment Out
                        </option>

                        <option value="damage">
                          Damage
                        </option>

                        <option value="loss">
                          Loss
                        </option>

                        <option value="return_out">
                          Return Out
                        </option>
                      </>
                    )}
                  </select>
                </Field>
              </div>

              <Field
                label="Quantity"
                required
              >
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={
                    form.quantity
                  }
                  onChange={(e) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,
                        quantity:
                          e.target
                            .value,
                      })
                    )
                  }
                  className={
                    inputClass
                  }
                />
              </Field>

              <Field
                label="Reason"
                required
              >
                <input
                  value={
                    form.reason
                  }
                  onChange={(e) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,
                        reason:
                          e.target
                            .value,
                      })
                    )
                  }
                  placeholder="e.g. Physical stock count correction"
                  className={
                    inputClass
                  }
                />
              </Field>

              <Field label="Notes">
                <textarea
                  rows={3}
                  value={
                    form.notes
                  }
                  onChange={(e) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,
                        notes:
                          e.target
                            .value,
                      })
                    )
                  }
                  className={
                    inputClass
                  }
                />
              </Field>

              <div className="flex justify-end gap-3 border-t border-gray-200 pt-5">
                <button
                  type="button"
                  onClick={() =>
                    setShowAdjustment(
                      false
                    )
                  }
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    backgroundColor:
                      "#111827",
                    color:
                      "#ffffff",
                    border:
                      "none",
                    borderRadius:
                      "8px",
                    padding:
                      "10px 18px",
                    fontSize:
                      "14px",
                    fontWeight:
                      600,
                    opacity:
                      saving
                        ? 0.5
                        : 1,
                  }}
                >
                  {saving
                    ? "Saving..."
                    : "Confirm Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function PeriodNotice({
  tone,
  title,
  text,
}: {
  tone:
    | "closed"
    | "reopened";
  title: string;
  text: string;
}) {
  const classes =
    tone === "closed"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-blue-200 bg-blue-50 text-blue-800";

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${classes}`}
    >
      <div className="text-sm font-semibold">
        {title}
      </div>
      <div className="mt-1 text-sm">
        {text}
      </div>
    </div>
  );
}

function CompactMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-gray-900">
        {value}
      </div>
    </div>
  );
}

function StockHealthCard({
  title,
  count,
  products,
  tone,
  active,
  onClick,
}: {
  title: string;
  count: number;
  products: Product[];
  tone: StockStatus;
  active: boolean;
  onClick: () => void;
}) {
  const styles =
    tone === "healthy"
      ? "border-green-200 bg-green-50"
      : tone === "low"
      ? "border-amber-200 bg-amber-50"
      : "border-red-200 bg-red-50";

  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`rounded-xl border p-5 text-left transition hover:shadow-sm ${styles} ${
        active
          ? "ring-2 ring-gray-900"
          : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium text-gray-700">
            {title}
          </div>

          <div className="mt-2 text-3xl font-semibold text-gray-900">
            {count}
          </div>
        </div>

        <span className="text-sm text-gray-500">
          View →
        </span>
      </div>

      <div className="mt-4 border-t border-black/5 pt-4">
        {products.length ===
        0 ? (
          <div className="text-sm text-gray-500">
            No products
          </div>
        ) : (
          <div className="space-y-2">
            {products
              .slice(0, 4)
              .map(
                (product) => (
                  <div
                    key={
                      product.id
                    }
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="truncate text-gray-700">
                      {
                        product.product_name
                      }
                    </span>

                    <span className="shrink-0 text-xs font-medium text-gray-500">
                      {number(
                        product.current_stock
                      )}
                      /
                      {number(
                        product.min_stock
                      )}
                    </span>
                  </div>
                )
              )}

            {products.length >
              4 && (
              <div className="text-xs font-medium text-gray-500">
                +
                {products.length -
                  4}{" "}
                more products
              </div>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

function CategoryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: StockStatus;
}) {
  const styles =
    tone === "healthy"
      ? "bg-green-50 text-green-700"
      : tone === "low"
      ? "bg-amber-50 text-amber-700"
      : "bg-red-50 text-red-700";

  return (
    <div
      className={`rounded-lg p-3 ${styles}`}
    >
      <div className="text-[11px] font-medium uppercase">
        {label}
      </div>

      <div className="mt-1 text-lg font-semibold">
        {value}
      </div>
    </div>
  );
}

function AttentionRow({
  product,
  onCategory,
  onAdjust,
}: {
  product: Product;
  onCategory: () => void;
  onAdjust: () => void;
}) {
  const status =
    getStockStatus(
      product
    );

  return (
    <div className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-medium text-gray-900">
            {
              product.product_name
            }
          </div>

          <StockBadge
            status={
              status
            }
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
          <button
            type="button"
            onClick={
              onCategory
            }
            className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200"
          >
            {
              product.category_name
            }
          </button>

          <span>
            Current{" "}
            <strong className="text-gray-900">
              {number(
                product.current_stock
              )}
            </strong>
          </span>

          <span>
            Minimum{" "}
            <strong className="text-gray-900">
              {number(
                product.min_stock
              )}
            </strong>
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <Link
          href={`/products/${product.id}`}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700"
        >
          View
        </Link>

        <button
          type="button"
          onClick={
            onAdjust
          }
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700"
        >
          Adjust
        </button>
      </div>
    </div>
  );
}

function InventoryProductCard({
  product,
  movement,
  onCategory,
  onAdjust,
  canAdjust = true,
  compact = false,
}: {
  product: Product;
  movement?: Movement;
  onCategory: () => void;
  onAdjust: () => void;
  canAdjust?: boolean;
  compact?: boolean;
}) {
  const status =
    getStockStatus(
      product
    );

  const stockValue =
    product.current_stock *
    product.cost_price;

  const target =
    Math.max(
      product.min_stock,
      1
    );

  const percent =
    Math.min(
      100,
      Math.max(
        0,
        (product.current_stock /
          target) *
          100
      )
    );

  return (
    <div className={compact ? "p-4" : "rounded-xl border border-gray-200 bg-white p-5 shadow-sm"}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-gray-900">
              {
                product.product_name
              }
            </h3>

            <StockBadge
              status={
                status
              }
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={
                onCategory
              }
              className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600"
            >
              {
                product.category_name
              }
            </button>

            <span className="text-xs text-gray-400">
              {product.product_code ||
                `Product #${product.id}`}
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-2xl font-semibold text-gray-900">
            {number(
              product.current_stock
            )}
          </div>

          <div className="text-xs text-gray-400">
            units available
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex justify-between text-xs">
          <span className="text-gray-500">
            Stock level
          </span>

          <span className="font-medium text-gray-700">
            Current{" "}
            {number(
              product.current_stock
            )}{" "}
            • Minimum{" "}
            {number(
              product.min_stock
            )}
          </span>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${
              status === "out"
                ? "bg-red-500"
                : status === "low"
                ? "bg-amber-500"
                : "bg-green-500"
            }`}
            style={{
              width: `${percent}%`,
            }}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4">
        <MiniMetric
          label="Unit Cost"
          value={money(
            product.cost_price
          )}
        />

        <MiniMetric
          label="Stock Value"
          value={money(
            stockValue
          )}
        />

        <MiniMetric
          label="Selling Price"
          value={money(
            product.selling_price
          )}
        />

        <MiniMetric
          label="Last Movement"
          value={
            movement
              ? movementLabel(
                  movement.movement_type
                )
              : "No history"
          }
        />
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Link
          href={`/products/${product.id}`}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700"
        >
          View Product
        </Link>

        <button
          type="button"
          disabled={!canAdjust}
          onClick={onAdjust}
          className={`rounded-lg px-3 py-2 text-sm font-semibold text-white ${
            canAdjust
              ? "bg-gray-900"
              : "cursor-not-allowed bg-gray-300"
          }`}
        >
          {canAdjust
            ? "Adjust Stock"
            : "Locked"}
        </button>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">
        {label}
      </div>

      <div className="mt-2 text-2xl font-semibold text-gray-900">
        {value}
      </div>

      <div className="mt-2 text-xs text-gray-400">
        {hint}
      </div>
    </div>
  );
}

function StockBadge({
  status,
}: {
  status: StockStatus;
}) {
  if (
    status === "out"
  ) {
    return (
      <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
        Out of Stock
      </span>
    );
  }

  if (
    status === "low"
  ) {
    return (
      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        Low Stock
      </span>
    );
  }

  return (
    <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
      Healthy
    </span>
  );
}

function MovementBadge({
  type,
}: {
  type: string;
}) {
  const incoming = [
    "opening_stock",
    "purchase_receipt",
    "adjustment_in",
    "return_in",
    "transfer_in",
  ].includes(type);

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        incoming
          ? "bg-green-50 text-green-700"
          : "bg-red-50 text-red-700"
      }`}
    >
      {movementLabel(
        type
      )}
    </span>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-400">
        {label}
      </div>

      <div className="mt-1 text-sm font-semibold text-gray-900">
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

function getStockStatus(
  product: Product
): StockStatus {
  if (
    product.current_stock <=
    0
  ) {
    return "out";
  }

  if (
    product.current_stock <=
    product.min_stock
  ) {
    return "low";
  }

  return "healthy";
}

function movementLabel(
  type: string
) {
  return type
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400";

function number(
  value: number
) {
  return Number(
    value || 0
  ).toLocaleString(undefined, {
    maximumFractionDigits: 3,
  });
}

function money(
  value: number
) {
  return `฿${Number(
    value || 0
  ).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleString();
}

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function firstDayOfDate(
  value: string
) {
  return `${String(
    value || ""
  ).slice(0, 7)}-01`;
}
