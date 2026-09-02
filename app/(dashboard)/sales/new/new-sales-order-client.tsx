"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: number;
  customer_name: string;
};

type Product = {
  id: number;
  product_name: string;
  product_code: string | null;
  selling_price: number;
  current_stock: number;
};

type PeriodStatus = "open" | "closed" | "reopened";

type OrderItem = {
  key: string;
  product_id: string;
  description: string;
  qty: string;
  unit_price: string;
  discount_percent: string;
  tax_percent: string;
};

export default function NewSalesOrderClient() {
  const router = useRouter();
  const supabase = createClient();

  const [customers, setCustomers] =
    useState<Customer[]>([]);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [companyId, setCompanyId] =
    useState<number | null>(null);

  const [periodStatus, setPeriodStatus] =
    useState<PeriodStatus>("open");

  const [periodClosedAt, setPeriodClosedAt] =
    useState<string | null>(null);

  const [checkingPeriod, setCheckingPeriod] =
    useState(false);

  const [customerId, setCustomerId] =
    useState("");

  const [orderDate, setOrderDate] =
    useState(
      new Date()
        .toISOString()
        .slice(0, 10)
    );

  const [orderSource, setOrderSource] =
    useState("messenger");

  const [
    sourceReference,
    setSourceReference,
  ] = useState("");

  const [currency, setCurrency] =
    useState("THB");

  const [notes, setNotes] =
    useState("");

  const [terms, setTerms] =
    useState("");

  const [items, setItems] =
    useState<OrderItem[]>([
      emptyItem(),
    ]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!companyId || !orderDate) return;
    checkPeriod(companyId, orderDate);
  }, [companyId, orderDate]);

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error(authError?.message || "Please login first.");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", authData.user.id)
        .single();
      if (profileError || !profile?.company_id) throw new Error(profileError?.message || "Company profile not found.");
      const resolvedCompanyId = Number(profile.company_id);
      setCompanyId(resolvedCompanyId);

      const [
        customerResult,
        productResult,
      ] = await Promise.all([
        supabase
          .from("customers")
          .select(
            "id, customer_name"
          )
          .eq("is_active", true)
          .order("customer_name"),

        supabase
          .from("products")
          .select(`
            id,
            product_name,
            product_code,
            selling_price,
            current_stock
          `)
          .eq("is_active", true)
          .order("product_name"),
      ]);

      if (customerResult.error) {
        throw customerResult.error;
      }

      if (productResult.error) {
        throw productResult.error;
      }

      setCustomers(
        (customerResult.data ||
          []) as Customer[]
      );

      setProducts(
        (productResult.data ||
          []).map(
          (row: any) => ({
            id: row.id,
            product_name:
              row.product_name,
            product_code:
              row.product_code,
            selling_price:
              Number(
                row.selling_price ||
                  0
              ),
            current_stock:
              Number(
                row.current_stock ||
                  0
              ),
          })
        )
      );

      await checkPeriod(resolvedCompanyId, orderDate);
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load form data."
      );
    } finally {
      setLoading(false);
    }
  }

  async function checkPeriod(targetCompanyId: number, targetDate: string) {
    if (!targetCompanyId || !targetDate) { setPeriodStatus("open"); setPeriodClosedAt(null); return; }
    setCheckingPeriod(true);
    try {
      const { data, error } = await supabase.from("accounting_period_closes")
        .select("status, closed_at")
        .eq("company_id", targetCompanyId)
        .eq("period_start", firstDayOfDate(targetDate))
        .maybeSingle();
      if (error) throw error;
      setPeriodStatus(data?.status === "closed" ? "closed" : data?.status === "reopened" ? "reopened" : "open");
      setPeriodClosedAt(data?.closed_at || null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not check accounting period.");
    } finally { setCheckingPeriod(false); }
  }

  function addItem() {
    setItems(
      (current) => [
        ...current,
        emptyItem(),
      ]
    );
  }

  function removeItem(
    key: string
  ) {
    setItems(
      (current) => {
        if (
          current.length === 1
        ) {
          return current;
        }

        return current.filter(
          (item) =>
            item.key !== key
        );
      }
    );
  }

  function updateItem(
    key: string,
    field: keyof OrderItem,
    value: string
  ) {
    setItems(
      (current) =>
        current.map(
          (item) => {
            if (
              item.key !== key
            ) {
              return item;
            }

            return {
              ...item,
              [field]:
                value,
            };
          }
        )
    );
  }

  function chooseProduct(
    key: string,
    productId: string
  ) {
    const product =
      products.find(
        (item) =>
          String(item.id) ===
          productId
      );

    if (
      product &&
      product.current_stock <= 0
    ) {
      setMessage(
        `${product.product_name} is out of stock.`
      );
      return;
    }

    setMessage("");

    setItems(
      (current) =>
        current.map(
          (item) => {
            if (
              item.key !== key
            ) {
              return item;
            }

            if (!product) {
              return {
                ...item,
                product_id: "",
                description: "",
                unit_price: "",
              };
            }

            return {
              ...item,
              product_id:
                String(
                  product.id
                ),
              description:
                product.product_name,
              unit_price:
                String(
                  product.selling_price
                ),
            };
          }
        )
    );
  }

  const calculations =
    useMemo(() => {
      let subtotal = 0;
      let discountAmount = 0;
      let taxAmount = 0;
      let total = 0;

      const rows =
        items.map((item) => {
          const qty =
            Number(
              item.qty || 0
            );

          const unitPrice =
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

          const lineSubtotal =
            qty * unitPrice;

          const lineDiscount =
            lineSubtotal *
            (discountPercent /
              100);

          const taxable =
            lineSubtotal -
            lineDiscount;

          const lineTax =
            taxable *
            (taxPercent /
              100);

          const lineTotal =
            taxable +
            lineTax;

          subtotal +=
            lineSubtotal;

          discountAmount +=
            lineDiscount;

          taxAmount +=
            lineTax;

          total +=
            lineTotal;

          return {
            ...item,
            line_subtotal:
              lineSubtotal,
            discount_amount:
              lineDiscount,
            tax_amount:
              lineTax,
            line_total:
              lineTotal,
          };
        });

      return {
        rows,
        subtotal,
        discountAmount,
        taxAmount,
        total,
      };
    }, [items]);

  async function createOrder(
    status:
      | "draft"
      | "confirmed"
  ) {
    if (saving) {
      return;
    }

    setMessage("");

    if (checkingPeriod) { setMessage("Please wait while the selected accounting period is checked."); return; }
    if (periodStatus === "closed") {
      setMessage("The selected order date belongs to a closed accounting period. Change the date or reopen that month from Reports → Month-End Close.");
      return;
    }

    if (!customerId) {
      setMessage(
        "Please select a customer."
      );
      return;
    }

    const validItems =
      calculations.rows.filter(
        (item) =>
          item.product_id &&
          Number(item.qty) > 0 &&
          Number(
            item.unit_price
          ) >= 0
      );

    if (
      validItems.length === 0
    ) {
      setMessage(
        "Please add at least one valid product."
      );
      return;
    }

    /*
      DUPLICATE PRODUCT CHECK
    */

    const productIds =
      validItems.map(
        (item) =>
          item.product_id
      );

    const duplicateProductId =
      productIds.find(
        (productId, index) =>
          productIds.indexOf(
            productId
          ) !== index
      );

    if (
      duplicateProductId
    ) {
      const duplicateProduct =
        products.find(
          (product) =>
            String(
              product.id
            ) ===
            duplicateProductId
        );

      setMessage(
        `${
          duplicateProduct
            ?.product_name ||
          "The same product"
        } cannot be added more than once.`
      );

      return;
    }

    /*
      STOCK VALIDATION
    */

    for (
      const item of validItems
    ) {
      const product =
        products.find(
          (product) =>
            String(
              product.id
            ) ===
            item.product_id
        );

      if (!product) {
        setMessage(
          `Product not found: ${item.description}`
        );
        return;
      }

      const qty =
        Number(
          item.qty
        );

      if (
        product.current_stock <=
        0
      ) {
        setMessage(
          `${product.product_name} is out of stock.`
        );
        return;
      }

      if (
        qty >
        product.current_stock
      ) {
        setMessage(
          `${product.product_name} only has ${formatQty(
            product.current_stock
          )} in stock. Requested quantity: ${formatQty(
            qty
          )}.`
        );
        return;
      }
    }

    setSaving(true);

    try {
      /*
        GET USER
      */

      const {
        data: {
          user,
        },
        error:
          userError,
      } =
        await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "Please login first."
        );
      }

      /*
        GET COMPANY
      */

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("company_id")
        .eq(
          "id",
          user.id
        )
        .single();

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

      const { data: closeData, error: closeError } = await supabase
        .from("accounting_period_closes")
        .select("status")
        .eq("company_id", Number(profile.company_id))
        .eq("period_start", firstDayOfDate(orderDate))
        .maybeSingle();
      if (closeError) throw closeError;
      if (closeData?.status === "closed") {
        setPeriodStatus("closed");
        throw new Error("The selected order date is now in a closed accounting period. Reopen the month or choose another date.");
      }

      /*
        FINAL STOCK REFRESH

        Important:
        stock may have changed since
        page was opened.
      */

      const selectedProductIds =
        validItems.map(
          (item) =>
            Number(
              item.product_id
            )
        );

      const {
        data:
          freshProductRows,
        error:
          freshProductError,
      } = await supabase
        .from("products")
        .select(`
          id,
          product_name,
          current_stock
        `)
        .in(
          "id",
          selectedProductIds
        );

      if (
        freshProductError
      ) {
        throw freshProductError;
      }

      for (
        const item of validItems
      ) {
        const freshProduct =
          (
            freshProductRows ||
            []
          ).find(
            (product) =>
              Number(
                product.id
              ) ===
              Number(
                item.product_id
              )
          );

        if (!freshProduct) {
          throw new Error(
            `Product not found: ${item.description}`
          );
        }

        const availableStock =
          Number(
            freshProduct.current_stock ||
              0
          );

        const requestedQty =
          Number(
            item.qty
          );

        if (
          availableStock <=
          0
        ) {
          throw new Error(
            `${freshProduct.product_name} is now out of stock.`
          );
        }

        if (
          requestedQty >
          availableStock
        ) {
          throw new Error(
            `${freshProduct.product_name} now only has ${formatQty(
              availableStock
            )} in stock. Requested quantity: ${formatQty(
              requestedQty
            )}.`
          );
        }
      }

      /*
        CREATE SALES ORDER
      */

      const salesOrderNo =
        `SO-${Date.now()}`;

      const {
        data: order,
        error: orderError,
      } = await supabase
        .from("sales_orders")
        .insert({
          company_id:
            profile.company_id,

          customer_id:
            Number(
              customerId
            ),

          quotation_id:
            null,

          sales_order_no:
            salesOrderNo,

          order_date:
            orderDate,

          status,

          order_source:
            orderSource,

          source_reference:
            sourceReference.trim() ||
            null,

          currency,

          subtotal:
            calculations.subtotal,

          discount_amount:
            calculations.discountAmount,

          tax_amount:
            calculations.taxAmount,

          total_amount:
            calculations.total,

          notes:
            notes.trim() ||
            null,

          terms:
            terms.trim() ||
            null,

          is_fulfilled:
            false,
        })
        .select(
          "id, sales_order_no"
        )
        .single();

      if (orderError) {
        throw orderError;
      }

      /*
        CREATE ORDER ITEMS
      */

      const itemRows =
        validItems.map(
          (
            item,
            index
          ) => ({
            sales_order_id:
              order.id,

            product_id:
              Number(
                item.product_id
              ),

            description:
              item.description,

            qty:
              Number(
                item.qty
              ),

            unit_price:
              Number(
                item.unit_price
              ),

            discount_percent:
              Number(
                item.discount_percent ||
                  0
              ),

            tax_percent:
              Number(
                item.tax_percent ||
                  0
              ),

            line_subtotal:
              item.line_subtotal,

            discount_amount:
              item.discount_amount,

            tax_amount:
              item.tax_amount,

            line_total:
              item.line_total,

            sort_order:
              index + 1,
          })
        );

      const {
        error:
          itemError,
      } = await supabase
        .from(
          "sales_order_items"
        )
        .insert(
          itemRows
        );

      if (itemError) {
        /*
          Clean up header if
          item insert fails.
      */

        await supabase
          .from(
            "sales_orders"
          )
          .delete()
          .eq(
            "id",
            order.id
          );

        throw itemError;
      }

      router.push(
        `/sales/${order.id}`
      );

      router.refresh();
    } catch (error) {
      console.error(error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not create Sales Order."
      );
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(
    e: FormEvent
  ) {
    e.preventDefault();

    createOrder("draft");
  }

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-sm text-gray-500">
        Loading new Sales Order...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            New Sales Order
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Create a direct customer order without a quotation.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            router.push(
              "/sales"
            )
          }
          className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
        >
          Cancel
        </button>
      </div>

      {message && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      {periodStatus === "closed" && (
        <PeriodNotice tone="closed" title="Selected Period Closed"
          text={`The selected order date ${formatDate(orderDate)} belongs to a closed accounting period${periodClosedAt ? ` closed on ${formatDateTime(periodClosedAt)}` : ""}. Change the date or reopen that month before creating this Sales Order.`} />
      )}
      {periodStatus === "reopened" && (
        <PeriodNotice tone="reopened" title="Selected Period Reopened"
          text="This Sales Order date is in a reopened accounting period. Creating the order is allowed until the month is closed again." />
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
            {/* ORDER INFO */}

            <Section
              title="Order Information"
              description="Customer and source of this order."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label="Customer"
                  required
                >
                  <select
                    value={
                      customerId
                    }
                    onChange={(e) =>
                      setCustomerId(
                        e.target
                          .value
                      )
                    }
                    className={
                      inputClass
                    }
                  >
                    <option value="">
                      Select customer
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
                        </option>
                      )
                    )}
                  </select>
                </Field>

                <Field
                  label="Order Date"
                  required
                >
                  <input
                    type="date"
                    value={
                      orderDate
                    }
                    onChange={(e) =>
                      setOrderDate(
                        e.target
                          .value
                      )
                    }
                    className={
                      inputClass
                    }
                  />
                  <PeriodHint status={periodStatus} checking={checkingPeriod} />
                </Field>

                <Field label="Order Source">
                  <select
                    value={
                      orderSource
                    }
                    onChange={(e) =>
                      setOrderSource(
                        e.target
                          .value
                      )
                    }
                    className={
                      inputClass
                    }
                  >
                    <option value="messenger">
                      Messenger
                    </option>

                    <option value="phone">
                      Phone
                    </option>

                    <option value="walk_in">
                      Walk-in
                    </option>

                    <option value="facebook">
                      Facebook
                    </option>

                    <option value="website">
                      Website
                    </option>

                    <option value="other">
                      Other
                    </option>
                  </select>
                </Field>

                <Field label="Reference">
                  <input
                    value={
                      sourceReference
                    }
                    onChange={(e) =>
                      setSourceReference(
                        e.target
                          .value
                      )
                    }
                    placeholder="e.g. Messenger chat / order reference"
                    className={
                      inputClass
                    }
                  />
                </Field>

                <Field label="Currency">
                  <select
                    value={
                      currency
                    }
                    onChange={(e) =>
                      setCurrency(
                        e.target
                          .value
                      )
                    }
                    className={
                      inputClass
                    }
                  >
                    <option value="THB">
                      THB
                    </option>

                    <option value="MMK">
                      MMK
                    </option>

                    <option value="USD">
                      USD
                    </option>
                  </select>
                </Field>
              </div>
            </Section>

            {/* ORDER ITEMS */}

            <Section
              title="Order Items"
              description="Only products with available stock can be ordered."
            >
              <div className="space-y-4">
                {items.map(
                  (
                    item,
                    index
                  ) => {
                    const product =
                      products.find(
                        (
                          product
                        ) =>
                          String(
                            product.id
                          ) ===
                          item.product_id
                      );

                    const calc =
                      calculations
                        .rows[
                        index
                      ];

                    const requestedQty =
                      Number(
                        item.qty ||
                          0
                      );

                    const overStock =
                      Boolean(
                        product &&
                          requestedQty >
                            product.current_stock
                      );

                    return (
                      <div
                        key={
                          item.key
                        }
                        className="rounded-xl border border-gray-200 p-4"
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <div className="text-sm font-semibold text-gray-900">
                            Item{" "}
                            {index +
                              1}
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
                              className="text-sm font-medium text-red-600"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <Field
                            label="Product"
                            required
                          >
                            <select
                              value={
                                item.product_id
                              }
                              onChange={(e) =>
                                chooseProduct(
                                  item.key,
                                  e
                                    .target
                                    .value
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
                                    disabled={
                                      product.current_stock <=
                                      0
                                    }
                                  >
                                    {
                                      product.product_name
                                    }
                                    {product.product_code
                                      ? ` (${product.product_code})`
                                      : ""}
                                    {" — "}
                                    Stock{" "}
                                    {formatQty(
                                      product.current_stock
                                    )}
                                    {product.current_stock <=
                                    0
                                      ? " — Out of Stock"
                                      : ""}
                                  </option>
                                )
                              )}
                            </select>
                          </Field>

                          <Field label="Description">
                            <input
                              value={
                                item.description
                              }
                              onChange={(e) =>
                                updateItem(
                                  item.key,
                                  "description",
                                  e
                                    .target
                                    .value
                                )
                              }
                              className={
                                inputClass
                              }
                            />
                          </Field>

                          <Field
                            label="Quantity"
                            required
                          >
                            <input
                              type="number"
                              min="0.001"
                              step="0.001"
                              max={
                                product
                                  ? product.current_stock
                                  : undefined
                              }
                              value={
                                item.qty
                              }
                              onChange={(e) =>
                                updateItem(
                                  item.key,
                                  "qty",
                                  e
                                    .target
                                    .value
                                )
                              }
                              className={
                                overStock
                                  ? `${inputClass} border-red-400`
                                  : inputClass
                              }
                            />

                            {product && (
                              <div
                                className={`mt-1 text-xs ${
                                  overStock
                                    ? "font-medium text-red-600"
                                    : "text-gray-500"
                                }`}
                              >
                                Available
                                stock:{" "}
                                {formatQty(
                                  product.current_stock
                                )}

                                {overStock &&
                                  ` — Requested ${formatQty(
                                    requestedQty
                                  )}`}
                              </div>
                            )}
                          </Field>

                          <Field
                            label="Unit Price"
                            required
                          >
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                item.unit_price
                              }
                              onChange={(e) =>
                                updateItem(
                                  item.key,
                                  "unit_price",
                                  e
                                    .target
                                    .value
                                )
                              }
                              className={
                                inputClass
                              }
                            />
                          </Field>

                          <Field label="Discount %">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={
                                item.discount_percent
                              }
                              onChange={(e) =>
                                updateItem(
                                  item.key,
                                  "discount_percent",
                                  e
                                    .target
                                    .value
                                )
                              }
                              className={
                                inputClass
                              }
                            />
                          </Field>

                          <Field label="Tax %">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                item.tax_percent
                              }
                              onChange={(e) =>
                                updateItem(
                                  item.key,
                                  "tax_percent",
                                  e
                                    .target
                                    .value
                                )
                              }
                              className={
                                inputClass
                              }
                            />
                          </Field>
                        </div>

                        <div className="mt-4 flex justify-end border-t border-gray-100 pt-4">
                          <div className="text-sm text-gray-500">
                            Line
                            Total:{" "}
                            <strong className="ml-2 text-gray-900">
                              {money(
                                calc?.line_total ||
                                  0,
                                currency
                              )}
                            </strong>
                          </div>
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
                  className="w-full rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700"
                >
                  + Add Another Product
                </button>
              </div>
            </Section>

            {/* NOTES */}

            <Section
              title="Notes & Terms"
              description="Optional order notes and customer terms."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Notes">
                  <textarea
                    rows={4}
                    value={
                      notes
                    }
                    onChange={(e) =>
                      setNotes(
                        e.target
                          .value
                      )
                    }
                    className={
                      inputClass
                    }
                  />
                </Field>

                <Field label="Terms & Conditions">
                  <textarea
                    rows={4}
                    value={
                      terms
                    }
                    onChange={(e) =>
                      setTerms(
                        e.target
                          .value
                      )
                    }
                    className={
                      inputClass
                    }
                  />
                </Field>
              </div>
            </Section>
          </div>

          {/* SUMMARY */}

          <div>
            <div className="sticky top-24 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900">
                Order Summary
              </h3>

              <div className="mt-5 space-y-4">
                <Summary
                  label="Subtotal"
                  value={money(
                    calculations.subtotal,
                    currency
                  )}
                />

                <Summary
                  label="Discount"
                  value={`-${money(
                    calculations.discountAmount,
                    currency
                  )}`}
                />

                <Summary
                  label="Tax"
                  value={money(
                    calculations.taxAmount,
                    currency
                  )}
                />

                <div className="border-t border-gray-200 pt-4">
                  <Summary
                    label="Grand Total"
                    value={money(
                      calculations.total,
                      currency
                    )}
                    strong
                  />
                </div>
              </div>

              <div className="mt-6 rounded-lg bg-gray-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  Direct Order
                </div>

                <div className="mt-2 text-sm font-semibold text-gray-900">
                  {sourceLabel(
                    orderSource
                  )}
                </div>

                <div className="mt-1 text-xs text-gray-500">
                  No quotation required
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || checkingPeriod || periodStatus === "closed"}
                className="mt-6 w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : checkingPeriod ? "Checking Period..." : periodStatus === "closed" ? "Selected Period Closed" : "Save as Draft"}
              </button>

              <button
                type="button"
                disabled={saving || checkingPeriod || periodStatus === "closed"}
                onClick={() =>
                  createOrder(
                    "confirmed"
                  )
                }
                style={{
                  marginTop:
                    "10px",
                  width:
                    "100%",
                  backgroundColor:
                    "#15803d",
                  color:
                    "#ffffff",
                  border:
                    "none",
                  borderRadius:
                    "8px",
                  padding:
                    "10px 16px",
                  fontSize:
                    "14px",
                  fontWeight:
                    600,
                  cursor:
                    saving
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    saving
                      ? 0.5
                      : 1,
                }}
              >
                {saving
                  ? "Saving..."
                  : checkingPeriod ? "Checking Period..." : periodStatus === "closed" ? "Selected Period Closed" : "Create & Confirm Order"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function PeriodNotice({
  tone,
  title,
  text,
}: {
  tone: "closed" | "reopened";
  title: string;
  text: string;
}) {
  const classes =
    tone === "closed"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-blue-200 bg-blue-50 text-blue-800";

  return (
    <div className={`rounded-xl border px-4 py-3 ${classes}`}>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm">{text}</div>
    </div>
  );
}

function PeriodHint({
  status,
  checking,
}: {
  status: PeriodStatus;
  checking: boolean;
}) {
  if (checking) {
    return <div className="mt-2 text-xs text-gray-400">Checking accounting period...</div>;
  }

  if (status === "closed") {
    return <div className="mt-2 text-xs font-medium text-amber-700">This date is in a closed accounting period.</div>;
  }

  if (status === "reopened") {
    return <div className="mt-2 text-xs font-medium text-blue-700">This date is in a reopened accounting period.</div>;
  }

  return <div className="mt-2 text-xs font-medium text-green-700">Accounting period is open.</div>;
}

function firstDayOfDate(value: string) {
  return `${String(value || "").slice(0, 7)}-01`;
}

function formatDate(value: string) {
  const parts = String(value || "").split("-");
  return parts.length === 3
    ? `${parts[2]}/${parts[1]}/${parts[0]}`
    : value || "-";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function emptyItem(): OrderItem {
  return {
    key: `${Date.now()}-${Math.random()}`,
    product_id: "",
    description: "",
    qty: "1",
    unit_price: "",
    discount_percent: "0",
    tax_percent: "0",
  };
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400";

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

function Summary({
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
            : "text-sm font-semibold text-gray-900"
        }
      >
        {value}
      </span>
    </div>
  );
}

function money(
  value: number,
  currency: string
) {
  const symbol =
    currency === "USD"
      ? "$"
      : currency === "MMK"
      ? "K "
      : "฿";

  return `${symbol}${Number(
    value || 0
  ).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatQty(
  value: number
) {
  return Number(
    value || 0
  ).toLocaleString(undefined, {
    maximumFractionDigits: 3,
  });
}

function sourceLabel(
  value: string
) {
  if (
    value === "walk_in"
  ) {
    return "Walk-in";
  }

  return value
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}