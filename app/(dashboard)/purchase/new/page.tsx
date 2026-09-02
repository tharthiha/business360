"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Supplier = {
  id: number;
  supplier_name: string;
  supplier_code: string | null;
};

type Product = {
  id: number;
  product_name: string;
  product_code: string | null;
  cost_price: number | null;
};

type PeriodStatus =
  | "open"
  | "closed"
  | "reopened";

type OrderItem = {
  key: string;
  product_id: string;
  description: string;
  qty: string;
  unit_cost: string;
  discount_percent: string;
  tax_percent: string;
};

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const supabase = createClient();

  const [suppliers, setSuppliers] =
    useState<Supplier[]>([]);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [supplierId, setSupplierId] =
    useState("");

  const [orderDate, setOrderDate] =
    useState("");

  const [expectedDate, setExpectedDate] =
    useState("");

  const [currency, setCurrency] =
    useState("THB");

  const [notes, setNotes] =
    useState("");

  const [terms, setTerms] =
    useState("");

  const [items, setItems] =
    useState<OrderItem[]>([]);

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

  const [
    periodClosedAt,
    setPeriodClosedAt,
  ] = useState<string | null>(null);

  const [
    checkingPeriod,
    setCheckingPeriod,
  ] = useState(false);

  useEffect(() => {
    const initialDate =
      localToday();

    setOrderDate(
      initialDate
    );

    setItems([
      createEmptyItem(),
    ]);

    async function loadData() {
      setLoading(true);
      setMessage("");

      try {
        const {
          data: authData,
          error: authError,
        } =
          await supabase.auth.getUser();

        if (
          authError ||
          !authData.user
        ) {
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
          .eq(
            "id",
            authData.user.id
          )
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

        const resolvedCompanyId =
          Number(
            profile.company_id
          );

        setCompanyId(
          resolvedCompanyId
        );

        const [
          supplierResult,
          productResult,
        ] = await Promise.all([
          supabase
            .from("suppliers")
            .select(`
              id,
              supplier_name,
              supplier_code
            `)
            .eq(
              "is_active",
              true
            )
            .order(
              "supplier_name"
            ),

          supabase
            .from("products")
            .select(`
              id,
              product_name,
              product_code,
              cost_price
            `)
            .eq(
              "is_active",
              true
            )
            .order(
              "product_name"
            ),
        ]);

        if (
          supplierResult.error
        ) {
          throw supplierResult.error;
        }

        if (
          productResult.error
        ) {
          throw productResult.error;
        }

        const supplierList =
          (
            supplierResult.data ||
            []
          ) as Supplier[];

        setSuppliers(
          supplierList
        );

        setProducts(
          (
            productResult.data ||
            []
          ) as Product[]
        );

        const presetSupplierId =
          typeof window !==
          "undefined"
            ? new URLSearchParams(
                window.location.search
              ).get(
                "supplier_id"
              )
            : null;

        if (
          presetSupplierId &&
          supplierList.some(
            (supplier) =>
              String(
                supplier.id
              ) ===
              presetSupplierId
          )
        ) {
          setSupplierId(
            presetSupplierId
          );
        }

        await checkPeriod(
          resolvedCompanyId,
          initialDate
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not load purchase order form."
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    if (
      !companyId ||
      !orderDate
    ) {
      return;
    }

    checkPeriod(
      companyId,
      orderDate
    );
  }, [
    companyId,
    orderDate,
  ]);

  async function checkPeriod(
    targetCompanyId: number,
    targetDate: string
  ) {
    if (
      !targetCompanyId ||
      !targetDate
    ) {
      setPeriodStatus(
        "open"
      );

      setPeriodClosedAt(
        null
      );

      return;
    }

    setCheckingPeriod(
      true
    );

    try {
      const {
        data,
        error,
      } = await supabase
        .from(
          "accounting_period_closes"
        )
        .select(
          "status, closed_at"
        )
        .eq(
          "company_id",
          targetCompanyId
        )
        .eq(
          "period_start",
          firstDayOfDate(
            targetDate
          )
        )
        .maybeSingle();

      if (error) {
        throw error;
      }

      setPeriodStatus(
        data?.status ===
          "closed"
          ? "closed"
          : data?.status ===
            "reopened"
          ? "reopened"
          : "open"
      );

      setPeriodClosedAt(
        data?.closed_at ||
          null
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not check accounting period."
      );
    } finally {
      setCheckingPeriod(
        false
      );
    }
  }

  const totals =
    useMemo(() => {
      let subtotal = 0;
      let discount = 0;
      let tax = 0;
      let total = 0;

      for (
        const item of items
      ) {
        const result =
          calculateItem(
            item
          );

        subtotal +=
          result.lineSubtotal;

        discount +=
          result.discountAmount;

        tax +=
          result.taxAmount;

        total +=
          result.lineTotal;
      }

      return {
        subtotal,
        discount,
        tax,
        total,
      };
    }, [items]);

  function selectedByOtherRow(
    productId: string,
    currentKey: string
  ) {
    return items.some(
      (item) =>
        item.key !==
          currentKey &&
        item.product_id ===
          productId
    );
  }

  function selectProduct(
    key: string,
    productId: string
  ) {
    setMessage("");

    if (
      productId &&
      selectedByOtherRow(
        productId,
        key
      )
    ) {
      setMessage(
        "This product is already in the purchase order. Increase the quantity on the existing line instead."
      );

      return;
    }

    const product =
      products.find(
        (row) =>
          String(
            row.id
          ) ===
          productId
      );

    setItems(
      (current) =>
        current.map(
          (item) =>
            item.key === key
              ? {
                  ...item,

                  product_id:
                    productId,

                  description:
                    product?.product_name ||
                    "",

                  unit_cost:
                    product
                      ? String(
                          Number(
                            product.cost_price ||
                              0
                          )
                        )
                      : "",
                }
              : item
        )
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
          (item) =>
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

  function addItem() {
    setMessage("");

    if (
      items.some(
        (item) =>
          !item.product_id
      )
    ) {
      setMessage(
        "Complete the current item before adding another line."
      );

      return;
    }

    setItems(
      (current) => [
        ...current,
        createEmptyItem(),
      ]
    );
  }

  function removeItem(
    key: string
  ) {
    setMessage("");

    setItems(
      (current) => {
        if (
          current.length <= 1
        ) {
          return [
            createEmptyItem(),
          ];
        }

        return current.filter(
          (item) =>
            item.key !== key
        );
      }
    );
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");

    if (
      checkingPeriod
    ) {
      setMessage(
        "Please wait while the selected accounting period is checked."
      );
      return;
    }

    if (
      periodStatus ===
      "closed"
    ) {
      setMessage(
        "The selected order date belongs to a closed accounting period. Change the date or reopen that month from Reports → Month-End Close."
      );
      return;
    }

    if (!supplierId) {
      setMessage(
        "Please select a supplier."
      );
      return;
    }

    if (!orderDate) {
      setMessage(
        "Order date is required."
      );
      return;
    }

    if (
      expectedDate &&
      expectedDate <
        orderDate
    ) {
      setMessage(
        "Expected date cannot be earlier than the order date."
      );
      return;
    }

    const validItems =
      items.filter(
        (item) =>
          item.product_id
      );

    if (
      validItems.length ===
      0
    ) {
      setMessage(
        "Add at least one product."
      );
      return;
    }

    const productIds =
      validItems.map(
        (item) =>
          item.product_id
      );

    if (
      new Set(
        productIds
      ).size !==
      productIds.length
    ) {
      setMessage(
        "The same product cannot appear more than once in a purchase order."
      );
      return;
    }

    for (
      const item of
        validItems
    ) {
      const qty =
        Number(
          item.qty
        );

      const unitCost =
        Number(
          item.unit_cost
        );

      const discount =
        Number(
          item.discount_percent
        );

      const tax =
        Number(
          item.tax_percent
        );

      if (
        !Number.isFinite(
          qty
        ) ||
        qty <= 0
      ) {
        setMessage(
          `Quantity must be greater than zero for "${item.description}".`
        );
        return;
      }

      if (
        !Number.isFinite(
          unitCost
        ) ||
        unitCost < 0
      ) {
        setMessage(
          `Unit cost is invalid for "${item.description}".`
        );
        return;
      }

      if (
        discount < 0 ||
        discount > 100
      ) {
        setMessage(
          `Discount must be between 0% and 100% for "${item.description}".`
        );
        return;
      }

      if (
        tax < 0 ||
        tax > 100
      ) {
        setMessage(
          `Tax must be between 0% and 100% for "${item.description}".`
        );
        return;
      }
    }

    setSaving(true);

    try {
      const {
        data: {
          user,
        },
        error:
          userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !user
      ) {
        throw new Error(
          "Please login first."
        );
      }

      const {
        data: profile,
        error:
          profileError,
      } = await supabase
        .from("profiles")
        .select("company_id")
        .eq(
          "id",
          user.id
        )
        .single();

      if (
        profileError ||
        !profile?.company_id
      ) {
        throw new Error(
          "Company profile not found."
        );
      }

      const {
        data: closeData,
        error: closeError,
      } = await supabase
        .from(
          "accounting_period_closes"
        )
        .select("status")
        .eq(
          "company_id",
          Number(
            profile.company_id
          )
        )
        .eq(
          "period_start",
          firstDayOfDate(
            orderDate
          )
        )
        .maybeSingle();

      if (closeError) {
        throw closeError;
      }

      if (
        closeData?.status ===
        "closed"
      ) {
        setPeriodStatus(
          "closed"
        );

        throw new Error(
          "The selected order date is now in a closed accounting period. Reopen the month or choose another date."
        );
      }

      const purchaseOrderNo =
        `PO-${Date.now()}`;

      const {
        data: order,
        error:
          orderError,
      } = await supabase
        .from(
          "purchase_orders"
        )
        .insert({
          company_id:
            profile.company_id,

          supplier_id:
            Number(
              supplierId
            ),

          purchase_order_no:
            purchaseOrderNo,

          order_date:
            orderDate,

          expected_date:
            expectedDate ||
            null,

          status:
            "draft",

          currency,

          subtotal:
            round2(
              totals.subtotal
            ),

          discount_amount:
            round2(
              totals.discount
            ),

          tax_amount:
            round2(
              totals.tax
            ),

          total_amount:
            round2(
              totals.total
            ),

          notes:
            notes.trim() ||
            null,

          terms:
            terms.trim() ||
            null,
        })
        .select("id")
        .single();

      if (
        orderError ||
        !order
      ) {
        throw (
          orderError ||
          new Error(
            "Could not create purchase order."
          )
        );
      }

      const itemRows =
        validItems.map(
          (
            item,
            index
          ) => {
            const calculation =
              calculateItem(
                item
              );

            return {
              purchase_order_id:
                order.id,

              product_id:
                Number(
                  item.product_id
                ),

              description:
                item.description.trim(),

              qty:
                Number(
                  item.qty
                ),

              received_qty:
                0,

              unit_cost:
                Number(
                  item.unit_cost
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
                round2(
                  calculation.lineSubtotal
                ),

              discount_amount:
                round2(
                  calculation.discountAmount
                ),

              tax_amount:
                round2(
                  calculation.taxAmount
                ),

              line_total:
                round2(
                  calculation.lineTotal
                ),

              sort_order:
                index,
            };
          }
        );

      const {
        error:
          itemError,
      } = await supabase
        .from(
          "purchase_order_items"
        )
        .insert(
          itemRows
        );

      if (itemError) {
        await supabase
          .from(
            "purchase_orders"
          )
          .delete()
          .eq(
            "id",
            order.id
          );

        throw itemError;
      }

      router.push(
        `/purchase/${order.id}`
      );

      router.refresh();
    } catch (error) {
      console.error(
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not create purchase order."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-sm text-gray-500">
        Loading purchase order form...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            New Purchase Order
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Create a draft purchase order for a supplier.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            router.push(
              "/purchase"
            )
          }
          className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>

      {message && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {message}
        </div>
      )}

      {periodStatus ===
        "closed" && (
        <PeriodNotice
          tone="closed"
          title="Selected Period Closed"
          text={`The selected order date ${formatDate(
            orderDate
          )} belongs to a closed accounting period${
            periodClosedAt
              ? ` closed on ${formatDateTime(
                  periodClosedAt
                )}`
              : ""
          }. Change the date or reopen that month before creating this Purchase Order.`}
        />
      )}

      {periodStatus ===
        "reopened" && (
        <PeriodNotice
          tone="reopened"
          title="Selected Period Reopened"
          text="This Purchase Order date is in a reopened accounting period. Creating the order is allowed until the month is closed again."
        />
      )}

      <form
        onSubmit={
          handleSubmit
        }
        className="space-y-6"
      >
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Section
              title="Purchase Information"
              description="Supplier and purchase order dates."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label="Supplier"
                  required
                >
                  <select
                    value={
                      supplierId
                    }
                    onChange={(event) =>
                      setSupplierId(
                        event.target.value
                      )
                    }
                    className={
                      inputClass
                    }
                  >
                    <option value="">
                      Select supplier
                    </option>

                    {suppliers.map(
                      (
                        supplier
                      ) => (
                        <option
                          key={
                            supplier.id
                          }
                          value={
                            supplier.id
                          }
                        >
                          {
                            supplier.supplier_name
                          }
                          {supplier.supplier_code
                            ? ` (${supplier.supplier_code})`
                            : ""}
                        </option>
                      )
                    )}
                  </select>
                </Field>

                <Field label="Currency">
                  <select
                    value={
                      currency
                    }
                    onChange={(event) =>
                      setCurrency(
                        event.target.value
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

                <Field
                  label="Order Date"
                  required
                >
                  <input
                    type="date"
                    value={
                      orderDate
                    }
                    onChange={(event) =>
                      setOrderDate(
                        event.target.value
                      )
                    }
                    className={
                      inputClass
                    }
                  />

                  <PeriodHint
                    status={
                      periodStatus
                    }
                    checking={
                      checkingPeriod
                    }
                  />
                </Field>

                <Field label="Expected Date">
                  <input
                    type="date"
                    value={
                      expectedDate
                    }
                    onChange={(event) =>
                      setExpectedDate(
                        event.target.value
                      )
                    }
                    min={
                      orderDate
                    }
                    className={
                      inputClass
                    }
                  />
                </Field>
              </div>
            </Section>

            <Section
              title="Purchase Items"
              description="Each product can appear only once. Increase quantity on the existing row instead of adding a duplicate."
            >
              <div className="space-y-4">
                {items.map(
                  (
                    item,
                    index
                  ) => {
                    const calculation =
                      calculateItem(
                        item
                      );

                    return (
                      <div
                        key={
                          item.key
                        }
                        className="rounded-xl border border-gray-200 p-4"
                      >
                        <div className="mb-4 flex items-center justify-between gap-4">
                          <div className="text-sm font-semibold text-gray-900">
                            Item{" "}
                            {index +
                              1}
                          </div>

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
                              onChange={(event) =>
                                selectProduct(
                                  item.key,
                                  event.target.value
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
                                ) => {
                                  const used =
                                    selectedByOtherRow(
                                      String(
                                        product.id
                                      ),
                                      item.key
                                    );

                                  return (
                                    <option
                                      key={
                                        product.id
                                      }
                                      value={
                                        product.id
                                      }
                                      disabled={
                                        used
                                      }
                                    >
                                      {
                                        product.product_name
                                      }
                                      {product.product_code
                                        ? ` (${product.product_code})`
                                        : ""}
                                      {used
                                        ? " — already added"
                                        : ""}
                                    </option>
                                  );
                                }
                              )}
                            </select>
                          </Field>

                          <Field label="Description">
                            <input
                              value={
                                item.description
                              }
                              onChange={(event) =>
                                updateItem(
                                  item.key,
                                  "description",
                                  event.target.value
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
                              value={
                                item.qty
                              }
                              onChange={(event) =>
                                updateItem(
                                  item.key,
                                  "qty",
                                  event.target.value
                                )
                              }
                              className={
                                inputClass
                              }
                            />
                          </Field>

                          <Field
                            label="Unit Cost"
                            required
                          >
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                item.unit_cost
                              }
                              onChange={(event) =>
                                updateItem(
                                  item.key,
                                  "unit_cost",
                                  event.target.value
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
                              onChange={(event) =>
                                updateItem(
                                  item.key,
                                  "discount_percent",
                                  event.target.value
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
                              max="100"
                              step="0.01"
                              value={
                                item.tax_percent
                              }
                              onChange={(event) =>
                                updateItem(
                                  item.key,
                                  "tax_percent",
                                  event.target.value
                                )
                              }
                              className={
                                inputClass
                              }
                            />
                          </Field>
                        </div>

                        <div className="mt-4 flex flex-wrap justify-end gap-5 border-t border-gray-100 pt-4 text-sm">
                          <span className="text-gray-500">
                            Subtotal{" "}
                            <strong className="ml-1 text-gray-900">
                              {money(
                                calculation.lineSubtotal,
                                currency
                              )}
                            </strong>
                          </span>

                          <span className="text-gray-500">
                            Total{" "}
                            <strong className="ml-1 text-gray-900">
                              {money(
                                calculation.lineTotal,
                                currency
                              )}
                            </strong>
                          </span>
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
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  + Add Item
                </button>
              </div>
            </Section>

            <Section
              title="Notes & Terms"
              description="Optional purchase instructions."
            >
              <div className="space-y-5">
                <Field label="Notes">
                  <textarea
                    rows={3}
                    value={
                      notes
                    }
                    onChange={(event) =>
                      setNotes(
                        event.target.value
                      )
                    }
                    className={
                      inputClass
                    }
                  />
                </Field>

                <Field label="Terms">
                  <textarea
                    rows={3}
                    value={
                      terms
                    }
                    onChange={(event) =>
                      setTerms(
                        event.target.value
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

          <div>
            <div className="sticky top-24 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900">
                Order Summary
              </h3>

              <div className="mt-5 space-y-4">
                <SummaryRow
                  label="Subtotal"
                  value={money(
                    totals.subtotal,
                    currency
                  )}
                />

                <SummaryRow
                  label="Discount"
                  value={money(
                    totals.discount,
                    currency
                  )}
                />

                <SummaryRow
                  label="Tax"
                  value={money(
                    totals.tax,
                    currency
                  )}
                />

                <div className="border-t border-gray-200 pt-4">
                  <SummaryRow
                    label="Total"
                    value={money(
                      totals.total,
                      currency
                    )}
                    strong
                  />
                </div>
              </div>

              <div className="mt-5 rounded-lg bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-500">
                The purchase order will be saved as Draft. Stock will not increase until the order is received.
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
          <button
            type="button"
            disabled={
              saving
            }
            onClick={() =>
              router.push(
                "/purchase"
              )
            }
            className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={
              saving ||
              checkingPeriod ||
              periodStatus ===
                "closed"
            }
            className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {saving
              ? "Creating..."
              : checkingPeriod
              ? "Checking Period..."
              : periodStatus ===
                "closed"
              ? "Selected Period Closed"
              : "Create Purchase Order"}
          </button>
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

function PeriodHint({
  status,
  checking,
}: {
  status: PeriodStatus;
  checking: boolean;
}) {
  if (checking) {
    return (
      <div className="mt-2 text-xs text-gray-400">
        Checking accounting period...
      </div>
    );
  }

  if (
    status === "closed"
  ) {
    return (
      <div className="mt-2 text-xs font-medium text-amber-700">
        This date is in a closed accounting period.
      </div>
    );
  }

  if (
    status === "reopened"
  ) {
    return (
      <div className="mt-2 text-xs font-medium text-blue-700">
        This date is in a reopened accounting period.
      </div>
    );
  }

  return (
    <div className="mt-2 text-xs font-medium text-green-700">
      Accounting period is open.
    </div>
  );
}

function firstDayOfDate(
  value: string
) {
  return `${String(
    value || ""
  ).slice(0, 7)}-01`;
}

function formatDate(
  value: string
) {
  const parts =
    String(
      value || ""
    ).split("-");

  return parts.length ===
    3
    ? `${parts[2]}/${parts[1]}/${parts[0]}`
    : value || "-";
}

function formatDateTime(
  value: string
) {
  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? value
    : date.toLocaleString();
}

function localToday() {
  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() +
        1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

function createEmptyItem(): OrderItem {
  return {
    key:
      typeof crypto !==
        "undefined" &&
      "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,

    product_id: "",
    description: "",
    qty: "1",
    unit_cost: "",
    discount_percent:
      "0",
    tax_percent:
      "0",
  };
}

function calculateItem(
  item: OrderItem
) {
  const qty =
    Number(
      item.qty
    ) || 0;

  const unitCost =
    Number(
      item.unit_cost
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
    qty *
    unitCost;

  const discountAmount =
    lineSubtotal *
    (discountPercent /
      100);

  const taxable =
    lineSubtotal -
    discountAmount;

  const taxAmount =
    taxable *
    (taxPercent /
      100);

  return {
    lineSubtotal,

    discountAmount,

    taxAmount,

    lineTotal:
      taxable +
      taxAmount,
  };
}

function round2(
  value: number
) {
  return (
    Math.round(
      (
        value +
        Number.EPSILON
      ) *
        100
    ) /
    100
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-400";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children:
    React.ReactNode;
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
  children:
    React.ReactNode;
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
            ? "text-lg font-semibold text-gray-900"
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
