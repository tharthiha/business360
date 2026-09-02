import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type CurrencySummary = {
  currency: string;

  sales: number;
  invoiced: number;
  collected: number;
  outstanding: number;

  cogs: number;
  grossProfit: number;

  expenses: number;
  netProfit: number;

  purchases: number;

  supplierBilled: number;
  supplierPaid: number;
  supplierOutstanding: number;

  cashFlow: number;
};

export default async function DashboardPage() {
  const supabase =
    await createClient();

  const now = new Date();

  const today =
    toDateInput(now);

  const currentMonth =
    today.slice(0, 7);

  const currentPeriodStart =
    `${currentMonth}-01`;

  const [
    customersResult,
    productsResult,
    salesOrdersResult,
    invoicesResult,
    paymentsResult,
    suppliersResult,
    purchaseOrdersResult,
    expensesResult,
    supplierBillsResult,
    supplierPaymentsResult,
    currentCloseResult,
  ] = await Promise.all([
    supabase
      .from("customers")
      .select(`
        id,
        customer_name,
        is_active
      `),

    supabase
      .from("products")
      .select(`
        id,
        product_name,
        product_code,
        is_active,
        current_stock,
        min_stock,
        cost_price
      `),

    supabase
      .from("sales_orders")
      .select(`
        id,
        sales_order_no,
        customer_id,
        status,
        currency,
        total_amount,
        order_date,
        order_source,
        is_fulfilled
      `),

    supabase
      .from("invoices")
      .select(`
        id,
        invoice_no,
        sales_order_id,
        customer_id,
        status,
        currency,
        total_amount,
        paid_amount,
        balance_due,
        invoice_date,
        due_date
      `),

    supabase
      .from("payments")
      .select(`
        id,
        payment_no,
        invoice_id,
        customer_id,
        amount,
        payment_date,
        payment_method
      `),

    supabase
      .from("suppliers")
      .select(`
        id,
        supplier_name,
        is_active
      `),

    supabase
      .from("purchase_orders")
      .select(`
        id,
        purchase_order_no,
        supplier_id,
        status,
        currency,
        total_amount,
        order_date
      `),

    supabase
      .from("expenses")
      .select(`
        id,
        expense_no,
        status,
        currency,
        total_amount,
        expense_date,
        description
      `),

    supabase
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
        balance_due
      `),

    supabase
      .from("supplier_payments")
      .select(`
        id,
        payment_no,
        supplier_id,
        supplier_bill_id,
        payment_date,
        amount,
        payment_method
      `),

    supabase
      .from(
        "accounting_period_closes"
      )
      .select(`
        status,
        closed_at,
        financial_snapshot,
        inventory_snapshot
      `)
      .eq(
        "period_start",
        currentPeriodStart
      )
      .maybeSingle(),
  ]);

  const customers =
    customersResult.data || [];

  const products =
    productsResult.data || [];

  const salesOrders =
    salesOrdersResult.data || [];

  const invoices =
    invoicesResult.data || [];

  const payments =
    paymentsResult.data || [];

  const suppliers =
    suppliersResult.data || [];

  const purchaseOrders =
    purchaseOrdersResult.data || [];

  const expenses =
    expensesResult.data || [];

  const supplierBills =
    supplierBillsResult.data || [];

  const supplierPayments =
    supplierPaymentsResult.data || [];

  const currentClose =
    currentCloseResult.data;

  const currentMonthClosed =
    currentClose?.status ===
      "closed";

  const currentMonthReopened =
    currentClose?.status ===
      "reopened";

  const currentFinancialSnapshot =
    currentMonthClosed &&
    Array.isArray(
      currentClose?.financial_snapshot
    )
      ? currentClose.financial_snapshot
      : [];

  const currentInventorySnapshot =
    currentMonthClosed &&
    currentClose?.inventory_snapshot &&
    typeof currentClose.inventory_snapshot ===
      "object"
      ? currentClose.inventory_snapshot
      : null;

  /*
    ======================================
    SALES ITEMS / COGS
    ======================================
  */

  const monthlySalesOrders =
    salesOrders.filter(
      (order) =>
        order.order_date?.startsWith(
          currentMonth
        ) &&
        order.status !==
          "cancelled"
    );

  const monthlySalesOrderIds =
    monthlySalesOrders.map(
      (order) =>
        Number(order.id)
    );

  let salesItems: any[] = [];

  if (
    monthlySalesOrderIds.length >
    0
  ) {
    const {
      data:
        salesItemsData,
    } = await supabase
      .from(
        "sales_order_items"
      )
      .select(`
        id,
        sales_order_id,
        product_id,
        qty,
        unit_cost,
        cogs_amount,
        line_total
      `)
      .in(
        "sales_order_id",
        monthlySalesOrderIds
      );

    salesItems =
      salesItemsData || [];
  }

  /*
    ======================================
    MAPS
    ======================================
  */

  const customerMap =
    new Map<number, string>();

  for (
    const customer of customers
  ) {
    customerMap.set(
      Number(customer.id),
      customer.customer_name
    );
  }

  const invoiceMap =
    new Map<number, any>();

  for (
    const invoice of invoices
  ) {
    invoiceMap.set(
      Number(invoice.id),
      invoice
    );
  }

  const supplierBillMap =
    new Map<number, any>();

  for (
    const bill of
      supplierBills
  ) {
    supplierBillMap.set(
      Number(bill.id),
      bill
    );
  }

  const salesOrderMap =
    new Map<number, any>();

  for (
    const order of salesOrders
  ) {
    salesOrderMap.set(
      Number(order.id),
      order
    );
  }

  /*
    ======================================
    BASIC COUNTS
    ======================================
  */

  const activeCustomers =
    customers.filter(
      (customer) =>
        customer.is_active !==
        false
    ).length;

  const activeProducts =
    products.filter(
      (product) =>
        product.is_active !==
        false
    ).length;

  const activeSuppliers =
    suppliers.filter(
      (supplier) =>
        supplier.is_active !==
        false
    ).length;

  /*
    ======================================
    INVENTORY
    ======================================
  */

  const outOfStockProducts =
    products.filter(
      (product) =>
        Number(
          product.current_stock ||
            0
        ) <= 0
    );

  const lowStockProducts =
    products.filter(
      (product) => {
        const stock =
          Number(
            product.current_stock ||
              0
          );

        const minimum =
          Number(
            product.min_stock ||
              0
          );

        return (
          stock > 0 &&
          stock <= minimum
        );
      }
    );

  const healthyProducts =
    products.filter(
      (product) =>
        Number(
          product.current_stock ||
            0
        ) >
        Number(
          product.min_stock ||
            0
        )
    );

  const liveInventoryValue =
    products.reduce(
      (sum, product) =>
        sum +
        Number(
          product.current_stock ||
            0
        ) *
          Number(
            product.cost_price ||
              0
          ),
      0
    );

  const liveTotalUnits =
    products.reduce(
      (sum, product) =>
        sum +
        Number(
          product.current_stock ||
            0
        ),
      0
    );

  const inventoryValue =
    currentInventorySnapshot
      ? Number(
          currentInventorySnapshot.inventory_value ||
            0
        )
      : liveInventoryValue;

  const totalUnits =
    currentInventorySnapshot
      ? Number(
          currentInventorySnapshot.total_units ||
            0
        )
      : liveTotalUnits;

  /*
    ======================================
    CUSTOMER INVOICES
    ======================================
  */

  const paidInvoices =
    invoices.filter(
      (invoice) =>
        invoice.status ===
          "paid" ||
        Number(
          invoice.balance_due ||
            0
        ) <= 0
    ).length;

  const outstandingInvoices =
    invoices.filter(
      (invoice) =>
        Number(
          invoice.balance_due ||
            0
        ) > 0
    );

  const overdueInvoices =
    invoices.filter(
      (invoice) =>
        invoice.due_date &&
        invoice.due_date <
          today &&
        Number(
          invoice.balance_due ||
            0
        ) > 0
    );

  /*
    ======================================
    SALES ORDERS
    ======================================
  */

  const draftSalesOrders =
    salesOrders.filter(
      (order) =>
        order.status === "draft"
    ).length;

  const confirmedSalesOrders =
    salesOrders.filter(
      (order) =>
        order.status ===
        "confirmed"
    ).length;

  const fulfilledSalesOrders =
    salesOrders.filter(
      (order) =>
        order.is_fulfilled ===
        true
    ).length;

  const pendingDeliveryOrders =
    salesOrders.filter(
      (order) =>
        order.status ===
          "confirmed" &&
        order.is_fulfilled !==
          true
    );

  const invoicedSalesOrderIds =
    new Set(
      invoices
        .filter(
          (invoice) =>
            invoice.sales_order_id
        )
        .map(
          (invoice) =>
            Number(
              invoice.sales_order_id
            )
        )
    );

  const notInvoicedOrders =
    salesOrders.filter(
      (order) =>
        order.status !==
          "cancelled" &&
        !invoicedSalesOrderIds.has(
          Number(order.id)
        )
    );

  /*
    ======================================
    PURCHASE ORDERS
    ======================================
  */

  const openPurchaseOrders =
    purchaseOrders.filter(
      (order) =>
        [
          "draft",
          "ordered",
          "partially_received",
        ].includes(
          order.status
        )
    );

  const receivedPurchaseOrders =
    purchaseOrders.filter(
      (order) =>
        order.status ===
        "received"
    ).length;

  /*
    ======================================
    EXPENSES
    ======================================
  */

  const postedExpenses =
    expenses.filter(
      (expense) =>
        expense.status ===
        "posted"
    );

  const draftExpenses =
    expenses.filter(
      (expense) =>
        expense.status ===
        "draft"
    );

  /*
    ======================================
    ACCOUNTS PAYABLE
    ======================================
  */

  const paidSupplierBills =
    supplierBills.filter(
      (bill) =>
        bill.status ===
          "paid" ||
        Number(
          bill.balance_due ||
            0
        ) <= 0
    );

  const openSupplierBills =
    supplierBills.filter(
      (bill) =>
        bill.status ===
          "open" ||
        bill.status ===
          "partially_paid"
    );

  const outstandingSupplierBills =
    supplierBills.filter(
      (bill) =>
        Number(
          bill.balance_due ||
            0
        ) > 0
    );

  const overdueSupplierBills =
    supplierBills.filter(
      (bill) =>
        bill.due_date &&
        bill.due_date <
          today &&
        Number(
          bill.balance_due ||
            0
        ) > 0
    );

  /*
    ======================================
    CURRENCIES
    ======================================
  */

  const currencies =
    new Set<string>();

  for (
    const order of
      monthlySalesOrders
  ) {
    currencies.add(
      order.currency || "THB"
    );
  }

  for (
    const invoice of invoices
  ) {
    if (
      invoice.invoice_date?.startsWith(
        currentMonth
      )
    ) {
      currencies.add(
        invoice.currency || "THB"
      );
    }
  }

  for (
    const order of
      purchaseOrders
  ) {
    if (
      order.order_date?.startsWith(
        currentMonth
      )
    ) {
      currencies.add(
        order.currency || "THB"
      );
    }
  }

  for (
    const expense of
      expenses
  ) {
    if (
      expense.expense_date?.startsWith(
        currentMonth
      )
    ) {
      currencies.add(
        expense.currency || "THB"
      );
    }
  }

  for (
    const bill of
      supplierBills
  ) {
    if (
      bill.bill_date?.startsWith(
        currentMonth
      )
    ) {
      currencies.add(
        bill.currency || "THB"
      );
    }
  }

  for (
    const payment of
      payments
  ) {
    if (
      payment.payment_date?.startsWith(
        currentMonth
      )
    ) {
      const invoice =
        invoiceMap.get(
          Number(
            payment.invoice_id
          )
        );

      currencies.add(
        invoice?.currency ||
          "THB"
      );
    }
  }

  for (
    const payment of
      supplierPayments
  ) {
    if (
      payment.payment_date?.startsWith(
        currentMonth
      )
    ) {
      const bill =
        supplierBillMap.get(
          Number(
            payment.supplier_bill_id
          )
        );

      currencies.add(
        bill?.currency ||
          "THB"
      );
    }
  }

  if (
    currencies.size === 0
  ) {
    currencies.add("THB");
  }

  /*
    ======================================
    FINANCIALS
    ======================================
  */

  const financials:
    CurrencySummary[] =
    Array.from(
      currencies
    ).map(
      (currency) => {
        const sales =
          monthlySalesOrders
            .filter(
              (order) =>
                (
                  order.currency ||
                  "THB"
                ) === currency
            )
            .reduce(
              (sum, order) =>
                sum +
                Number(
                  order.total_amount ||
                    0
                ),
              0
            );

        const invoiced =
          invoices
            .filter(
              (invoice) =>
                invoice.invoice_date?.startsWith(
                  currentMonth
                ) &&
                (
                  invoice.currency ||
                  "THB"
                ) === currency
            )
            .reduce(
              (
                sum,
                invoice
              ) =>
                sum +
                Number(
                  invoice.total_amount ||
                    0
                ),
              0
            );

        const customerOutstanding =
          invoices
            .filter(
              (invoice) =>
                (
                  invoice.currency ||
                  "THB"
                ) === currency
            )
            .reduce(
              (
                sum,
                invoice
              ) =>
                sum +
                Number(
                  invoice.balance_due ||
                    0
                ),
              0
            );

        const collected =
          payments
            .filter(
              (payment) => {
                if (
                  !payment.payment_date?.startsWith(
                    currentMonth
                  )
                ) {
                  return false;
                }

                const invoice =
                  invoiceMap.get(
                    Number(
                      payment.invoice_id
                    )
                  );

                return (
                  (
                    invoice?.currency ||
                    "THB"
                  ) ===
                  currency
                );
              }
            )
            .reduce(
              (
                sum,
                payment
              ) =>
                sum +
                Number(
                  payment.amount ||
                    0
                ),
              0
            );

        let cogs = 0;

        for (
          const item of
            salesItems
        ) {
          const order =
            salesOrderMap.get(
              Number(
                item.sales_order_id
              )
            );

          if (
            !order ||
            (
              order.currency ||
              "THB"
            ) !== currency
          ) {
            continue;
          }

          const snapshotCogs =
            Number(
              item.cogs_amount ||
                0
            );

          if (
            snapshotCogs > 0
          ) {
            cogs +=
              snapshotCogs;

            continue;
          }

          /*
            Historical fallback:
            before cogs_amount existed,
            fulfilled rows used
            qty × unit_cost.

            Do not book fallback COGS
            for an order that has not
            been fulfilled yet.
          */
          if (
            order.is_fulfilled ===
            true
          ) {
            cogs +=
              Number(
                item.qty || 0
              ) *
              Number(
                item.unit_cost ||
                  0
              );
          }
        }

        const operatingExpenses =
          postedExpenses
            .filter(
              (expense) =>
                expense.expense_date?.startsWith(
                  currentMonth
                ) &&
                (
                  expense.currency ||
                  "THB"
                ) === currency
            )
            .reduce(
              (
                sum,
                expense
              ) =>
                sum +
                Number(
                  expense.total_amount ||
                    0
                ),
              0
            );

        const purchases =
          purchaseOrders
            .filter(
              (order) =>
                order.order_date?.startsWith(
                  currentMonth
                ) &&
                order.status !==
                  "cancelled" &&
                (
                  order.currency ||
                  "THB"
                ) === currency
            )
            .reduce(
              (sum, order) =>
                sum +
                Number(
                  order.total_amount ||
                    0
                ),
              0
            );

        const supplierBilled =
          supplierBills
            .filter(
              (bill) =>
                bill.bill_date?.startsWith(
                  currentMonth
                ) &&
                (
                  bill.currency ||
                  "THB"
                ) === currency
            )
            .reduce(
              (sum, bill) =>
                sum +
                Number(
                  bill.total_amount ||
                    0
                ),
              0
            );

        const supplierOutstanding =
          supplierBills
            .filter(
              (bill) =>
                (
                  bill.currency ||
                  "THB"
                ) === currency
            )
            .reduce(
              (sum, bill) =>
                sum +
                Number(
                  bill.balance_due ||
                    0
                ),
              0
            );

        const supplierPaid =
          supplierPayments
            .filter(
              (payment) => {
                if (
                  !payment.payment_date?.startsWith(
                    currentMonth
                  )
                ) {
                  return false;
                }

                const bill =
                  supplierBillMap.get(
                    Number(
                      payment.supplier_bill_id
                    )
                  );

                return (
                  (
                    bill?.currency ||
                    "THB"
                  ) ===
                  currency
                );
              }
            )
            .reduce(
              (
                sum,
                payment
              ) =>
                sum +
                Number(
                  payment.amount ||
                    0
                ),
              0
            );

        const grossProfit =
          sales - cogs;

        const netProfit =
          grossProfit -
          operatingExpenses;

        /*
          Cash Flow now includes:
          Customer collections
          - operating expenses
          - supplier payments
        */

        const cashFlow =
          collected -
          operatingExpenses -
          supplierPaid;

        return {
          currency,

          sales,
          invoiced,
          collected,

          outstanding:
            customerOutstanding,

          cogs,
          grossProfit,

          expenses:
            operatingExpenses,

          netProfit,

          purchases,

          supplierBilled,
          supplierPaid,
          supplierOutstanding,

          cashFlow,
        };
      }
    );

  const dashboardSnapshotMap =
    new Map<string, any>();

  for (
    const row of
      currentFinancialSnapshot
  ) {
    dashboardSnapshotMap.set(
      String(
        row?.currency ||
          "THB"
      ),
      row
    );
  }

  const snapshotAwareFinancials =
    financials.map(
      (live) => {
        const stored =
          dashboardSnapshotMap.get(
            live.currency
          );

        if (!stored) {
          return live;
        }

        return {
          ...live,

          sales:
            Number(
              stored.recognized_sales_revenue ||
                0
            ),

          collected:
            Number(
              stored.customer_collections ||
                0
            ),

          outstanding:
            Number(
              stored.ar_outstanding ||
                0
            ),

          cogs:
            Number(
              stored.cogs ||
                0
            ),

          grossProfit:
            Number(
              stored.gross_profit ||
                0
            ),

          expenses:
            Number(
              stored.posted_expenses ||
                0
            ),

          netProfit:
            Number(
              stored.net_profit ||
                0
            ),

          supplierPaid:
            Number(
              stored.supplier_payments ||
                0
            ),

          supplierOutstanding:
            Number(
              stored.ap_outstanding ||
                0
            ),

          cashFlow:
            Number(
              stored.net_cash_flow ||
                0
            ),
        };
      }
    );

  /*
    ======================================
    RECENT ACTIVITY
    ======================================
  */

  const recentPayments =
    [...payments]
      .sort(
        (a, b) =>
          String(
            b.payment_date ||
              ""
          ).localeCompare(
            String(
              a.payment_date ||
                ""
            )
          ) ||
          Number(b.id) -
            Number(a.id)
      )
      .slice(0, 5);

  const recentSupplierPayments =
    [...supplierPayments]
      .sort(
        (a, b) =>
          String(
            b.payment_date ||
              ""
          ).localeCompare(
            String(
              a.payment_date ||
                ""
            )
          ) ||
          Number(b.id) -
            Number(a.id)
      )
      .slice(0, 5);

  const recentSales =
    [...salesOrders]
      .sort(
        (a, b) =>
          String(
            b.order_date ||
              ""
          ).localeCompare(
            String(
              a.order_date ||
                ""
            )
          ) ||
          Number(b.id) -
            Number(a.id)
      )
      .slice(0, 5);

  const displayedFinancials =
    currentMonthClosed
      ? snapshotAwareFinancials
      : financials;

  const primary =
    displayedFinancials.find(
      (row) =>
        row.currency ===
        "THB"
    ) ||
    displayedFinancials[0];

  const totalAttention =
    outOfStockProducts.length +
    lowStockProducts.length +
    overdueInvoices.length +
    overdueSupplierBills.length +
    pendingDeliveryOrders.length +
    openPurchaseOrders.length +
    draftExpenses.length;

  /*
    ======================================
    AI ACTION CENTER
    ======================================
  */

  const aiAlerts: {
    title: string;
    description: string;
    action: string;
    href: string;
    priority:
      | "critical"
      | "high"
      | "medium"
      | "info";
  }[] = [];

  if (
    overdueInvoices.length >
    0
  ) {
    aiAlerts.push({
      title: `${overdueInvoices.length} overdue customer invoice${
        overdueInvoices.length === 1
          ? ""
          : "s"
      }`,
      description:
        "Customer balances are past due. Prioritize collection follow-up to protect cash flow.",
      action:
        "Review customer collections",
      href: "/invoices",
      priority: "critical",
    });
  }

  if (
    overdueSupplierBills.length >
    0
  ) {
    aiAlerts.push({
      title: `${overdueSupplierBills.length} overdue supplier bill${
        overdueSupplierBills.length ===
        1
          ? ""
          : "s"
      }`,
      description:
        "Supplier balances are past due. Review payment timing and supplier commitments.",
      action:
        "Review supplier payables",
      href: "/supplier-bills",
      priority: "critical",
    });
  }

  if (
    outOfStockProducts.length >
    0
  ) {
    aiAlerts.push({
      title: `${outOfStockProducts.length} product${
        outOfStockProducts.length ===
        1
          ? ""
          : "s"
      } out of stock`,
      description:
        "Sales may be blocked until stock is replenished. Prioritize items with active demand.",
      action: "Open inventory",
      href: "/inventory",
      priority: "high",
    });
  }

  if (
    lowStockProducts.length >
    0
  ) {
    aiAlerts.push({
      title: `${lowStockProducts.length} low-stock product${
        lowStockProducts.length === 1
          ? ""
          : "s"
      }`,
      description:
        "Current stock is at or below minimum level. Consider replenishment before stockout.",
      action: "Plan replenishment",
      href: "/inventory",
      priority: "high",
    });
  }

  if (
    pendingDeliveryOrders.length >
    0
  ) {
    aiAlerts.push({
      title: `${pendingDeliveryOrders.length} confirmed order${
        pendingDeliveryOrders.length ===
        1
          ? ""
          : "s"
      } pending delivery`,
      description:
        "Confirmed customer orders are not yet fulfilled. Review delivery readiness and stock availability.",
      action:
        "Review sales orders",
      href: "/sales",
      priority: "medium",
    });
  }

  if (
    draftExpenses.length >
    0
  ) {
    aiAlerts.push({
      title: `${draftExpenses.length} draft expense${
        draftExpenses.length === 1
          ? ""
          : "s"
      } waiting`,
      description:
        "Draft expenses are not yet posted and may be missing from current-period profitability.",
      action: "Review expenses",
      href: "/expenses",
      priority: "medium",
    });
  }

  if (
    primary &&
    primary.netProfit < 0
  ) {
    aiAlerts.push({
      title:
        "Current month is operating at a net loss",
      description: `${moneySigned(
        primary.netProfit,
        primary.currency
      )} net profit for the current month. Review margin and operating expenses.`,
      action:
        "Open financial reports",
      href: "/reports",
      priority: "critical",
    });
  } else if (
    primary &&
    primary.cashFlow < 0
  ) {
    aiAlerts.push({
      title:
        "Cash flow is negative this month",
      description: `${moneySigned(
        primary.cashFlow,
        primary.currency
      )} net cash flow after collections, expenses and supplier payments.`,
      action: "Review cash flow",
      href: "/reports",
      priority: "high",
    });
  }

  if (
    aiAlerts.length === 0
  ) {
    aiAlerts.push({
      title:
        "No urgent business alerts detected",
      description:
        "Collections, payables, inventory and current operating signals do not require immediate attention.",
      action: "Ask Business360 AI",
      href: "/ai",
      priority: "info",
    });
  }

  const visibleAiAlerts =
    aiAlerts.slice(0, 6);

  return (
    <div className="space-y-7">
      {/* HERO */}

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid gap-6 p-7 xl:grid-cols-[1.4fr_0.6fr] xl:items-center">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white">
                Business360
              </span>

              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  currentMonthClosed
                    ? "bg-gray-900 text-white"
                    : currentMonthReopened
                    ? "bg-blue-50 text-blue-700"
                    : "bg-green-50 text-green-700"
                }`}
              >
                {currentMonthClosed
                  ? "Closed month snapshot"
                  : currentMonthReopened
                  ? "Reopened month • Live"
                  : "Live business overview"}
              </span>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
              Executive Dashboard
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Monitor profitability,
              customer collections,
              supplier payments,
              inventory, purchasing and
              operational risks from
              one place.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <PrimaryAction
                href="/sales/new"
                label="+ New Sales Order"
              />

              <SecondaryAction
                href="/quotations/new"
                label="New Quotation"
              />

              <SecondaryAction
                href="/purchase/new"
                label="Purchase Order"
              />

              <SecondaryAction
                href="/supplier-bills"
                label="Supplier Bills"
              />

              <SecondaryAction
                href="/reports"
                label="View Reports"
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Business Attention
            </div>

            <div className="mt-2 flex items-end justify-between">
              <div>
                <div className="text-4xl font-semibold tracking-tight text-gray-900">
                  {totalAttention}
                </div>

                <div className="mt-1 text-sm text-gray-500">
                  attention signals
                </div>
              </div>

              <div
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  totalAttention >
                  0
                    ? "bg-amber-50 text-amber-700"
                    : "bg-green-50 text-green-700"
                }`}
              >
                {totalAttention >
                0
                  ? "Review"
                  : "Healthy"}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-4 gap-2 text-center">
              <MiniStatus
                label="Stock Out"
                value={
                  outOfStockProducts.length
                }
                tone="danger"
              />

              <MiniStatus
                label="A/R Due"
                value={
                  overdueInvoices.length
                }
                tone="warning"
              />

              <MiniStatus
                label="A/P Due"
                value={
                  overdueSupplierBills.length
                }
                tone="warning"
              />

              <MiniStatus
                label="Open PO"
                value={
                  openPurchaseOrders.length
                }
              />
            </div>
          </div>
        </div>
      </section>

      {currentMonthClosed && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          Current-month financial and inventory summary cards are using the
          stored month-end close snapshot. Operational activity and attention
          indicators remain live for day-to-day monitoring.
        </div>
      )}

      {currentMonthReopened && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          The current accounting month is reopened. Dashboard financials are
          live until the month is closed again.
        </div>
      )}

      {/* AI ACTION CENTER */}

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-700">
                AI Signals
              </span>

              <h2 className="text-lg font-semibold text-gray-900">
                AI Action Center
              </h2>
            </div>

            <p className="mt-2 text-sm text-gray-500">
              Smart business signals generated from live collections, payables,
              inventory, sales and profitability data.
            </p>
          </div>

          <Link
            href="/ai"
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            Ask AI Assistant →
          </Link>
        </div>

        <div className="grid gap-3 p-5 lg:grid-cols-2">
          {visibleAiAlerts.map(
            (alert, index) => (
              <AiAlertCard
                key={`${alert.title}-${index}`}
                title={alert.title}
                description={
                  alert.description
                }
                action={alert.action}
                href={alert.href}
                priority={
                  alert.priority
                }
              />
            )
          )}
        </div>

        <div className="border-t border-gray-100 bg-gray-50 px-6 py-3 text-xs text-gray-500">
          Business360 analyzes current operational signals only. Review source
          records before making financial or purchasing decisions.
        </div>
      </section>

      {/* EXECUTIVE SNAPSHOT */}

      <section>
        <SectionHeading
          title="Executive Snapshot"
          description="Key financial and operational indicators for the current month."
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ExecutiveCard
            href="/sales"
            eyebrow="Monthly Sales"
            value={
              primary
                ? money(
                    primary.sales,
                    primary.currency
                  )
                : "฿0.00"
            }
            sub="Customer sales value"
          />

          <ExecutiveCard
            href="/reports"
            eyebrow="Net Profit"
            value={
              primary
                ? moneySigned(
                    primary.netProfit,
                    primary.currency
                  )
                : "฿0.00"
            }
            sub="Sales − COGS − expenses"
            accent={
              primary &&
              primary.netProfit <
                0
                ? "danger"
                : "positive"
            }
          />

          <ExecutiveCard
            href="/invoices"
            eyebrow="Customer Outstanding"
            value={
              primary
                ? money(
                    primary.outstanding,
                    primary.currency
                  )
                : "฿0.00"
            }
            sub={`${outstandingInvoices.length} customer invoices`}
            accent={
              outstandingInvoices.length >
              0
                ? "warning"
                : "positive"
            }
          />

          <ExecutiveCard
            href="/supplier-bills"
            eyebrow="Supplier Payables"
            value={
              primary
                ? money(
                    primary.supplierOutstanding,
                    primary.currency
                  )
                : "฿0.00"
            }
            sub={`${outstandingSupplierBills.length} supplier bills`}
            accent={
              outstandingSupplierBills.length >
              0
                ? "warning"
                : "positive"
            }
          />
        </div>
      </section>

      {/* FINANCIAL PERFORMANCE */}

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <SectionHeading
            title="Financial Performance"
            description="Currencies are reported separately. Cash Flow includes supplier payments."
            compact
          />
        </div>

        <div className="grid gap-5 p-6 xl:grid-cols-2">
          {displayedFinancials.map(
            (summary) => {
              const grossMargin =
                summary.sales > 0
                  ? (summary.grossProfit /
                      summary.sales) *
                    100
                  : 0;

              const netMargin =
                summary.sales > 0
                  ? (summary.netProfit /
                      summary.sales) *
                    100
                  : 0;

              return (
                <div
                  key={
                    summary.currency
                  }
                  className="rounded-xl border border-gray-200 bg-gray-50 p-5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Monthly P&L
                      </div>

                      <div className="mt-1 text-xl font-semibold text-gray-900">
                        {
                          summary.currency
                        }
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        summary.netProfit >=
                        0
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {summary.netProfit >=
                      0
                        ? "Profitable"
                        : "Loss"}
                    </span>
                  </div>

                  <div className="mt-6 space-y-3">
                    <FinancialRow
                      label="Sales Revenue"
                      value={money(
                        summary.sales,
                        summary.currency
                      )}
                    />

                    <FinancialRow
                      label="Cost of Goods Sold"
                      value={`-${money(
                        summary.cogs,
                        summary.currency
                      )}`}
                    />

                    <FinancialRow
                      label="Gross Profit"
                      value={money(
                        summary.grossProfit,
                        summary.currency
                      )}
                      strong
                      positive={
                        summary.grossProfit >=
                        0
                      }
                    />

                    <FinancialRow
                      label="Operating Expenses"
                      value={`-${money(
                        summary.expenses,
                        summary.currency
                      )}`}
                    />

                    <div className="border-t border-gray-200 pt-3">
                      <FinancialRow
                        label="Net Profit"
                        value={moneySigned(
                          summary.netProfit,
                          summary.currency
                        )}
                        large
                        positive={
                          summary.netProfit >=
                          0
                        }
                        danger={
                          summary.netProfit <
                          0
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <InfoTile
                      label="Gross Margin"
                      value={`${grossMargin.toFixed(
                        1
                      )}%`}
                    />

                    <InfoTile
                      label="Net Margin"
                      value={`${netMargin.toFixed(
                        1
                      )}%`}
                    />
                  </div>

                  <div className="mt-5 border-t border-gray-200 pt-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <InfoTile
                        label="Collected"
                        value={money(
                          summary.collected,
                          summary.currency
                        )}
                        positive
                      />

                      <InfoTile
                        label="Supplier Paid"
                        value={money(
                          summary.supplierPaid,
                          summary.currency
                        )}
                      />

                      <InfoTile
                        label="A/P Balance"
                        value={money(
                          summary.supplierOutstanding,
                          summary.currency
                        )}
                      />

                      <InfoTile
                        label="Cash Flow"
                        value={moneySigned(
                          summary.cashFlow,
                          summary.currency
                        )}
                        positive={
                          summary.cashFlow >=
                          0
                        }
                        danger={
                          summary.cashFlow <
                          0
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            }
          )}
        </div>
      </section>

      {/* ACCOUNTS PAYABLE */}

      <section>
        <SectionHeading
          title="Accounts Payable"
          description="Supplier bills and outgoing supplier payments."
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SimpleMetricCard
            href="/supplier-bills"
            label="Supplier Bills"
            value={
              supplierBills.length
            }
            hint={`${openSupplierBills.length} open`}
          />

          <SimpleMetricCard
            href="/supplier-bills"
            label="Paid Bills"
            value={
              paidSupplierBills.length
            }
            hint="Fully settled"
            tone="positive"
          />

          <SimpleMetricCard
            href="/supplier-bills"
            label="Outstanding Bills"
            value={
              outstandingSupplierBills.length
            }
            hint="Balance still payable"
            tone={
              outstandingSupplierBills.length >
              0
                ? "warning"
                : "positive"
            }
          />

          <SimpleMetricCard
            href="/supplier-bills"
            label="Overdue Payables"
            value={
              overdueSupplierBills.length
            }
            hint="Past supplier due date"
            tone={
              overdueSupplierBills.length >
              0
                ? "danger"
                : "positive"
            }
          />
        </div>
      </section>

      {/* OPERATIONAL HEALTH */}

      <section>
        <SectionHeading
          title="Operational Health"
          description="Sales, inventory and purchasing progress."
        />

        <div className="grid gap-6 xl:grid-cols-3">
          <HealthCard
            title="Sales Pipeline"
            description="Customer order progress"
            href="/sales"
          >
            <HealthRow
              label="Draft"
              value={
                draftSalesOrders
              }
              total={
                Math.max(
                  salesOrders.length,
                  1
                )
              }
            />

            <HealthRow
              label="Confirmed"
              value={
                confirmedSalesOrders
              }
              total={
                Math.max(
                  salesOrders.length,
                  1
                )
              }
            />

            <HealthRow
              label="Fulfilled"
              value={
                fulfilledSalesOrders
              }
              total={
                Math.max(
                  salesOrders.length,
                  1
                )
              }
              positive
            />

            <div className="mt-5 grid grid-cols-2 gap-3">
              <InfoTile
                label="Pending Delivery"
                value={String(
                  pendingDeliveryOrders.length
                )}
              />

              <InfoTile
                label="Not Invoiced"
                value={String(
                  notInvoicedOrders.length
                )}
              />
            </div>
          </HealthCard>

          <HealthCard
            title="Inventory Health"
            description="Current stock condition"
            href="/inventory"
          >
            <HealthRow
              label="Healthy"
              value={
                healthyProducts.length
              }
              total={
                Math.max(
                  products.length,
                  1
                )
              }
              positive
            />

            <HealthRow
              label="Low Stock"
              value={
                lowStockProducts.length
              }
              total={
                Math.max(
                  products.length,
                  1
                )
              }
            />

            <HealthRow
              label="Out of Stock"
              value={
                outOfStockProducts.length
              }
              total={
                Math.max(
                  products.length,
                  1
                )
              }
              danger
            />

            <div className="mt-5 grid grid-cols-2 gap-3">
              <InfoTile
                label="Products"
                value={String(
                  activeProducts
                )}
              />

              <InfoTile
                label="Inventory Value"
                value={money(
                  inventoryValue,
                  "THB"
                )}
              />
            </div>
          </HealthCard>

          <HealthCard
            title="Purchasing & Payables"
            description="Supplier purchasing progress"
            href="/purchase"
          >
            <HealthRow
              label="Open Purchase Orders"
              value={
                openPurchaseOrders.length
              }
              total={
                Math.max(
                  purchaseOrders.length,
                  1
                )
              }
            />

            <HealthRow
              label="Received"
              value={
                receivedPurchaseOrders
              }
              total={
                Math.max(
                  purchaseOrders.length,
                  1
                )
              }
              positive
            />

            <HealthRow
              label="Outstanding Bills"
              value={
                outstandingSupplierBills.length
              }
              total={
                Math.max(
                  supplierBills.length,
                  1
                )
              }
              danger={
                overdueSupplierBills.length >
                0
              }
            />

            <div className="mt-5 grid grid-cols-2 gap-3">
              <InfoTile
                label="Suppliers"
                value={String(
                  activeSuppliers
                )}
              />

              <InfoTile
                label="Supplier Bills"
                value={String(
                  supplierBills.length
                )}
              />
            </div>

            <Link
              href="/supplier-bills"
              className="mt-4 flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              View Accounts Payable
            </Link>
          </HealthCard>
        </div>
      </section>

      {/* NEEDS ATTENTION */}

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-5">
          <SectionHeading
            title="Needs Attention"
            description="Items that may require action today."
            compact
          />
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <AttentionCard
            href="/inventory"
            label="Out of Stock"
            value={
              outOfStockProducts.length
            }
            description="Products with zero stock"
            tone="danger"
          />

          <AttentionCard
            href="/invoices"
            label="Customer Overdue"
            value={
              overdueInvoices.length
            }
            description="Customer balances past due"
            tone="danger"
          />

          <AttentionCard
            href="/supplier-bills"
            label="Supplier Overdue"
            value={
              overdueSupplierBills.length
            }
            description="Supplier bills past due"
            tone="danger"
          />

          <AttentionCard
            href="/sales"
            label="Pending Delivery"
            value={
              pendingDeliveryOrders.length
            }
            description="Orders not yet fulfilled"
            tone="warning"
          />

          <AttentionCard
            href="/inventory"
            label="Low Stock"
            value={
              lowStockProducts.length
            }
            description="Products near minimum stock"
            tone="warning"
          />

          <AttentionCard
            href="/purchase"
            label="Open Purchase Orders"
            value={
              openPurchaseOrders.length
            }
            description="POs still in progress"
          />

          <AttentionCard
            href="/supplier-bills"
            label="Outstanding Payables"
            value={
              outstandingSupplierBills.length
            }
            description="Supplier bills still unpaid"
            tone="warning"
          />

          <AttentionCard
            href="/expenses"
            label="Draft Expenses"
            value={
              draftExpenses.length
            }
            description="Expenses not yet posted"
          />
        </div>
      </section>

      {/* BUSINESS NETWORK */}

      <section>
        <SectionHeading
          title="Business Network"
          description="Core customer, product and supplier records."
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <SimpleLinkCard
            href="/customers"
            label="Active Customers"
            value={
              activeCustomers
            }
            hint="Customer accounts"
          />

          <SimpleLinkCard
            href="/products"
            label="Active Products"
            value={
              activeProducts
            }
            hint={`${formatQty(
              totalUnits
            )} units on hand`}
          />

          <SimpleLinkCard
            href="/suppliers"
            label="Active Suppliers"
            value={
              activeSuppliers
            }
            hint="Purchasing partners"
          />
        </div>
      </section>

      {/* RECENT ACTIVITY */}

      <section>
        <SectionHeading
          title="Recent Activity"
          description="Latest sales, customer collections and supplier payments."
        />

        <div className="grid gap-6 xl:grid-cols-3">
          <ActivityCard
            title="Recent Sales Orders"
            subtitle="Latest customer orders"
            href="/sales"
            linkLabel="View all"
          >
            {recentSales.length ===
            0 ? (
              <EmptyState text="No sales orders yet." />
            ) : (
              <div className="divide-y divide-gray-100">
                {recentSales.map(
                  (order) => (
                    <Link
                      key={
                        order.id
                      }
                      href={`/sales/${order.id}`}
                      className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-gray-900">
                          {
                            order.sales_order_no
                          }
                        </div>

                        <div className="mt-1 text-xs text-gray-500">
                          {customerMap.get(
                            Number(
                              order.customer_id
                            )
                          ) ||
                            "Customer"}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-semibold">
                          {money(
                            Number(
                              order.total_amount ||
                                0
                            ),
                            order.currency ||
                              "THB"
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
          </ActivityCard>

          <ActivityCard
            title="Customer Payments"
            subtitle="Recent collections"
            href="/invoices"
            linkLabel="Invoices"
          >
            {recentPayments.length ===
            0 ? (
              <EmptyState text="No customer payments yet." />
            ) : (
              <div className="divide-y divide-gray-100">
                {recentPayments.map(
                  (payment) => {
                    const invoice =
                      invoiceMap.get(
                        Number(
                          payment.invoice_id
                        )
                      );

                    return (
                      <Link
                        key={
                          payment.id
                        }
                        href={`/invoices/${payment.invoice_id}`}
                        className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50"
                      >
                        <div>
                          <div className="text-sm font-semibold">
                            {
                              payment.payment_no
                            }
                          </div>

                          <div className="mt-1 text-xs text-gray-500">
                            {formatDate(
                              payment.payment_date
                            )}
                          </div>
                        </div>

                        <div className="text-sm font-semibold text-green-700">
                          {money(
                            Number(
                              payment.amount ||
                                0
                            ),
                            invoice?.currency ||
                              "THB"
                          )}
                        </div>
                      </Link>
                    );
                  }
                )}
              </div>
            )}
          </ActivityCard>

          <ActivityCard
            title="Supplier Payments"
            subtitle="Recent outgoing payments"
            href="/supplier-bills"
            linkLabel="Supplier Bills"
          >
            {recentSupplierPayments.length ===
            0 ? (
              <EmptyState text="No supplier payments yet." />
            ) : (
              <div className="divide-y divide-gray-100">
                {recentSupplierPayments.map(
                  (payment) => {
                    const bill =
                      supplierBillMap.get(
                        Number(
                          payment.supplier_bill_id
                        )
                      );

                    return (
                      <Link
                        key={
                          payment.id
                        }
                        href={`/supplier-bills/${payment.supplier_bill_id}`}
                        className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-gray-50"
                      >
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {
                              payment.payment_no
                            }
                          </div>

                          <div className="mt-1 text-xs text-gray-500">
                            {formatDate(
                              payment.payment_date
                            )}
                          </div>
                        </div>

                        <div className="text-sm font-semibold text-red-600">
                          -
                          {money(
                            Number(
                              payment.amount ||
                                0
                            ),
                            bill?.currency ||
                              "THB"
                          )}
                        </div>
                      </Link>
                    );
                  }
                )}
              </div>
            )}
          </ActivityCard>
        </div>
      </section>

      {/* QUICK ACTIONS */}

      <section className="rounded-2xl border border-gray-200 bg-gray-900 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              Quick Actions
            </h2>

            <p className="mt-1 text-sm text-gray-400">
              Create records or jump
              directly into key
              workflows.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <DarkAction
              href="/sales/new"
              label="+ Sales Order"
            />

            <DarkAction
              href="/quotations/new"
              label="+ Quotation"
            />

            <DarkAction
              href="/purchase/new"
              label="+ Purchase"
            />

            <DarkAction
              href="/supplier-bills"
              label="Supplier Bills"
            />

            <DarkAction
              href="/expenses/new"
              label="+ Expense"
            />

            <DarkAction
              href="/inventory"
              label="Inventory"
            />

            <DarkAction
              href="/reports"
              label="Reports"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

/* ======================================
   UI
====================================== */

function SectionHeading({
  title,
  description,
  compact = false,
}: {
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? ""
          : "mb-4"
      }
    >
      <h2 className="text-lg font-semibold text-gray-900">
        {title}
      </h2>

      <p className="mt-1 text-sm text-gray-500">
        {description}
      </p>
    </div>
  );
}

function ExecutiveCard({
  href,
  eyebrow,
  value,
  sub,
  accent = "normal",
}: {
  href: string;
  eyebrow: string;
  value: string;
  sub: string;
  accent?:
    | "normal"
    | "positive"
    | "warning"
    | "danger";
}) {
  const valueClass =
    accent === "positive"
      ? "text-green-700"
      : accent === "warning"
      ? "text-amber-600"
      : accent === "danger"
      ? "text-red-600"
      : "text-gray-900";

  return (
    <Link
      href={href}
      className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {eyebrow}
        </div>

        <span className="text-gray-300 group-hover:text-gray-600">
          →
        </span>
      </div>

      <div
        className={`mt-3 text-2xl font-semibold ${valueClass}`}
      >
        {value}
      </div>

      <div className="mt-2 text-xs text-gray-400">
        {sub}
      </div>
    </Link>
  );
}

function SimpleMetricCard({
  href,
  label,
  value,
  hint,
  tone = "normal",
}: {
  href: string;
  label: string;
  value: number;
  hint: string;
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
    <Link
      href={href}
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
    >
      <div className="text-sm text-gray-500">
        {label}
      </div>

      <div
        className={`mt-2 text-2xl font-semibold ${valueClass}`}
      >
        {value}
      </div>

      <div className="mt-2 text-xs text-gray-400">
        {hint}
      </div>
    </Link>
  );
}

function FinancialRow({
  label,
  value,
  strong = false,
  large = false,
  positive = false,
  danger = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  large?: boolean;
  positive?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className={
          strong || large
            ? "text-sm font-semibold text-gray-900"
            : "text-sm text-gray-500"
        }
      >
        {label}
      </span>

      <span
        className={`font-semibold ${
          large
            ? "text-2xl"
            : strong
            ? "text-base"
            : "text-sm"
        } ${
          danger
            ? "text-red-600"
            : positive
            ? "text-green-700"
            : "text-gray-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function InfoTile({
  label,
  value,
  positive = false,
  danger = false,
}: {
  label: string;
  value: string;
  positive?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </div>

      <div
        className={`mt-2 text-sm font-semibold ${
          danger
            ? "text-red-600"
            : positive
            ? "text-green-700"
            : "text-gray-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function HealthCard({
  title,
  description,
  href,
  children,
}: {
  title: string;
  description: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">
            {title}
          </h3>

          <p className="mt-1 text-xs text-gray-500">
            {description}
          </p>
        </div>

        <Link
          href={href}
          className="text-sm text-gray-400 hover:text-gray-900"
        >
          →
        </Link>
      </div>

      <div className="mt-6">
        {children}
      </div>
    </div>
  );
}

function HealthRow({
  label,
  value,
  total,
  positive = false,
  danger = false,
}: {
  label: string;
  value: number;
  total: number;
  positive?: boolean;
  danger?: boolean;
}) {
  const percent =
    total > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (value / total) *
              100
          )
        )
      : 0;

  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-gray-600">
          {label}
        </span>

        <span
          className={`font-semibold ${
            danger
              ? "text-red-600"
              : positive
              ? "text-green-700"
              : "text-gray-900"
          }`}
        >
          {value}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${
            danger
              ? "bg-red-500"
              : positive
              ? "bg-green-500"
              : "bg-gray-900"
          }`}
          style={{
            width: `${percent}%`,
          }}
        />
      </div>
    </div>
  );
}

