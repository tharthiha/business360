"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";

type Product = {
  id: number;
  product_code: string | null;
  sku: string | null;
  barcode: string | null;
  product_name: string;
  category_id: number | null;
  cost_price: number | null;
  selling_price: number | null;
  current_stock: number | null;
  min_stock: number | null;
  is_active: boolean;
};

type ProductImage = {
  id: number;
  image_path: string;
  is_primary: boolean;
  sort_order: number;
  url?: string;
};

export default function ProductDetailClient({
  id,
}: {
  id: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [product, setProduct] = useState<Product | null>(null);
  const [categoryName, setCategoryName] = useState<string>("");
  const [images, setImages] = useState<ProductImage[]>([]);
  const [selectedImage, setSelectedImage] =
    useState<ProductImage | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      const { data: productData, error: productError } =
        await supabase
          .from("products")
          .select("*")
          .eq("id", id)
          .single();

      if (productError || !productData) {
        setError(
          productError?.message || "Product not found."
        );
        setLoading(false);
        return;
      }

      setProduct(productData);

      if (productData.category_id) {
        const {
          data: categoryData,
          error: categoryError,
        } = await supabase
          .from("product_categories")
          .select("name")
          .eq("id", productData.category_id)
          .maybeSingle();

        if (categoryError) {
          console.error(
            "Category load error:",
            categoryError
          );
        } else {
          setCategoryName(categoryData?.name || "");
        }
      } else {
        setCategoryName("");
      }

      const { data: imageData, error: imageError } =
        await supabase
          .from("product_images")
          .select("*")
          .eq("product_id", id)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true });

      if (imageError) {
        console.error("Image DB error:", imageError);
        setLoading(false);
        return;
      }

      const records = imageData || [];

      const imagesWithUrls = await Promise.all(
        records.map(async (image) => {
          const { data, error } = await supabase.storage
            .from("product-images")
            .createSignedUrl(image.image_path, 3600);

          if (error) {
            console.error(
              "Signed URL error:",
              image.image_path,
              error
            );

            return {
              ...image,
              url: "",
            };
          }

          return {
            ...image,
            url: data.signedUrl,
          };
        })
      );

      setImages(imagesWithUrls);

      if (imagesWithUrls.length > 0) {
        const primary =
          imagesWithUrls.find(
            (image) => image.is_primary
          ) || imagesWithUrls[0];

        setSelectedImage(primary);
      }

      setLoading(false);
    }

    loadData();
  }, [id]);

  async function toggleActive() {
    if (!product) return;

    const { error } = await supabase
      .from("products")
      .update({
        is_active: !product.is_active,
      })
      .eq("id", product.id);

    if (error) {
      alert(error.message);
      return;
    }

    setProduct({
      ...product,
      is_active: !product.is_active,
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="text-sm text-gray-500">
          Loading product...
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {error || "Product not found."}
      </div>
    );
  }

  const cost = Number(product.cost_price || 0);
  const price = Number(product.selling_price || 0);
  const stock = Number(product.current_stock || 0);
  const minStock = Number(product.min_stock || 0);

  const margin = price - cost;
  const marginPercent =
    price > 0 ? (margin / price) * 100 : 0;

  const lowStock = stock <= minStock;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {product.product_name}
            </h1>

            {product.is_active === false ? (
              <Badge tone="default">
                Inactive
              </Badge>
            ) : lowStock ? (
              <Badge tone="warning">
                Low Stock
              </Badge>
            ) : (
              <Badge tone="success">
                Active
              </Badge>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
            <span>
              {product.product_code ||
                "No product code"}
            </span>

            {product.sku && (
              <span>SKU: {product.sku}</span>
            )}

            <span>
              Product ID #{product.id}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() =>
              router.push("/products")
            }
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
<Link
  href="/products/new"
  className="rounded-lg border border-gray-400 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
>
  + Add Another Product
</Link>
          <Link
            href={`/products/${product.id}/edit`}
            className="rounded-lg border border-gray-200 bg-blue px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Edit
          </Link>

          <button
            type="button"
            onClick={toggleActive}
            className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-black"
          >
            {product.is_active
              ? "Make Inactive"
              : "Make Active"}
          </button>
        </div>
      </div>

      {/* Images + Summary */}
      <div className="grid gap-6 xl:grid-cols-5">
        {/* Product Images */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm xl:col-span-3">
          <div className="mb-4">
            <h2 className="font-semibold text-gray-900">
              Product Images
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {images.length} image
              {images.length === 1 ? "" : "s"}
            </p>
          </div>

          {selectedImage?.url ? (
            <>
              <div className="flex justify-center">
                <div className="flex h-[320px] w-full max-w-[480px] items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                  <img
                    src={selectedImage.url}
                    alt={product.product_name}
                    className="max-h-[300px] max-w-[440px] object-contain"
                  />
                </div>
              </div>

              {images.length > 1 && (
                <div className="mt-4 flex justify-center gap-3 overflow-x-auto pb-1">
                  {images.map((image) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() =>
                        setSelectedImage(image)
                      }
                      className={`relative h-16 w-16 flex-none overflow-hidden rounded-lg border bg-gray-50 ${
                        selectedImage.id === image.id
                          ? "border-gray-900 ring-2 ring-gray-200"
                          : "border-gray-200"
                      }`}
                    >
                      {image.url ? (
                        <img
                          src={image.url}
                          alt={product.product_name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-gray-400">
                          No image
                        </div>
                      )}

                      {image.is_primary && (
                        <span className="absolute bottom-1 left-1 rounded bg-gray-900 px-1 py-0.5 text-[8px] font-medium text-white">
                          Primary
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex justify-center">
              <div className="flex h-[320px] w-full max-w-[480px] items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50">
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-700">
                    No image available
                  </div>

                  <p className="mt-1 text-xs text-gray-400">
                    Edit this product to add images.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-2 xl:col-span-2 xl:grid-cols-1">
          <SummaryCard
            label="Selling Price"
            value={`฿${price.toLocaleString(
              undefined,
              {
                minimumFractionDigits: 2,
              }
            )}`}
            note="Current selling price"
          />

          <SummaryCard
            label="Cost"
            value={`฿${cost.toLocaleString(
              undefined,
              {
                minimumFractionDigits: 2,
              }
            )}`}
            note="Product cost"
          />

          <SummaryCard
            label="Gross Margin"
            value={`${marginPercent.toFixed(1)}%`}
            note={`฿${margin.toFixed(
              2
            )} per unit`}
          />

          <SummaryCard
            label="Current Stock"
            value={String(stock)}
            note={`Minimum ${minStock}`}
          />
        </div>
      </div>

      {lowStock && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="font-medium text-amber-800">
            Low stock warning
          </div>

          <div className="mt-1 text-sm text-amber-700">
            Current stock is {stock}. Minimum
            stock is {minStock}.
          </div>
        </div>
      )}

      {/* Details */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm lg:col-span-2">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="font-semibold text-gray-900">
              Product Information
            </h2>
          </div>

          <div className="grid gap-6 p-6 md:grid-cols-2">
            <InfoItem
              label="Product Code"
              value={product.product_code}
            />

            <InfoItem
              label="SKU"
              value={product.sku}
            />

            <InfoItem
              label="Barcode"
              value={product.barcode}
            />

            <InfoItem
              label="Category"
              value={categoryName || null}
            />

            <InfoItem
              label="Status"
              value={
                product.is_active
                  ? "Active"
                  : "Inactive"
              }
            />
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900">
            Pricing
          </h3>

          <div className="mt-5 space-y-4">
            <Metric
              label="Cost Price"
              value={`฿${cost.toFixed(2)}`}
            />

            <Metric
              label="Selling Price"
              value={`฿${price.toFixed(2)}`}
            />

            <Metric
              label="Margin"
              value={`฿${margin.toFixed(2)}`}
            />

            <Metric
              label="Margin %"
              value={`${marginPercent.toFixed(
                1
              )}%`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-gray-500">
        {label}
      </div>

      <div className="mt-2 text-2xl font-semibold text-gray-900">
        {value}
      </div>

      <div className="mt-1 text-xs text-gray-400">
        {note}
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </div>

      <div className="mt-2 text-sm font-medium text-gray-900">
        {value || "-"}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-gray-500">
        {label}
      </span>

      <span className="font-semibold text-gray-900">
        {value}
      </span>
    </div>
  );
}