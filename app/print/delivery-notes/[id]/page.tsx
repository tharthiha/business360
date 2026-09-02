import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "./print-button";
import "./delivery-note-print.css";

export const instant = false;

export default async function DeliveryNotePage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  const supabase =
    await createClient();

  const {
    data: deliveryNote,
    error: deliveryError,
  } = await supabase
    .from("delivery_notes")
    .select(`
      id,
      company_id,
      sales_order_id,
      customer_id,
      delivery_note_no,
      delivery_date,
      receiver_name,
      remarks,
      created_at
    `)
    .eq("id", Number(id))
    .single();

  if (
    deliveryError ||
    !deliveryNote
  ) {
    return (
      <div className="mx-auto max-w-3xl p-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          Delivery Note not found.
        </div>
      </div>
    );
  }

  const [
    companyResult,
    customerResult,
    salesOrderResult,
    itemsResult,
  ] = await Promise.all([
    supabase
      .from("companies")
      .select(`
        company_name,
        email,
        phone,
        address
      `)
      .eq(
        "id",
        deliveryNote.company_id
      )
      .single(),

    supabase
      .from("customers")
      .select(`
        customer_name,
        customer_code,
        contact_name,
        phone,
        email,
        address
      `)
      .eq(
        "id",
        deliveryNote.customer_id
      )
      .single(),

    supabase
      .from("sales_orders")
      .select(`
        id,
        sales_order_no,
        order_date,
        currency,
        notes
      `)
      .eq(
        "id",
        deliveryNote.sales_order_id
      )
      .single(),

    supabase
      .from(
        "sales_order_items"
      )
      .select(`
        id,
        description,
        qty,
        sort_order
      `)
      .eq(
        "sales_order_id",
        deliveryNote.sales_order_id
      )
      .order(
        "sort_order",
        {
          ascending: true,
        }
      ),
  ]);

  const company =
    companyResult.data;

  const customer =
    customerResult.data;

  const salesOrder =
    salesOrderResult.data;

  const items =
    itemsResult.data || [];

  return (
    <div className="min-h-screen py-8">
      {/* TOOLBAR */}

      <div className="print-hide mx-auto mb-4 flex max-w-[900px] items-center justify-between px-4">
        <Link
          href={`/sales/${deliveryNote.sales_order_id}`}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700"
        >
          ← Back to Sales Order
        </Link>

        <PrintButton />
      </div>

      {/* DOCUMENT */}

      <div className="delivery-note-page mx-auto max-w-[900px] bg-white p-10 shadow-sm">
        {/* HEADER */}

        <div className="flex items-start justify-between gap-8 border-b border-gray-200 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {company?.company_name ||
                "Company"}
            </h1>

            <div className="mt-3 space-y-1 text-sm text-gray-500">
              {company?.address && (
                <div>
                  {
                    company.address
                  }
                </div>
              )}

              {company?.phone && (
                <div>
                  Tel:{" "}
                  {
                    company.phone
                  }
                </div>
              )}

              {company?.email && (
                <div>
                  {
                    company.email
                  }
                </div>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-400">
              Delivery Note
            </div>

            <div className="mt-2 text-xl font-bold text-gray-900">
              {
                deliveryNote.delivery_note_no
              }
            </div>

            <div className="mt-3 text-sm text-gray-500">
              Date:{" "}
              {formatDate(
                deliveryNote.delivery_date
              )}
            </div>
          </div>
        </div>

        {/* CUSTOMER / SOURCE */}

        <div className="grid grid-cols-2 gap-8 border-b border-gray-200 py-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Deliver To
            </div>

            <div className="mt-3 text-base font-semibold text-gray-900">
              {customer?.customer_name ||
                "-"}
            </div>

            <div className="mt-2 space-y-1 text-sm text-gray-500">
              {customer?.contact_name && (
                <div>
                  Contact:{" "}
                  {
                    customer.contact_name
                  }
                </div>
              )}

              {customer?.phone && (
                <div>
                  Phone:{" "}
                  {
                    customer.phone
                  }
                </div>
              )}

              {customer?.address && (
                <div className="whitespace-pre-line">
                  {
                    customer.address
                  }
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Reference
            </div>

            <div className="mt-3 space-y-2 text-sm">
              <InfoRow
                label="Sales Order"
                value={
                  salesOrder?.sales_order_no ||
                  "-"
                }
              />

              <InfoRow
                label="Order Date"
                value={
                  salesOrder
                    ? formatDate(
                        salesOrder.order_date
                      )
                    : "-"
                }
              />

              <InfoRow
                label="Delivery Date"
                value={formatDate(
                  deliveryNote.delivery_date
                )}
              />
            </div>
          </div>
        </div>

        {/* ITEMS */}

        <div className="py-6">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-y border-gray-200 bg-gray-50">
                <th className="w-16 px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                  #
                </th>

                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                  Description
                </th>

                <th className="w-32 px-4 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                  Qty Delivered
                </th>
              </tr>
            </thead>

            <tbody>
              {items.map(
                (item, index) => (
                  <tr
                    key={
                      item.id
                    }
                    className="border-b border-gray-100"
                  >
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {index + 1}
                    </td>

                    <td className="px-4 py-4 text-sm font-medium text-gray-900">
                      {
                        item.description
                      }
                    </td>

                    <td className="px-4 py-4 text-right text-sm font-semibold text-gray-900">
                      {formatQty(
                        Number(
                          item.qty ||
                            0
                        )
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>

        {/* REMARKS */}

        <div className="grid grid-cols-2 gap-8 border-t border-gray-200 py-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Remarks
            </div>

            <div className="mt-3 min-h-16 whitespace-pre-line text-sm leading-6 text-gray-600">
              {deliveryNote.remarks ||
                salesOrder?.notes ||
                "-"}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Received By
            </div>

            <div className="mt-3 min-h-16 text-sm text-gray-600">
              {deliveryNote.receiver_name ||
                "____________________________"}
            </div>
          </div>
        </div>

        {/* SIGNATURE */}

        <div className="mt-10 grid grid-cols-2 gap-16">
          <Signature
            label="Delivered By"
          />

          <Signature
            label="Received By"
          />
        </div>

        <div className="mt-12 border-t border-gray-200 pt-4 text-center text-xs text-gray-400">
          This document confirms delivery of the goods listed above.
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-5">
      <span className="text-gray-500">
        {label}
      </span>

      <span className="font-medium text-gray-900">
        {value}
      </span>
    </div>
  );
}

function Signature({
  label,
}: {
  label: string;
}) {
  return (
    <div className="pt-12 text-center">
      <div className="border-t border-gray-400 pt-2 text-sm font-medium text-gray-700">
        {label}
      </div>

      <div className="mt-1 text-xs text-gray-400">
        Signature / Date
      </div>
    </div>
  );
}

function formatDate(
  value: string
) {
  const parts =
    String(
      value || ""
    ).split("-");

  if (
    parts.length === 3
  ) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return value || "-";
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