import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SalesOrdersClient from "./sales-orders-client";

export const instant = false;

type SalesOrderRow = {
  id: number;
  sales_order_no: string;
  order_date: string;
  status: string;
  currency: string;
  total_amount: number;
  is_fulfilled: boolean;
  order_source: string | null;
  quotation_id: number | null;
  customer_id: number;
  fulfilled_at: string | null;
};

type InvoiceRow = {
  id: number;
  sales_order_id: number | null;
  invoice_no: string;
  status: string;
  currency: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  invoice_date: string;
};

export default async function SalesOrdersPage() {
  const supabase = await createClient();

  const { data: ordersData, error: ordersError } =
    await supabase
      .from("sales_orders")
      .select(`
        id,
        sales_order_no,
        order_date,
        status,
        currency,
        total_amount,
        is_fulfilled,
        order_source,
        quotation_id,
        customer_id,
        fulfilled_at
      `)
      .order("id", {
        ascending: false,
      });

  if (ordersError) {
    return <ErrorBox message={ordersError.message} />;
  }

  const orders: SalesOrderRow[] = (
    ordersData || []
  ).map((row: any) => ({
    id: Number(row.id),
    sales_order_no: row.sales_order_no,
    order_date: row.order_date,
    status: row.status || "draft",
    currency: row.currency || "THB",
    total_amount: Number(row.total_amount || 0),
    is_fulfilled: row.is_fulfilled === true,
    order_source: row.order_source || null,
    quotation_id: row.quotation_id
      ? Number(row.quotation_id)
      : null,
    customer_id: Number(row.customer_id),
    fulfilled_at: row.fulfilled_at || null,
  }));

  const orderIds = orders.map((order) => order.id);

  const customerIds = Array.from(
    new Set(
      orders.map((order) => order.customer_id)
    )
  );

  const [customersResult, invoicesResult] =
    await Promise.all([
      customerIds.length > 0
        ? supabase
            .from("customers")
            .select(`
              id,
              customer_name
            `)
            .in("id", customerIds)
        : Promise.resolve({
            data: [],
            error: null,
          }),

      orderIds.length > 0
        ? supabase
            .from("invoices")
            .select(`
              id,
              sales_order_id,
              invoice_no,
              status,
              currency,
              total_amount,
              paid_amount,
              balance_due,
              invoice_date
            `)
            .in("sales_order_id", orderIds)
        : Promise.resolve({
            data: [],
            error: null,
          }),
    ]);

  if (customersResult.error) {
    return (
      <ErrorBox
        message={customersResult.error.message}
      />
    );
  }

  if (invoicesResult.error) {
    return (
      <ErrorBox
        message={invoicesResult.error.message}
      />
    );
  }

  const customerMap = new Map<number, string>();

  for (const customer of customersResult.data || []) {
    customerMap.set(
      Number(customer.id),
      customer.customer_name
    );
  }

  const invoiceMap = new Map<number, InvoiceRow>();

  for (const raw of invoicesResult.data || []) {
    if (!raw.sales_order_id) continue;

    invoiceMap.set(Number(raw.sales_order_id), {
      id: Number(raw.id),
      sales_order_id: Number(raw.sales_order_id),
      invoice_no: raw.invoice_no,
      status: raw.status || "draft",
      currency: raw.currency || "THB",
      total_amount: Number(raw.total_amount || 0),
      paid_amount: Number(raw.paid_amount || 0),
      balance_due: Number(raw.balance_due || 0),
      invoice_date: raw.invoice_date,
    });
  }

  const enrichedOrders = orders.map((order) => {
    const invoice = invoiceMap.get(order.id);

    return {
      ...order,
      customer_name:
        customerMap.get(order.customer_id) || "-",
      invoice: invoice || null,
      source:
        order.order_source ||
        (order.quotation_id
          ? "quotation"
          : "direct"),
      last_activity:
        invoice?.invoice_date ||
        (order.fulfilled_at
          ? order.fulfilled_at.slice(0, 10)
          : order.order_date),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Sales Orders
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage order confirmation, fulfillment, invoicing and customer collection status.
          </p>
        </div>

        <Link
          href="/sales/new"
          className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
        >
          + New Sales Order
        </Link>
      </div>

      <SalesOrdersClient orders={enrichedOrders} />
    </div>
  );
}

function ErrorBox({
  message,
}: {
  message: string;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
      {message}
    </div>
  );
}
