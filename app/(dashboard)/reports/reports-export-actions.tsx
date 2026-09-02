"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";

type Props = {
  startDate: string;
  endDate: string;
};

type FinancialSummary = {
  currency: string;

  sales: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;

  expenses: number;
  netProfit: number;
  netMargin: number;

  invoiced: number;
  customerCollected: number;
  customerOutstanding: number;

  purchases: number;

  supplierBilled: number;
  supplierPaid: number;
  supplierOutstanding: number;
  supplierOverdue: number;

  netCashFlow: number;
};

export default function ReportsExportActions({
  startDate,
  endDate,
}: Props) {
  const supabase = createClient();

  const [exporting, setExporting] =
    useState(false);

  const [activeExport, setActiveExport] =
    useState<"excel" | "csv" | null>(null);

  const [message, setMessage] =
    useState("");

  async function loadExportData() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw new Error(
        userError.message ||
          "Could not read user session."
      );
    }

    if (!user) {
      throw new Error(
        "Please login first."
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (profileError) {
      throw new Error(
        profileError.message ||
          "Could not load company profile."
      );
    }

    if (!profile?.company_id) {
      throw new Error(
        "Company profile not found."
      );
    }

    const companyId =
      Number(profile.company_id);

    /*
      ======================================
      CORE DATA
      ======================================
    */

    const [
      salesResult,
      invoicesResult,
      paymentsResult,
      purchasesResult,
      expensesResult,
      supplierBillsResult,
      supplierPaymentsResult,
      monthCloseResult,
    ] = await Promise.all([
      supabase
        .from("sales_orders")
        .select(`
          id,
          sales_order_no,
          customer_id,
          order_date,
          status,
          order_source,
          currency,
          subtotal,
          discount_amount,
          tax_amount,
          total_amount,
          is_fulfilled
        `)
        .eq(
          "company_id",
          companyId
        )
        .gte(
          "order_date",
          startDate
        )
        .lte(
          "order_date",
          endDate
        )
        .order("id"),

      supabase
        .from("invoices")
        .select(`
          id,
          invoice_no,
          customer_id,
          sales_order_id,
          invoice_date,
          due_date,
          status,
          currency,
          total_amount,
          paid_amount,
          balance_due
        `)
        .eq(
          "company_id",
          companyId
        )
        .gte(
          "invoice_date",
          startDate
        )
        .lte(
          "invoice_date",
          endDate
        )
        .order("id"),

      supabase
        .from("payments")
        .select(`
          id,
          payment_no,
          invoice_id,
          customer_id,
          payment_date,
          amount,
          payment_method,
          reference_no,
          notes
        `)
        .eq(
          "company_id",
          companyId
        )
        .gte(
          "payment_date",
          startDate
        )
        .lte(
          "payment_date",
          endDate
        )
        .order("id"),

      supabase
        .from("purchase_orders")
        .select(`
          id,
          purchase_order_no,
          supplier_id,
          order_date,
          expected_date,
          status,
          currency,
          subtotal,
          discount_amount,
          tax_amount,
          total_amount
        `)
        .eq(
          "company_id",
          companyId
        )
        .gte(
          "order_date",
          startDate
        )
        .lte(
          "order_date",
          endDate
        )
        .order("id"),

      supabase
        .from("expenses")
        .select(`
          id,
          expense_no,
          expense_date,
          supplier_id,
          payment_method,
          status,
          currency,
          total_amount,
          description
        `)
        .eq(
          "company_id",
          companyId
        )
        .gte(
          "expense_date",
          startDate
        )
        .lte(
          "expense_date",
          endDate
        )
        .order("id"),

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
          balance_due,
          supplier_invoice_no,
          notes
        `)
        .eq(
          "company_id",
          companyId
        )
        .gte(
          "bill_date",
          startDate
        )
        .lte(
          "bill_date",
          endDate
        )
        .order("id"),

      supabase
        .from("supplier_payments")
        .select(`
          id,
          payment_no,
          supplier_id,
          supplier_bill_id,
          payment_date,
          amount,
          payment_method,
          reference_no,
          notes
        `)
        .eq(
          "company_id",
          companyId
        )
        .gte(
          "payment_date",
          startDate
        )
        .lte(
          "payment_date",
          endDate
        )
        .order("id"),

      isFullCalendarMonth(
        startDate,
        endDate
      )
        ? supabase
            .from(
              "accounting_period_closes"
            )
            .select(`
              status,
              period_start,
              period_end,
              financial_snapshot
            `)
            .eq(
              "company_id",
              companyId
            )
            .eq(
              "period_start",
              firstDayOfDate(
                startDate
              )
            )
            .maybeSingle()
        : Promise.resolve({
            data: null,
            error: null,
          }),
    ]);

    if (salesResult.error) {
      throw new Error(
        salesResult.error.message ||
          "Could not load sales orders."
      );
    }

    if (invoicesResult.error) {
      throw new Error(
        invoicesResult.error.message ||
          "Could not load invoices."
      );
    }

    if (paymentsResult.error) {
      throw new Error(
        paymentsResult.error.message ||
          "Could not load customer payments."
      );
    }

    if (purchasesResult.error) {
      throw new Error(
        purchasesResult.error.message ||
          "Could not load purchase orders."
      );
    }

    if (expensesResult.error) {
      throw new Error(
        expensesResult.error.message ||
          "Could not load expenses."
      );
    }

    if (
      supplierBillsResult.error
    ) {
      throw new Error(
        supplierBillsResult.error
          .message ||
          "Could not load supplier bills."
      );
    }

    if (
      supplierPaymentsResult.error
    ) {
      throw new Error(
        supplierPaymentsResult.error
          .message ||
          "Could not load supplier payments."
      );
    }

    if (
      monthCloseResult.error
    ) {
      throw new Error(
        monthCloseResult.error
          .message ||
          "Could not check month-end close snapshot."
      );
    }

    const sales =
      salesResult.data || [];

    /*
      Revenue recognition policy:
      only fulfilled Sales Orders are
      recognized as revenue and COGS.
      All orders still remain in the
      Sales Orders export register.
    */
    const recognizedSales =
      sales.filter(
        (row: any) =>
          row.status !==
            "cancelled" &&
          row.is_fulfilled ===
            true
      );

    const invoices =
      invoicesResult.data || [];

    const payments =
      paymentsResult.data || [];

    const purchases =
      purchasesResult.data || [];

    const expenses =
      expensesResult.data || [];

    const supplierBills =
      supplierBillsResult.data ||
      [];

    const supplierPayments =
      supplierPaymentsResult.data ||
      [];

    /*
      ======================================
      SALES ITEMS / HISTORICAL COGS
      ======================================

      Primary source:
        sales_order_items.cogs_amount

      Historical fallback:
        qty × unit_cost

      This matches the accounting logic used by
      Reports and the Executive Dashboard.
    */

    const salesOrderIds =
      sales.map(
        (row: any) =>
          Number(row.id)
      );

    let salesItems: any[] = [];

    if (
      salesOrderIds.length > 0
    ) {
      const {
        data:
          salesItemsData,
        error:
          salesItemsError,
      } = await supabase
        .from(
          "sales_order_items"
        )
        .select(`
          id,
          sales_order_id,
          product_id,
          description,
          qty,
          unit_price,
          unit_cost,
          cogs_amount,
          line_total
        `)
        .in(
          "sales_order_id",
          salesOrderIds
        );

      if (salesItemsError) {
        throw new Error(
          salesItemsError.message ||
            "Could not load sales order costing."
        );
      }

      salesItems =
        salesItemsData || [];
    }

    const salesOrderMap =
      new Map<
        number,
        any
      >();

    for (
      const order of sales
    ) {
      salesOrderMap.set(
        Number(order.id),
        order
      );
    }

    const cogsByOrder =
      new Map<
        number,
        number
      >();

    for (
      const item of salesItems
    ) {
      const orderId =
        Number(
          item.sales_order_id
        );

      const order =
        salesOrderMap.get(
          orderId
        );

      if (
        !order ||
        order.status ===
          "cancelled" ||
        order.is_fulfilled !==
          true
      ) {
        continue;
      }

      const snapshotCogs =
        Number(
          item.cogs_amount ||
            0
        );

      const itemCogs =
        snapshotCogs > 0
          ? snapshotCogs
          : Number(
              item.qty || 0
            ) *
            Number(
              item.unit_cost ||
                0
            );

      cogsByOrder.set(
        orderId,
        (
          cogsByOrder.get(
            orderId
          ) || 0
        ) +
          itemCogs
      );
    }

    /*
      ======================================
      CUSTOMERS / SUPPLIERS
      ======================================
    */

    const customerIds =
      Array.from(
        new Set(
          [
            ...sales.map(
              (row: any) =>
                row.customer_id
            ),

            ...invoices.map(
              (row: any) =>
                row.customer_id
            ),

            ...payments.map(
              (row: any) =>
                row.customer_id
            ),
          ].filter(Boolean)
        )
      );

    const supplierIds =
      Array.from(
        new Set(
          [
            ...purchases.map(
              (row: any) =>
                row.supplier_id
            ),

            ...expenses.map(
              (row: any) =>
                row.supplier_id
            ),

            ...supplierBills.map(
              (row: any) =>
                row.supplier_id
            ),

            ...supplierPayments.map(
              (row: any) =>
                row.supplier_id
            ),
          ].filter(Boolean)
        )
      );

    const customersResult =
      customerIds.length > 0
        ? await supabase
            .from("customers")
            .select(
              "id, customer_name"
            )
            .in(
              "id",
              customerIds
            )
        : {
            data: [],
            error: null,
          };

    const suppliersResult =
      supplierIds.length > 0
        ? await supabase
            .from("suppliers")
            .select(
              "id, supplier_name"
            )
            .in(
              "id",
              supplierIds
            )
        : {
            data: [],
            error: null,
          };

    if (
      customersResult.error
    ) {
      throw new Error(
        customersResult.error
          .message ||
          "Could not load customers."
      );
    }

    if (
      suppliersResult.error
    ) {
      throw new Error(
        suppliersResult.error
          .message ||
          "Could not load suppliers."
      );
    }

    const customerMap =
      new Map<
        number,
        string
      >();

    for (
      const customer of
        customersResult.data ||
        []
    ) {
      customerMap.set(
        Number(customer.id),
        customer.customer_name
      );
    }

    const supplierMap =
      new Map<
        number,
        string
      >();

    for (
      const supplier of
        suppliersResult.data ||
        []
    ) {
      supplierMap.set(
        Number(supplier.id),
        supplier.supplier_name
      );
    }

    /*
      ======================================
      INVOICE / BILL MAPS
      ======================================
    */

    const invoiceMap =
      new Map<
        number,
        any
      >();

    for (
      const invoice of invoices
    ) {
      invoiceMap.set(
        Number(invoice.id),
        invoice
      );
    }

    const supplierBillMap =
      new Map<
        number,
        any
      >();

    for (
      const bill of
        supplierBills
    ) {
      supplierBillMap.set(
        Number(bill.id),
        bill
      );
    }

    /*
      ======================================
      FINANCIAL SUMMARY
      ======================================
    */

    const currencySet =
      new Set<string>();

    for (
      const row of sales
    ) {
      currencySet.add(
        row.currency ||
          "THB"
      );
    }

    for (
      const row of invoices
    ) {
      currencySet.add(
        row.currency ||
          "THB"
      );
    }

    for (
      const row of purchases
    ) {
      currencySet.add(
        row.currency ||
          "THB"
      );
    }

    for (
      const row of expenses
    ) {
      currencySet.add(
        row.currency ||
          "THB"
      );
    }

    for (
      const row of
        supplierBills
    ) {
      currencySet.add(
        row.currency ||
          "THB"
      );
    }

    for (
      const payment of
        payments
    ) {
      const invoice =
        invoiceMap.get(
          Number(
            payment.invoice_id
          )
        );

      currencySet.add(
        invoice?.currency ||
          "THB"
      );
    }

    for (
      const payment of
        supplierPayments
    ) {
      const bill =
        supplierBillMap.get(
          Number(
            payment.supplier_bill_id
          )
        );

      currencySet.add(
        bill?.currency ||
          "THB"
      );
    }

    if (
      currencySet.size === 0
    ) {
      currencySet.add("THB");
    }

    const closedSnapshotActive =
      isFullCalendarMonth(
        startDate,
        endDate
      ) &&
      monthCloseResult.data?.status ===
        "closed" &&
      Array.isArray(
        monthCloseResult.data
          ?.financial_snapshot
      );

    const storedFinancialRows =
      closedSnapshotActive
        ? monthCloseResult.data
            ?.financial_snapshot || []
        : [];

    const storedFinancialMap =
      new Map<string, any>();

    for (
      const row of
        storedFinancialRows
    ) {
      storedFinancialMap.set(
        String(
          row?.currency ||
            "THB"
        ),
        row
      );

      currencySet.add(
        String(
          row?.currency ||
            "THB"
        )
      );
    }

    const liveFinancialSummary:
      FinancialSummary[] =
      Array.from(
        currencySet
      ).map(
        (currency) => {
          const salesTotal =
            recognizedSales
              .filter(
                (row: any) =>
                  (
                    row.currency ||
                    "THB"
                  ) ===
                    currency &&
                  row.status !==
                    "cancelled"
              )
              .reduce(
                (
                  sum: number,
                  row: any
                ) =>
                  sum +
                  Number(
                    row.total_amount ||
                      0
                  ),
                0
              );

          const cogsTotal =
            recognizedSales
              .filter(
                (row: any) =>
                  (
                    row.currency ||
                    "THB"
                  ) ===
                    currency &&
                  row.status !==
                    "cancelled"
              )
              .reduce(
                (
                  sum: number,
                  row: any
                ) =>
                  sum +
                  (
                    cogsByOrder.get(
                      Number(row.id)
                    ) || 0
                  ),
                0
              );

          const invoiceTotal =
            invoices
              .filter(
                (row: any) =>
                  (
                    row.currency ||
                    "THB"
                  ) ===
                  currency
              )
              .reduce(
                (
                  sum: number,
                  row: any
                ) =>
                  sum +
                  Number(
                    row.total_amount ||
                      0
                  ),
                0
              );

          const customerCollected =
            payments
              .filter(
                (row: any) => {
                  const invoice =
                    invoiceMap.get(
                      Number(
                        row.invoice_id
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
                  sum: number,
                  row: any
                ) =>
                  sum +
                  Number(
                    row.amount ||
                      0
                  ),
                0
              );

          const customerOutstanding =
            invoices
              .filter(
                (row: any) =>
                  (
                    row.currency ||
                    "THB"
                  ) ===
                  currency
              )
              .reduce(
                (
                  sum: number,
                  row: any
                ) =>
                  sum +
                  Number(
                    row.balance_due ||
                      0
                  ),
                0
              );

          const purchaseTotal =
            purchases
              .filter(
                (row: any) =>
                  (
                    row.currency ||
                    "THB"
                  ) ===
                    currency &&
                  row.status !==
                    "cancelled"
              )
              .reduce(
                (
                  sum: number,
                  row: any
                ) =>
                  sum +
                  Number(
                    row.total_amount ||
                      0
                  ),
                0
              );

          const expenseTotal =
            expenses
              .filter(
                (row: any) =>
                  (
                    row.currency ||
                    "THB"
                  ) ===
                    currency &&
                  row.status ===
                    "posted"
              )
              .reduce(
                (
                  sum: number,
                  row: any
                ) =>
                  sum +
                  Number(
                    row.total_amount ||
                      0
                  ),
                0
              );

          const supplierBilled =
            supplierBills
              .filter(
                (row: any) =>
                  (
                    row.currency ||
                    "THB"
                  ) ===
                  currency
              )
              .reduce(
                (
                  sum: number,
                  row: any
                ) =>
                  sum +
                  Number(
                    row.total_amount ||
                      0
                  ),
                0
              );

          const supplierPaid =
            supplierPayments
              .filter(
                (row: any) => {
                  const bill =
                    supplierBillMap.get(
                      Number(
                        row.supplier_bill_id
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
                  sum: number,
                  row: any
                ) =>
                  sum +
                  Number(
                    row.amount ||
                      0
                  ),
                0
              );

          const supplierOutstanding =
            supplierBills
              .filter(
                (row: any) =>
                  (
                    row.currency ||
                    "THB"
                  ) ===
                  currency
              )
              .reduce(
                (
                  sum: number,
                  row: any
                ) =>
                  sum +
                  Number(
                    row.balance_due ||
                      0
                  ),
                0
              );

          const supplierOverdue =
            supplierBills
              .filter(
                (row: any) =>
                  (
                    row.currency ||
                    "THB"
                  ) ===
                    currency &&
                  isOverdueBill(
                    row
                  )
              )
              .reduce(
                (
                  sum: number,
                  row: any
                ) =>
                  sum +
                  Number(
                    row.balance_due ||
                      0
                  ),
                0
              );

          const grossProfit =
            salesTotal -
            cogsTotal;

          const netProfit =
            grossProfit -
            expenseTotal;

          const grossMargin =
            salesTotal > 0
              ? (
                  grossProfit /
                  salesTotal
                ) * 100
              : 0;

          const netMargin =
            salesTotal > 0
              ? (
                  netProfit /
                  salesTotal
                ) * 100
              : 0;

          /*
            Cash Flow =
            Customer Collections
            - Operating Expenses
            - Supplier Payments
          */

          const netCashFlow =
            customerCollected -
            expenseTotal -
            supplierPaid;

          return {
            currency,

            sales:
              salesTotal,

            cogs:
              cogsTotal,

            grossProfit,

            grossMargin,

            expenses:
              expenseTotal,

            netProfit,

            netMargin,

            invoiced:
              invoiceTotal,

            customerCollected,

            customerOutstanding,

            purchases:
              purchaseTotal,

            supplierBilled,

            supplierPaid,

            supplierOutstanding,

            supplierOverdue,

            netCashFlow,
          };
        }
      );

    const financialSummary:
      FinancialSummary[] =
      liveFinancialSummary.map(
        (live) => {
          if (
            !closedSnapshotActive
          ) {
            return live;
          }

          const stored =
            storedFinancialMap.get(
              live.currency
            );

          if (!stored) {
            return live;
          }

          const sales =
            Number(
              stored.recognized_sales_revenue ||
                0
            );

          const cogs =
            Number(
              stored.cogs ||
                0
            );

          const grossProfit =
            Number(
              stored.gross_profit ??
                sales - cogs
            );

          const expenses =
            Number(
              stored.posted_expenses ||
                0
            );

          const netProfit =
            Number(
              stored.net_profit ??
                grossProfit -
                  expenses
            );

          return {
            ...live,

            sales,
            cogs,
            grossProfit,

            grossMargin:
              Number(
                stored.gross_margin_pct ??
                  (
                    sales > 0
                      ? (
                          grossProfit /
                          sales
                        ) * 100
                      : 0
                  )
              ),

            expenses,
            netProfit,

            netMargin:
              Number(
                stored.net_margin_pct ??
                  (
                    sales > 0
                      ? (
                          netProfit /
                          sales
                        ) * 100
                      : 0
                  )
              ),

            customerCollected:
              Number(
                stored.customer_collections ||
                  0
              ),

            customerOutstanding:
              Number(
                stored.ar_outstanding ||
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

            netCashFlow:
              Number(
                stored.net_cash_flow ??
                  0
              ),
          };
        }
      );

    return {
      sales,
      salesItems,
      cogsByOrder,
      salesOrderMap,

      invoices,
      payments,
      purchases,
      expenses,

      supplierBills,
      supplierPayments,

      customerMap,
      supplierMap,

      invoiceMap,
      supplierBillMap,

      financialSummary,

      exportBasis:
        closedSnapshotActive
          ? "Closed Snapshot"
          : monthCloseResult.data
              ?.status ===
            "reopened"
          ? "Reopened • Live"
          : "Live",

      snapshotStatus:
        monthCloseResult.data
          ?.status ||
        null,
    };
  }

  /*
    ======================================
    EXCEL
    ======================================
  */

  async function exportExcel() {
    if (exporting) {
      return;
    }

    setExporting(true);
    setActiveExport("excel");
    setMessage("");

    try {
      const data =
        await loadExportData();

      const workbook =
        XLSX.utils.book_new();

      /*
        REPORT INFO
      */

      appendSheet(
        workbook,
        [
          {
            Field:
              "Report",
            Value:
              "Business360 Management Report",
          },

          {
            Field:
              "From",
            Value:
              startDate,
          },

          {
            Field:
              "To",
            Value:
              endDate,
          },

          {
            Field:
              "Generated",
            Value:
              new Date().toLocaleString(),
          },

          {
            Field:
              "Accounting Basis",
            Value:
              data.exportBasis,
          },

          {
            Field:
              "Snapshot Rule",
            Value:
              data.exportBasis ===
                "Closed Snapshot"
                ? "Financial P&L, collections, A/R, supplier payments, A/P and cash flow use the stored month-end close snapshot."
                : "Financial totals are calculated from live transaction data.",
          },

          {
            Field:
              "Currency Rule",
            Value:
              "Currencies are kept separate.",
          },

          {
            Field:
              "Profit Formula",
            Value:
              "Net Profit = Sales Revenue - Historical COGS - Posted Operating Expenses",
          },

          {
            Field:
              "COGS Source",
            Value:
              "sales_order_items.cogs_amount; historical fallback = qty × unit_cost",
          },

          {
            Field:
              "Cash Flow Formula",
            Value:
              "Customer Collections - Operating Expenses - Supplier Payments",
          },
        ],
        "Report Info"
      );

      /*
        FINANCIAL SUMMARY
      */

      const financialRows =
        data.financialSummary.map(
          (row) => ({
            Currency:
              row.currency,

            "Sales Revenue":
              row.sales,

            COGS:
              row.cogs,

            "Gross Profit":
              row.grossProfit,

            "Gross Margin %":
              Number(
                row.grossMargin.toFixed(
                  2
                )
              ),

            "Operating Expenses":
              row.expenses,

            "Net Profit":
              row.netProfit,

            "Net Margin %":
              Number(
                row.netMargin.toFixed(
                  2
                )
              ),

            Invoiced:
              row.invoiced,

            "Customer Collected":
              row.customerCollected,

            "Customer Outstanding":
              row.customerOutstanding,

            Purchases:
              row.purchases,

            "Supplier Billed":
              row.supplierBilled,

            "Supplier Paid":
              row.supplierPaid,

            "Supplier Outstanding":
              row.supplierOutstanding,

            "Supplier Overdue":
              row.supplierOverdue,

            "Net Cash Flow":
              row.netCashFlow,
          })
        );

      appendSheet(
        workbook,
        financialRows,
        "Financial Summary"
      );

      /*
        SALES
      */

      const salesRows =
        data.sales.map(
          (row: any) => {
            const orderValue =
              Number(
                row.total_amount ||
                  0
              );

            const recognizedRevenue =
              row.is_fulfilled ===
                true &&
              row.status !==
                "cancelled"
                ? orderValue
                : 0;

            const cogs =
              row.is_fulfilled ===
                true
                ? (
                    data.cogsByOrder.get(
                      Number(row.id)
                    ) || 0
                  )
                : 0;

            const grossProfit =
              recognizedRevenue -
              cogs;

            const grossMargin =
              recognizedRevenue > 0
                ? (
                    grossProfit /
                    recognizedRevenue
                  ) * 100
                : 0;

            return {
            "Sales Order":
              row.sales_order_no,

            Customer:
              data.customerMap.get(
                Number(
                  row.customer_id
                )
              ) || "",

            Date:
              row.order_date,

            Source:
              sourceLabel(
                row.order_source ||
                  "quotation"
              ),

            Status:
              labelize(
                row.status
              ),

            Delivery:
              row.is_fulfilled
                ? "Fulfilled"
                : "Pending",

            Currency:
              row.currency ||
              "THB",

            Subtotal:
              Number(
                row.subtotal || 0
              ),

            Discount:
              Number(
                row.discount_amount ||
                  0
              ),

            Tax:
              Number(
                row.tax_amount ||
                  0
              ),

            "Order Total":
              orderValue,

            "Recognized Revenue":
              recognizedRevenue,

            COGS:
              cogs,

            "Gross Profit":
              grossProfit,

            "Gross Margin %":
              Number(
                grossMargin.toFixed(
                  2
                )
              ),
            };
          }
        );

      appendSheet(
        workbook,
        salesRows,
        "Sales Orders"
      );

      /*
        INVOICES
      */

      const invoiceRows =
        data.invoices.map(
          (row: any) => ({
            Invoice:
              row.invoice_no,

            Customer:
              data.customerMap.get(
                Number(
                  row.customer_id
                )
              ) || "",

            "Sales Order ID":
              row.sales_order_id ||
              "",

            "Invoice Date":
              row.invoice_date,

            "Due Date":
              row.due_date ||
              "",

            Status:
              labelize(
                row.status
              ),

            Currency:
              row.currency ||
              "THB",

            Total:
              Number(
                row.total_amount ||
                  0
              ),

            Paid:
              Number(
                row.paid_amount ||
                  0
              ),

            Balance:
              Number(
                row.balance_due ||
                  0
              ),
          })
        );

      appendSheet(
        workbook,
        invoiceRows,
        "Invoices"
      );

      /*
        CUSTOMER PAYMENTS
      */

      const paymentRows =
        data.payments.map(
          (row: any) => {
            const invoice =
              data.invoiceMap.get(
                Number(
                  row.invoice_id
                )
              );

            return {
              Payment:
                row.payment_no,

              "Invoice ID":
                row.invoice_id,

              Customer:
                data.customerMap.get(
                  Number(
                    row.customer_id
                  )
                ) || "",

              Date:
                row.payment_date,

              Currency:
                invoice?.currency ||
                "THB",

              Amount:
                Number(
                  row.amount || 0
                ),

              Method:
                paymentMethodLabel(
                  row.payment_method
                ),

              Reference:
                row.reference_no ||
                "",

              Notes:
                row.notes ||
                "",
            };
          }
        );

      appendSheet(
        workbook,
        paymentRows,
        "Customer Payments"
      );

      /*
        PURCHASE ORDERS
      */

      const purchaseRows =
        data.purchases.map(
          (row: any) => ({
            "Purchase Order":
              row.purchase_order_no,

            Supplier:
              data.supplierMap.get(
                Number(
                  row.supplier_id
                )
              ) || "",

            "Order Date":
              row.order_date,

            "Expected Date":
              row.expected_date ||
              "",

            Status:
              labelize(
                row.status
              ),

            Currency:
              row.currency ||
              "THB",

            Subtotal:
              Number(
                row.subtotal || 0
              ),

            Discount:
              Number(
                row.discount_amount ||
                  0
              ),

            Tax:
              Number(
                row.tax_amount ||
                  0
              ),

            Total:
              Number(
                row.total_amount ||
                  0
              ),
          })
        );

      appendSheet(
        workbook,
        purchaseRows,
        "Purchase Orders"
      );

      /*
        SUPPLIER BILLS
      */

      const supplierBillRows =
        data.supplierBills.map(
          (row: any) => ({
            "Supplier Bill":
              row.bill_no,

            Supplier:
              data.supplierMap.get(
                Number(
                  row.supplier_id
                )
              ) || "",

            "Purchase Order ID":
              row.purchase_order_id ||
              "",

            "Supplier Invoice No":
              row.supplier_invoice_no ||
              "",

            "Bill Date":
              row.bill_date,

            "Due Date":
              row.due_date ||
              "",

            Status:
              isOverdueBill(
                row
              )
                ? "Overdue"
                : labelize(
                    row.status
                  ),

            Currency:
              row.currency ||
              "THB",

            Total:
              Number(
                row.total_amount ||
                  0
              ),

            Paid:
              Number(
                row.paid_amount ||
                  0
              ),

            Balance:
              Number(
                row.balance_due ||
                  0
              ),

            Notes:
              row.notes ||
              "",
          })
        );

      appendSheet(
        workbook,
        supplierBillRows,
        "Supplier Bills"
      );

      /*
        SUPPLIER PAYMENTS
      */

      const supplierPaymentRows =
        data.supplierPayments.map(
          (row: any) => {
            const bill =
              data.supplierBillMap.get(
                Number(
                  row.supplier_bill_id
                )
              );

            return {
              Payment:
                row.payment_no,

              Supplier:
                data.supplierMap.get(
                  Number(
                    row.supplier_id
                  )
                ) || "",

              "Supplier Bill":
                bill?.bill_no ||
                `Bill #${row.supplier_bill_id}`,

              Date:
                row.payment_date,

              Currency:
                bill?.currency ||
                "THB",

              Amount:
                Number(
                  row.amount || 0
                ),

              Method:
                paymentMethodLabel(
                  row.payment_method
                ),

              Reference:
                row.reference_no ||
                "",

              Notes:
                row.notes ||
                "",
            };
          }
        );

      appendSheet(
        workbook,
        supplierPaymentRows,
        "Supplier Payments"
      );

      /*
        EXPENSES
      */

      const expenseRows =
        data.expenses.map(
          (row: any) => ({
            Expense:
              row.expense_no,

            Date:
              row.expense_date,

            Supplier:
              row.supplier_id
                ? data.supplierMap.get(
                    Number(
                      row.supplier_id
                    )
                  ) || ""
                : "",

            Description:
              row.description ||
              "",

            Method:
              paymentMethodLabel(
                row.payment_method
              ),

            Status:
              labelize(
                row.status
              ),

            Currency:
              row.currency ||
              "THB",

            Total:
              Number(
                row.total_amount ||
                  0
              ),
          })
        );

      appendSheet(
        workbook,
        expenseRows,
        "Expenses"
      );

      /*
        WRITE FILE
      */

      XLSX.writeFile(
        workbook,
        `Business360-Management-Report-${startDate}-to-${endDate}.xlsx`
      );

      setMessage(
        `Excel report exported successfully • ${data.exportBasis}.`
      );
    } catch (error: any) {
      console.error(
        "[Excel Export]",
        error
      );

      setMessage(
        getErrorMessage(
          error,
          "Excel export failed."
        )
      );
    } finally {
      setExporting(false);
      setActiveExport(null);
    }
  }

  /*
    ======================================
    CSV
    ======================================

    One CSV cannot contain multiple sheets,
    so export one professional transaction
    register including cash inflows/outflows.
  */

  async function exportCSV() {
    if (exporting) {
      return;
    }

    setExporting(true);
    setActiveExport("csv");
    setMessage("");

    try {
      const data =
        await loadExportData();

      const rows: Record<
        string,
        any
      >[] = [];

      /*
        PERIOD PROFIT & LOSS SUMMARY

        These rows make the CSV carry the same
        accounting totals as the on-screen report
        and Excel Financial Summary.
      */

      for (
        const summary of
          data.financialSummary
      ) {
        rows.push({
          Date:
            `${startDate} to ${endDate}`,

          Type:
            "Financial Summary",

          Reference:
            "P&L",

          Party: "",

          Status:
            summary.netProfit >= 0
              ? "Profit"
              : "Loss",

          "Accounting Basis":
            data.exportBasis,

          Currency:
            summary.currency,

          Inflow: 0,

          Outflow: 0,

          Value:
            summary.sales,

          Balance: "",

          Revenue:
            summary.sales,

          COGS:
            summary.cogs,

          "Gross Profit":
            summary.grossProfit,

          "Operating Expenses":
            summary.expenses,

          "Net Profit":
            summary.netProfit,

          Notes:
            `Gross Margin ${summary.grossMargin.toFixed(
              2
            )}% | Net Margin ${summary.netMargin.toFixed(
              2
            )}%`,
        });
      }

      /*
        SALES ORDERS
      */

      for (
        const row of data.sales
      ) {
        const orderValue =
          Number(
            row.total_amount ||
              0
          );

        const recognizedRevenue =
          row.is_fulfilled ===
            true &&
          row.status !==
            "cancelled"
            ? orderValue
            : 0;

        const cogs =
          row.is_fulfilled ===
            true
            ? (
                data.cogsByOrder.get(
                  Number(row.id)
                ) || 0
              )
            : 0;

        const grossProfit =
          recognizedRevenue -
          cogs;

        rows.push({
          Date:
            row.order_date,

          Type:
            "Sales Order",

          Reference:
            row.sales_order_no,

          Party:
            data.customerMap.get(
              Number(
                row.customer_id
              )
            ) || "",

          Status:
            labelize(
              row.status
            ),

          Currency:
            row.currency ||
            "THB",

          Inflow: 0,

          Outflow: 0,

          Value:
            orderValue,

          Balance: "",

          Revenue:
            recognizedRevenue,

          COGS:
            cogs,

          "Gross Profit":
            grossProfit,

          "Operating Expenses":
            "",

          "Net Profit":
            "",

          Notes:
            sourceLabel(
              row.order_source ||
                "quotation"
            ),
        });
      }

      /*
        CUSTOMER PAYMENTS
      */

      for (
        const row of
          data.payments
      ) {
        const invoice =
          data.invoiceMap.get(
            Number(
              row.invoice_id
            )
          );

        rows.push({
          Date:
            row.payment_date,

          Type:
            "Customer Payment",

          Reference:
            row.payment_no,

          Party:
            data.customerMap.get(
              Number(
                row.customer_id
              )
            ) || "",

          Status:
            "Received",

          Currency:
            invoice?.currency ||
            "THB",

          Inflow:
            Number(
              row.amount ||
                0
            ),

          Outflow: 0,

          Value:
            Number(
              row.amount ||
                0
            ),

          Balance: "",

          Notes:
            paymentMethodLabel(
              row.payment_method
            ),
        });
      }

      /*
        PURCHASE ORDERS
      */

      for (
        const row of
          data.purchases
      ) {
        rows.push({
          Date:
            row.order_date,

          Type:
            "Purchase Order",

          Reference:
            row.purchase_order_no,

          Party:
            data.supplierMap.get(
              Number(
                row.supplier_id
              )
            ) || "",

          Status:
            labelize(
              row.status
            ),

          Currency:
            row.currency ||
            "THB",

          Inflow: 0,

          Outflow: 0,

          Value:
            Number(
              row.total_amount ||
                0
            ),

          Balance: "",

          Notes:
            "Purchase commitment",
        });
      }

      /*
        SUPPLIER BILLS
      */

      for (
        const row of
          data.supplierBills
      ) {
        rows.push({
          Date:
            row.bill_date,

          Type:
            "Supplier Bill",

          Reference:
            row.bill_no,

          Party:
            data.supplierMap.get(
              Number(
                row.supplier_id
              )
            ) || "",

          Status:
            isOverdueBill(
              row
            )
              ? "Overdue"
              : labelize(
                  row.status
                ),

          Currency:
            row.currency ||
            "THB",

          Inflow: 0,

          Outflow: 0,

          Value:
            Number(
              row.total_amount ||
                0
            ),

          Balance:
            Number(
              row.balance_due ||
                0
            ),

          Notes:
            row.supplier_invoice_no
              ? `Supplier Invoice ${row.supplier_invoice_no}`
              : "",
        });
      }

      /*
        SUPPLIER PAYMENTS
      */

      for (
        const row of
          data.supplierPayments
      ) {
        const bill =
          data.supplierBillMap.get(
            Number(
              row.supplier_bill_id
            )
          );

        rows.push({
          Date:
            row.payment_date,

          Type:
            "Supplier Payment",

          Reference:
            row.payment_no,

          Party:
            data.supplierMap.get(
              Number(
                row.supplier_id
              )
            ) || "",

          Status:
            "Paid",

          Currency:
            bill?.currency ||
            "THB",

          Inflow: 0,

          Outflow:
            Number(
              row.amount ||
                0
            ),

          Value:
            Number(
              row.amount ||
                0
            ),

          Balance: "",

          Notes:
            paymentMethodLabel(
              row.payment_method
            ),
        });
      }

      /*
        OPERATING EXPENSES
      */

      for (
        const row of
          data.expenses
      ) {
        rows.push({
          Date:
            row.expense_date,

          Type:
            "Operating Expense",

          Reference:
            row.expense_no,

          Party:
            row.supplier_id
              ? data.supplierMap.get(
                  Number(
                    row.supplier_id
                  )
                ) || ""
              : "",

          Status:
            labelize(
              row.status
            ),

          Currency:
            row.currency ||
            "THB",

          Inflow: 0,

          Outflow:
            row.status ===
            "posted"
              ? Number(
                  row.total_amount ||
                    0
                )
              : 0,

          Value:
            Number(
              row.total_amount ||
                0
            ),

          Balance: "",

          Notes:
            row.description ||
            "",
        });
      }

      /*
        SORT BY DATE
      */

      for (
        const row of rows
      ) {
        if (
          !(
            "Accounting Basis" in
            row
          )
        ) {
          row[
            "Accounting Basis"
          ] =
            data.exportBasis;
        }
      }

      rows.sort(
        (a, b) =>
          String(
            a.Date || ""
          ).localeCompare(
            String(
              b.Date || ""
            )
          )
      );

      const safeRows =
        rows.length > 0
          ? rows
          : [
              {
                Date: "",
                Type: "",
                Reference: "",
                Party: "",
                Status: "",
                Currency: "",
                Inflow: 0,
                Outflow: 0,
                Value: 0,
                Balance: "",
                Notes:
                  "No records in selected period",
              },
            ];

      const sheet =
        XLSX.utils.json_to_sheet(
          safeRows
        );

      const csv =
        XLSX.utils.sheet_to_csv(
          sheet
        );

      downloadTextFile(
        csv,
        `Business360-Transaction-Report-${startDate}-to-${endDate}.csv`,
        "text/csv;charset=utf-8;"
      );

      setMessage(
        `CSV report exported successfully • ${data.exportBasis}.`
      );
    } catch (error: any) {
      console.error(
        "[CSV Export]",
        error
      );

      setMessage(
        getErrorMessage(
          error,
          "CSV export failed."
        )
      );
    } finally {
      setExporting(false);
      setActiveExport(null);
    }
  }

  /*
    ======================================
    PRINT
    ======================================
  */

  function printReport() {
    setMessage("");

    // Keep printing simple and let the report page's
    // Tailwind print:hidden / print:block classes control
    // what appears. Avoid adding a body-level print class
    // that can accidentally hide the report through a parent.
    window.print();
  }

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
          }

          /* Hide only the application chrome.
             The report body itself does not use a <header> element,
             so hiding the app shell header is safe here. */
          nav,
          aside,
          header {
            display: none !important;
          }

          main {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }

          /* Explicitly support the print utility classes used by
             reports-client.tsx, without relying on escaped selectors. */
          [class~="print:hidden"],
          .print-hidden,
          .no-print {
            display: none !important;
          }

          [class~="print:block"] {
            display: block !important;
          }

          [class~="print:grid"] {
            display: grid !important;
          }

          [class~="print:flex"] {
            display: flex !important;
          }

          a {
            color: inherit !important;
            text-decoration: none !important;
          }

          * {
            box-shadow: none !important;
          }

          .rounded-xl,
          .rounded-lg {
            break-inside: avoid;
          }

          /* Make wide report registers fit inside the printable page.
             This especially prevents the Accounts Payable Register
             Paid / Balance columns from being clipped. */
          table {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
          }

          .min-w-full {
            min-width: 0 !important;
            width: 100% !important;
          }

          th,
          td {
            padding-left: 4px !important;
            padding-right: 4px !important;
            font-size: 8px !important;
            line-height: 1.25 !important;
            white-space: normal !important;
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
          }

          th {
            font-size: 7.5px !important;
          }

          svg {
            max-width: 100% !important;
          }

          .recharts-responsive-container {
            break-inside: avoid;
          }
        }
      `}</style>

      <div className="print-hidden print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={exporting}
            onClick={
              exportExcel
            }
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {activeExport === "excel"
              ? "Preparing Excel..."
              : "Export Excel"}
          </button>

          <button
            type="button"
            disabled={exporting}
            onClick={
              exportCSV
            }
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {activeExport === "csv"
              ? "Preparing CSV..."
              : "Export CSV"}
          </button>

          <button
            type="button"
            onClick={
              printReport
            }
            className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Print / Save PDF
          </button>
        </div>

        <div className="mt-2 text-xs text-gray-400">
          Excel includes separate financial and transaction sheets. CSV is a unified transaction register. PDF uses the on-screen accounting basis.
        </div>

        {message && (
          <div
            className={`mt-3 rounded-lg px-3 py-2 text-sm ${
              message
                .toLowerCase()
                .includes(
                  "success"
                )
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        )}
      </div>
    </>
  );
}

