"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ExistingImage = {
  id: number;
  image_path: string;
  is_primary: boolean;
  sort_order: number;
  url: string;
};

type NewImage = {
  file: File;
  preview: string;
  is_primary: boolean;
};

type Category = {
  id: number;
  name: string;
};

export default function EditProductClient({
  id,
}: {
  id: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    product_code: "",
    sku: "",
    barcode: "",
    product_name: "",
    category_id: "",
    cost_price: "",
    selling_price: "",
    current_stock: "",
    min_stock: "",
    is_active: true,
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [newImages, setNewImages] = useState<NewImage[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setMessage("");

      try {
        const {
          data: product,
          error: productError,
        } = await supabase
          .from("products")
          .select("*")
          .eq("id", id)
          .single();

        if (productError || !product) {
          setMessage(productError?.message || "Product not found.");
          setLoading(false);
          return;
        }

        setForm({
          product_code: product.product_code || "",
          sku: product.sku || "",
          barcode: product.barcode || "",
          product_name: product.product_name || "",
          category_id: product.category_id
            ? String(product.category_id)
            : "",
          cost_price: String(product.cost_price ?? ""),
          selling_price: String(product.selling_price ?? ""),
          current_stock: String(product.current_stock ?? ""),
          min_stock: String(product.min_stock ?? ""),
          is_active: product.is_active !== false,
        });

        const {
          data: categoryData,
          error: categoryError,
        } = await supabase
          .from("product_categories")
          .select("id, name")
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (categoryError) {
          console.error("Category load error:", categoryError);
        } else {
          setCategories((categoryData || []) as Category[]);
        }

        setLoadingCategories(false);

        const {
          data: imageRecords,
          error: imageError,
        } = await supabase
          .from("product_images")
          .select("*")
          .eq("product_id", id)
          .order("is_primary", { ascending: false })
          .order("sort_order", { ascending: true });

        if (imageError) {
          setMessage(imageError.message);
          setLoading(false);
          return;
        }

        const records = imageRecords || [];

        const imagesWithUrls = await Promise.all(
          records.map(async (image) => {
            const { data, error } = await supabase.storage
              .from("product-images")
              .createSignedUrl(image.image_path, 3600);

            return {
              id: image.id,
              image_path: image.image_path,
              is_primary: image.is_primary,
              sort_order: image.sort_order,
              url: error ? "" : data.signedUrl,
            };
          })
        );

        setExistingImages(imagesWithUrls);
      } catch (error) {
        console.error(error);
        setMessage("Unexpected error while loading product.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function handleNewImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);

    const validFiles = files.filter((file) => {
      const validType = [
        "image/jpeg",
        "image/png",
        "image/webp",
      ].includes(file.type);

      const validSize = file.size <= 5 * 1024 * 1024;

      return validType && validSize;
    });

    const hasPrimary =
      existingImages.some((image) => image.is_primary) ||
      newImages.some((image) => image.is_primary);

    const incoming = validFiles.map((file, index) => ({
      file,
      preview: URL.createObjectURL(file),
      is_primary: !hasPrimary && index === 0,
    }));

    setNewImages((current) => [...current, ...incoming]);

    e.target.value = "";
  }

  function removeNewImage(index: number) {
    setNewImages((current) => {
      const removed = current[index];

      if (removed?.preview) {
        URL.revokeObjectURL(removed.preview);
      }

      const wasPrimary = removed?.is_primary;

      const next = current.filter((_, i) => i !== index);

      if (
        wasPrimary &&
        !existingImages.some((image) => image.is_primary) &&
        next.length > 0
      ) {
        next[0] = {
          ...next[0],
          is_primary: true,
        };
      }

      return next;
    });
  }

  async function deleteExistingImage(image: ExistingImage) {
    const confirmed = window.confirm("Remove this image?");

    if (!confirmed) return;

    setMessage("");

    const { error: storageError } = await supabase.storage
      .from("product-images")
      .remove([image.image_path]);

    if (storageError) {
      setMessage(storageError.message);
      return;
    }

    const { error: dbError } = await supabase
      .from("product_images")
      .delete()
      .eq("id", image.id);

    if (dbError) {
      setMessage(dbError.message);
      return;
    }

    let remaining = existingImages.filter(
      (item) => item.id !== image.id
    );

    if (image.is_primary && remaining.length > 0) {
      const nextPrimary = remaining[0];

      await supabase
        .from("product_images")
        .update({ is_primary: true })
        .eq("id", nextPrimary.id);

      remaining = remaining.map((item) => ({
        ...item,
        is_primary: item.id === nextPrimary.id,
      }));
    }

    if (
      image.is_primary &&
      remaining.length === 0 &&
      newImages.length > 0
    ) {
      setNewImages((current) =>
        current.map((item, index) => ({
          ...item,
          is_primary: index === 0,
        }))
      );
    }

    setExistingImages(remaining);
  }

  async function makeExistingPrimary(imageId: number) {
    setMessage("");

    const { error: resetError } = await supabase
      .from("product_images")
      .update({ is_primary: false })
      .eq("product_id", id);

    if (resetError) {
      setMessage(resetError.message);
      return;
    }

    const { error: setError } = await supabase
      .from("product_images")
      .update({ is_primary: true })
      .eq("id", imageId);

    if (setError) {
      setMessage(setError.message);
      return;
    }

    setExistingImages((current) =>
      current.map((image) => ({
        ...image,
        is_primary: image.id === imageId,
      }))
    );

    setNewImages((current) =>
      current.map((image) => ({
        ...image,
        is_primary: false,
      }))
    );
  }

  function makeNewPrimary(index: number) {
    setExistingImages((current) =>
      current.map((image) => ({
        ...image,
        is_primary: false,
      }))
    );

    setNewImages((current) =>
      current.map((image, i) => ({
        ...image,
        is_primary: i === index,
      }))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.product_name.trim()) {
      setMessage("Product name is required.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("Please login first.");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) {
        setMessage("Company profile not found.");
        return;
      }

      const companyId = profile.company_id;

      const { error: productError } = await supabase
        .from("products")
        .update({
          product_code: form.product_code || null,
          sku: form.sku || null,
          barcode: form.barcode || null,
          product_name: form.product_name.trim(),

          category_id: form.category_id
            ? Number(form.category_id)
            : null,

          cost_price: Number(form.cost_price || 0),
          selling_price: Number(form.selling_price || 0),
          current_stock: Number(form.current_stock || 0),
          min_stock: Number(form.min_stock || 0),
          is_active: form.is_active,
        })
        .eq("id", id);

      if (productError) {
        setMessage(productError.message);
        return;
      }

      const primaryNewIndex = newImages.findIndex(
        (image) => image.is_primary
      );

      if (primaryNewIndex >= 0) {
        await supabase
          .from("product_images")
          .update({ is_primary: false })
          .eq("product_id", id);
      }

      for (let index = 0; index < newImages.length; index++) {
        const image = newImages[index];

        const extension =
          image.file.name.split(".").pop()?.toLowerCase() || "jpg";

        const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;

        const path =
          `company-${companyId}/` +
          `product-${id}/` +
          fileName;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, image.file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          setMessage(uploadError.message);
          return;
        }

        const { error: imageDbError } = await supabase
          .from("product_images")
          .insert({
            product_id: Number(id),
            image_path: path,
            is_primary: image.is_primary,
            sort_order: existingImages.length + index,
          });

        if (imageDbError) {
          setMessage(imageDbError.message);
          return;
        }
      }

      router.push(`/products/${id}`);
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage("Unexpected error while saving product.");
    } finally {
      setSaving(false);
    }
  }

  const cost = Number(form.cost_price || 0);
  const price = Number(form.selling_price || 0);
  const margin = price - cost;

  const marginPercent =
    price > 0 ? (margin / price) * 100 : 0;

  const totalImageCount =
    existingImages.length + newImages.length;

  const newImageSize = useMemo(
    () =>
      newImages.reduce(
        (total, image) => total + image.file.size,
        0
      ),
    [newImages]
  );

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="text-sm text-gray-500">
          Loading product...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Edit Product
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Update product information, pricing, inventory and images.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push(`/products/${id}`)}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          View Product
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Section
              title="Product Information"
              description="Product identification, category and reference information."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label="Product Code"
                  name="product_code"
                  value={form.product_code}
                  onChange={handleChange}
                />

                <Field
                  label="Product Name"
                  name="product_name"
                  value={form.product_name}
                  onChange={handleChange}
                  required
                />

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Category
                  </label>

                  <select
                    value={form.category_id}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        category_id: e.target.value,
                      })
                    }
                    disabled={loadingCategories}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
                  >
                    <option value="">
                      {loadingCategories
                        ? "Loading categories..."
                        : "No category"}
                    </option>

                    {categories.map((category) => (
                      <option
                        key={category.id}
                        value={category.id}
                      >
                        {category.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() =>
                      router.push("/products/categories")
                    }
                    className="mt-2 text-xs font-medium text-gray-700 underline underline-offset-2"
                  >
                    Manage Categories
                  </button>
                </div>

                <Field
                  label="SKU"
                  name="sku"
                  value={form.sku}
                  onChange={handleChange}
                />

                <Field
                  label="Barcode"
                  name="barcode"
                  value={form.barcode}
                  onChange={handleChange}
                />
              </div>
            </Section>

            <Section
              title="Product Images"
              description="Add, remove and choose the primary product image."
            >
              <div className="space-y-5">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-8 text-center">
                  <div className="text-sm font-medium text-gray-900">
                    + Add product images
                  </div>

                  <div className="mt-1 text-xs text-gray-500">
                    JPG, PNG or WEBP • Max 5 MB each
                  </div>

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleNewImages}
                    className="hidden"
                  />
                </label>

                {existingImages.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-4">
                    {existingImages.map((image) => (
                      <div
                        key={image.id}
                        className="overflow-hidden rounded-xl border border-gray-200"
                      >
                        <div className="relative flex h-36 items-center justify-center bg-gray-50">
                          {image.url && (
                            <img
                              src={image.url}
                              alt="Product"
                              className="max-h-full max-w-full object-contain"
                            />
                          )}

                          {image.is_primary && (
                            <span className="absolute left-2 top-2 rounded-full bg-gray-900 px-2 py-1 text-[10px] text-white">
                              Primary
                            </span>
                          )}
                        </div>

                        <div className="space-y-2 p-3">
                          {!image.is_primary && (
                            <button
                              type="button"
                              onClick={() =>
                                makeExistingPrimary(image.id)
                              }
                              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                            >
                              Set Primary
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              deleteExistingImage(image)
                            }
                            className="w-full rounded-lg border border-red-200 px-2 py-1.5 text-xs text-red-600"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {newImages.length > 0 && (
                  <div>
                    <div className="mb-3 text-xs text-gray-500">
                      New images: {newImages.length} ·{" "}
                      {(newImageSize / 1024 / 1024).toFixed(2)} MB
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-4">
                      {newImages.map((image, index) => (
                        <div
                          key={`${image.file.name}-${index}`}
                          className="overflow-hidden rounded-xl border border-gray-200"
                        >
                          <div className="relative flex h-36 items-center justify-center bg-gray-50">
                            <img
                              src={image.preview}
                              alt={image.file.name}
                              className="max-h-full max-w-full object-contain"
                            />

                            {image.is_primary && (
                              <span className="absolute left-2 top-2 rounded-full bg-gray-900 px-2 py-1 text-[10px] text-white">
                                Primary
                              </span>
                            )}
                          </div>

                          <div className="space-y-2 p-3">
                            {!image.is_primary && (
                              <button
                                type="button"
                                onClick={() =>
                                  makeNewPrimary(index)
                                }
                                className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                              >
                                Set Primary
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                removeNewImage(index)
                              }
                              className="w-full rounded-lg border border-red-200 px-2 py-1.5 text-xs text-red-600"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {totalImageCount === 0 && (
                  <div className="rounded-lg bg-gray-50 px-4 py-4 text-sm text-gray-500">
                    This product currently has no images.
                  </div>
                )}
              </div>
            </Section>

            <Section
              title="Pricing"
              description="Update the product cost and selling price."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label="Cost Price"
                  name="cost_price"
                  value={form.cost_price}
                  onChange={handleChange}
                  type="number"
                />

                <Field
                  label="Selling Price"
                  name="selling_price"
                  value={form.selling_price}
                  onChange={handleChange}
                  type="number"
                />
              </div>
            </Section>

            <Section
              title="Inventory"
              description="Manage stock and reorder level."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label="Current Stock"
                  name="current_stock"
                  value={form.current_stock}
                  onChange={handleChange}
                  type="number"
                />

                <Field
                  label="Minimum Stock"
                  name="min_stock"
                  value={form.min_stock}
                  onChange={handleChange}
                  type="number"
                />
              </div>
            </Section>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="font-semibold">Pricing Summary</h3>

              <div className="mt-5 space-y-4">
                <Metric label="Cost" value={`฿${cost.toFixed(2)}`} />
                <Metric
                  label="Selling Price"
                  value={`฿${price.toFixed(2)}`}
                />
                <Metric
                  label="Gross Margin"
                  value={`฿${margin.toFixed(2)}`}
                />
                <Metric
                  label="Margin"
                  value={`${marginPercent.toFixed(1)}%`}
                />
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="font-semibold">Images</h3>

              <div className="mt-4 flex justify-between text-sm">
                <span className="text-gray-500">Total Images</span>
                <span className="font-semibold">
                  {totalImageCount}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="font-semibold">Product Status</h3>

              <div className="mt-5 flex items-center justify-between">
                <span className="text-sm">
                  {form.is_active ? "Active" : "Inactive"}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      ...form,
                      is_active: !form.is_active,
                    })
                  }
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  Toggle
                </button>
              </div>
            </div>
          </div>
        </div>

        {message && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-6">
          <button
            type="button"
            onClick={() => router.push(`/products/${id}`)}
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            style={{
              backgroundColor: "#111827",
              color: "#ffffff",
              borderRadius: "8px",
              padding: "10px 20px",
              fontWeight: 600,
            }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

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
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>

      <div className="p-6">{children}</div>
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
}: {
  label: string;
  name: string;
  value: string;
  required?: boolean;
  type?: string;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement>
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
        step={type === "number" ? "0.01" : undefined}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none"
      />
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
      <span className="text-sm text-gray-500">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
