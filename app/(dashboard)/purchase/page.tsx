import { createClient } from "@/lib/supabase/server";
import PurchaseOrdersClient from "./purchase-orders-client";

export const instant = false;

export default async function PurchaseOrdersPage() {
  const supabase = await createClient();

  const { data: poData, error: poError } = await supabase
    .from("purchase_orders")
    .select(`
      id,
      purchase_order_no,
      supplier_id,
      order_date,
      expected_date,
      status,
      currency,
      total_amount
    `)
    .order("id", { ascending: false });

  if (poError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Could not load Purchase Orders: {poError.message}
      </div>
    );
  }

  const orders = (poData || []).map((row: any) => ({
    id: Number(row.id),
    purchase_order_no: row.purchase_order_no,
    supplier_id: Number(row.supplier_id),
    order_date: row.order_date,
    expected_date: row.expected_date || null,
    status: row.status || "draft",
    currency: row.currency || "THB",
    total_amount: Number(row.total_amount || 0),
  }));

  const supplierIds = Array.from(
    new Set(orders.map((row) => row.supplier_id).filter(Boolean))
  );

  const orderIds = orders.map((row) => row.id);

  const [supplierResult, billResult] = await Promise.all([
    supplierIds.length
      ? supabase
          .from("suppliers")
          .select("id, supplier_name, supplier_code")
          .in("id", supplierIds)
      : Promise.resolve({ data: [], error: null }),
    orderIds.length
      ? supabase
          .from("supplier_bills")
          .select("id, purchase_order_id, bill_no, status, balance_due")
          .in("purchase_order_id", orderIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (supplierResult.error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Could not load suppliers: {supplierResult.error.message}
      </div>
    );
  }

  if (billResult.error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Could not load Supplier Bills: {billResult.error.message}
      </div>
    );
  }

  const supplierMap = new Map<number, any>();
  for (const supplier of supplierResult.data || []) {
    supplierMap.set(Number(supplier.id), supplier);
  }

  const billMap = new Map<number, any>();
  for (const bill of billResult.data || []) {
    if (!bill.purchase_order_id) continue;
    billMap.set(Number(bill.purchase_order_id), {
      id: Number(bill.id),
      bill_no: bill.bill_no,
      status: bill.status || "draft",
      balance_due: Number(bill.balance_due || 0),
    });
  }

  const rows = orders.map((order) => {
    const supplier = supplierMap.get(order.supplier_id);
    const bill = billMap.get(order.id) || null;

    return {
      ...order,
      supplier_name: supplier?.supplier_name || "-",
      supplier_code: supplier?.supplier_code || null,
      supplier_bill: bill,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Purchase Orders
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Receive supplier goods, update inventory and move received orders directly into accounts payable.
        </p>
      </div>

      <PurchaseOrdersClient orders={rows} />
    </div>
  );
}
