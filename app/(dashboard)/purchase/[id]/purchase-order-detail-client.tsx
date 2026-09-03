"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type PurchaseOrder = {
  id: number;
  purchase_order_no: string;
  supplier_id: number;
  order_date: string;
  expected_date: string | null;
  status: string;
  currency: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  terms: string | null;
};

type Supplier = {
  id: number;
  supplier_name: string;
  supplier_code: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
};

type PurchaseItem = {
  id: number;
  product_id: number | null;
  description: string;
  qty: number;
  received_qty: number;
  unit_cost: number;
  discount_percent: number;
  tax_percent: number;
  line_subtotal: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
  sort_order: number;
  product_name: string | null;
  product_code: string | null;
};

type SupplierBill = {
  id: number;
  bill_no: string;
  status: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  due_date: string | null;
};

export default function PurchaseOrderDetailClient({
  id,
}: {
  id: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [order, setOrder] =
    useState<PurchaseOrder | null>(
      null
    );

  const [supplier, setSupplier] =
    useState<Supplier | null>(
      null
    );

  const [items, setItems] =
    useState<PurchaseItem[]>([]);

  const [
    supplierBill,
    setSupplierBill,
  ] = useState<SupplierBill | null>(
    null
  );

  const [receiveQty, setReceiveQty] =
    useState<
      Record<number, string>
    >({});

  const [
    showReceiving,
    setShowReceiving,
  ] = useState(false);

  const [receiptDate, setReceiptDate] =
    useState(today());

  const receiveRequestIdRef =
    useRef<string | null>(null);

  const billRequestIdRef =
    useRef<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [
    creatingBill,
    setCreatingBill,
  ] = useState(false);

  const [message, setMessage] =
    useState("");

  const [
    messageType,
    setMessageType,
  ] = useState<
    "success" | "error"
  >("error");

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: orderData,
        error: orderError,
      } = await supabase
        .from("purchase_orders")
        .select("*")
        .eq("id", id)
        .single();

      if (
        orderError ||
        !orderData
      ) {
        throw new Error(
          orderError?.message ||
            "Purchase order not found."
        );
      }

      setOrder(
        orderData as PurchaseOrder
      );

      const [
        supplierResult,
        itemResult,
        billResult,
      ] = await Promise.all([
        supabase
          .from("suppliers")
          .select(`
            id,
            supplier_name,
            supplier_code,
            contact_name,
            phone,
            email
          `)
          .eq(
            "id",
            orderData.supplier_id
          )
          .single(),

        supabase
          .from(
            "purchase_order_items"
          )
          .select(`
            id,
            product_id,
            description,
            qty,
            received_qty,
            unit_cost,
            discount_percent,
            tax_percent,
            line_subtotal,
            discount_amount,
            tax_amount,
            line_total,
            sort_order,
            products (
              product_name,
              product_code
            )
          `)
          .eq(
            "purchase_order_id",
            id
          )
          .order(
            "sort_order",
            {
              ascending: true,
            }
          ),

        supabase
          .from("supplier_bills")
          .select(`
            id,
            bill_no,
            status,
            total_amount,
            paid_amount,
            balance_due,
            due_date
          `)
          .eq(
            "purchase_order_id",
            id
          )
          .maybeSingle(),
      ]);

      if (
        supplierResult.error
      ) {
        throw new Error(
          supplierResult.error
            .message ||
            "Could not load supplier."
        );
      }

      setSupplier(
        supplierResult.data as Supplier
      );

      if (itemResult.error) {
        throw new Error(
          itemResult.error.message ||
            "Could not load purchase items."
        );
      }

      if (billResult.error) {
        throw new Error(
          billResult.error.message ||
            "Could not check supplier bill."
        );
      }

      setSupplierBill(
        billResult.data
          ? (billResult.data as SupplierBill)
          : null
      );

      const normalized =
        (
          itemResult.data || []
        ).map((row: any) => {
          const product =
            Array.isArray(
              row.products
            )
              ? row.products[0]
              : row.products;

          return {
            id: row.id,

            product_id:
              row.product_id,

            description:
              row.description,

            qty: Number(
              row.qty || 0
            ),

            received_qty:
              Number(
                row.received_qty ||
                  0
              ),

            unit_cost:
              Number(
                row.unit_cost || 0
              ),

            discount_percent:
              Number(
                row.discount_percent ||
                  0
              ),

            tax_percent:
              Number(
                row.tax_percent ||
                  0
              ),

            line_subtotal:
              Number(
                row.line_subtotal ||
                  0
              ),

            discount_amount:
              Number(
                row.discount_amount ||
                  0
              ),

            tax_amount:
              Number(
                row.tax_amount || 0
              ),

            line_total:
              Number(
                row.line_total || 0
              ),

            sort_order:
              row.sort_order,

            product_name:
              product?.product_name ||
              null,

            product_code:
              product?.product_code ||
              null,
          };
        });

      setItems(normalized);

      const defaults: Record<
        number,
        string
      > = {};

      normalized.forEach(
        (item) => {
          const remaining =
            item.qty -
            item.received_qty;

          defaults[item.id] =
            remaining > 0
              ? "0"
              : "0";
        }
      );

      setReceiveQty(defaults);
    } catch (error) {
      setMessageType("error");

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load purchase order."
      );
    } finally {
      setLoading(false);
    }
  }

  async function markAsOrdered() {
    if (!order) return;

    setSaving(true);
    setMessage("");

    try {
      const { error } =
        await supabase
          .from(
            "purchase_orders"
          )
          .update({
            status: "ordered",
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", order.id)
          .eq(
            "status",
            "draft"
          );

      if (error) {
        throw error;
      }

      setMessageType(
        "success"
      );

      setMessage(
        "Purchase Order marked as Ordered."
      );

      await loadData();
    } catch (error) {
      setMessageType("error");

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not mark purchase order as ordered."
      );
    } finally {
      setSaving(false);
    }
  }

  async function backToDraft() {
    if (!order) return;

    const hasReceived =
      items.some(
        (item) =>
          item.received_qty > 0
      );

    if (hasReceived) {
      setMessageType("error");

      setMessage(
        "A purchase order with received stock cannot be returned to Draft."
      );

      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { error } =
        await supabase
          .from(
            "purchase_orders"
          )
          .update({
            status: "draft",
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", order.id);

      if (error) {
        throw error;
      }

      await loadData();
    } catch (error) {
      setMessageType("error");

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not return purchase order to Draft."
      );
    } finally {
      setSaving(false);
    }
  }

  async function cancelOrder() {
    if (!order) return;

    const hasReceived =
      items.some(
        (item) =>
          item.received_qty > 0
      );

    if (hasReceived) {
      setMessageType("error");

      setMessage(
        "Purchase orders with received stock cannot be cancelled."
      );

      return;
    }

    const confirmed =
      window.confirm(
        "Cancel this purchase order?"
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { error } =
        await supabase
          .from(
            "purchase_orders"
          )
          .update({
            status:
              "cancelled",
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", order.id);

      if (error) {
        throw error;
      }

      await loadData();
    } catch (error) {
      setMessageType("error");

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not cancel purchase order."
      );
    } finally {
      setSaving(false);
    }
  }

  async function reopenDraft() {
    if (!order) return;

    setSaving(true);
    setMessage("");

    try {
      const { error } =
        await supabase
          .from(
            "purchase_orders"
          )
          .update({
            status: "draft",
            updated_at:
              new Date().toISOString(),
          })
          .eq("id", order.id)
          .eq(
            "status",
            "cancelled"
          );

      if (error) {
        throw error;
      }

      await loadData();
    } catch (error) {
      setMessageType("error");

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not reopen purchase order."
      );
    } finally {
      setSaving(false);
    }
  }

  async function receiveStock() {
    if (!order || saving) return;

    const receivingRows =
      items
        .map((item) => ({
          item_id: item.id,
          receive_qty: Number(
            receiveQty[item.id] || 0
          ),
        }))
        .filter(
          (row) =>
            Number.isFinite(
              row.receive_qty
            ) &&
            row.receive_qty > 0
        )
        .sort(
          (left, right) =>
            left.item_id -
            right.item_id
        );

    if (
      receivingRows.length ===
      0
    ) {
      setMessageType("error");
      setMessage(
        "Enter at least one quantity to receive."
      );
      return;
    }

    for (
      const row of receivingRows
    ) {
      const item =
        items.find(
          (value) =>
            value.id ===
            row.item_id
        );

      if (!item) {
        setMessageType("error");
        setMessage(
          "A selected purchase item no longer exists."
        );
        return;
      }

      const remaining =
        item.qty -
        item.received_qty;

      if (
        row.receive_qty >
        remaining
      ) {
        setMessageType("error");
        setMessage(
          `Receive quantity for "${item.description}" exceeds remaining quantity.`
        );
        return;
      }
    }

    const confirmed =
      window.confirm(
        "Record this goods receipt and update inventory?"
      );

    if (!confirmed) return;

    const requestId =
      receiveRequestIdRef.current ||
      crypto.randomUUID();

    receiveRequestIdRef.current =
      requestId;

    setSaving(true);
    setMessage("");

    try {
      const {
        data,
        error,
      } = await supabase.rpc(
        "process_purchase_order_receipt",
        {
          p_purchase_order_id:
            order.id,
          p_receipt_date:
            receiptDate,
          p_items:
            receivingRows,
          p_request_id:
            requestId,
          p_create_supplier_bill:
            false,
          p_bill_date:
            null,
          p_due_date:
            null,
        }
      );

      if (error) throw error;

      receiveRequestIdRef.current =
        null;

      setShowReceiving(false);
      setMessageType("success");

      const result =
        normalizeRpcResult(data);

      setMessage(
        result.purchase_order_status ===
          "received"
          ? "Purchase Order fully received. Inventory has been updated."
          : "Stock received successfully. Inventory has been updated."
      );

      await loadData();
      router.refresh();
    } catch (error) {
      setMessageType("error");
      setMessage(
        formatSupabaseError(
          error,
          "Could not receive stock."
        )
      );
    } finally {
      setSaving(false);
    }
  }


  /*
    ========================================
    CREATE SUPPLIER BILL
    ========================================
  */

  async function createSupplierBill() {
    if (
      !order ||
      creatingBill
    ) {
      return;
    }

    if (
      order.status !==
      "received"
    ) {
      setMessageType("error");
      setMessage(
        "The Purchase Order must be fully received before creating a Supplier Bill."
      );
      return;
    }

    if (supplierBill) {
      router.push(
        `/supplier-bills/${supplierBill.id}`
      );
      return;
    }

    if (
      items.length === 0
    ) {
      setMessageType("error");
      setMessage(
        "Purchase Order has no items."
      );
      return;
    }

    const confirmed =
      window.confirm(
        "Create the Supplier Bill from this fully received Purchase Order?"
      );

    if (!confirmed) return;

    const requestId =
      billRequestIdRef.current ||
      crypto.randomUUID();

    billRequestIdRef.current =
      requestId;

    const billDate = today();
    const dueDate =
      addDays(
        billDate,
        30
      );

    setCreatingBill(true);
    setMessage("");

    try {
      const {
        data,
        error,
      } = await supabase.rpc(
        "process_purchase_order_receipt",
        {
          p_purchase_order_id:
            order.id,
          p_receipt_date:
            billDate,
          p_items:
            [],
          p_request_id:
            requestId,
          p_create_supplier_bill:
            true,
          p_bill_date:
            billDate,
          p_due_date:
            dueDate,
        }
      );

      if (error) throw error;

      billRequestIdRef.current =
        null;

      const result =
        normalizeRpcResult(data);

      const billId =
        Number(
          result.supplier_bill_id ||
            0
        );

      if (!billId) {
        throw new Error(
          "Supplier Bill was not returned by the server."
        );
      }

      setMessageType("success");
      setMessage(
        result.supplier_bill_no
          ? `Supplier Bill ${result.supplier_bill_no} created and is ready for payment.`
          : "Supplier Bill created and is ready for payment."
      );

      router.push(
        `/supplier-bills/${billId}`
      );
      router.refresh();
    } catch (error) {
      setMessageType("error");
      setMessage(
        formatSupabaseError(
          error,
          "Could not create Supplier Bill."
        )
      );
    } finally {
      setCreatingBill(false);
    }
  }


  const receivingProgress =
    useMemo(() => {
      const ordered =
        items.reduce(
          (
            total,
            item
          ) =>
            total +
            item.qty,
          0
        );

      const received =
        items.reduce(
          (
            total,
            item
          ) =>
            total +
            item.received_qty,
          0
        );

      return {
        ordered,

        received,

        remaining:
          ordered -
          received,
      };
    }, [items]);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-sm text-gray-500">
        Loading purchase
        order...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {message ||
          "Purchase order not found."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {
                order.purchase_order_no
              }
            </h1>

            <StatusBadge
              status={
                order.status
              }
            />

            {supplierBill && (
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                Billed
              </span>
            )}
          </div>

          <p className="mt-2 text-sm text-gray-500">
            Purchase Order #
            {order.id}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              router.push(
                "/purchase"
              )
            }
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>

          <Link
            href="/purchase/new"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            + New PO
          </Link>
        </div>
      </div>

      {/* MESSAGE */}

      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            messageType ===
            "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      {/* WORKFLOW */}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">
              Purchase Workflow
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Prepare → Receive Goods →
              Supplier Bill →
              Payment
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {order.status ===
              "draft" && (
              <>
                <button
                  type="button"
                  disabled={
                    saving
                  }
                  onClick={() =>
                    setShowReceiving(true)
                  }
                  style={{
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
                  }}
                >
                  Receive Stock
                </button>

                <button
                  type="button"
                  disabled={
                    saving
                  }
                  onClick={
                    cancelOrder
                  }
                  className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Cancel Order
                </button>
              </>
            )}

            {(order.status ===
              "ordered" ||
              order.status ===
                "partially_received") && (
              <>
                <button
                  type="button"
                  disabled={
                    saving
                  }
                  onClick={() =>
                    setShowReceiving(
                      true
                    )
                  }
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
                      "10px 16px",
                    fontSize:
                      "14px",
                    fontWeight:
                      600,
                  }}
                >
                  Receive Stock
                </button>

                {order.status ===
                  "ordered" && (
                  <button
                    type="button"
                    disabled={
                      saving
                    }
                    onClick={
                      backToDraft
                    }
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Back to Draft
                  </button>
                )}

                <button
                  type="button"
                  disabled={
                    saving
                  }
                  onClick={
                    cancelOrder
                  }
                  className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Cancel
                </button>
              </>
            )}

            {order.status ===
              "cancelled" && (
              <button
                type="button"
                disabled={
                  saving
                }
                onClick={
                  reopenDraft
                }
                className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Reopen as Draft
              </button>
            )}

            {order.status ===
              "received" &&
              !supplierBill && (
                <button
                  type="button"
                  disabled={
                    creatingBill
                  }
                  onClick={
                    createSupplierBill
                  }
                  style={{
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
                    opacity:
                      creatingBill
                        ? 0.6
                        : 1,
                  }}
                >
                  {creatingBill
                    ? "Creating Bill..."
                    : "Create Supplier Bill"}
                </button>
              )}

            {order.status ===
              "received" &&
              supplierBill && (
                <Link
                  href={`/supplier-bills/${supplierBill.id}`}
                  style={{
                    backgroundColor:
                      "#111827",
                    color:
                      "#ffffff",
                  }}
                  className="rounded-lg px-4 py-2.5 text-sm font-semibold"
                >
                  View Supplier Bill
                </Link>
              )}
          </div>
        </div>

        {/* WORKFLOW STEPS */}

        <div className="mt-6 grid gap-3 md:grid-cols-5">
          <WorkflowStep
            number="1"
            label="Draft"
            text="Prepare PO"
            active={
              order.status ===
              "draft"
            }
            complete={
              order.status !==
                "draft" &&
              order.status !==
                "cancelled"
            }
          />

          <WorkflowStep
            number="2"
            label="Receive"
            text="Receive supplier goods"
            active={
              order.status ===
                "ordered" ||
              order.status ===
                "partially_received"
            }
            complete={
              order.status ===
                "received"
            }
          />

          <WorkflowStep
            number="3"
            label="Received"
            text="Stock updated"
            active={
              order.status ===
              "received"
            }
            complete={
              order.status ===
                "received"
            }
          />

          <WorkflowStep
            number="4"
            label="Supplier Bill"
            text={
              supplierBill
                ? "Bill created"
                : "Waiting"
            }
            active={
              !!supplierBill
            }
            complete={
              !!supplierBill
            }
          />

          <WorkflowStep
            number="5"
            label="Payment"
            text={
              supplierBill?.status ===
              "paid"
                ? "Paid"
                : "Pay supplier"
            }
            active={
              supplierBill?.status ===
                "partially_paid" ||
              supplierBill?.status ===
                "paid"
            }
            complete={
              supplierBill?.status ===
              "paid"
            }
          />
        </div>
      </div>

      {/* SUMMARY */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Supplier"
          value={
            supplier?.supplier_name ||
            "-"
          }
          hint={
            supplier?.supplier_code ||
            "Supplier"
          }
        />

        <SummaryCard
          label="Ordered Qty"
          value={number(
            receivingProgress.ordered
          )}
          hint="Total ordered quantity"
        />

        <SummaryCard
          label="Received Qty"
          value={number(
            receivingProgress.received
          )}
          hint="Stock received"
        />

        <SummaryCard
          label="Remaining Qty"
          value={number(
            receivingProgress.remaining
          )}
          hint={
            receivingProgress.remaining ===
            0
              ? "Fully received"
              : "Still to receive"
          }
        />
      </div>

      {/* RECEIVING PANEL */}

      {showReceiving && (
        <div className="rounded-xl border border-gray-300 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
            <div>
              <h2 className="font-semibold text-gray-900">
                Receive Stock
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Enter quantities
                physically received
                from the supplier.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowReceiving(
                  false
                )
              }
              className="text-sm font-medium text-gray-500"
            >
              Close
            </button>
          </div>

          <div className="p-6">
            <div className="mb-5 flex flex-col gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:flex-row sm:items-end sm:justify-between">
              <label className="block">
                <div className="mb-1 text-xs font-medium text-gray-500">
                  Receipt Date
                </div>

                <input
                  type="date"
                  value={receiptDate}
                  onChange={(event) => {
                    setReceiptDate(
                      event.target.value
                    );
                    receiveRequestIdRef.current =
                      null;
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  const allRemaining:
                    Record<number, string> = {};

                  items.forEach(
                    (item) => {
                      allRemaining[
                        item.id
                      ] = String(
                        Math.max(
                          0,
                          item.qty -
                            item.received_qty
                        )
                      );
                    }
                  );

                  setReceiveQty(
                    allRemaining
                  );

                  receiveRequestIdRef.current =
                    null;
                }}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Receive All Remaining
              </button>
            </div>

            <div className="space-y-3">
              {items.map(
                (item) => {
                  const remaining =
                    item.qty -
                    item.received_qty;

                  return (
                    <div
                      key={
                        item.id
                      }
                      className="grid gap-4 rounded-lg border border-gray-200 p-4 md:grid-cols-[1fr_120px_120px_160px] md:items-center"
                    >
                      <div>
                        <div className="font-medium text-gray-900">
                          {item.product_name ||
                            item.description}
                        </div>

                        <div className="mt-1 text-xs text-gray-500">
                          {
                            item.product_code
                          }
                        </div>
                      </div>

                      <div className="text-sm">
                        <div className="text-xs text-gray-400">
                          Ordered
                        </div>

                        <div className="mt-1 font-medium">
                          {number(
                            item.qty
                          )}
                        </div>
                      </div>

                      <div className="text-sm">
                        <div className="text-xs text-gray-400">
                          Remaining
                        </div>

                        <div className="mt-1 font-medium">
                          {number(
                            remaining
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-500">
                          Receive Now
                        </label>

                        <input
                          type="number"
                          min="0"
                          max={
                            remaining
                          }
                          step="0.001"
                          disabled={
                            remaining <=
                            0
                          }
                          value={
                            receiveQty[
                              item.id
                            ] || ""
                          }
                          onChange={(e) => {
                            receiveRequestIdRef.current =
                              null;

                            setReceiveQty(
                              (
                                current
                              ) => ({
                                ...current,

                                [item.id]:
                                  e
                                    .target
                                    .value,
                              })
                            );
                          }}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400 disabled:bg-gray-50"
                        />
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() =>
                  setShowReceiving(
                    false
                  )
                }
                className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  saving
                }
                onClick={
                  receiveStock
                }
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
                      ? 0.6
                      : 1,
                }}
              >
                {saving
                  ? "Receiving..."
                  : "Confirm Receipt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ITEMS */}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">
            Purchase Items
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <Header>
                  Product
                </Header>

                <Header right>
                  Ordered
                </Header>

                <Header right>
                  Received
                </Header>

                <Header right>
                  Remaining
                </Header>

                <Header right>
                  Unit Cost
                </Header>

                <Header right>
                  Total
                </Header>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {items.map(
                (item) => (
                  <tr
                    key={
                      item.id
                    }
                  >
                    <td className="px-5 py-4">
                      <div className="font-medium text-gray-900">
                        {item.product_name ||
                          item.description}
                      </div>

                      <div className="mt-1 text-xs text-gray-500">
                        {item.product_code ||
                          item.description}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-right text-sm">
                      {number(
                        item.qty
                      )}
                    </td>

                    <td className="px-5 py-4 text-right text-sm font-medium text-green-700">
                      {number(
                        item.received_qty
                      )}
                    </td>

                    <td className="px-5 py-4 text-right text-sm">
                      {number(
                        item.qty -
                          item.received_qty
                      )}
                    </td>

                    <td className="px-5 py-4 text-right text-sm">
                      {money(
                        item.unit_cost,
                        order.currency
                      )}
                    </td>

                    <td className="px-5 py-4 text-right text-sm font-semibold">
                      {money(
                        item.line_total,
                        order.currency
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* INFORMATION */}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Purchase Information">
            <div className="grid gap-6 md:grid-cols-2">
              <InfoItem
                label="Order Date"
                value={formatDate(
                  order.order_date
                )}
              />

              <InfoItem
                label="Expected Date"
                value={
                  order.expected_date
                    ? formatDate(
                        order.expected_date
                      )
                    : "-"
                }
              />

              <InfoItem
                label="Supplier"
                value={
                  supplier?.supplier_name ||
                  "-"
                }
              />

              <InfoItem
                label="Currency"
                value={
                  order.currency
                }
              />
            </div>
          </Section>

          <Section title="Notes & Terms">
            <div className="space-y-5">
              <InfoItem
                label="Notes"
                value={
                  order.notes ||
                  "-"
                }
              />

              <InfoItem
                label="Terms"
                value={
                  order.terms ||
                  "-"
                }
              />
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          {/* ORDER SUMMARY */}

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900">
              Order Summary
            </h3>

            <div className="mt-5 space-y-4">
              <Metric
                label="Subtotal"
                value={money(
                  order.subtotal,
                  order.currency
                )}
              />

              <Metric
                label="Discount"
                value={money(
                  order.discount_amount,
                  order.currency
                )}
              />

              <Metric
                label="Tax"
                value={money(
                  order.tax_amount,
                  order.currency
                )}
              />

              <div className="border-t border-gray-200 pt-4">
                <Metric
                  label="Total"
                  value={money(
                    order.total_amount,
                    order.currency
                  )}
                  strong
                />
              </div>
            </div>
          </div>

          {/* SUPPLIER BILL */}

          {order.status ===
            "received" && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900">
                Supplier Bill
              </h3>

              {!supplierBill ? (
                <>
                  <p className="mt-2 text-sm leading-6 text-gray-500">
                    Goods have been
                    fully received.
                    Create the supplier
                    payable from this
                    Purchase Order.
                  </p>

                  <button
                    type="button"
                    disabled={
                      creatingBill
                    }
                    onClick={
                      createSupplierBill
                    }
                    style={{
                      width:
                        "100%",

                      marginTop:
                        "16px",

                      backgroundColor:
                        "#111827",

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
                        "pointer",

                      opacity:
                        creatingBill
                          ? 0.6
                          : 1,
                    }}
                  >
                    {creatingBill
                      ? "Creating..."
                      : "Create Supplier Bill"}
                  </button>
                </>
              ) : (
                <>
                  <div className="mt-4 space-y-3">
                    <Metric
                      label="Bill"
                      value={
                        supplierBill.bill_no
                      }
                    />

                    <Metric
                      label="Status"
                      value={labelize(
                        supplierBill.status
                      )}
                    />

                    <Metric
                      label="Total"
                      value={money(
                        supplierBill.total_amount,
                        order.currency
                      )}
                    />

                    <Metric
                      label="Paid"
                      value={money(
                        supplierBill.paid_amount,
                        order.currency
                      )}
                    />

                    <Metric
                      label="Balance"
                      value={money(
                        supplierBill.balance_due,
                        order.currency
                      )}
                      strong
                    />
                  </div>

                  <Link
                    href={`/supplier-bills/${supplierBill.id}`}
                    style={{
                      display:
                        "block",

                      marginTop:
                        "16px",

                      backgroundColor:
                        "#111827",

                      color:
                        "#ffffff",
                    }}
                    className="rounded-lg px-4 py-2.5 text-center text-sm font-semibold"
                  >
                    View Supplier Bill
                  </Link>
                </>
              )}
            </div>
          )}

          {/* SUPPLIER */}

          {supplier && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900">
                Supplier
              </h3>

              <div className="mt-4 space-y-3">
                <InfoItem
                  label="Contact"
                  value={
                    supplier.contact_name ||
                    "-"
                  }
                />

                <InfoItem
                  label="Phone"
                  value={
                    supplier.phone ||
                    "-"
                  }
                />

                <InfoItem
                  label="Email"
                  value={
                    supplier.email ||
                    "-"
                  }
                />
              </div>

              <Link
                href={`/suppliers/${supplier.id}`}
                className="mt-5 block rounded-lg border border-gray-200 px-4 py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                View Supplier
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ========================================
   UI
======================================== */

function WorkflowStep({
  number,
  label,
  text,
  active,
  complete,
}: {
  number: string;
  label: string;
  text: string;
  active: boolean;
  complete: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        active ||
        complete
          ? "border-gray-900 bg-gray-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            active ||
            complete
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-400"
          }`}
        >
          {complete
            ? "✓"
            : number}
        </div>

        <div>
          <div className="text-sm font-semibold text-gray-900">
            {label}
          </div>

          <div className="mt-1 text-xs text-gray-500">
            {text}
          </div>
        </div>
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
      <div className="text-sm font-medium text-gray-500">
        {label}
      </div>

      <div className="mt-2 text-xl font-semibold text-gray-900">
        {value}
      </div>

      <div className="mt-2 text-xs text-gray-400">
        {hint}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="font-semibold text-gray-900">
          {title}
        </h2>
      </div>

      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </div>

      <div className="mt-2 text-sm font-medium text-gray-900">
        {value}
      </div>
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
            ? "text-lg font-semibold text-gray-900"
            : "text-sm font-semibold text-gray-900"
        }
      >
        {value}
      </span>
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
  status,
}: {
  status: string;
}) {
  const label =
    labelize(status);

  const tone =
    status === "received"
      ? "bg-green-50 text-green-700"
      : status ===
        "partially_received"
      ? "bg-amber-50 text-amber-700"
      : status ===
        "ordered"
      ? "bg-blue-50 text-blue-700"
      : status ===
        "cancelled"
      ? "bg-red-50 text-red-700"
      : "bg-gray-100 text-gray-700";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      {label}
    </span>
  );
}

/* ========================================
   FORMAT
======================================== */

function labelize(
  value: string
) {
  return String(
    value || "-"
  )
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function number(
  value: number
) {
  return Number(
    value || 0
  ).toLocaleString(
    undefined,
    {
      maximumFractionDigits:
        3,
    }
  );
}

function formatDate(
  value: string
) {
  const parts =
    value.split("-");

  if (
    parts.length === 3
  ) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return value;
}



function normalizeRpcResult(
  data: unknown
): Record<string, any> {
  if (
    Array.isArray(data)
  ) {
    return (
      (data[0] as Record<
        string,
        any
      >) || {}
    );
  }

  if (
    data &&
    typeof data ===
      "object"
  ) {
    return data as Record<
      string,
      any
    >;
  }

  return {};
}

function formatSupabaseError(
  error: unknown,
  fallback: string
) {
  if (
    error instanceof Error
  ) {
    return (
      error.message ||
      fallback
    );
  }

  if (
    error &&
    typeof error === "object"
  ) {
    const value =
      error as {
        message?: unknown;
        details?: unknown;
        hint?: unknown;
        code?: unknown;
      };

    const parts = [
      typeof value.message ===
      "string"
        ? value.message
        : "",
      typeof value.details ===
        "string" &&
      value.details
        ? `Details: ${value.details}`
        : "",
      typeof value.hint ===
        "string" &&
      value.hint
        ? `Hint: ${value.hint}`
        : "",
      typeof value.code ===
        "string" &&
      value.code
        ? `Code: ${value.code}`
        : "",
    ].filter(Boolean);

    if (parts.length) {
      return parts.join(
        " • "
      );
    }
  }

  return fallback;
}

function today() {
  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
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

function addDays(
  dateValue: string,
  days: number
) {
  const date =
    new Date(
      `${dateValue}T00:00:00`
    );

  date.setDate(
    date.getDate() +
      days
  );

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
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


function money(
  value: number,
  currency: string
) {
  if (
    currency === "MMK"
  ) {
    return `K ${Number(
      value || 0
    ).toLocaleString(
      undefined,
      {
        maximumFractionDigits:
          0,
      }
    )}`;
  }

  const symbol =
    currency === "USD"
      ? "$"
      : currency === "SGD"
      ? "S$"
      : currency === "EUR"
      ? "€"
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