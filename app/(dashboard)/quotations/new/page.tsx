"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: number;
  customer_name: string;
  customer_code: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
};

type Product = {
  id: number;
  product_code: string | null;
  product_name: string;
  sku: string | null;
  selling_price: number | null;
  current_stock: number | null;
};

type QuoteItem = {
  key: string;
  product_id: number | null;
  description: string;
  qty: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
};

function emptyItem(key: string): QuoteItem {
  return {
    key,
    product_id: null,
    description: "",
    qty: 1,
    unit_price: 0,
    discount_percent: 0,
    tax_percent: 0,
  };
}

export default function NewQuotationPage() {
  const router = useRouter();
  const supabase = createClient();

  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [companyId, setCompanyId] =
    useState<number | null>(null);

  const [currency, setCurrency] =
    useState("THB");

  const [template, setTemplate] =
    useState("classic");

  const [customerId, setCustomerId] =
    useState("");

  /*
    IMPORTANT:
    Don't use new Date() during initial render.
    We fill this inside useEffect instead.
  */
  const [quotationDate, setQuotationDate] =
    useState("");

  const [validUntil, setValidUntil] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [terms, setTerms] =
    useState("");

  /*
    IMPORTANT:
    Don't use crypto.randomUUID() during initial render.
    Initial key is stable.
    crypto.randomUUID() is okay later inside click handlers.
  */
  const [items, setItems] =
    useState<QuoteItem[]>([
      emptyItem("item-1"),
    ]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  // =========================================================
  // LOAD INITIAL DATA
  // =========================================================

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setMessage("");

      try {
        // -----------------------------------------
        // Set current date only after mount
        // -----------------------------------------

        const today =
          new Date()
            .toISOString()
            .slice(0, 10);

        setQuotationDate(today);

        // Optional:
        // default validity = 30 days
        const validDate =
          new Date();

        validDate.setDate(
          validDate.getDate() + 30
        );

        setValidUntil(
          validDate
            .toISOString()
            .slice(0, 10)
        );

        // -----------------------------------------
        // User
        // -----------------------------------------

        const {
          data: { user },
          error: userError,
        } =
          await supabase.auth.getUser();

        if (
          userError ||
          !user
        ) {
          setMessage(
            "Please login first."
          );

          return;
        }

        // -----------------------------------------
        // Profile
        // -----------------------------------------

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .maybeSingle();

        if (
          profileError ||
          !profile?.company_id
        ) {
          setMessage(
            "Company profile not found."
          );

          return;
        }

        const currentCompanyId =
          profile.company_id;

        setCompanyId(
          currentCompanyId
        );

        // -----------------------------------------
        // Company defaults
        // -----------------------------------------

        const {
          data: company,
          error: companyError,
        } = await supabase
          .from("companies")
          .select(
            `
            default_currency,
            default_quote_template
            `
          )
          .eq(
            "id",
            currentCompanyId
          )
          .maybeSingle();

        if (companyError) {
          console.error(
            "Company defaults error:",
            companyError
          );
        }

        if (company) {
          setCurrency(
            company.default_currency ||
              "THB"
          );

          setTemplate(
            company.default_quote_template ||
              "classic"
          );
        }

        // -----------------------------------------
        // Customers
        // -----------------------------------------

        const {
          data: customerData,
          error: customerError,
        } = await supabase
          .from("customers")
          .select(
            `
            id,
            customer_name,
            customer_code,
            contact_name,
            phone,
            email
            `
          )
          .eq(
            "is_active",
            true
          )
          .order(
            "customer_name",
            {
              ascending: true,
            }
          );

        if (customerError) {
          console.error(
            "Customers error:",
            customerError
          );
        } else {
          setCustomers(
            customerData || []
          );
        }

        // -----------------------------------------
        // Products
        // -----------------------------------------

        const {
          data: productData,
          error: productError,
        } = await supabase
          .from("products")
          .select(
            `
            id,
            product_code,
            product_name,
            sku,
            selling_price,
            current_stock
            `
          )
          .eq(
            "is_active",
            true
          )
          .order(
            "product_name",
            {
              ascending: true,
            }
          );

        if (productError) {
          console.error(
            "Products error:",
            productError
          );
        } else {
          setProducts(
            productData || []
          );
        }
      } catch (error) {
        console.error(error);

        setMessage(
          "Could not load quotation data."
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // =========================================================
  // ITEM UPDATE
  // =========================================================

  function updateItem(
    key: string,
    field: keyof QuoteItem,
    value:
      | string
      | number
      | null
  ) {
    setItems((current) =>
      current.map((item) =>
        item.key === key
          ? {
              ...item,
              [field]:
                value,
            }
          : item
      )
    );
  }

  // =========================================================
  // SELECT PRODUCT
  // =========================================================

  function selectProduct(
    key: string,
    productId: string
  ) {
    if (!productId) {
      setItems((current) =>
        current.map(
          (item) =>
            item.key === key
              ? {
                  ...item,
                  product_id:
                    null,
                }
              : item
        )
      );

      return;
    }

    const product =
      products.find(
        (product) =>
          product.id ===
          Number(productId)
      );

    if (!product) {
      return;
    }

    setItems((current) =>
      current.map((item) =>
        item.key === key
          ? {
              ...item,

              product_id:
                product.id,

              description:
                product.product_name,

              unit_price:
                Number(
                  product.selling_price ||
                    0
                ),
            }
          : item
      )
    );
  }

  // =========================================================
  // ADD ITEM
  // =========================================================

  function addItem() {
    /*
      Event handler:
      randomUUID is safe here because it is caused by user action.
    */

    setItems((current) => [
      ...current,
      emptyItem(
        crypto.randomUUID()
      ),
    ]);
  }

  // =========================================================
  // REMOVE ITEM
  // =========================================================

  function removeItem(
    key: string
  ) {
    if (
      items.length === 1
    ) {
      return;
    }

    setItems((current) =>
      current.filter(
        (item) =>
          item.key !== key
      )
    );
  }

  // =========================================================
  // CALCULATIONS
  // =========================================================

  const calculatedItems =
    useMemo(() => {
      return items.map(
        (item) => {
          const qty =
            Number(
              item.qty || 0
            );

          const price =
            Number(
              item.unit_price ||
                0
            );

          const discountPercent =
            Number(
              item.discount_percent ||
                0
            );

          const taxPercent =
            Number(
              item.tax_percent ||
                0
            );

          const base =
            qty * price;

          const discount =
            base *
            (discountPercent /
              100);

          const afterDiscount =
            base - discount;

          const tax =
            afterDiscount *
            (taxPercent /
              100);

          const total =
            afterDiscount +
            tax;

          return {
            ...item,

            line_subtotal:
              base,

            discount_amount:
              discount,

            tax_amount:
              tax,

            line_total:
              total,
          };
        }
      );
    }, [items]);

  const subtotal =
    calculatedItems.reduce(
      (sum, item) =>
        sum +
        item.line_subtotal,
      0
    );

  const discountAmount =
    calculatedItems.reduce(
      (sum, item) =>
        sum +
        item.discount_amount,
      0
    );

  const taxAmount =
    calculatedItems.reduce(
      (sum, item) =>
        sum +
        item.tax_amount,
      0
    );

  const totalAmount =
    calculatedItems.reduce(
      (sum, item) =>
        sum +
        item.line_total,
      0
    );

  // =========================================================
  // SAVE
  // =========================================================

  async function handleSave(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!companyId) {
      setMessage(
        "Company not found."
      );

      return;
    }

    if (!customerId) {
      setMessage(
        "Please select a customer."
      );

      return;
    }

    if (!quotationDate) {
      setMessage(
        "Quotation date is required."
      );

      return;
    }

    const validItems =
      calculatedItems.filter(
        (item) =>
          item.description
            .trim() &&
          item.qty > 0
      );

    if (
      validItems.length ===
      0
    ) {
      setMessage(
        "Please add at least one quotation item."
      );

      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !user
      ) {
        setMessage(
          "Please login first."
        );

        return;
      }

      /*
        Date.now() is inside submit event handler,
        so it is safe from prerender blocking.
      */

      const quotationNo =
        `QT-${Date.now()}`;

      // -----------------------------------------
      // Insert quotation
      // -----------------------------------------

      const {
        data: quotation,
        error: quotationError,
      } = await supabase
        .from("quotations")
        .insert({
          company_id:
            companyId,

          customer_id:
            Number(customerId),

          quotation_no:
            quotationNo,

          quotation_date:
            quotationDate,

          valid_until:
            validUntil ||
            null,

          status:
            "draft",

          template_name:
            template,

          currency,

          subtotal,

          discount_amount:
            discountAmount,

          tax_amount:
            taxAmount,

          total_amount:
            totalAmount,

          notes:
            notes.trim() ||
            null,

          terms:
            terms.trim() ||
            null,

          created_by:
            user.id,
        })
        .select("id")
        .single();

      if (
        quotationError ||
        !quotation
      ) {
        setMessage(
          quotationError?.message ||
            "Could not create quotation."
        );

        return;
      }

      // -----------------------------------------
      // Insert quotation items
      // -----------------------------------------

      const itemRows =
        validItems.map(
          (
            item,
            index
          ) => ({
            quotation_id:
              quotation.id,

            product_id:
              item.product_id,

            description:
              item.description.trim(),

            qty:
              item.qty,

            unit_price:
              item.unit_price,

            discount_percent:
              item.discount_percent,

            tax_percent:
              item.tax_percent,

            line_subtotal:
              item.line_subtotal,

            discount_amount:
              item.discount_amount,

            tax_amount:
              item.tax_amount,

            line_total:
              item.line_total,

            sort_order:
              index,
          })
        );

      const {
        error: itemError,
      } = await supabase
        .from(
          "quotation_items"
        )
        .insert(itemRows);

      if (itemError) {
        setMessage(
          `Quotation created, but items failed: ${itemError.message}`
        );

        return;
      }

      router.push(
        `/quotations/${quotation.id}`
      );

      router.refresh();
    } catch (error) {
      console.error(error);

      setMessage(
        "Unexpected error while saving quotation."
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-sm text-gray-500">
        Loading quotation form...
      </div>
    );
  }

  // =========================================================
  // UI
  // =========================================================

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            New Quotation
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Create a professional quotation for your customer.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            router.push(
              "/quotations"
            )
          }
          className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>
      </div>

      <form
        onSubmit={
          handleSave
        }
      >
        <div className="grid gap-6 xl:grid-cols-3">
          {/* ================================================= */}
          {/* LEFT */}
          {/* ================================================= */}

          <div className="space-y-6 xl:col-span-2">
            {/* QUOTATION DETAILS */}

            <Section
              title="Quotation Details"
              description="Customer and quotation information."
            >
              <div className="grid gap-5 md:grid-cols-2">
                {/* CUSTOMER */}

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Customer
                    <span className="ml-1 text-red-500">
                      *
                    </span>
                  </label>

                  <select
                    value={
                      customerId
                    }
                    onChange={(
                      e
                    ) =>
                      setCustomerId(
                        e.target
                          .value
                      )
                    }
                    required
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
                  >
                    <option value="">
                      Select customer...
                    </option>

                    {customers.map(
                      (
                        customer
                      ) => (
                        <option
                          key={
                            customer.id
                          }
                          value={
                            customer.id
                          }
                        >
                          {
                            customer.customer_name
                          }
                          {customer.customer_code
                            ? ` — ${customer.customer_code}`
                            : ""}
                        </option>
                      )
                    )}
                  </select>

                  {customers.length ===
                    0 && (
                    <p className="mt-2 text-xs text-amber-600">
                      No active customers found. Add or activate a customer first.
                    </p>
                  )}
                </div>

                <Field
                  label="Quotation Date"
                  type="date"
                  value={
                    quotationDate
                  }
                  onChange={
                    setQuotationDate
                  }
                />

                <Field
                  label="Valid Until"
                  type="date"
                  value={
                    validUntil
                  }
                  onChange={
                    setValidUntil
                  }
                />
              </div>
            </Section>

            {/* QUOTATION ITEMS */}

            <Section
              title="Quotation Items"
              description="Add products, quantity, price, discount and tax."
            >
              <div className="space-y-4">
                {items.map(
                  (
                    item,
                    index
                  ) => {
                    const calculated =
                      calculatedItems.find(
                        (
                          row
                        ) =>
                          row.key ===
                          item.key
                      );

                    const selectedProduct =
                      products.find(
                        (
                          product
                        ) =>
                          product.id ===
                          item.product_id
                      );

                    return (
                      <div
                        key={
                          item.key
                        }
                        className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                      >
                        {/* ITEM HEADER */}

                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              Item{" "}
                              {index +
                                1}
                            </div>

                            {selectedProduct && (
                              <div className="mt-1 text-xs text-gray-500">
                                Stock:{" "}
                                {Number(
                                  selectedProduct.current_stock ||
                                    0
                                )}
                              </div>
                            )}
                          </div>

                          {items.length >
                            1 && (
                            <button
                              type="button"
                              onClick={() =>
                                removeItem(
                                  item.key
                                )
                              }
                              className="text-xs font-medium text-red-600 hover:text-red-700"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        {/* ITEM FIELDS */}

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          {/* PRODUCT */}

                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                              Product
                            </label>

                            <select
                              value={
                                item.product_id
                                  ? String(
                                      item.product_id
                                    )
                                  : ""
                              }
                              onChange={(
                                e
                              ) =>
                                selectProduct(
                                  item.key,
                                  e
                                    .target
                                    .value
                                )
                              }
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
                            >
                              <option value="">
                                Custom item / select product...
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
                                    }
                                    {product.product_code
                                      ? ` — ${product.product_code}`
                                      : ""}
                                  </option>
                                )
                              )}
                            </select>
                          </div>

                          {/* DESCRIPTION */}

                          <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700">
                              Description
                            </label>

                            <input
                              value={
                                item.description
                              }
                              onChange={(
                                e
                              ) =>
                                updateItem(
                                  item.key,
                                  "description",
                                  e
                                    .target
                                    .value
                                )
                              }
                              placeholder="Item description"
                              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
                            />
                          </div>

                          <NumberField
                            label="Quantity"
                            value={
                              item.qty
                            }
                            step="0.001"
                            onChange={(
                              value
                            ) =>
                              updateItem(
                                item.key,
                                "qty",
                                value
                              )
                            }
                          />

                          <NumberField
                            label={`Unit Price (${currency})`}
                            value={
                              item.unit_price
                            }
                            step="0.01"
                            onChange={(
                              value
                            ) =>
                              updateItem(
                                item.key,
                                "unit_price",
                                value
                              )
                            }
                          />

                          <NumberField
                            label="Discount %"
                            value={
                              item.discount_percent
                            }
                            step="0.01"
                            max={100}
                            onChange={(
                              value
                            ) =>
                              updateItem(
                                item.key,
                                "discount_percent",
                                value
                              )
                            }
                          />

                          <NumberField
                            label="Tax %"
                            value={
                              item.tax_percent
                            }
                            step="0.01"
                            onChange={(
                              value
                            ) =>
                              updateItem(
                                item.key,
                                "tax_percent",
                                value
                              )
                            }
                          />
                        </div>

                        {/* LINE SUMMARY */}

                        <div className="mt-4 grid gap-3 border-t border-gray-200 pt-4 sm:grid-cols-4">
                          <SmallMetric
                            label="Subtotal"
                            value={`${currencySymbol(
                              currency
                            )}${Number(
                              calculated?.line_subtotal ||
                                0
                            ).toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 2,
                              }
                            )}`}
                          />

                          <SmallMetric
                            label="Discount"
                            value={`${currencySymbol(
                              currency
                            )}${Number(
                              calculated?.discount_amount ||
                                0
                            ).toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 2,
                              }
                            )}`}
                          />

                          <SmallMetric
                            label="Tax"
                            value={`${currencySymbol(
                              currency
                            )}${Number(
                              calculated?.tax_amount ||
                                0
                            ).toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 2,
                              }
                            )}`}
                          />

                          <SmallMetric
                            label="Line Total"
                            value={`${currencySymbol(
                              currency
                            )}${Number(
                              calculated?.line_total ||
                                0
                            ).toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 2,
                              }
                            )}`}
                            strong
                          />
                        </div>
                      </div>
                    );
                  }
                )}

                <button
                  type="button"
                  onClick={
                    addItem
                  }
                  className="w-full rounded-lg border border-dashed border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50"
                >
                  + Add Item
                </button>
              </div>
            </Section>

            {/* NOTES */}

            <Section
              title="Notes & Terms"
              description="Optional information that will appear on the quotation."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Notes
                  </label>

                  <textarea
                    value={
                      notes
                    }
                    onChange={(
                      e
                    ) =>
                      setNotes(
                        e.target
                          .value
                      )
                    }
                    rows={5}
                    placeholder="Thank you for your business..."
                    className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Terms & Conditions
                  </label>

                  <textarea
                    value={
                      terms
                    }
                    onChange={(
                      e
                    ) =>
                      setTerms(
                        e.target
                          .value
                      )
                    }
                    rows={5}
                    placeholder="Payment terms, delivery terms, validity..."
                    className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
                  />
                </div>
              </div>
            </Section>
          </div>

          {/* ================================================= */}
          {/* RIGHT */}
          {/* ================================================= */}

          <div className="space-y-6">
            {/* TOTALS */}

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900">
                Quotation Summary
              </h3>

              <div className="mt-5 space-y-4">
                <Metric
                  label="Subtotal"
                  value={`${currencySymbol(
                    currency
                  )}${subtotal.toLocaleString(
                    undefined,
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}`}
                />

                <Metric
                  label="Discount"
                  value={`-${currencySymbol(
                    currency
                  )}${discountAmount.toLocaleString(
                    undefined,
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}`}
                />

                <Metric
                  label="Tax"
                  value={`${currencySymbol(
                    currency
                  )}${taxAmount.toLocaleString(
                    undefined,
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}`}
                />

                <div className="border-t border-gray-200 pt-4">
                  <Metric
                    label="Grand Total"
                    value={`${currencySymbol(
                      currency
                    )}${totalAmount.toLocaleString(
                      undefined,
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }
                    )}`}
                    strong
                  />
                </div>
              </div>
            </div>

            {/* CURRENCY */}

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900">
                Currency
              </h3>

              <p className="mt-1 text-xs text-gray-500">
                Defaults from Company Settings.
              </p>

              <select
                value={
                  currency
                }
                onChange={(
                  e
                ) =>
                  setCurrency(
                    e.target.value
                  )
                }
                className="mt-4 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none"
              >
                <option value="THB">
                  THB — Thai Baht
                </option>

                <option value="MMK">
                  MMK — Myanmar Kyat
                </option>

                <option value="USD">
                  USD — US Dollar
                </option>

                <option value="SGD">
                  SGD — Singapore Dollar
                </option>

                <option value="EUR">
                  EUR — Euro
                </option>
              </select>
            </div>

            {/* TEMPLATE */}

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900">
                Quotation Template
              </h3>

              <p className="mt-1 text-xs text-gray-500">
                Choose the design for this quotation.
              </p>

              <div className="mt-4 space-y-3">
                <TemplateOption
                  title="Classic Corporate"
                  description="Traditional professional B2B quotation."
                  selected={
                    template ===
                    "classic"
                  }
                  onClick={() =>
                    setTemplate(
                      "classic"
                    )
                  }
                />

                <TemplateOption
                  title="Modern Minimal"
                  description="Clean premium layout with modern spacing."
                  selected={
                    template ===
                    "modern"
                  }
                  onClick={() =>
                    setTemplate(
                      "modern"
                    )
                  }
                />

                <TemplateOption
                  title="Retail / Commercial"
                  description="Bold commercial layout for product quotes."
                  selected={
                    template ===
                    "commercial"
                  }
                  onClick={() =>
                    setTemplate(
                      "commercial"
                    )
                  }
                />
              </div>
            </div>

            {/* STATUS */}

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900">
                Status
              </h3>

              <div className="mt-4">
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                  Draft
                </span>
              </div>

              <p className="mt-3 text-xs leading-5 text-gray-500">
                New quotations are saved as drafts. You can mark them as sent or accepted later.
              </p>
            </div>
          </div>
        </div>

        {/* ERROR */}

        {message && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        )}

        {/* ACTIONS */}

        <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-6">
          <button
            type="button"
            disabled={
              saving
            }
            onClick={() =>
              router.push(
                "/quotations"
              )
            }
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={
              saving
            }
            className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving Quotation..."
              : "Save Quotation"}
          </button>
        </div>
      </form>
    </div>
  );
}

