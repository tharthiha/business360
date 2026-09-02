"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";

type Customer = {
  id: number;
  customer_code: string | null;
  customer_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  tax_id: string | null;
  address: string | null;
  is_active: boolean;
  created_at?: string | null;
};

type SalesOrder = {
  id: number;
  sales_order_no: string;
  order_date: string;
  status: string;
  currency: string;
  total_amount: number;
  is_fulfilled: boolean | null;
};

type Invoice = {
  id: number;
  invoice_no: string;
  invoice_date: string;
  due_date: string | null;
  status: string;
  currency: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
};

type Payment = {
  id: number;
  payment_no: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  invoice_id: number;
};

type Quotation = {
  id: number;
  quotation_no: string;
  quotation_date: string;
  status: string;
  currency: string;
  total_amount: number;
};

type ActivityItem = {
  key: string;
  date: string;
  title: string;
  description: string;
  amount?: number;
  currency?: string;
  href?: string;
  tone?: "normal" | "positive" | "warning" | "danger";
};

export default function CustomerDetailClient({
  id,
}: {
  id: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [
    customer,
    setCustomer,
  ] = useState<Customer | null>(
    null
  );

  const [
    salesOrders,
    setSalesOrders,
  ] = useState<SalesOrder[]>(
    []
  );

  const [
    invoices,
    setInvoices,
  ] = useState<Invoice[]>([]);

  const [
    payments,
    setPayments,
  ] = useState<Payment[]>([]);

  const [
    quotations,
    setQuotations,
  ] = useState<Quotation[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [error, setError] =
    useState("");

  const [
    actionBusy,
    setActionBusy,
  ] = useState(false);

  useEffect(() => {
    loadCustomer360();
  }, [id]);

  async function loadCustomer360() {
    setLoading(true);
    setError("");

    try {
      const customerId =
        Number(id);

      if (
        !Number.isFinite(
          customerId
        )
      ) {
        throw new Error(
          "Invalid customer ID."
        );
      }

      const [
        customerResult,
        salesResult,
        invoiceResult,
        paymentResult,
        quotationResult,
      ] = await Promise.all([
        supabase
          .from("customers")
          .select(`
            id,
            customer_code,
            customer_name,
            contact_name,
            phone,
            email,
            tax_id,
            address,
            is_active,
            created_at
          `)
          .eq(
            "id",
            customerId
          )
          .single(),

        supabase
          .from("sales_orders")
          .select(`
            id,
            sales_order_no,
            order_date,
            status,
            currency,
            total_amount,
            is_fulfilled
          `)
          .eq(
            "customer_id",
            customerId
          )
          .order(
            "order_date",
            {
              ascending: false,
            }
          )
          .order(
            "id",
            {
              ascending: false,
            }
          )
          .limit(20),

        supabase
          .from("invoices")
          .select(`
            id,
            invoice_no,
            invoice_date,
            due_date,
            status,
            currency,
            total_amount,
            paid_amount,
            balance_due
          `)
          .eq(
            "customer_id",
            customerId
          )
          .order(
            "invoice_date",
            {
              ascending: false,
            }
          )
          .order(
            "id",
            {
              ascending: false,
            }
          )
          .limit(20),

        supabase
          .from("payments")
          .select(`
            id,
            payment_no,
            payment_date,
            amount,
            payment_method,
            invoice_id
          `)
          .eq(
            "customer_id",
            customerId
          )
          .order(
            "payment_date",
            {
              ascending: false,
            }
          )
          .order(
            "id",
            {
              ascending: false,
            }
          )
          .limit(20),

        supabase
          .from("quotations")
          .select(`
            id,
            quotation_no,
            quotation_date,
            status,
            currency,
            total_amount
          `)
          .eq(
            "customer_id",
            customerId
          )
          .order(
            "quotation_date",
            {
              ascending: false,
            }
          )
          .order(
            "id",
            {
              ascending: false,
            }
          )
          .limit(20),
      ]);

      if (
        customerResult.error
      ) {
        throw customerResult.error;
      }

      if (
        salesResult.error
      ) {
        throw salesResult.error;
      }

      if (
        invoiceResult.error
      ) {
        throw invoiceResult.error;
      }

      if (
        paymentResult.error
      ) {
        throw paymentResult.error;
      }

      if (
        quotationResult.error
      ) {
        /*
          Keep Customer 360 usable even if an older installation
          does not yet expose quotations exactly as expected.
        */
        console.warn(
          "[customer-360 quotations]",
          quotationResult.error.message
        );
      }

      setCustomer(
        customerResult.data as Customer
      );

      setSalesOrders(
        (
          salesResult.data ||
          []
        ).map(
          (row: any) => ({
            ...row,
            id:
              Number(
                row.id
              ),
            total_amount:
              Number(
                row.total_amount ||
                  0
              ),
          })
        )
      );

      setInvoices(
        (
          invoiceResult.data ||
          []
        ).map(
          (row: any) => ({
            ...row,
            id:
              Number(
                row.id
              ),
            total_amount:
              Number(
                row.total_amount ||
                  0
              ),
            paid_amount:
              Number(
                row.paid_amount ||
                  0
              ),
            balance_due:
              Number(
                row.balance_due ||
                  0
              ),
          })
        )
      );

      setPayments(
        (
          paymentResult.data ||
          []
        ).map(
          (row: any) => ({
            ...row,
            id:
              Number(
                row.id
              ),
            invoice_id:
              Number(
                row.invoice_id
              ),
            amount:
              Number(
                row.amount ||
                  0
              ),
          })
        )
      );

      setQuotations(
        quotationResult.error
          ? []
          : (
              quotationResult.data ||
              []
            ).map(
              (row: any) => ({
                ...row,
                id:
                  Number(
                    row.id
                  ),
                total_amount:
                  Number(
                    row.total_amount ||
                      0
                  ),
              })
            )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load customer."
      );
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive() {
    if (!customer) return;

    setActionBusy(true);

    try {
      const nextActive =
        !customer.is_active;

      const { error } =
        await supabase
          .from("customers")
          .update({
            is_active:
              nextActive,
          })
          .eq(
            "id",
            customer.id
          );

      if (error) {
        throw error;
      }

      setCustomer({
        ...customer,
        is_active:
          nextActive,
      });
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Could not update customer status."
      );
    } finally {
      setActionBusy(false);
    }
  }

  const invoiceCurrencyMap =
    useMemo(() => {
      const map =
        new Map<
          number,
          string
        >();

      for (
        const invoice of
          invoices
      ) {
        map.set(
          invoice.id,
          invoice.currency ||
            "THB"
        );
      }

      return map;
    }, [invoices]);

  const totalsByCurrency =
    useMemo(() => {
      const result =
        new Map<
          string,
          {
            sales: number;
            invoiced: number;
            collected: number;
            outstanding: number;
          }
        >();

      function ensure(
        currency: string
      ) {
        if (
          !result.has(
            currency
          )
        ) {
          result.set(
            currency,
            {
              sales: 0,
              invoiced: 0,
              collected: 0,
              outstanding: 0,
            }
          );
        }

        return result.get(
          currency
        )!;
      }

      for (
        const order of
          salesOrders
      ) {
        if (
          order.status ===
          "cancelled"
        ) {
          continue;
        }

        ensure(
          order.currency ||
            "THB"
        ).sales +=
          Number(
            order.total_amount ||
              0
          );
      }

      for (
        const invoice of
          invoices
      ) {
        const row =
          ensure(
            invoice.currency ||
              "THB"
          );

        row.invoiced +=
          invoice.total_amount;

        row.outstanding +=
          invoice.balance_due;
      }

      for (
        const payment of
          payments
      ) {
        const currency =
          invoiceCurrencyMap.get(
            payment.invoice_id
          ) ||
          "THB";

        ensure(
          currency
        ).collected +=
          payment.amount;
      }

      return Array.from(
        result.entries()
      ).map(
        ([
          currency,
          value,
        ]) => ({
          currency,
          ...value,
        })
      );
    }, [
      salesOrders,
      invoices,
      payments,
      invoiceCurrencyMap,
    ]);

  const primaryCurrency =
    totalsByCurrency.find(
      (row) =>
        row.currency ===
        "THB"
    ) ||
    totalsByCurrency[0] ||
    {
      currency: "THB",
      sales: 0,
      invoiced: 0,
      collected: 0,
      outstanding: 0,
    };

  const overdueInvoices =
    invoices.filter(
      (invoice) =>
        invoice.due_date &&
        invoice.due_date <
          today() &&
        invoice.balance_due >
          0
    );

  const activity =
    useMemo(() => {
      const rows:
        ActivityItem[] = [];

      for (
        const quotation of
          quotations
      ) {
        rows.push({
          key:
            `quotation-${quotation.id}`,
          date:
            quotation.quotation_date,
          title:
            quotation.quotation_no,
          description:
            `Quotation • ${labelize(
              quotation.status
            )}`,
          amount:
            quotation.total_amount,
          currency:
            quotation.currency ||
            "THB",
          href:
            `/quotations/${quotation.id}`,
        });
      }

      for (
        const order of
          salesOrders
      ) {
        rows.push({
          key:
            `sales-${order.id}`,
          date:
            order.order_date,
          title:
            order.sales_order_no,
          description:
            order.is_fulfilled
              ? "Sales Order • Fulfilled"
              : `Sales Order • ${labelize(
                  order.status
                )}`,
          amount:
            order.total_amount,
          currency:
            order.currency ||
            "THB",
          href:
            `/sales/${order.id}`,
          tone:
            order.is_fulfilled
              ? "positive"
              : "normal",
        });
      }

      for (
        const invoice of
          invoices
      ) {
        rows.push({
          key:
            `invoice-${invoice.id}`,
          date:
            invoice.invoice_date,
          title:
            invoice.invoice_no,
          description:
            `Invoice • ${labelize(
              invoice.status
            )}`,
          amount:
            invoice.total_amount,
          currency:
            invoice.currency ||
            "THB",
          href:
            `/invoices/${invoice.id}`,
          tone:
            invoice.balance_due >
              0
              ? "warning"
              : "positive",
        });
      }

      for (
        const payment of
          payments
      ) {
        rows.push({
          key:
            `payment-${payment.id}`,
          date:
            payment.payment_date,
          title:
            payment.payment_no,
          description:
            `Payment • ${methodLabel(
              payment.payment_method
            )}`,
          amount:
            payment.amount,
          currency:
            invoiceCurrencyMap.get(
              payment.invoice_id
            ) ||
            "THB",
          href:
            `/invoices/${payment.invoice_id}`,
          tone:
            "positive",
        });
      }

      return rows
        .sort(
          (a, b) =>
            String(
              b.date ||
                ""
            ).localeCompare(
              String(
                a.date ||
                  ""
              )
            )
        )
        .slice(
          0,
          12
        );
    }, [
      quotations,
      salesOrders,
      invoices,
      payments,
      invoiceCurrencyMap,
    ]);

  const lastActivity =
    activity[0]?.date ||
    customer?.created_at ||
    null;

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-gray-500">
        Loading Customer 360...
      </div>
    );
  }

  if (
    error ||
    !customer
  ) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Customer not found
        {error
          ? `: ${error}`
          : "."}
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* HEADER */}

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid gap-6 p-6 xl:grid-cols-[1.4fr_0.6fr] xl:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 text-lg font-semibold text-white">
                {initials(
                  customer.customer_name
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                    {
                      customer.customer_name
                    }
                  </h1>

                  {customer.is_active ? (
                    <Badge tone="success">
                      Active
                    </Badge>
                  ) : (
                    <Badge tone="default">
                      Inactive
                    </Badge>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                  <span>
                    {customer.customer_code ||
                      "No customer code"}
                  </span>

                  <span>
                    Customer #
                    {customer.id}
                  </span>

                  {customer.created_at && (
                    <span>
                      Since{" "}
                      {formatDate(
                        customer.created_at.slice(
                          0,
                          10
                        )
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <p className="mt-5 max-w-2xl text-sm leading-6 text-gray-500">
              Customer 360° view for contact details, sales activity,
              invoices, collections and current accounts receivable.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <PrimaryAction
                href={`/sales/new?customer_id=${customer.id}`}
              >
                + New Sales Order
              </PrimaryAction>

              <SecondaryAction
                href={`/quotations/new?customer_id=${customer.id}`}
              >
                + New Quotation
              </SecondaryAction>

              <SecondaryAction
                href="/invoices"
              >
                View Invoices
              </SecondaryAction>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Account Standing
            </div>

            <div className="mt-2 text-3xl font-semibold text-gray-900">
              {money(
                primaryCurrency.outstanding,
                primaryCurrency.currency
              )}
            </div>

            <div className="mt-1 text-sm text-gray-500">
              outstanding receivable
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <MiniMetric
                label="Open Invoices"
                value={String(
                  invoices.filter(
                    (invoice) =>
                      invoice.balance_due >
                      0
                  ).length
                )}
              />

              <MiniMetric
                label="Overdue"
                value={String(
                  overdueInvoices.length
                )}
                warning={
                  overdueInvoices.length >
                  0
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* SUMMARY */}

      <section>
        <SectionHeading
          title="Customer Snapshot"
          description="Commercial and receivable indicators across the customer's account."
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Sales Orders"
            value={String(
              salesOrders.length
            )}
            note={`${salesOrders.filter(
              (order) =>
                order.is_fulfilled ===
                true
            ).length} fulfilled`}
          />

          <SummaryCard
            label="Invoices"
            value={String(
              invoices.length
            )}
            note={`${invoices.filter(
              (invoice) =>
                invoice.balance_due <=
                0
            ).length} paid`}
          />

          <SummaryCard
            label="Outstanding A/R"
            value={money(
              primaryCurrency.outstanding,
              primaryCurrency.currency
            )}
            note={
              overdueInvoices.length >
              0
                ? `${overdueInvoices.length} overdue`
                : "No overdue balance"
            }
            tone={
              primaryCurrency.outstanding >
              0
                ? "warning"
                : "positive"
            }
          />

          <SummaryCard
            label="Last Activity"
            value={
              lastActivity
                ? formatDate(
                    String(
                      lastActivity
                    ).slice(
                      0,
                      10
                    )
                  )
                : "-"
            }
            note={`${activity.length} recent activities`}
          />
        </div>
      </section>

      {/* CURRENCY POSITION */}

      {totalsByCurrency.length >
        0 && (
        <section>
          <SectionHeading
            title="Financial Position"
            description="Sales, invoicing, collections and outstanding balance by currency."
          />

          <div className="grid gap-4 xl:grid-cols-2">
            {totalsByCurrency.map(
              (row) => (
                <div
                  key={
                    row.currency
                  }
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Customer Account
                      </div>

                      <div className="mt-1 text-xl font-semibold text-gray-900">
                        {
                          row.currency
                        }
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        row.outstanding >
                        0
                          ? "bg-amber-50 text-amber-700"
                          : "bg-green-50 text-green-700"
                      }`}
                    >
                      {row.outstanding >
                      0
                        ? "Balance Due"
                        : "Settled"}
                    </span>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <MetricBox
                      label="Orders"
                      value={money(
                        row.sales,
                        row.currency
                      )}
                    />

                    <MetricBox
                      label="Invoiced"
                      value={money(
                        row.invoiced,
                        row.currency
                      )}
                    />

                    <MetricBox
                      label="Collected"
                      value={money(
                        row.collected,
                        row.currency
                      )}
                      tone="positive"
                    />

                    <MetricBox
                      label="Outstanding"
                      value={money(
                        row.outstanding,
                        row.currency
                      )}
                      tone={
                        row.outstanding >
                        0
                          ? "warning"
                          : "positive"
                      }
                    />
                  </div>
                </div>
              )
            )}
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.7fr_0.8fr]">
        {/* MAIN */}

        <div className="space-y-6">
          <SectionCard
            title="Contact Information"
            description="Primary customer and billing contact details."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <InfoItem
                label="Contact Person"
                value={
                  customer.contact_name
                }
              />

              <InfoItem
                label="Phone"
                value={
                  customer.phone
                }
                href={
                  customer.phone
                    ? `tel:${customer.phone}`
                    : undefined
                }
              />

              <InfoItem
                label="Email"
                value={
                  customer.email
                }
                href={
                  customer.email
                    ? `mailto:${customer.email}`
                    : undefined
                }
              />

              <InfoItem
                label="Tax ID"
                value={
                  customer.tax_id
                }
              />
            </div>

            <div className="mt-6 border-t border-gray-100 pt-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Address
              </div>

              <div className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-700">
                {customer.address ||
                  "No address provided."}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Recent Sales Orders"
            description="Latest customer sales workflow."
            action={
              <Link
                href="/sales"
                className="text-sm font-medium text-gray-500 hover:text-gray-900"
              >
                View all →
              </Link>
            }
          >
            {salesOrders.length ===
            0 ? (
              <EmptyState text="No sales orders for this customer yet." />
            ) : (
              <div className="divide-y divide-gray-100">
                {salesOrders
                  .slice(
                    0,
                    6
                  )
                  .map(
                    (order) => (
                      <Link
                        key={
                          order.id
                        }
                        href={`/sales/${order.id}`}
                        className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                      >
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {
                              order.sales_order_no
                            }
                          </div>

                          <div className="mt-1 text-xs text-gray-500">
                            {formatDate(
                              order.order_date
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-semibold text-gray-900">
                            {money(
                              order.total_amount,
                              order.currency
                            )}
                          </div>

                          <div className="mt-1">
                            <StatusPill
                              value={
                                order.is_fulfilled
                                  ? "fulfilled"
                                  : order.status
                              }
                            />
                          </div>
                        </div>
                      </Link>
                    )
                  )}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Recent Invoices"
            description="Billing status and receivable balances."
            action={
              <Link
                href="/invoices"
                className="text-sm font-medium text-gray-500 hover:text-gray-900"
              >
                View all →
              </Link>
            }
          >
            {invoices.length ===
            0 ? (
              <EmptyState text="No invoices for this customer yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <TableHeader>
                        Invoice
                      </TableHeader>

                      <TableHeader>
                        Date
                      </TableHeader>

                      <TableHeader>
                        Status
                      </TableHeader>

                      <TableHeader right>
                        Total
                      </TableHeader>

                      <TableHeader right>
                        Balance
                      </TableHeader>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {invoices
                      .slice(
                        0,
                        8
                      )
                      .map(
                        (invoice) => {
                          const overdue =
                            Boolean(
                              invoice.due_date &&
                                invoice.due_date <
                                  today() &&
                                invoice.balance_due >
                                  0
                            );

                          return (
                            <tr
                              key={
                                invoice.id
                              }
                            >
                              <td className="py-3 pr-4">
                                <Link
                                  href={`/invoices/${invoice.id}`}
                                  className="text-sm font-semibold text-gray-900 hover:underline"
                                >
                                  {
                                    invoice.invoice_no
                                  }
                                </Link>
                              </td>

                              <td className="py-3 pr-4 text-sm text-gray-500">
                                {formatDate(
                                  invoice.invoice_date
                                )}
                              </td>

                              <td className="py-3 pr-4">
                                <StatusPill
                                  value={
                                    overdue
                                      ? "overdue"
                                      : invoice.status
                                  }
                                />
                              </td>

                              <td className="py-3 pr-4 text-right text-sm font-medium text-gray-900">
                                {money(
                                  invoice.total_amount,
                                  invoice.currency
                                )}
                              </td>

                              <td
                                className={`py-3 text-right text-sm font-semibold ${
                                  overdue
                                    ? "text-red-600"
                                    : invoice.balance_due >
                                      0
                                    ? "text-amber-600"
                                    : "text-green-700"
                                }`}
                              >
                                {money(
                                  invoice.balance_due,
                                  invoice.currency
                                )}
                              </td>
                            </tr>
                          );
                        }
                      )}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Customer Activity"
            description="Combined quotation, order, invoice and payment timeline."
          >
            {activity.length ===
            0 ? (
              <EmptyState text="No customer activity yet." />
            ) : (
              <div className="space-y-1">
                {activity.map(
                  (item) => (
                    <ActivityRow
                      key={
                        item.key
                      }
                      item={
                        item
                      }
                    />
                  )
                )}
              </div>
            )}
          </SectionCard>
        </div>

        {/* SIDEBAR */}

        <div className="space-y-6">
          <SectionCard
            title="Account Status"
            description="Customer master record."
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  {customer.is_active
                    ? "Active Customer"
                    : "Inactive Customer"}
                </div>

                <p className="mt-1 text-xs leading-5 text-gray-500">
                  {customer.is_active
                    ? "Available for quotations, sales orders and billing workflows."
                    : "Kept for history but not intended for normal new transactions."}
                </p>
              </div>

              {customer.is_active ? (
                <Badge tone="success">
                  Active
                </Badge>
              ) : (
                <Badge tone="default">
                  Inactive
                </Badge>
              )}
            </div>

            <button
              type="button"
              disabled={
                actionBusy
              }
              onClick={
                toggleActive
              }
              className="mt-5 w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionBusy
                ? "Updating..."
                : customer.is_active
                ? "Make Inactive"
                : "Make Active"}
            </button>
          </SectionCard>

          <SectionCard
            title="Quick Actions"
            description="Start a customer workflow."
          >
            <div className="space-y-2">
              <QuickLink
                href={`/quotations/new?customer_id=${customer.id}`}
                label="Create Quotation"
                hint="Prepare a customer quote"
              />

              <QuickLink
                href={`/sales/new?customer_id=${customer.id}`}
                label="Create Sales Order"
                hint="Start a sales workflow"
              />

              <QuickLink
                href="/invoices"
                label="View Invoices"
                hint="Billing and collections"
              />

              <QuickLink
                href="/reports"
                label="Open Reports"
                hint="Business-wide analytics"
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Record Management"
            description="Customer master-data actions."
          >
            <div className="space-y-2">
              <Link
                href={`/customers/${customer.id}/edit`}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <span>
                  Edit Customer
                </span>

                <span className="text-gray-300">
                  →
                </span>
              </Link>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/customers"
                  )
                }
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-3 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                <span>
                  Back to Customers
                </span>

                <span className="text-gray-300">
                  →
                </span>
              </button>
            </div>
          </SectionCard>

          {payments.length >
            0 && (
            <SectionCard
              title="Recent Payments"
              description="Latest customer collections."
            >
              <div className="divide-y divide-gray-100">
                {payments
                  .slice(
                    0,
                    5
                  )
                  .map(
                    (payment) => (
                      <Link
                        key={
                          payment.id
                        }
                        href={`/invoices/${payment.invoice_id}`}
                        className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {
                              payment.payment_no
                            }
                          </div>

                          <div className="mt-1 text-xs text-gray-400">
                            {formatDate(
                              payment.payment_date
                            )}{" "}
                            •{" "}
                            {methodLabel(
                              payment.payment_method
                            )}
                          </div>
                        </div>

                        <div className="text-sm font-semibold text-green-700">
                          {money(
                            payment.amount,
                            invoiceCurrencyMap.get(
                              payment.invoice_id
                            ) ||
                              "THB"
                          )}
                        </div>
                      </Link>
                    )
                  )}
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-gray-900">
        {title}
      </h2>

      <p className="mt-1 text-sm text-gray-500">
        {description}
      </p>
    </div>
  );
}

function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
        <div>
          <h2 className="font-semibold text-gray-900">
            {title}
          </h2>

          {description && (
            <p className="mt-1 text-sm text-gray-500">
              {description}
            </p>
          )}
        </div>

        {action}
      </div>

      <div className="p-5">
        {children}
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  note,
  tone = "normal",
}: {
  label: string;
  value: string;
  note: string;
  tone?:
    | "normal"
    | "positive"
    | "warning"
    | "danger";
}) {
  const valueClass =
    tone === "positive"
      ? "text-green-700"
      : tone === "warning"
      ? "text-amber-600"
      : tone === "danger"
      ? "text-red-600"
      : "text-gray-900";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-gray-500">
        {label}
      </div>

      <div
        className={`mt-2 text-2xl font-semibold ${valueClass}`}
      >
        {value}
      </div>

      <div className="mt-2 text-xs text-gray-400">
        {note}
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="rounded-lg bg-white p-3">
      <div
        className={`text-lg font-semibold ${
          warning
            ? "text-amber-600"
            : "text-gray-900"
        }`}
      >
        {value}
      </div>

      <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-gray-400">
        {label}
      </div>
    </div>
  );
}

function MetricBox({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string;
  tone?:
    | "normal"
    | "positive"
    | "warning";
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </div>

      <div
        className={`mt-2 text-sm font-semibold ${
          tone === "positive"
            ? "text-green-700"
            : tone === "warning"
            ? "text-amber-600"
            : "text-gray-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null;
  href?: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </div>

      {href && value ? (
        <a
          href={href}
          className="mt-2 block text-sm font-medium text-gray-900 underline decoration-gray-300 underline-offset-4"
        >
          {value}
        </a>
      ) : (
        <div className="mt-2 text-sm font-medium text-gray-900">
          {value || "-"}
        </div>
      )}
    </div>
  );
}

function QuickLink({
  href,
  label,
  hint,
}: {
  href: string;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-3 transition hover:bg-gray-50"
    >
      <div>
        <div className="text-sm font-medium text-gray-900">
          {label}
        </div>

        <div className="mt-1 text-xs text-gray-400">
          {hint}
        </div>
      </div>

      <span className="text-gray-300">
        →
      </span>
    </Link>
  );
}

function PrimaryAction({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        backgroundColor:
          "#111827",
        color:
          "#ffffff",
      }}
      className="rounded-lg px-4 py-2.5 text-sm font-semibold"
    >
      {children}
    </Link>
  );
}

function SecondaryAction({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
    >
      {children}
    </Link>
  );
}

function ActivityRow({
  item,
}: {
  item: ActivityItem;
}) {
  const inner = (
    <div className="flex items-center justify-between gap-4 rounded-lg px-3 py-3 transition hover:bg-gray-50">
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
            item.tone ===
            "positive"
              ? "bg-green-500"
              : item.tone ===
                "warning"
              ? "bg-amber-500"
              : item.tone ===
                "danger"
              ? "bg-red-500"
              : "bg-gray-300"
          }`}
        />

        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-gray-900">
            {item.title}
          </div>

          <div className="mt-1 text-xs text-gray-500">
            {
              item.description
            }{" "}
            •{" "}
            {formatDate(
              item.date
            )}
          </div>
        </div>
      </div>

      {item.amount !==
        undefined && (
        <div className="shrink-0 text-sm font-semibold text-gray-900">
          {money(
            item.amount,
            item.currency ||
              "THB"
          )}
        </div>
      )}
    </div>
  );

  return item.href ? (
    <Link
      href={
        item.href
      }
    >
      {inner}
    </Link>
  ) : (
    inner
  );
}

function StatusPill({
  value,
}: {
  value: string;
}) {
  const normalized =
    String(
      value || ""
    ).toLowerCase();

  const className =
    normalized === "paid" ||
    normalized ===
      "fulfilled" ||
    normalized ===
      "accepted"
      ? "bg-green-50 text-green-700"
      : normalized ===
        "overdue" ||
        normalized ===
          "cancelled" ||
        normalized ===
          "rejected"
      ? "bg-red-50 text-red-700"
      : normalized ===
          "draft"
      ? "bg-gray-100 text-gray-600"
      : "bg-amber-50 text-amber-700";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${className}`}
    >
      {labelize(
        value
      )}
    </span>
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
      className={`py-2 pr-4 text-xs font-semibold uppercase tracking-wider text-gray-400 ${
        right
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-lg bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
      {text}
    </div>
  );
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

function methodLabel(
  value: string
) {
  if (
    value ===
    "bank_transfer"
  ) {
    return "Bank Transfer";
  }

  if (value === "qr") {
    return "QR / PromptPay";
  }

  if (value === "cash") {
    return "Cash";
  }

  if (value === "card") {
    return "Card";
  }

  return labelize(
    value
  );
}

function initials(
  value: string
) {
  const parts =
    String(
      value || "C"
    )
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  return parts
    .slice(
      0,
      2
    )
    .map(
      (part) =>
        part[0]?.toUpperCase() ||
        ""
    )
    .join("") ||
    "C";
}

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
      : currency ===
        "SGD"
      ? "S$"
      : currency ===
        "EUR"
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
