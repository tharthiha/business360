import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import QuotationsClient from "./quotations-client";

export const instant = false;

export default async function QuotationsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("quotations")
    .select(`
      id,
      quotation_no,
      customer_id,
      quotation_date,
      valid_until,
      status,
      currency,
      total_amount,
      created_at,
      customers (
        customer_name
      )
    `)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Could not load quotations: {error.message}
      </div>
    );
  }

  const quotations = (data || []).map((quotation: any) => {
    const customerRelation = quotation.customers as
      | { customer_name?: string }
      | { customer_name?: string }[]
      | null;

    const customerName = Array.isArray(customerRelation)
      ? customerRelation[0]?.customer_name
      : customerRelation?.customer_name;

    return {
      id: Number(quotation.id),
      quotation_no: quotation.quotation_no || "-",
      customer_id: quotation.customer_id
        ? Number(quotation.customer_id)
        : null,
      customer_name: customerName || "-",
      quotation_date: quotation.quotation_date,
      valid_until: quotation.valid_until || null,
      status: quotation.status || "draft",
      currency: quotation.currency || "THB",
      total_amount: Number(quotation.total_amount || 0),
      created_at: quotation.created_at || null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Quotations
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage customer quotations and track the sales pipeline from draft to acceptance.
          </p>
        </div>

        <Link
          href="/quotations/new"
          className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black"
        >
          + New Quotation
        </Link>
      </div>

      <QuotationsClient quotations={quotations} />
    </div>
  );
}
