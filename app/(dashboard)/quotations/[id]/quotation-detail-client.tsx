"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import QuotationPdfDownload from "@/components/quotation-pdf-download";

type Quotation = {
  id: number;
  customer_id: number;
  quotation_no: string;
  quotation_date: string;
  valid_until: string | null;
  status: string;
  template_name: string;
  currency: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  terms: string | null;
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

type QuotationItem = {
  id: number;
  description: string;
  qty: number;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  line_total: number;
};

type ConvertedSalesOrder = {
  id: number;
  sales_order_no: string;
  status: string;
};

export default function QuotationDetailClient({
  id,
}: {
  id: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [quotation, setQuotation] =
    useState<Quotation | null>(null);
  const [customer, setCustomer] =
    useState<Customer | null>(null);
  const [items, setItems] =
    useState<QuotationItem[]>([]);
  const [convertedOrder, setConvertedOrder] =
    useState<ConvertedSalesOrder | null>(null);

  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] =
    useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadQuotation() {
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        const quotationId = Number(id);

        if (!Number.isFinite(quotationId)) {
          throw new Error("Invalid quotation ID.");
        }

        const {
          data: quotationData,
          error: quotationError,
        } = await supabase
          .from("quotations")
          .select(`
            id,
            customer_id,
            quotation_no,
            quotation_date,
            valid_until,
            status,
            template_name,
            currency,
            subtotal,
            discount_amount,
            tax_amount,
            total_amount,
            notes,
            terms
          `)
          .eq("id", quotationId)
          .maybeSingle();

        if (quotationError) throw quotationError;
        if (!quotationData) {
          throw new Error("Quotation not found.");
        }

        if (cancelled) return;

        const [
          customerResult,
          itemResult,
          convertedOrderResult,
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
            .eq("id", quotationData.customer_id)
            .maybeSingle(),

          supabase
            .from("quotation_items")
            .select(`
              id,
              description,
              qty,
              unit_price,
              discount_percent,
              tax_percent,
              line_total
            `)
            .eq("quotation_id", quotationId)
            .order("sort_order", {
              ascending: true,
            }),

          supabase
            .from("sales_orders")
            .select(`
              id,
              sales_order_no,
              status
            `)
            .eq("quotation_id", quotationId)
            .order("id", {
              ascending: true,
            })
            .limit(1)
            .maybeSingle(),
        ]);

        if (customerResult.error) {
          throw customerResult.error;
        }

        if (itemResult.error) {
          throw itemResult.error;
        }

        if (convertedOrderResult.error) {
          throw convertedOrderResult.error;
        }

        if (cancelled) return;

        setQuotation({
          ...quotationData,
          subtotal: Number(
            quotationData.subtotal || 0
          ),
          discount_amount: Number(
            quotationData.discount_amount || 0
          ),
          tax_amount: Number(
            quotationData.tax_amount || 0
          ),
          total_amount: Number(
            quotationData.total_amount || 0
          ),
        } as Quotation);

        setCustomer(
          customerResult.data as Customer | null
        );

        setItems(
          (itemResult.data || []).map(
            (row: any) => ({
              ...row,
              id: Number(row.id),
              qty: Number(row.qty || 0),
              unit_price: Number(
                row.unit_price || 0
              ),
              discount_percent: Number(
                row.discount_percent || 0
              ),
              tax_percent: Number(
                row.tax_percent || 0
              ),
              line_total: Number(
                row.line_total || 0
              ),
            })
          )
        );

        setConvertedOrder(
          convertedOrderResult.data
            ? {
                id: Number(
                  convertedOrderResult.data.id
                ),
                sales_order_no:
                  convertedOrderResult.data
                    .sales_order_no ||
                  `Sales Order #${convertedOrderResult.data.id}`,
                status:
                  convertedOrderResult.data.status ||
                  "draft",
              }
            : null
        );
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load quotation."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadQuotation();

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function updateStatus(
    newStatus: string
  ) {
    if (!quotation || statusUpdating) {
      return;
    }

    setStatusUpdating(true);
    setError("");
    setSuccess("");

    try {
      const { error: updateError } =
        await supabase
          .from("quotations")
          .update({
            status: newStatus,
          })
          .eq("id", quotation.id);

      if (updateError) {
        throw updateError;
      }

      setQuotation({
        ...quotation,
        status: newStatus,
      });

      setSuccess(
        `Quotation status changed to ${capitalize(
          newStatus
        )}.`
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not update quotation status."
      );
    } finally {
      setStatusUpdating(false);
    }
  }

  async function convertToSalesOrder() {
    if (!quotation || statusUpdating) return;

    if (quotation.status !== "accepted") {
      setError(
        "Only accepted quotations can be converted to a Sales Order."
      );
      return;
    }

    setStatusUpdating(true);
    setError("");
    setSuccess("");

    try {
      // Re-check immediately before conversion.
      const {
        data: existingOrder,
        error: existingOrderError,
      } = await supabase
        .from("sales_orders")
        .select(`
          id,
          sales_order_no,
          status
        `)
        .eq("quotation_id", quotation.id)
        .order("id", {
          ascending: true,
        })
        .limit(1)
        .maybeSingle();

      if (existingOrderError) {
        throw existingOrderError;
      }

      if (existingOrder) {
        const linked = {
          id: Number(existingOrder.id),
          sales_order_no:
            existingOrder.sales_order_no ||
            `Sales Order #${existingOrder.id}`,
          status:
            existingOrder.status || "draft",
        };

        setConvertedOrder(linked);
        router.push(`/sales/${linked.id}`);
        return;
      }

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("company_id")
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profileData?.company_id) {
        throw new Error(
          "Company profile not found."
        );
      }

      const {
        data: quotationItems,
        error: quotationItemsError,
      } = await supabase
        .from("quotation_items")
        .select(`
          product_id,
          description,
          qty,
          unit_price,
          discount_percent,
          tax_percent,
          line_subtotal,
          discount_amount,
          tax_amount,
          line_total,
          sort_order
        `)
        .eq("quotation_id", quotation.id)
        .order("sort_order", {
          ascending: true,
        });

      if (quotationItemsError) {
        throw quotationItemsError;
      }

      if (
        !quotationItems ||
        quotationItems.length === 0
      ) {
        throw new Error(
          "This quotation has no items to convert."
        );
      }

      const salesOrderNo =
        `SO-${Date.now()}`;

      const {
        data: salesOrder,
        error: salesOrderError,
      } = await supabase
        .from("sales_orders")
        .insert({
          company_id:
            profileData.company_id,
          customer_id:
            quotation.customer_id,
          quotation_id:
            quotation.id,
          sales_order_no:
            salesOrderNo,
          order_date:
            new Date()
              .toISOString()
              .slice(0, 10),
          status: "draft",
          currency:
            quotation.currency,
          subtotal:
            quotation.subtotal,
          discount_amount:
            quotation.discount_amount,
          tax_amount:
            quotation.tax_amount,
          total_amount:
            quotation.total_amount,
          notes:
            quotation.notes,
          terms:
            quotation.terms,
        })
        .select(`
          id,
          sales_order_no,
          status
        `)
        .single();

      if (salesOrderError) {
        // If a DB unique constraint wins a race, recover gracefully.
        const { data: raceWinner } =
          await supabase
            .from("sales_orders")
            .select(`
              id,
              sales_order_no,
              status
            `)
            .eq(
              "quotation_id",
              quotation.id
            )
            .order("id", {
              ascending: true,
            })
            .limit(1)
            .maybeSingle();

        if (raceWinner) {
          const linked = {
            id: Number(raceWinner.id),
            sales_order_no:
              raceWinner.sales_order_no ||
              `Sales Order #${raceWinner.id}`,
            status:
              raceWinner.status ||
              "draft",
          };

          setConvertedOrder(linked);
          router.push(
            `/sales/${linked.id}`
          );
          return;
        }

        throw salesOrderError;
      }

      const rows = quotationItems.map(
        (item) => ({
          sales_order_id:
            salesOrder.id,
          product_id:
            item.product_id,
          description:
            item.description,
          qty:
            item.qty,
          unit_price:
            item.unit_price,
          discount_percent:
            item.discount_percent,
          tax_percent:
            item.tax_percent,
          line_subtotal:
            item.line_subtotal,
          discount_amount:
            item.discount_amount,
          tax_amount:
            item.tax_amount,
          line_total:
            item.line_total,
          sort_order:
            item.sort_order,
        })
      );

      const {
        error: itemInsertError,
      } = await supabase
        .from("sales_order_items")
        .insert(rows);

      if (itemInsertError) {
        // Compensating cleanup for a header-only order.
        await supabase
          .from("sales_orders")
          .delete()
          .eq("id", salesOrder.id);

        throw itemInsertError;
      }

      const linked = {
        id: Number(salesOrder.id),
        sales_order_no:
          salesOrder.sales_order_no ||
          `Sales Order #${salesOrder.id}`,
        status:
          salesOrder.status || "draft",
      };

      setConvertedOrder(linked);

      setSuccess(
        `Sales Order ${linked.sales_order_no} created successfully.`
      );

      router.push(`/sales/${linked.id}`);
    } catch (err) {
      const message = formatSupabaseError(
        err,
        "Could not create sales order."
      );

      // Keep expected database/application errors in the page UI.
      // console.error() causes the Next.js dev overlay and hides the useful
      // PostgREST fields because Supabase errors are often plain objects.
      console.warn(
        "[quotation-to-sales-order]",
        message
      );

      setError(message);
    } finally {
      setStatusUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <span className="text-sm text-gray-500">
          Loading quotation...
        </span>
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {error || "Quotation not found."}
      </div>
    );
  }

  const currency =
    quotation.currency || "THB";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {quotation.quotation_no}
            </h1>

            <StatusBadge
              status={quotation.status}
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
            <span>
              Quotation ID #{quotation.id}
            </span>

            <span>
              {templateLabel(
                quotation.template_name
              )}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {quotation.status ===
            "accepted" &&
            (convertedOrder ? (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/sales/${convertedOrder.id}`
                  )
                }
                className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                View {convertedOrder.sales_order_no}
              </button>
            ) : (
              <button
                type="button"
                disabled={statusUpdating}
                onClick={convertToSalesOrder}
                className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {statusUpdating
                  ? "Creating Sales Order..."
                  : "Convert to Sales Order"}
              </button>
            ))}

          <button
            type="button"
            onClick={() =>
              router.push("/quotations")
            }
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Back
          </button>

          <button
            type="button"
            onClick={() =>
              router.push(
                `/quotations/${quotation.id}/edit`
              )
            }
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Edit
          </button>
        </div>
      </div>

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
        <SummaryCard
          label="Customer"
          value={
            customer?.customer_name || "-"
          }
        />
        <SummaryCard
          label="Quotation Date"
          value={formatDate(
            quotation.quotation_date
          )}
        />
        <SummaryCard
          label="Valid Until"
          value={
            quotation.valid_until
              ? formatDate(
                  quotation.valid_until
                )
              : "-"
          }
        />
        <SummaryCard
          label="Grand Total"
          value={money(
            quotation.total_amount,
            currency
          )}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">
              Quotation Workflow
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Move this quotation through its sales approval process.
            </p>
          </div>

          <StatusActions
            status={quotation.status}
            updating={statusUpdating}
            onChange={updateStatus}
          />
        </div>

        <WorkflowSteps
          status={quotation.status}
        />
      </div>

      {quotation.status === "accepted" && (
        <div
          className={`rounded-xl border p-5 shadow-sm ${
            convertedOrder
              ? "border-green-200 bg-green-50"
              : "border-blue-200 bg-blue-50"
          }`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div
                className={`text-sm font-semibold ${
                  convertedOrder
                    ? "text-green-900"
                    : "text-blue-900"
                }`}
              >
                {convertedOrder
                  ? "Converted to Sales Order"
                  : "Ready for Sales Order"}
              </div>

              <p
                className={`mt-1 text-sm ${
                  convertedOrder
                    ? "text-green-700"
                    : "text-blue-700"
                }`}
              >
                {convertedOrder
                  ? `${convertedOrder.sales_order_no} is linked to this quotation.`
                  : "This accepted quotation can be converted into a draft Sales Order."}
              </p>
            </div>

            {convertedOrder ? (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/sales/${convertedOrder.id}`
                  )
                }
                className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-800"
              >
                Open Sales Order
              </button>
            ) : (
              <button
                type="button"
                disabled={statusUpdating}
                onClick={convertToSalesOrder}
                className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {statusUpdating
                  ? "Creating..."
                  : "Create Sales Order"}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section
            title="Customer Information"
            description="Customer details for this quotation."
          >
            <div className="grid gap-6 md:grid-cols-2">
              <InfoItem
                label="Customer"
                value={
                  customer?.customer_name
                }
              />
              <InfoItem
                label="Customer Code"
                value={
                  customer?.customer_code
                }
              />
              <InfoItem
                label="Contact"
                value={
                  customer?.contact_name
                }
              />
              <InfoItem
                label="Phone"
                value={customer?.phone}
              />
              <InfoItem
                label="Email"
                value={customer?.email}
              />
              <InfoItem
                label="Tax ID"
                value={customer?.tax_id}
              />

              <div className="md:col-span-2">
                <InfoItem
                  label="Address"
                  value={customer?.address}
                />
              </div>
            </div>
          </Section>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="font-semibold text-gray-900">
                Quotation Items
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {items.length} item
                {items.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <TableHeader>
                      Description
                    </TableHeader>
                    <TableHeader right>
                      Qty
                    </TableHeader>
                    <TableHeader right>
                      Unit Price
                    </TableHeader>
                    <TableHeader right>
                      Discount
                    </TableHeader>
                    <TableHeader right>
                      Tax
                    </TableHeader>
                    <TableHeader right>
                      Total
                    </TableHeader>
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
                        {money(
                          item.unit_price,
                          currency
                        )}
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-gray-600">
                        {formatPercent(
                          item.discount_percent
                        )}
                      </td>
                      <td className="px-5 py-4 text-right text-sm text-gray-600">
                        {formatPercent(
                          item.tax_percent
                        )}
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-semibold text-gray-900">
                        {money(
                          item.line_total,
                          currency
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {(quotation.notes ||
            quotation.terms) && (
            <div className="grid gap-6 md:grid-cols-2">
              <TextCard
                title="Notes"
                value={quotation.notes}
              />
              <TextCard
                title="Terms & Conditions"
                value={quotation.terms}
              />
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900">
              Quotation Summary
            </h3>

            <div className="mt-5 space-y-4">
              <Metric
                label="Subtotal"
                value={money(
                  quotation.subtotal,
                  currency
                )}
              />
              <Metric
                label="Discount"
                value={`-${money(
                  quotation.discount_amount,
                  currency
                )}`}
              />
              <Metric
                label="Tax"
                value={money(
                  quotation.tax_amount,
                  currency
                )}
              />

              <div className="border-t border-gray-200 pt-4">
                <Metric
                  label="Grand Total"
                  value={money(
                    quotation.total_amount,
                    currency
                  )}
                  strong
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900">
              Document
            </h3>

            <div className="mt-5 space-y-4">
              <InfoRow
                label="Template"
                value={templateLabel(
                  quotation.template_name
                )}
              />
              <InfoRow
                label="Currency"
                value={currency}
              />
              <InfoRow
                label="Status"
                value={capitalize(
                  quotation.status
                )}
              />
              <InfoRow
                label="Sales Order"
                value={
                  convertedOrder
                    ? convertedOrder.sales_order_no
                    : quotation.status ===
                      "accepted"
                    ? "Ready to convert"
                    : "Not available yet"
                }
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900">
              Document Actions
            </h3>

            <p className="mt-1 text-xs text-gray-500">
              Professional document output.
            </p>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/print/quotations/${quotation.id}`
                  )
                }
                className="w-full rounded-lg bg-gray-900 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-black"
              >
                Preview / Print
              </button>

              <QuotationPdfDownload
                quotationId={quotation.id}
                fileName={quotation.quotation_no}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Download PDF
              </QuotationPdfDownload>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusActions({
  status,
  updating,
  onChange,
}: {
  status: string;
  updating: boolean;
  onChange: (status: string) => void;
}) {
  const normalized = status || "draft";

  if (normalized === "draft") {
    return (
      <button
        type="button"
        disabled={updating}
        onClick={() => onChange("sent")}
        className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {updating
          ? "Updating..."
          : "Mark as Sent"}
      </button>
    );
  }

  if (normalized === "sent") {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={updating}
          onClick={() =>
            onChange("accepted")
          }
          className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Accept
        </button>

        <button
          type="button"
          disabled={updating}
          onClick={() =>
            onChange("rejected")
          }
          className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          Reject
        </button>

        <button
          type="button"
          disabled={updating}
          onClick={() =>
            onChange("draft")
          }
          className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Back to Draft
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={updating}
      onClick={() => onChange("draft")}
      className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {updating
        ? "Updating..."
        : "Reopen as Draft"}
    </button>
  );
}

function WorkflowSteps({
  status,
}: {
  status: string;
}) {
  const normalized = status || "draft";

  const sentActive =
    normalized === "sent" ||
    normalized === "accepted" ||
    normalized === "rejected";

  const finalActive =
    normalized === "accepted" ||
    normalized === "rejected";

  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      <WorkflowStep
        number="1"
        label="Draft"
        description="Quotation is being prepared."
        active
      />

      <WorkflowStep
        number="2"
        label="Sent"
        description="Quotation sent to customer."
        active={sentActive}
      />

      <WorkflowStep
        number="3"
        label={
          normalized === "rejected"
            ? "Rejected"
            : "Accepted"
        }
        description={
          normalized === "rejected"
            ? "Customer rejected quotation."
            : normalized === "accepted"
            ? "Customer accepted quotation."
            : "Waiting for customer decision."
        }
        active={finalActive}
        danger={
          normalized === "rejected"
        }
      />
    </div>
  );
}

function WorkflowStep({
  number,
  label,
  description,
  active,
  danger = false,
}: {
  number: string;
  label: string;
  description: string;
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
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            active
              ? danger
                ? "bg-red-600 text-white"
                : "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-400"
          }`}
        >
          {number}
        </div>

        <div>
          <div className="text-sm font-semibold text-gray-900">
            {label}
          </div>
          <div className="mt-0.5 text-xs text-gray-500">
            {description}
          </div>
        </div>
      </div>
    </div>
  );
}

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

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-gray-900">
        {value}
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div className="mt-2 whitespace-pre-line text-sm font-medium text-gray-900">
        {value || "-"}
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
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-gray-500">
        {label}
      </span>
      <span className="text-sm font-medium text-gray-900">
        {value}
      </span>
    </div>
  );
}

function TextCard({
  title,
  value,
}: {
  title: string;
  value: string | null;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-gray-900">
        {title}
      </h3>
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
            : "font-medium text-gray-900"
        }
      >
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

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const normalized = status || "draft";

  const style =
    normalized === "accepted"
      ? "bg-green-50 text-green-700"
      : normalized === "sent"
      ? "bg-blue-50 text-blue-700"
      : normalized === "rejected"
      ? "bg-red-50 text-red-700"
      : normalized === "expired"
      ? "bg-amber-50 text-amber-700"
      : "bg-gray-100 text-gray-700";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${style}`}
    >
      {normalized}
    </span>
  );
}


function formatSupabaseError(
  err: unknown,
  fallback: string
) {
  if (err instanceof Error) {
    return err.message || fallback;
  }

  if (
    err &&
    typeof err === "object"
  ) {
    const value = err as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };

    const parts = [
      typeof value.message === "string"
        ? value.message
        : "",
      typeof value.details === "string" &&
      value.details
        ? `Details: ${value.details}`
        : "",
      typeof value.hint === "string" &&
      value.hint
        ? `Hint: ${value.hint}`
        : "",
      typeof value.code === "string" &&
      value.code
        ? `Code: ${value.code}`
        : "",
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(" • ");
    }
  }

  return fallback;
}

function money(
  value: number,
  currency: string
) {
  return `${currencySymbol(currency)}${Number(
    value || 0
  ).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function currencySymbol(
  currency: string
) {
  if (currency === "MMK") return "K ";
  if (currency === "USD") return "$";
  if (currency === "EUR") return "€";
  if (currency === "SGD") return "S$";
  return "฿";
}

function formatDate(value: string) {
  const parts = value.split("-");

  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return value;
}

function formatQty(value: number) {
  return Number(
    value || 0
  ).toLocaleString(undefined, {
    maximumFractionDigits: 3,
  });
}

function formatPercent(value: number) {
  return `${Number(
    value || 0
  ).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}%`;
}

function templateLabel(value: string) {
  if (value === "modern") {
    return "Modern Minimal";
  }

  if (value === "commercial") {
    return "Retail / Commercial";
  }

  return "Classic Corporate";
}

function capitalize(value: string) {
  if (!value) return "";

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}