/* ======================================
   EXCEL HELPERS
====================================== */

function appendSheet(
  workbook: XLSX.WorkBook,
  rows: Record<
    string,
    any
  >[],
  name: string
) {
  const safeRows =
    rows.length > 0
      ? rows
      : [
          {
            Message:
              "No records in selected period",
          },
        ];

  const worksheet =
    XLSX.utils.json_to_sheet(
      safeRows
    );

  const headers =
    Object.keys(
      safeRows[0]
    );

  worksheet["!cols"] =
    headers.map(
      (header) => {
        let width =
          header.length;

        for (
          const row of
            safeRows
        ) {
          const value =
            row[header];

          width =
            Math.max(
              width,
              String(
                value ?? ""
              ).length
            );
        }

        return {
          wch:
            Math.min(
              Math.max(
                width + 2,
                12
              ),
              42
            ),
        };
      }
    );

  worksheet["!autofilter"] = {
    ref: worksheet["!ref"] || "A1",
  };

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    name
  );
}

function downloadTextFile(
  content: string,
  filename: string,
  type: string
) {
  const blob =
    new Blob(
      [
        "\uFEFF",
        content,
      ],
      {
        type,
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href = url;

  link.download =
    filename;

  document.body.appendChild(
    link
  );

  link.click();

  document.body.removeChild(
    link
  );

  URL.revokeObjectURL(
    url
  );
}

/* ======================================
   FORMAT / ERRORS
====================================== */

function firstDayOfDate(
  value: string
) {
  return `${String(
    value || ""
  ).slice(0, 7)}-01`;
}

function isFullCalendarMonth(
  startDate: string,
  endDate: string
) {
  if (
    !startDate ||
    !endDate
  ) {
    return false;
  }

  if (
    startDate.slice(
      0,
      7
    ) !==
    endDate.slice(
      0,
      7
    )
  ) {
    return false;
  }

  if (
    !startDate.endsWith(
      "-01"
    )
  ) {
    return false;
  }

  const [
    yearText,
    monthText,
  ] =
    endDate
      .slice(0, 7)
      .split("-");

  const year =
    Number(yearText);

  const month =
    Number(monthText);

  const lastDay =
    new Date(
      year,
      month,
      0
    ).getDate();

  return (
    endDate ===
    `${yearText}-${monthText}-${String(
      lastDay
    ).padStart(
      2,
      "0"
    )}`
  );
}

function isOverdueBill(
  row: any
) {
  return Boolean(
    row.due_date &&
      row.due_date <
        today() &&
      Number(
        row.balance_due ||
          0
      ) > 0
  );
}

function today() {
  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() +
        1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function paymentMethodLabel(
  value:
    | string
    | null
    | undefined
) {
  if (
    value ===
    "bank_transfer"
  ) {
    return "Bank Transfer";
  }

  if (
    value === "qr"
  ) {
    return "QR / PromptPay";
  }

  if (
    value === "cash"
  ) {
    return "Cash";
  }

  if (
    value === "card"
  ) {
    return "Card";
  }

  return labelize(
    value
  );
}

function getErrorMessage(
  error: any,
  fallback: string
) {
  if (!error) {
    return fallback;
  }

  if (
    typeof error ===
    "string"
  ) {
    return error;
  }

  if (error.message) {
    return String(
      error.message
    );
  }

  if (error.details) {
    return String(
      error.details
    );
  }

  if (error.hint) {
    return String(
      error.hint
    );
  }

  if (error.code) {
    return `Error ${error.code}`;
  }

  return fallback;
}

function labelize(
  value:
    | string
    | null
    | undefined
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

function sourceLabel(
  value: string
) {
  if (
    value === "walk_in"
  ) {
    return "Walk-in";
  }

  if (
    value === "quotation"
  ) {
    return "Quotation";
  }

  return labelize(
    value
  );
}