// =========================================================
// COMPONENTS
// =========================================================

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
  type,
  value,
  onChange,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = "0.01",
  max,
}: {
  label: string;
  value: number;
  onChange: (
    value: number
  ) => void;
  step?: string;
  max?: number;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>

      <input
        type="number"
        min="0"
        max={
          max
        }
        step={
          step
        }
        value={
          value
        }
        onChange={(e) =>
          onChange(
            Number(
              e.target.value ||
                0
            )
          )
        }
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
      />
    </div>
  );
}

function Metric({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
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
            ? "text-xl font-semibold text-gray-900"
            : "font-medium text-gray-900"
        }
      >
        {value}
      </span>
    </div>
  );
}

function SmallMetric({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-gray-400">
        {label}
      </div>

      <div
        className={`mt-1 text-sm ${
          strong
            ? "font-semibold text-gray-900"
            : "font-medium text-gray-700"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function TemplateOption({
  title,
  description,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`w-full rounded-lg border p-3 text-left transition ${
        selected
          ? "border-gray-900 bg-gray-50 ring-1 ring-gray-900"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-gray-900">
          {title}
        </div>

        {selected && (
          <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[9px] font-medium text-white">
            Selected
          </span>
        )}
      </div>

      <p className="mt-1 text-xs leading-5 text-gray-500">
        {description}
      </p>
    </button>
  );
}

function currencySymbol(
  currency: string
) {
  if (
    currency === "MMK"
  ) {
    return "K ";
  }

  if (
    currency === "USD"
  ) {
    return "$";
  }

  if (
    currency === "EUR"
  ) {
    return "€";
  }

  if (
    currency === "SGD"
  ) {
    return "S$";
  }

  return "฿";
}