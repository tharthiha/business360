import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProductsTableClient from "./products-table-client";

export const instant = false;

export default async function ProductsPage() {
  const supabase = await createClient();

  // =========================================================
  // LOAD PRODUCTS
  // =========================================================

  const {
    data: products,
    error: productsError,
  } = await supabase
    .from("products")
    .select(
      `
      id,
      product_code,
      sku,
      barcode,
      product_name,
      cost_price,
      selling_price,
      current_stock,
      min_stock,
      is_active,
      created_at
      `
    )
    .order("created_at", {
      ascending: false,
    });

  if (productsError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Could not load products: {productsError.message}
      </div>
    );
  }

  const productList = products || [];

  // =========================================================
  // LOAD PRIMARY / FIRST PRODUCT IMAGES
  // =========================================================

  const productIds = productList.map(
    (product) => product.id
  );

  const imageMap: Record<number, string> = {};

  if (productIds.length > 0) {
    const {
      data: imageRows,
      error: imageError,
    } = await supabase
      .from("product_images")
      .select(
        `
        product_id,
        image_path,
        is_primary,
        sort_order
        `
      )
      .in("product_id", productIds)
      .order("is_primary", {
        ascending: false,
      })
      .order("sort_order", {
        ascending: true,
      });

    if (imageError) {
      console.error(
        "Could not load product images:",
        imageError
      );
    }

    if (imageRows) {
      const firstImageByProduct: Record<
        number,
        string
      > = {};

      for (const image of imageRows) {
        if (
          !firstImageByProduct[
            image.product_id
          ]
        ) {
          firstImageByProduct[
            image.product_id
          ] = image.image_path;
        }
      }

      const entries =
        Object.entries(
          firstImageByProduct
        );

      await Promise.all(
        entries.map(
          async ([productId, path]) => {
            const {
              data,
              error,
            } =
              await supabase.storage
                .from(
                  "product-images"
                )
                .createSignedUrl(
                  path,
                  3600
                );

            if (
              !error &&
              data?.signedUrl
            ) {
              imageMap[
                Number(productId)
              ] = data.signedUrl;
            }
          }
        )
      );
    }
  }

  // =========================================================
  // PREPARE PRODUCTS FOR CLIENT TABLE
  // =========================================================

  const productsWithImages =
    productList.map(
      (product) => ({
        ...product,
        image_url:
          imageMap[product.id] ||
          null,
      })
    );

  // =========================================================
  // SUMMARY CARDS
  // =========================================================

  const totalProducts =
    productList.length;

  const activeProducts =
    productList.filter(
      (product) =>
        product.is_active !== false
    ).length;

  const lowStockProducts =
    productList.filter(
      (product) =>
        Number(
          product.current_stock || 0
        ) <=
        Number(
          product.min_stock || 0
        )
    ).length;

  const inventoryValue =
    productList.reduce(
      (total, product) => {
        const cost =
          Number(
            product.cost_price || 0
          );

        const stock =
          Number(
            product.current_stock || 0
          );

        return (
          total +
          cost * stock
        );
      },
      0
    );

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Products
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage products, pricing, inventory and product images.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/products/bulk-upload"
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Bulk Upload
          </Link>

          <Link
            href="/products/new"
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black"
          >
            + Add Product
          </Link>
        </div>
      </div>

      {/* SUMMARY CARDS */}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total Products"
          value={String(
            totalProducts
          )}
          description="All products"
        />

        <SummaryCard
          label="Active Products"
          value={String(
            activeProducts
          )}
          description="Available products"
        />

        <SummaryCard
          label="Low Stock"
          value={String(
            lowStockProducts
          )}
          description="Need attention"
          warning={
            lowStockProducts > 0
          }
        />

        <SummaryCard
          label="Inventory Value"
          value={`฿${inventoryValue.toLocaleString(
            undefined,
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          )}`}
          description="Stock × cost price"
        />
      </div>

      {/* PRODUCT TABLE */}

      <ProductsTableClient
        products={
          productsWithImages
        }
      />
    </div>
  );
}

// =========================================================
// SUMMARY CARD
// =========================================================

function SummaryCard({
  label,
  value,
  description,
  warning = false,
}: {
  label: string;
  value: string;
  description: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-gray-500">
        {label}
      </div>

      <div
        className={`mt-2 text-2xl font-semibold ${
          warning
            ? "text-amber-600"
            : "text-gray-900"
        }`}
      >
        {value}
      </div>

      <div className="mt-1 text-xs text-gray-400">
        {description}
      </div>
    </div>
  );
}