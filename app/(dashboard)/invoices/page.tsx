import { createClient } from "@/lib/supabase/server";
import InvoicesClient from "./invoices-client";

export const instant = false;

type InvoiceRow = {
  id: number;
  customer_id: number;
  sales_order_id: number | null;
  invoice_no: string;
  invoice_date: string;
  due_date: string | null;
  status: string;
  currency: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  customer_name: string;
};

export default async function InvoicesPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select(`
      id,
      customer_id,
      sales_order_id,
      invoice_no,
      invoice_date,
      due_date,
      status,
      currency,
      total_amount,
      paid_amount,
      balance_due,
      customers (
        customer_name
      )
    `)
    .order("id", {
      ascending: false,
    });

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {error.message}
      </div>
    );
  }

  const invoices: InvoiceRow[] = (data || []).map(
    (invoice: any) => {
      const customerRelation = invoice.customers as
        | { customer_name?: string }
        | { customer_name?: string }[]
        | null;

      const customerName = Array.isArray(
        customerRelation
      )
        ? customerRelation[0]?.customer_name
        : customerRelation?.customer_name;

      return {
        id: Number(invoice.id),
        customer_id: Number(invoice.customer_id),
        sales_order_id: invoice.sales_order_id
          ? Number(invoice.sales_order_id)
          : null,
        invoice_no: invoice.invoice_no,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date || null,
        status: invoice.status || "draft",
        currency: invoice.currency || "THB",
        total_amount: Number(
          invoice.total_amount || 0
        ),
        paid_amount: Number(
          invoice.paid_amount || 0
        ),
        balance_due: Number(
          invoice.balance_due || 0
        ),
        customer_name: customerName || "-",
      };
    }
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Invoices
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Track open receivables, collections, overdue balances and invoice status.
        </p>
      </div>

      <InvoicesClient invoices={invoices} />
    </div>
  );
}