function AiAlertCard({
  title,
  description,
  action,
  href,
  priority,
}: {
  title: string;
  description: string;
  action: string;
  href: string;
  priority:
    | "critical"
    | "high"
    | "medium"
    | "info";
}) {
  const styles =
    priority === "critical"
      ? {
          badge:
            "bg-red-50 text-red-700",
          dot: "bg-red-500",
          border:
            "border-red-100",
        }
      : priority === "high"
      ? {
          badge:
            "bg-amber-50 text-amber-700",
          dot: "bg-amber-500",
          border:
            "border-amber-100",
        }
      : priority === "medium"
      ? {
          badge:
            "bg-blue-50 text-blue-700",
          dot: "bg-blue-500",
          border:
            "border-blue-100",
        }
      : {
          badge:
            "bg-green-50 text-green-700",
          dot: "bg-green-500",
          border:
            "border-green-100",
        };

  return (
    <Link
      href={href}
      className={`group rounded-xl border ${styles.border} p-4 transition hover:bg-gray-50`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${styles.dot}`}
            />

            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${styles.badge}`}
            >
              {priority}
            </span>
          </div>

          <h3 className="mt-3 text-sm font-semibold text-gray-900">
            {title}
          </h3>

          <p className="mt-1 text-xs leading-5 text-gray-500">
            {description}
          </p>
        </div>

        <span className="shrink-0 text-gray-300 transition group-hover:text-gray-700">
          →
        </span>
      </div>

      <div className="mt-3 text-xs font-semibold text-gray-700">
        {action}
      </div>
    </Link>
  );
}

