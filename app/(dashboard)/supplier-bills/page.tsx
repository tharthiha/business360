import { createClient } from "@/lib/supabase/server";
import SupplierBillsClient from "./supplier-bills-client";

export const instant = false;

export default async function SupplierBillsPage() {
  const supabase = await createClient();

  const { data: billData, error: billError } = await supabase
    .from("supplier_bills")
    .select(`
      id,
      bill_no,
      supplier_id,
      purchase_order_id,
      bill_date,
      due_date,
      status,
      currency,
      total_amount,
      paid_amount,
      balance_due,
      supplier_invoice_no
    `)
    .order("id", { ascending: false });

  if (billError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Could not load Supplier Bills: {billError.message}
      </div>
    );
  }

  const bills = (billData || []).map((row: any) => ({
    id: Number(row.id),
    bill_no: row.bill_no,
    supplier_id: Number(row.supplier_id),
    purchase_order_id: row.purchase_order_id ? Number(row.purchase_order_id) : null,
    bill_date: row.bill_date,
    due_date: row.due_date || null,
    status: row.status || "draft",
    currency: row.currency || "THB",
    total_amount: Number(row.total_amount || 0),
    paid_amount: Number(row.paid_amount || 0),
    balance_due: Number(row.balance_due || 0),
    supplier_invoice_no: row.supplier_invoice_no || null,
  }));

  const supplierIds = Array.from(new Set(bills.map((row) => row.supplier_id)));

  const { data: supplierData, error: supplierError } = supplierIds.length
    ? await supabase
        .from("suppliers")
        .select("id, supplier_name, supplier_code")
        .in("id", supplierIds)
    : { data: [], error: null };

  if (supplierError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Could not load suppliers: {supplierError.message}
      </div>
    );
  }

  const supplierMap = new Map<number, any>();
  for (const supplier of supplierData || []) {
    supplierMap.set(Number(supplier.id), supplier);
  }

  const rows = bills.map((bill) => ({
    ...bill,
    supplier_name: supplierMap.get(bill.supplier_id)?.supplier_name || "-",
    supplier_code: supplierMap.get(bill.supplier_id)?.supplier_code || null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Supplier Bills
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Track open payables, supplier payments, overdue balances and settlement status.
        </p>
      </div>

      <SupplierBillsClient bills={rows} />
    </div>
  );
}
