"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type PeriodStatus = "open" | "closed" | "reopened";

type SalesOrder = {
  id: number;
  company_id: number;
  customer_id: number;
  quotation_id: number | null;
  sales_order_no: string;
  order_date: string;
  status: string;
  currency: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  terms: string | null;
  is_fulfilled: boolean;
  fulfilled_at: string | null;
};

type Customer = {
  id: number;
  customer_name: string;
  customer_code: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_id: string | null;
};

type SalesOrderItem = {
  id: number;
  description: string;
  qty: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  line_total: number;
};

type DeliveryNote = {
  id: number;
  delivery_note_no: string;
  delivery_date: string;
  receiver_name: string | null;
  remarks: string | null;
};

export default function SalesOrderDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [salesOrder, setSalesOrder] = useState<SalesOrder | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [deliveryNote, setDeliveryNote] = useState<DeliveryNote | null>(null);

  const [periodStatus, setPeriodStatus] = useState<PeriodStatus>("open");
  const [periodClosedAt, setPeriodClosedAt] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadSalesOrder();
  }, [id]);

  async function loadSalesOrder(showLoader = true) {
    if (showLoader) setLoading(true);
    setError("");

    try {
      const salesOrderId = Number(id);
      if (!Number.isFinite(salesOrderId)) {
        throw new Error("Invalid sales order ID.");
      }

      const { data: orderData, error: orderError } = await supabase
        .from("sales_orders")
        .select(`
          id,
          company_id,
          customer_id,
          quotation_id,
          sales_order_no,
          order_date,
          status,
          currency,
          subtotal,
          discount_amount,
          tax_amount,
          total_amount,
          notes,
          terms,
          is_fulfilled,
          fulfilled_at
        `)
        .eq("id", salesOrderId)
        .maybeSingle();

      if (orderError) throw orderError;
      if (!orderData) throw new Error("Sales Order not found.");

      const order: SalesOrder = {
        ...orderData,
        company_id: Number(orderData.company_id),
        subtotal: Number(orderData.subtotal || 0),
        discount_amount: Number(orderData.discount_amount || 0),
        tax_amount: Number(orderData.tax_amount || 0),
        total_amount: Number(orderData.total_amount || 0),
        is_fulfilled: orderData.is_fulfilled === true,
        fulfilled_at: orderData.fulfilled_at || null,
      };

      setSalesOrder(order);

      const [
        customerResult,
        itemsResult,
        deliveryResult,
        closeResult,
      ] = await Promise.all([
        supabase
          .from("customers")
          .select(`
            id,
            customer_name,
            customer_code,
            contact_name,
            phone,
            email,
            address,
            tax_id
          `)
          .eq("id", order.customer_id)
          .maybeSingle(),

        supabase
          .from("sales_order_items")
          .select(`
            id,
            description,
            qty,
            unit_price,
            discount_percent,
            tax_percent,
            line_total
          `)
          .eq("sales_order_id", salesOrderId)
          .order("sort_order", { ascending: true }),

        supabase
          .from("delivery_notes")
          .select(`
            id,
            delivery_note_no,
            delivery_date,
            receiver_name,
            remarks
          `)
          .eq("sales_order_id", salesOrderId)
          .maybeSingle(),

        supabase
          .from("accounting_period_closes")
          .select("status, closed_at")
          .eq("company_id", order.company_id)
          .eq("period_start", firstDayOfDate(order.order_date))
          .maybeSingle(),
      ]);

      if (customerResult.error) throw customerResult.error;
      if (itemsResult.error) throw itemsResult.error;
      if (deliveryResult.error) throw deliveryResult.error;
      if (closeResult.error) throw closeResult.error;

      setCustomer(customerResult.data as Customer | null);
      setItems(
        (itemsResult.data || []).map((item: any) => ({
          id: Number(item.id),
          description: item.description,
          qty: Number(item.qty || 0),
          unit_price: Number(item.unit_price || 0),
          discount_percent: Number(item.discount_percent || 0),
          tax_percent: Number(item.tax_percent || 0),
          line_total: Number(item.line_total || 0),
        }))
      );
      setDeliveryNote(deliveryResult.data as DeliveryNote | null);

      setPeriodStatus(
        closeResult.data?.status === "closed"
          ? "closed"
          : closeResult.data?.status === "reopened"
          ? "reopened"
          : "open"
      );
      setPeriodClosedAt(closeResult.data?.closed_at || null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Could not load sales order.");
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  function ensurePeriodEditable(action: string) {
    if (periodStatus !== "closed") return true;

    setError(
      `This Sales Order belongs to a closed accounting period and cannot ${action}. Reopen the month from Reports → Month-End Close first.`
    );
    return false;
  }

  async function updateStatus(newStatus: string) {
    if (!salesOrder || updating) return;
    if (!ensurePeriodEditable("change status")) return;

    if (salesOrder.is_fulfilled && newStatus !== "confirmed") {
      setError(
        "This order has already been fulfilled. It cannot be reopened or cancelled because inventory has already been deducted."
      );
      return;
    }

    setUpdating(true);
    setError("");
    setSuccess("");

    try {
      const { error: updateError } = await supabase
        .from("sales_orders")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", salesOrder.id);

      if (updateError) throw updateError;

      setSalesOrder({ ...salesOrder, status: newStatus });
      setSuccess(`Sales Order status changed to ${capitalize(newStatus)}.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update sales order status."
      );
    } finally {
      setUpdating(false);
    }
  }

  async function ensureDeliveryNote(order: SalesOrder) {
    const { data: existing, error: existingError } = await supabase
      .from("delivery_notes")
      .select(`
        id,
        delivery_note_no,
        delivery_date,
        receiver_name,
        remarks
      `)
      .eq("sales_order_id", order.id)
      .maybeSingle();

    if (existingError) throw existingError;

    if (!existing) {
      throw new Error(
        "Delivery Note is missing. Fulfillment should create it automatically."
      );
    }

    setDeliveryNote(existing as DeliveryNote);
    return existing as DeliveryNote;
  }


  async function fulfillOrder() {
    if (!salesOrder || updating) return;
    if (!ensurePeriodEditable("be fulfilled")) return;

    if (salesOrder.status !== "confirmed") {
      setError("Sales Order must be confirmed before delivery.");
      return;
    }

    if (salesOrder.is_fulfilled) {
      setError("This Sales Order has already been fulfilled.");
      return;
    }

    if (
      !window.confirm(
        "Deliver / fulfill this Sales Order now?\n\nProduct stock will be deducted and a Delivery Note will be created."
      )
    ) {
      return;
    }

    setUpdating(true);
    setError("");
    setSuccess("");

    try {
      const { error: fulfillmentError } = await supabase.rpc(
        "fulfill_sales_order",
        { p_sales_order_id: salesOrder.id }
      );

      if (fulfillmentError) throw fulfillmentError;

      const { data: freshOrderData, error: freshOrderError } = await supabase
        .from("sales_orders")
        .select(`
          id,
          company_id,
          customer_id,
          quotation_id,
          sales_order_no,
          order_date,
          status,
          currency,
          subtotal,
          discount_amount,
          tax_amount,
          total_amount,
          notes,
          terms,
          is_fulfilled,
          fulfilled_at
        `)
        .eq("id", salesOrder.id)
        .single();

      if (freshOrderError) throw freshOrderError;

      const freshOrder: SalesOrder = {
        ...freshOrderData,
        company_id: Number(freshOrderData.company_id),
        subtotal: Number(freshOrderData.subtotal || 0),
        discount_amount: Number(freshOrderData.discount_amount || 0),
        tax_amount: Number(freshOrderData.tax_amount || 0),
        total_amount: Number(freshOrderData.total_amount || 0),
        is_fulfilled: freshOrderData.is_fulfilled === true,
        fulfilled_at: freshOrderData.fulfilled_at || null,
      };

      setSalesOrder(freshOrder);

      try {
        const note = await ensureDeliveryNote(freshOrder);
        setSuccess(
          `Order delivered successfully. Inventory updated and Delivery Note ${note.delivery_note_no} created.`
        );
      } catch (deliveryError) {
        setError(
          deliveryError instanceof Error
            ? `Stock was delivered successfully, but Delivery Note creation failed: ${deliveryError.message}`
            : "Stock was delivered, but Delivery Note could not be created."
        );
      }

      await loadSalesOrder(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fulfill Sales Order.");
    } finally {
      setUpdating(false);
    }
  }

  async function convertToInvoice() {
    if (!salesOrder || updating) return;
    if (!ensurePeriodEditable("create an invoice")) return;

    if (salesOrder.status !== "confirmed") {
      setError("Sales Order must be confirmed before creating an invoice.");
      return;
    }

    if (!salesOrder.is_fulfilled) {
      setError("Sales Order must be fulfilled before creating an invoice.");
      return;
    }

    setUpdating(true);
    setError("");
    setSuccess("");

    try {
      const invoiceDate = today();
      const dueDate = addDays(invoiceDate, 30);

      const { data, error } = await supabase.rpc(
        "create_invoice_from_sales_order",
        {
          p_sales_order_id: salesOrder.id,
          p_invoice_date: invoiceDate,
          p_due_date: dueDate,
        }
      );

      if (error) throw error;

      const result =
        data && typeof data === "object"
          ? (data as Record<string, unknown>)
          : {};

      const invoiceId = Number(result.invoice_id || 0);

      if (!invoiceId) {
        throw new Error("Invoice ID was not returned by the server.");
      }

      setSuccess(
        typeof result.invoice_no === "string"
          ? `Invoice ${result.invoice_no} is ready for payment.`
          : "Invoice is ready for payment."
      );

      router.push(`/invoices/${invoiceId}`);
      router.refresh();
    } catch (err) {
      const message = formatSupabaseError(
        err,
        "Could not create invoice."
      );

      console.warn("[sales-order-invoice]", message);
      setError(message);
    } finally {
      setUpdating(false);
    }
  }


  async function openDeliveryNote() {
    if (!salesOrder) return;
    setError("");

    try {
      let note = deliveryNote;

      if (!note && salesOrder.is_fulfilled) {
        if (periodStatus === "closed") {
          setError(
            "This order is in a closed period. An existing Delivery Note can be viewed, but a missing one cannot be created until the month is reopened."
          );
          return;
        }
        note = await ensureDeliveryNote(salesOrder);
      }

      if (!note) {
        setError("Delivery Note is not available until this order is fulfilled.");
        return;
      }

      router.push(`/print/delivery-notes/${note.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open Delivery Note.");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-sm text-gray-500">
        Loading sales order...
      </div>
    );
  }

  if (error && !salesOrder) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!salesOrder) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Sales Order not found.
      </div>
    );
  }

  const currency = salesOrder.currency || "THB";
  const canFulfill =
    salesOrder.status === "confirmed" &&
    !salesOrder.is_fulfilled &&
    periodStatus !== "closed";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {salesOrder.sales_order_no}
            </h1>
            <StatusBadge status={salesOrder.status} />
            <PeriodBadge status={periodStatus} />

            {salesOrder.is_fulfilled && (
              <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                ✓ Fulfilled
              </span>
            )}

            {deliveryNote && (
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                Delivery Note Ready
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
            <span>Sales Order ID #{salesOrder.id}</span>
            {salesOrder.quotation_id && (
              <span>From Quotation #{salesOrder.quotation_id}</span>
            )}
            {salesOrder.fulfilled_at && (
              <span>Delivered {formatDateTime(salesOrder.fulfilled_at)}</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {salesOrder.quotation_id && (
            <button
              type="button"
              onClick={() => router.push(`/quotations/${salesOrder.quotation_id}`)}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              View Quotation
            </button>
          )}

          {salesOrder.is_fulfilled && deliveryNote && (
            <button
              type="button"
              onClick={openDeliveryNote}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              View Delivery Note
            </button>
          )}

          <button
            type="button"
            onClick={() => router.push("/sales")}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
        </div>
      </div>

      {periodStatus === "closed" && (
        <PeriodNotice
          tone="closed"
          title="Period Closed • Read Only"
          text={`This Sales Order belongs to a closed accounting period${
            periodClosedAt ? ` closed on ${formatDateTime(periodClosedAt)}` : ""
          }. Status changes, fulfillment, stock movements and new related documents are locked.`}
        />
      )}

      {periodStatus === "reopened" && (
        <PeriodNotice
          tone="reopened"
          title="Period Reopened"
          text="Workflow changes are currently allowed. Close the accounting month again when corrections are complete."
        />
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Customer" value={customer?.customer_name || "-"} />
        <SummaryCard label="Order Date" value={formatDate(salesOrder.order_date)} />
        <SummaryCard label="Order Status" value={capitalize(salesOrder.status)} />
        <SummaryCard label="Grand Total" value={money(salesOrder.total_amount, currency)} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Sales Order Workflow</h2>
            <p className="mt-1 text-sm text-gray-500">
              Confirm the order, deliver the goods, issue the Delivery Note, and invoice the customer.
            </p>
          </div>

          {periodStatus === "closed" ? (
            <span className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-500">
              Workflow locked for closed period
            </span>
          ) : (
            <div className="flex flex-wrap gap-2">
              <StatusActions
                status={salesOrder.status}
                updating={updating}
                fulfilled={salesOrder.is_fulfilled}
                onChange={updateStatus}
              />
              {canFulfill && (
                <ActionButton
                  label={updating ? "Processing..." : "Deliver / Fulfill Order"}
                  onClick={fulfillOrder}
                  disabled={updating}
                  green
                />
              )}
            </div>
          )}
        </div>

        <WorkflowSteps
          status={salesOrder.status}
          fulfilled={salesOrder.is_fulfilled}
          hasDeliveryNote={Boolean(deliveryNote)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section title="Customer Information">
            <div className="grid gap-6 md:grid-cols-2">
              <InfoItem label="Customer" value={customer?.customer_name} />
              <InfoItem label="Customer Code" value={customer?.customer_code} />
              <InfoItem label="Contact" value={customer?.contact_name} />
              <InfoItem label="Phone" value={customer?.phone} />
              <InfoItem label="Email" value={customer?.email} />
              <InfoItem label="Tax ID" value={customer?.tax_id} />
              <div className="md:col-span-2">
                <InfoItem label="Address" value={customer?.address} />
              </div>
            </div>
          </Section>

          <Section title={`Sales Order Items • ${items.length}`}>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <TableHeader>Description</TableHeader>
                    <TableHeader right>Qty</TableHeader>
                    <TableHeader right>Unit Price</TableHeader>
                    <TableHeader right>Discount</TableHeader>
                    <TableHeader right>Tax</TableHeader>
                    <TableHeader right>Total</TableHeader>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-5 py-4 text-sm font-medium text-gray-900">
                        {item.description}
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-gray-600">
                        {formatQty(item.qty)}
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-gray-600">
                        {money(item.unit_price, currency)}
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-gray-600">
                        {formatPercent(item.discount_percent)}
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-gray-600">
                        {formatPercent(item.tax_percent)}
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-semibold text-gray-900">
                        {money(item.line_total, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {(salesOrder.notes || salesOrder.terms) && (
            <div className="grid gap-6 md:grid-cols-2">
              <TextCard title="Notes" value={salesOrder.notes} />
              <TextCard title="Terms & Conditions" value={salesOrder.terms} />
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Section title="Order Summary">
            <div className="space-y-4">
              <Metric label="Subtotal" value={money(salesOrder.subtotal, currency)} />
              <Metric
                label="Discount"
                value={`-${money(salesOrder.discount_amount, currency)}`}
              />
              <Metric label="Tax" value={money(salesOrder.tax_amount, currency)} />
              <div className="border-t border-gray-200 pt-4">
                <Metric
                  label="Grand Total"
                  value={money(salesOrder.total_amount, currency)}
                  strong
                />
              </div>
            </div>
          </Section>

          <Section title="Fulfillment">
            <div className="space-y-4">
              <InfoRow
                label="Delivery Status"
                value={salesOrder.is_fulfilled ? "Fulfilled" : "Not Fulfilled"}
              />
              <InfoRow
                label="Stock Effect"
                value={salesOrder.is_fulfilled ? "Stock deducted" : "No stock deducted"}
              />
              {salesOrder.fulfilled_at && (
                <InfoRow
                  label="Delivered At"
                  value={formatDateTime(salesOrder.fulfilled_at)}
                />
              )}
            </div>

            {canFulfill && (
              <ActionButton
                label={updating ? "Processing..." : "Deliver / Fulfill Order"}
                onClick={fulfillOrder}
                disabled={updating}
                green
                full
              />
            )}

            {salesOrder.is_fulfilled && (
              <div className="mt-5 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                ✓ Goods delivered and inventory updated.
              </div>
            )}
          </Section>

          <Section title="Delivery Note">
            {!salesOrder.is_fulfilled ? (
              <p className="text-sm leading-6 text-gray-500">
                The Delivery Note will be created when the order is fulfilled.
              </p>
            ) : deliveryNote ? (
              <>
                <div className="space-y-4">
                  <InfoRow label="Delivery Note" value={deliveryNote.delivery_note_no} />
                  <InfoRow label="Delivery Date" value={formatDate(deliveryNote.delivery_date)} />
                  <InfoRow label="Status" value="Ready" />
                </div>
                <ActionButton label="View / Print Delivery Note" onClick={openDeliveryNote} full />
              </>
            ) : (
              <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Delivery Note is missing. Fulfillment should create it automatically.
              </div>
            )}
          </Section>

          <Section title="Next Step">
            {periodStatus === "closed" ? (
              <div className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-600">
                This Sales Order is read-only because its accounting period is closed.
              </div>
            ) : salesOrder.status === "cancelled" ? (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                This Sales Order has been cancelled.
              </div>
            ) : salesOrder.status !== "confirmed" ? (
              <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
                Next: Confirm Order
              </div>
            ) : !salesOrder.is_fulfilled ? (
              <ActionButton
                label={updating ? "Processing..." : "Deliver / Fulfill Order"}
                onClick={fulfillOrder}
                disabled={updating}
                green
                full
              />
            ) : (
              <>
                <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                  ✓ Delivery Complete
                </div>
                <p className="mt-4 text-sm leading-6 text-gray-500">
                  The next business step is to create the customer invoice.
                </p>
                <ActionButton
                  label={updating ? "Processing..." : "Create Invoice"}
                  onClick={convertToInvoice}
                  disabled={updating}
                  full
                />
              </>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function StatusActions({
  status,
  updating,
  fulfilled,
  onChange,
}: {
  status: string;
  updating: boolean;
  fulfilled: boolean;
  onChange: (status: string) => void;
}) {
  if (fulfilled) return null;
  const normalized = status || "draft";

  if (normalized === "draft") {
    return (
      <>
        <ActionButton
          label={updating ? "Updating..." : "Confirm Order"}
          onClick={() => onChange("confirmed")}
          disabled={updating}
          green
        />
        <button
          type="button"
          disabled={updating}
          onClick={() => onChange("cancelled")}
          className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600"
        >
          Cancel Order
        </button>
      </>
    );
  }

  if (normalized === "confirmed") {
    return (
      <>
        <button
          type="button"
          disabled={updating}
          onClick={() => onChange("draft")}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
        >
          Back to Draft
        </button>
        <button
          type="button"
          disabled={updating}
          onClick={() => onChange("cancelled")}
          className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600"
        >
          Cancel Order
        </button>
      </>
    );
  }

  return (
    <button
      type="button"
      disabled={updating}
      onClick={() => onChange("draft")}
      className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
    >
      Reopen as Draft
    </button>
  );
}

function WorkflowSteps({
  status,
  fulfilled,
  hasDeliveryNote,
}: {
  status: string;
  fulfilled: boolean;
  hasDeliveryNote: boolean;
}) {
  const normalized = status || "draft";
  const confirmed = normalized === "confirmed" || fulfilled;
  const cancelled = normalized === "cancelled";

  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <WorkflowStep number="1" label="Draft" active={normalized === "draft"} />
      <WorkflowStep number="2" label="Confirmed" active={confirmed && !cancelled} />
      <WorkflowStep
        number="3"
        label={cancelled ? "Cancelled" : "Delivery"}
        active={fulfilled || cancelled}
        danger={cancelled}
      />
      <WorkflowStep number="4" label="Delivery Note" active={hasDeliveryNote} />
      <WorkflowStep number="5" label="Invoice" active={confirmed && !cancelled} />
    </div>
  );
}

function WorkflowStep({
  number,
  label,
  active,
  danger = false,
}: {
  number: string;
  label: string;
  active: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        active
          ? danger
            ? "border-red-200 bg-red-50"
            : "border-gray-900 bg-gray-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
            active
              ? danger
                ? "bg-red-600 text-white"
                : "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-400"
          }`}
        >
          {number}
        </div>
        <div className="text-sm font-semibold text-gray-900">{label}</div>
      </div>
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

function PeriodBadge({ status }: { status: PeriodStatus }) {
  if (status === "open") return null;

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        status === "closed"
          ? "bg-gray-900 text-white"
          : "bg-blue-50 text-blue-700"
      }`}
    >
      {status === "closed" ? "Period Closed" : "Period Reopened"}
    </span>
  );
}

function ActionButton({
  label,
  onClick,
  disabled = false,
  green = false,
  full = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  green?: boolean;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        backgroundColor: disabled ? "#d1d5db" : green ? "#15803d" : "#111827",
        color: "#ffffff",
      }}
      className={`${full ? "mt-4 w-full" : ""} rounded-lg px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed`}
    >
      {label}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-gray-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-2 whitespace-pre-line text-sm font-medium text-gray-900">
        {value || "-"}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

function TextCard({ title, value }: { title: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-600">
        {value || "-"}
      </p>
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
      <span className={strong ? "font-semibold text-gray-900" : "text-sm text-gray-500"}>
        {label}
      </span>
      <span className={strong ? "text-xl font-semibold text-gray-900" : "font-medium text-gray-900"}>
        {value}
      </span>
    </div>
  );
}

function TableHeader({
  children,
  right = false,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status || "draft";
  const style =
    normalized === "confirmed"
      ? "bg-green-50 text-green-700"
      : normalized === "cancelled"
      ? "bg-red-50 text-red-700"
      : "bg-gray-100 text-gray-700";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${style}`}>
      {normalized}
    </span>
  );
}


function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}



function formatSupabaseError(
  err: unknown,
  fallback: string
) {
  if (err instanceof Error) {
    return err.message || fallback;
  }

  if (err && typeof err === "object") {
    const value = err as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };

    const parts = [
      typeof value.message === "string" ? value.message : "",
      typeof value.details === "string" && value.details
        ? `Details: ${value.details}`
        : "",
      typeof value.hint === "string" && value.hint
        ? `Hint: ${value.hint}`
        : "",
      typeof value.code === "string" && value.code
        ? `Code: ${value.code}`
        : "",
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" • ");
    }
  }

  return fallback;
}


function firstDayOfDate(value: string) {
  return `${String(value || "").slice(0, 7)}-01`;
}

function money(value: number, currency: string) {
  return `${currencySymbol(currency)}${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function currencySymbol(currency: string) {
  if (currency === "MMK") return "K ";
  if (currency === "USD") return "$";
  if (currency === "EUR") return "€";
  if (currency === "SGD") return "S$";
  return "฿";
}

function formatDate(value: string) {
  const parts = String(value || "").split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value || "-";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatQty(value: number) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function formatPercent(value: number) {
  return `${Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}%`;
}

function capitalize(value: string) {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