function AttentionCard({
  href,
  label,
  value,
  description,
  tone = "normal",
}: {
  href: string;
  label: string;
  value: number;
  description: string;
  tone?:
    | "normal"
    | "warning"
    | "danger";
}) {
  const valueClass =
    tone === "danger"
      ? "text-red-600"
      : tone === "warning"
      ? "text-amber-600"
      : "text-gray-900";

  return (
    <Link
      href={href}
      className="rounded-xl border border-gray-200 p-4 transition hover:bg-gray-50"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-gray-900">
            {label}
          </div>

          <p className="mt-1 text-xs text-gray-500">
            {description}
          </p>
        </div>

        <div
          className={`text-2xl font-semibold ${valueClass}`}
        >
          {value}
        </div>
      </div>
    </Link>
  );
}

function SimpleLinkCard({
  href,
  label,
  value,
  hint,
}: {
  href: string;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
    >
      <div className="text-sm text-gray-500">
        {label}
      </div>

      <div className="mt-3 text-3xl font-semibold">
        {value}
      </div>

      <div className="mt-2 text-xs text-gray-400">
        {hint}
      </div>
    </Link>
  );
}

function MiniStatus({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: number;
  tone?:
    | "normal"
    | "warning"
    | "danger";
}) {
  return (
    <div className="rounded-lg bg-white p-3">
      <div
        className={`text-lg font-semibold ${
          tone === "danger"
            ? "text-red-600"
            : tone ===
              "warning"
            ? "text-amber-600"
            : "text-gray-900"
        }`}
      >
        {value}
      </div>

      <div className="mt-1 text-[9px] uppercase tracking-wide text-gray-400">
        {label}
      </div>
    </div>
  );
}

