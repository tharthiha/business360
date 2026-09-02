"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: number;
  customer_name: string;
};

type Product = {
  id: number;
  product_name: string;
  selling_price: number;
};

type QuotationItem = {
  id?: number;
  product_id: number | null;
  description: string;
  qty: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
};

type Quotation = {
  id: number;
  customer_id: number;
  quotation_no: string;
  quotation_date: string;
  valid_until: string | null;
  status: string;
  template_name: string;
  currency: string;
  notes: string | null;
  terms: string | null;
};

export default function EditQuotationClient({
  id,
}: {
  id: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [quotation, setQuotation] =
    useState<Quotation | null>(null);

  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [items, setItems] =
    useState<QuotationItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [customerId, setCustomerId] =
    useState("");

  const [quotationDate, setQuotationDate] =
    useState("");

  const [validUntil, setValidUntil] =
    useState("");

  const [currency, setCurrency] =
    useState("THB");

  const [templateName, setTemplateName] =
    useState("classic");

  const [notes, setNotes] =
    useState("");

  const [terms, setTerms] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const quotationId = Number(id);

        if (!Number.isFinite(quotationId)) {
          throw new Error("Invalid quotation ID.");
        }

        const [
          quotationResult,
          customerResult,
          productResult,
          itemResult,
        ] = await Promise.all([
          supabase
            .from("quotations")
            .select(`
              id,
              customer_id,
              quotation_no,
              quotation_date,
              valid_until,
              status,
              template_name,
              currency,
              notes,
              terms
            `)
            .eq("id", quotationId)
            .maybeSingle(),

          supabase
            .from("customers")
            .select("id, customer_name")
            .eq("is_active", true)
            .order("customer_name"),

          supabase
            .from("products")
            .select("id, product_name, selling_price")
            .eq("is_active", true)
            .order("product_name"),

          supabase
            .from("quotation_items")
            .select(`
              id,
              product_id,
              description,
              qty,
              unit_price,
              discount_percent,
              tax_percent
            `)
            .eq("quotation_id", quotationId)
            .order("sort_order", {
              ascending: true,
            }),
        ]);

        if (quotationResult.error) {
          throw quotationResult.error;
        }

        if (!quotationResult.data) {
          throw new Error("Quotation not found.");
        }

        if (customerResult.error) {
          throw customerResult.error;
        }

        if (productResult.error) {
          throw productResult.error;
        }

        if (itemResult.error) {
          throw itemResult.error;
        }

        if (cancelled) return;

        const q =
          quotationResult.data as Quotation;

        setQuotation(q);

        setCustomerId(
          String(q.customer_id)
        );

        setQuotationDate(
          q.quotation_date
        );

        setValidUntil(
          q.valid_until || ""
        );

        setCurrency(
          q.currency || "THB"
        );

        setTemplateName(
          q.template_name || "classic"
        );

        setNotes(
          q.notes || ""
        );

        setTerms(
          q.terms || ""
        );

        setCustomers(
          (customerResult.data ||
            []) as Customer[]
        );

        setProducts(
          (productResult.data ||
            []) as Product[]
        );

        setItems(
          (
            itemResult.data ||
            []
          ).map((item) => ({
            id: item.id,
            product_id:
              item.product_id,
            description:
              item.description,
            qty:
              Number(item.qty) ||
              1,
            unit_price:
              Number(
                item.unit_price
              ) || 0,
            discount_percent:
              Number(
                item.discount_percent
              ) || 0,
            tax_percent:
              Number(
                item.tax_percent
              ) || 0,
          }))
        );
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load quotation."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const totals = useMemo(() => {
    let subtotal = 0;
    let discountAmount = 0;
    let taxAmount = 0;
    let totalAmount = 0;

    for (const item of items) {
      const qty =
        Number(item.qty) || 0;

      const price =
        Number(
          item.unit_price
        ) || 0;

      const discount =
        Number(
          item.discount_percent
        ) || 0;

      const tax =
        Number(
          item.tax_percent
        ) || 0;

      const lineBase =
        qty * price;

      const lineDiscount =
        lineBase *
        (discount / 100);

      const afterDiscount =
        lineBase -
        lineDiscount;

      const lineTax =
        afterDiscount *
        (tax / 100);

      const lineTotal =
        afterDiscount +
        lineTax;

      subtotal += lineBase;
      discountAmount +=
        lineDiscount;
      taxAmount +=
        lineTax;
      totalAmount +=
        lineTotal;
    }

    return {
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
    };
  }, [items]);

  function updateItem(
    index: number,
    field:
      | "product_id"
      | "description"
      | "qty"
      | "unit_price"
      | "discount_percent"
      | "tax_percent",
    value:
      | string
      | number
      | null
  ) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  function handleProductChange(
    index: number,
    value: string
  ) {
    if (!value) {
      updateItem(
        index,
        "product_id",
        null
      );

      return;
    }

    const productId =
      Number(value);

    const product =
      products.find(
        (p) =>
          p.id === productId
      );

    if (!product) return;

    setItems((current) =>
      current.map(
        (item, itemIndex) =>
          itemIndex === index
            ? {
                ...item,
                product_id:
                  product.id,
                description:
                  product.product_name,
                unit_price:
                  Number(
                    product.selling_price
                  ) || 0,
              }
            : item
      )
    );
  }

  function addItem() {
    setItems((current) => [
      ...current,
      {
        product_id: null,
        description: "",
        qty: 1,
        unit_price: 0,
        discount_percent: 0,
        tax_percent: 0,
      },
    ]);
  }

  function removeItem(
    index: number
  ) {
    setItems((current) =>
      current.filter(
        (_, itemIndex) =>
          itemIndex !== index
      )
    );
  }

  async function handleSave() {
    if (!quotation) return;

    setError("");

    if (!customerId) {
      setError(
        "Please select a customer."
      );

      return;
    }

    if (!quotationDate) {
      setError(
        "Quotation date is required."
      );

      return;
    }

    if (items.length === 0) {
      setError(
        "Please add at least one quotation item."
      );

      return;
    }

    const invalidItem =
      items.find(
        (item) =>
          !item.description.trim() ||
          Number(item.qty) <= 0
      );

    if (invalidItem) {
      setError(
        "Each item needs a description and quantity greater than 0."
      );

      return;
    }

    setSaving(true);

    try {
      const {
        error: quotationError,
      } = await supabase
        .from("quotations")
        .update({
          customer_id:
            Number(customerId),
          quotation_date:
            quotationDate,
          valid_until:
            validUntil || null,
          currency,
          template_name:
            templateName,
          notes:
            notes || null,
          terms:
            terms || null,
          subtotal:
            totals.subtotal,
          discount_amount:
            totals.discountAmount,
          tax_amount:
            totals.taxAmount,
          total_amount:
            totals.totalAmount,
        })
        .eq(
          "id",
          quotation.id
        );

      if (quotationError) {
        throw quotationError;
      }

      const {
        error: deleteError,
      } = await supabase
        .from("quotation_items")
        .delete()
        .eq(
          "quotation_id",
          quotation.id
        );

      if (deleteError) {
        throw deleteError;
      }

      const rows = items.map(
        (item, index) => {
          const qty =
            Number(item.qty) ||
            0;

          const unitPrice =
            Number(
              item.unit_price
            ) || 0;

          const discountPercent =
            Number(
              item.discount_percent
            ) || 0;

          const taxPercent =
            Number(
              item.tax_percent
            ) || 0;

          const lineSubtotal =
            qty * unitPrice;

          const discountAmount =
            lineSubtotal *
            (discountPercent /
              100);

          const afterDiscount =
            lineSubtotal -
            discountAmount;

          const taxAmount =
            afterDiscount *
            (taxPercent / 100);

          const lineTotal =
            afterDiscount +
            taxAmount;

          return {
            quotation_id:
              quotation.id,
            product_id:
              item.product_id,
            description:
              item.description.trim(),
            qty,
            unit_price:
              unitPrice,
            discount_percent:
              discountPercent,
            tax_percent:
              taxPercent,
            line_subtotal:
              lineSubtotal,
            discount_amount:
              discountAmount,
            tax_amount:
              taxAmount,
            line_total:
              lineTotal,
            sort_order:
              index + 1,
          };
        }
      );

      const {
        error: insertError,
      } = await supabase
        .from("quotation_items")
        .insert(rows);

      if (insertError) {
        throw insertError;
      }

      router.push(
        `/quotations/${quotation.id}`
      );

      router.refresh();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not save quotation."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[350px] items-center justify-center">
        <span className="text-sm text-gray-500">
          Loading quotation...
        </span>
      </div>
    );
  }

  if (
    error &&
    !quotation
  ) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!quotation) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Edit Quotation
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            {quotation.quotation_no}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            router.push(
              `/quotations/${quotation.id}`
            )
          }
          className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* BASIC DETAILS */}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">
            Quotation Details
          </h2>
        </div>

        <div className="grid gap-5 p-6 md:grid-cols-2">
          <Field label="Customer">
            <select
              value={customerId}
              onChange={(event) =>
                setCustomerId(
                  event.target.value
                )
              }
              className={inputClass}
            >
              <option value="">
                Select customer
              </option>

              {customers.map(
                (customer) => (
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
                  </option>
                )
              )}
            </select>
          </Field>

          <Field label="Currency">
            <select
              value={currency}
              onChange={(event) =>
                setCurrency(
                  event.target.value
                )
              }
              className={inputClass}
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
          </Field>

          <Field label="Quotation Date">
            <input
              type="date"
              value={quotationDate}
              onChange={(event) =>
                setQuotationDate(
                  event.target.value
                )
              }
              className={inputClass}
            />
          </Field>

          <Field label="Valid Until">
            <input
              type="date"
              value={validUntil}
              onChange={(event) =>
                setValidUntil(
                  event.target.value
                )
              }
              className={inputClass}
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="Quotation Template">
              <select
                value={templateName}
                onChange={(event) =>
                  setTemplateName(
                    event.target.value
                  )
                }
                className={inputClass}
              >
                <option value="classic">
                  Classic Corporate
                </option>

                <option value="modern">
                  Modern Minimal
                </option>

                <option value="commercial">
                  Retail / Commercial
                </option>
              </select>
            </Field>
          </div>
        </div>
      </div>

      {/* ITEMS */}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="font-semibold text-gray-900">
              Quotation Items
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Edit products, quantity, prices, discount and tax.
            </p>
          </div>

          <button
            type="button"
            onClick={addItem}
            className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-black"
          >
            + Add Item
          </button>
        </div>

        <div className="space-y-4 p-6">
          {items.map(
            (item, index) => (
              <div
                key={
                  item.id ??
                  `new-${index}`
                }
                className="rounded-xl border border-gray-200 bg-gray-50 p-4"
              >
                <div className="grid gap-4 lg:grid-cols-12">
                  <div className="lg:col-span-3">
                    <Field label="Product">
                      <select
                        value={
                          item.product_id ??
                          ""
                        }
                        onChange={(event) =>
                          handleProductChange(
                            index,
                            event.target.value
                          )
                        }
                        className={inputClass}
                      >
                        <option value="">
                          Custom item
                        </option>

                        {products.map(
                          (product) => (
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
                            </option>
                          )
                        )}
                      </select>
                    </Field>
                  </div>

                  <div className="lg:col-span-3">
                    <Field label="Description">
                      <input
                        value={
                          item.description
                        }
                        onChange={(event) =>
                          updateItem(
                            index,
                            "description",
                            event.target.value
                          )
                        }
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  <div className="lg:col-span-1">
                    <Field label="Qty">
                      <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={
                          item.qty
                        }
                        onChange={(event) =>
                          updateItem(
                            index,
                            "qty",
                            Number(
                              event.target.value
                            )
                          )
                        }
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  <div className="lg:col-span-2">
                    <Field label="Unit Price">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          item.unit_price
                        }
                        onChange={(event) =>
                          updateItem(
                            index,
                            "unit_price",
                            Number(
                              event.target.value
                            )
                          )
                        }
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  <div className="lg:col-span-1">
                    <Field label="Disc %">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          item.discount_percent
                        }
                        onChange={(event) =>
                          updateItem(
                            index,
                            "discount_percent",
                            Number(
                              event.target.value
                            )
                          )
                        }
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  <div className="lg:col-span-1">
                    <Field label="Tax %">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          item.tax_percent
                        }
                        onChange={(event) =>
                          updateItem(
                            index,
                            "tax_percent",
                            Number(
                              event.target.value
                            )
                          )
                        }
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  <div className="flex items-end lg:col-span-1">
                    <button
                      type="button"
                      onClick={() =>
                        removeItem(
                          index
                        )
                      }
                      className="w-full rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="mt-3 text-right text-sm text-gray-500">
                  Line Total:{" "}
                  <span className="font-semibold text-gray-900">
                    {money(
                      calculateLineTotal(
                        item
                      ),
                      currency
                    )}
                  </span>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* NOTES */}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <Field label="Notes">
            <textarea
              rows={6}
              value={notes}
              onChange={(event) =>
                setNotes(
                  event.target.value
                )
              }
              className={inputClass}
              placeholder="Optional notes..."
            />
          </Field>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <Field label="Terms & Conditions">
            <textarea
              rows={6}
              value={terms}
              onChange={(event) =>
                setTerms(
                  event.target.value
                )
              }
              className={inputClass}
              placeholder="Payment terms, delivery terms..."
            />
          </Field>
        </div>
      </div>

      {/* TOTALS */}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="ml-auto w-full max-w-md space-y-4">
          <TotalRow
            label="Subtotal"
            value={money(
              totals.subtotal,
              currency
            )}
          />

          <TotalRow
            label="Discount"
            value={`-${money(
              totals.discountAmount,
              currency
            )}`}
          />

          <TotalRow
            label="Tax"
            value={money(
              totals.taxAmount,
              currency
            )}
          />

          <div className="border-t border-gray-200 pt-4">
            <TotalRow
              label="Grand Total"
              value={money(
                totals.totalAmount,
                currency
              )}
              strong
            />
          </div>
        </div>
      </div>

      {/* SAVE */}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() =>
            router.push(
              `/quotations/${quotation.id}`
            )
          }
          className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="rounded-lg bg-gray-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-400";

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

function TotalRow({
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
            ? "text-xl font-semibold text-gray-900"
            : "font-medium text-gray-900"
        }
      >
        {value}
      </span>
    </div>
  );
}

function calculateLineTotal(
  item: QuotationItem
) {
  const qty =
    Number(item.qty) || 0;

  const price =
    Number(item.unit_price) || 0;

  const discount =
    Number(
      item.discount_percent
    ) || 0;

  const tax =
    Number(
      item.tax_percent
    ) || 0;

  const subtotal =
    qty * price;

  const discountAmount =
    subtotal *
    (discount / 100);

  const afterDiscount =
    subtotal -
    discountAmount;

  const taxAmount =
    afterDiscount *
    (tax / 100);

  return (
    afterDiscount +
    taxAmount
  );
}

function money(
  value: number,
  currency: string
) {
  return `${currencySymbol(
    currency
  )}${Number(
    value || 0
  ).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function currencySymbol(
  currency: string
) {
  if (currency === "MMK") {
    return "K ";
  }

  if (currency === "USD") {
    return "$";
  }

  if (currency === "EUR") {
    return "€";
  }

  if (currency === "SGD") {
    return "S$";
  }

  return "฿";
}