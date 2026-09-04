"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type SelectedImage = {
  file: File;
  preview: string;
};

type Category = {
  id: number;
  name: string;
};

export default function NewProductPage() {
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
  });

  const [categories, setCategories] =
    useState<Category[]>([]);

  const [
    loadingCategories,
    setLoadingCategories,
  ] = useState(true);

  const [images, setImages] =
    useState<SelectedImage[]>([]);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      setLoadingCategories(true);

      const {
        data,
        error,
      } = await supabase
        .from("product_categories")
        .select("id, name")
        .eq("is_active", true)
        .order("name", {
          ascending: true,
        });

      if (cancelled) {
        return;
      }

      if (error) {
        console.error(
          "Category load error:",
          error
        );

        setMessage(
          "Could not load product categories."
        );

        setLoadingCategories(false);
        return;
      }

      setCategories(
        (data || []) as Category[]
      );

      setLoadingCategories(false);
    }

    loadCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  const margin = useMemo(() => {
    const cost =
      Number(form.cost_price) || 0;

    const selling =
      Number(form.selling_price) ||
      0;

    if (selling <= 0) {
      return 0;
    }

    return (
      ((selling - cost) /
        selling) *
      100
    );
  }, [
    form.cost_price,
    form.selling_price,
  ]);

  const profitPerUnit = Math.max(
    (Number(
      form.selling_price
    ) || 0) -
      (Number(
        form.cost_price
      ) || 0),
    0
  );

  function handleChange(
    e: ChangeEvent<HTMLInputElement>
  ) {
    setForm({
      ...form,
      [e.target.name]:
        e.target.value,
    });
  }

  function handleImages(
    e: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(
      e.target.files || []
    );

    if (files.length === 0) {
      return;
    }

    const nextImages =
      files.map((file) => ({
        file,
        preview:
          URL.createObjectURL(
            file
          ),
      }));

    setImages((current) => [
      ...current,
      ...nextImages,
    ]);

    e.target.value = "";
  }

  function removeImage(
    index: number
  ) {
    setImages((current) => {
      const target =
        current[index];

      if (target) {
        URL.revokeObjectURL(
          target.preview
        );
      }

      return current.filter(
        (_, currentIndex) =>
          currentIndex !== index
      );
    });
  }

  async function uploadImages(
    companyId: number,
    productId: number
  ) {
    if (images.length === 0) {
      return;
    }

    for (
      let index = 0;
      index < images.length;
      index++
    ) {
      const image =
        images[index];

      const extension =
        image.file.name
          .split(".")
          .pop()
          ?.toLowerCase() ||
        "jpg";

      const filePath = `company-${companyId}/products/product-${productId}/${Date.now()}-${index}.${extension}`;

      const {
        error: uploadError,
      } = await supabase.storage
        .from("product-images")
        .upload(
          filePath,
          image.file,
          {
            cacheControl:
              "3600",
            upsert: false,
          }
        );

      if (uploadError) {
        console.error(
          "Product image upload error:",
          uploadError
        );

        throw new Error(
          `Product created, but image upload failed: ${uploadError.message}`
        );
      }

      const {
  error: imageInsertError,
} = await supabase
  .from("product_images")
  .insert({
    product_id:
      productId,

    image_path:
      filePath,

    sort_order:
      index,

    is_primary:
      index === 0,
  });

      if (imageInsertError) {
        console.error(
          "Product image record error:",
          imageInsertError
        );

        throw new Error(
          `Product created, but image record failed: ${imageInsertError.message}`
        );
      }
    }
  }

  async function handleSubmit(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setMessage("");

    if (
      !form.product_name.trim()
    ) {
      setMessage(
        "Product name is required."
      );
      return;
    }

    if (
      Number(
        form.cost_price || 0
      ) < 0 ||
      Number(
        form.selling_price || 0
      ) < 0 ||
      Number(
        form.current_stock || 0
      ) < 0 ||
      Number(
        form.min_stock || 0
      ) < 0
    ) {
      setMessage(
        "Price and stock values cannot be negative."
      );
      return;
    }

    setSaving(true);

    try {
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

      if (
        !profile?.company_id
      ) {
        throw new Error(
          "Company profile not found."
        );
      }

      const {
        data: product,
        error: productError,
      } = await supabase
        .from("products")
        .insert({
          company_id:
            profile.company_id,

          product_code:
            form.product_code.trim() ||
            null,

          sku:
            form.sku.trim() ||
            null,

          barcode:
            form.barcode.trim() ||
            null,

          product_name:
            form.product_name.trim(),

          category_id:
            form.category_id
              ? Number(
                  form.category_id
                )
              : null,

          cost_price:
            Number(
              form.cost_price
            ) || 0,

          selling_price:
            Number(
              form.selling_price
            ) || 0,

          current_stock:
            Number(
              form.current_stock
            ) || 0,

          min_stock:
            Number(
              form.min_stock
            ) || 0,

          is_active: true,
        })
        .select("id")
        .single();

      if (productError) {
        throw productError;
      }

      await uploadImages(
        profile.company_id,
        product.id
      );

      router.push(
        `/products/${product.id}`
      );

      router.refresh();
    } catch (error: any) {
      console.error("Create product error:", error);

      const rawMessage =
        error?.message ||
        error?.details ||
        error?.hint ||
        "";

      if (
        rawMessage.includes(
          "PRODUCT_LIMIT_REACHED"
        )
      ) {
        setMessage(
          "You’ve reached your Maximum Products limit. Increase the company limit or upgrade the subscription plan."
        );
      } else if (
        rawMessage.includes(
          "PRODUCT_LIMIT_DISABLED"
        )
      ) {
        setMessage(
          "Product creation is not available for this company."
        );
      } else if (
        rawMessage.includes(
          "PRODUCT_LIMIT_NO_SUBSCRIPTION"
        )
      ) {
        setMessage(
          "This company does not have an active subscription."
        );
      } else {
        setMessage(
          rawMessage ||
            "Could not create product."
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            New Product
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Add a product to your company catalogue and inventory.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            router.push(
              "/products"
            )
          }
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
        onSubmit={
          handleSubmit
        }
        className="space-y-6"
      >
        <div className="grid gap-6 xl:grid-cols-3">
          {/* LEFT */}

          <div className="space-y-6 xl:col-span-2">
            {/* PRODUCT INFO */}

            <Section
              title="Product Information"
              description="Basic product details, identification and category."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label="Product Name"
                  required
                >
                  <input
                    name="product_name"
                    value={
                      form.product_name
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="e.g. Premium Notebook"
                    className={
                      inputClass
                    }
                  />
                </Field>

                <Field label="Category">
                  <select
                    name="category_id"
                    value={
                      form.category_id
                    }
                    onChange={(
                      e
                    ) =>
                      setForm({
                        ...form,
                        category_id:
                          e.target
                            .value,
                      })
                    }
                    disabled={
                      loadingCategories
                    }
                    className={
                      inputClass
                    }
                  >
                    <option value="">
                      {loadingCategories
                        ? "Loading categories..."
                        : "No category"}
                    </option>

                    {categories.map(
                      (
                        category
                      ) => (
                        <option
                          key={
                            category.id
                          }
                          value={
                            category.id
                          }
                        >
                          {
                            category.name
                          }
                        </option>
                      )
                    )}
                  </select>

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-xs text-gray-500">
                      Company-specific category
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          "/products/categories"
                        )
                      }
                      className="text-xs font-medium text-gray-700 underline underline-offset-2 hover:text-gray-900"
                    >
                      Manage Categories
                    </button>
                  </div>
                </Field>

                <Field label="Product Code">
                  <input
                    name="product_code"
                    value={
                      form.product_code
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="e.g. PRD-001"
                    className={
                      inputClass
                    }
                  />
                </Field>

                <Field label="SKU">
                  <input
                    name="sku"
                    value={
                      form.sku
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="Stock keeping unit"
                    className={
                      inputClass
                    }
                  />
                </Field>

                <div className="md:col-span-2">
                  <Field label="Barcode">
                    <input
                      name="barcode"
                      value={
                        form.barcode
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Optional barcode"
                      className={
                        inputClass
                      }
                    />
                  </Field>
                </div>
              </div>
            </Section>

            {/* PRICING */}

            <Section
              title="Pricing"
              description="Product cost and selling price."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Cost Price">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="cost_price"
                    value={
                      form.cost_price
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="0.00"
                    className={
                      inputClass
                    }
                  />
                </Field>

                <Field label="Selling Price">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="selling_price"
                    value={
                      form.selling_price
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="0.00"
                    className={
                      inputClass
                    }
                  />
                </Field>
              </div>
            </Section>

            {/* INVENTORY */}

            <Section
              title="Inventory"
              description="Opening stock and low-stock threshold."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Current Stock">
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    name="current_stock"
                    value={
                      form.current_stock
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="0"
                    className={
                      inputClass
                    }
                  />
                </Field>

                <Field label="Minimum Stock">
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    name="min_stock"
                    value={
                      form.min_stock
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="0"
                    className={
                      inputClass
                    }
                  />

                  <p className="mt-2 text-xs text-gray-500">
                    Low-stock alert appears when current stock reaches this level.
                  </p>
                </Field>
              </div>
            </Section>

            {/* IMAGES */}

            <Section
              title="Product Images"
              description="Upload product photos for easier identification."
            >
              <div className="space-y-5">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center transition hover:border-gray-300 hover:bg-gray-100">
                  <div className="text-sm font-medium text-gray-700">
                    Add product images
                  </div>

                  <div className="mt-1 text-xs text-gray-500">
                    JPG, PNG, WEBP
                  </div>

                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={
                      handleImages
                    }
                    className="hidden"
                  />
                </label>

                {images.length >
                  0 && (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {images.map(
                      (
                        image,
                        index
                      ) => (
                        <div
                          key={`${image.file.name}-${index}`}
                          className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                        >
                          <img
                            src={
                              image.preview
                            }
                            alt={`Product preview ${
                              index +
                              1
                            }`}
                            className="aspect-square w-full object-cover"
                          />

                          {index ===
                            0 && (
                            <span className="absolute left-2 top-2 rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white">
                              Primary
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              removeImage(
                                index
                              )
                            }
                            className="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-red-600 shadow-sm hover:bg-white"
                          >
                            Remove
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </Section>
          </div>

          {/* RIGHT */}

          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900">
                Pricing Summary
              </h3>

              <div className="mt-5 space-y-4">
                <SummaryRow
                  label="Cost"
                  value={money(
                    Number(
                      form.cost_price
                    )
                  )}
                />

                <SummaryRow
                  label="Selling"
                  value={money(
                    Number(
                      form.selling_price
                    )
                  )}
                />

                <SummaryRow
                  label="Profit / Unit"
                  value={money(
                    profitPerUnit
                  )}
                />

                <div className="border-t border-gray-200 pt-4">
                  <SummaryRow
                    label="Margin"
                    value={`${margin.toFixed(
                      2
                    )}%`}
                    strong
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900">
                Product Category
              </h3>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Categories are company-specific and can later be used in purchasing, inventory, reports and sales analysis.
              </p>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/products/categories"
                  )
                }
                className="mt-4 w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Manage Categories
              </button>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900">
                Product Status
              </h3>

              <div className="mt-4 flex items-center gap-3">
                <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                  Active
                </span>

                <span className="text-sm text-gray-500">
                  New products are active by default.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ACTIONS */}

        <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              router.push(
                "/products"
              )
            }
            className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>

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
              padding:
                "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: saving
                ? "not-allowed"
                : "pointer",
              opacity: saving
                ? 0.6
                : 1,
            }}
          >
            {saving
              ? "Saving..."
              : "Create Product"}
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

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-5">
      <span
        className={
          strong
            ? "font-semibold text-gray-900"
            : "text-sm text-gray-500"
        }
      >
        {label}
      </span>

      <span
        className={
          strong
            ? "text-lg font-semibold text-gray-900"
            : "font-medium text-gray-900"
        }
      >
        {value}
      </span>
    </div>
  );
}

function money(
  value: number
) {
  return `฿${Number(
    value || 0
  ).toLocaleString(
    undefined,
    {
      minimumFractionDigits:
        2,
      maximumFractionDigits:
        2,
    }
  )}`;
}