function ActivityCard({
  title,
  subtitle,
  href,
  linkLabel,
  children,
}: {
  title: string;
  subtitle: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <div>
          <h3 className="font-semibold text-gray-900">
            {title}
          </h3>

          <p className="mt-1 text-xs text-gray-500">
            {subtitle}
          </p>
        </div>

        <Link
          href={href}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          {linkLabel} →
        </Link>
      </div>

      {children}
    </div>
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
    normalized ===
      "fulfilled" ||
    normalized === "paid"
      ? "bg-green-50 text-green-700"
      : normalized ===
        "cancelled"
      ? "bg-red-50 text-red-700"
      : normalized ===
        "draft"
      ? "bg-gray-100 text-gray-600"
      : "bg-amber-50 text-amber-700";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${className}`}
    >
      {labelize(value)}
    </span>
  );
}

function PrimaryAction({
  href,
  label,
}: {
  href: string;
  label: string;
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
      {label}
    </Link>
  );
}

function SecondaryAction({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      {label}
    </Link>
  );
}

function DarkAction({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700"
    >
      {label}
    </Link>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="px-5 py-10 text-center text-sm text-gray-500">
      {text}
    </div>
  );
}

/* ======================================
   FORMAT
====================================== */

function toDateInput(
  date: Date
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

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

function formatQty(
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

function moneySigned(
  value: number,
  currency: string
) {
  if (value < 0) {
    return `-${money(
      Math.abs(value),
      currency
    )}`;
  }

  return money(
    value,
    currency
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