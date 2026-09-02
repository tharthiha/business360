"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ReportsExportActions from "./reports-export-actions";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

/* =========================================
   TYPES
========================================= */

type CurrencyTotals = {
  currency: string;

  sales: number;
  invoiced: number;
  paid: number;
  outstanding: number;

  purchases: number;
  expenses: number;

  cogs: number;
  grossProfit: number;
  netProfit: number;

  grossMargin: number;
  netMargin: number;

  supplierBilled: number;
  supplierPaid: number;
  supplierOutstanding: number;
  supplierOverdue: number;

  cashFlow: number;
};

type PaymentRow = {
  id: number;
  payment_no: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  invoice_id: number;
  currency: string;
};

type SupplierPaymentRow = {
  id: number;
  payment_no: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  supplier_bill_id: number;
  supplier_id: number;
  supplier_name: string;
  currency: string;
};

type SupplierBillRow = {
  id: number;
  bill_no: string;
  supplier_id: number;
  supplier_name: string;

  bill_date: string;
  due_date: string | null;

  status: string;
  currency: string;

  total_amount: number;
  paid_amount: number;
  balance_due: number;
};

type CustomerSummary = {
  customer_id: number;
  customer_name: string;
  sales: number;
  currency: string;
};

type ProductSummary = {
  product_id: number;
  product_name: string;
  qty: number;
  sales: number;
  cogs: number;
  grossProfit: number;
  currency: string;
};

type LowStockRow = {
  id: number;
  product_name: string;
  product_code: string | null;
  current_stock: number;
  min_stock: number;
};

type TrendRow = {
  date: string;
  label: string;
  revenue: number;
  expenses: number;
  grossProfit: number;
  netProfit: number;
};

type SourceRow = {
  source: string;
  orders: number;
  sales: number;
  currency: string;
};

type RangeMode =
  | "this_month"
  | "last_30_days"
  | "custom";

type AccountingHealth = {
  reconciliationIssues: number;
  salesAccountingIssues: number;
  inventoryCostingIssues: number;
  manualCostingIssues: number;

  inventoryValue: number;
  totalUnits: number;
  negativeStockProducts: number;
  negativeCostProducts: number;
};

type MonthCloseRow = {
  id: number;
  period_start: string;
  period_end: string;
  status: string;
  closed_at: string | null;
  close_note: string | null;
  financial_snapshot: any[];
  inventory_snapshot: Record<string, any>;
  health_snapshot: Record<string, any>;
};

type CloseReadinessRow = {
  currency: string;
  ready_to_close: boolean;
  reconciliation_issue_count: number;
  close_id: number | null;
  close_status: string | null;
  closed_at: string | null;
};

type PeriodAuditRow = {
  id: number;
  accounting_period_close_id: number | null;
  period_start: string;
  period_end: string | null;
  action: "created" | "closed" | "reopened" | "updated";
  previous_status: string | null;
  new_status: string | null;
  reason: string | null;
  actor_user_id: string | null;
  created_at: string;
};

/* =========================================
   MAIN
========================================= */

export default function ReportsClient() {
  const supabase = createClient();

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState("");

  const [rangeMode, setRangeMode] =
    useState<RangeMode>(
      "this_month"
    );

  const [startDate, setStartDate] =
    useState(
      firstDayOfMonth()
    );

  const [endDate, setEndDate] =
    useState(today());

  const [
    currencyTotals,
    setCurrencyTotals,
  ] = useState<
    CurrencyTotals[]
  >([]);

  const [
    payments,
    setPayments,
  ] = useState<
    PaymentRow[]
  >([]);

  const [
    supplierPayments,
    setSupplierPayments,
  ] = useState<
    SupplierPaymentRow[]
  >([]);

  const [
    supplierBills,
    setSupplierBills,
  ] = useState<
    SupplierBillRow[]
  >([]);

  const [
    topCustomers,
    setTopCustomers,
  ] = useState<
    CustomerSummary[]
  >([]);

  const [
    topProducts,
    setTopProducts,
  ] = useState<
    ProductSummary[]
  >([]);

  const [
    lowStock,
    setLowStock,
  ] = useState<
    LowStockRow[]
  >([]);

  const [
    trendDataByCurrency,
    setTrendDataByCurrency,
  ] = useState<
    Record<
      string,
      TrendRow[]
    >
  >({});

  const [
    sourceData,
    setSourceData,
  ] = useState<
    SourceRow[]
  >([]);

  const [counts, setCounts] =
    useState({
      salesOrders: 0,
      invoices: 0,
      paidInvoices: 0,
      purchaseOrders: 0,
      postedExpenses: 0,
      products: 0,

      supplierBills: 0,
      paidSupplierBills: 0,
      outstandingSupplierBills: 0,
      overdueSupplierBills: 0,
    });

  const [
    accountingHealth,
    setAccountingHealth,
  ] = useState<AccountingHealth>({
    reconciliationIssues: 0,
    salesAccountingIssues: 0,
    inventoryCostingIssues: 0,
    manualCostingIssues: 0,

    inventoryValue: 0,
    totalUnits: 0,
    negativeStockProducts: 0,
    negativeCostProducts: 0,
  });

  const [userRole, setUserRole] =
    useState("");

  const [
    closeReadiness,
    setCloseReadiness,
  ] = useState<CloseReadinessRow[]>(
    []
  );

  const [
    monthClose,
    setMonthClose,
  ] = useState<MonthCloseRow | null>(
    null
  );

  const [closeNote, setCloseNote] =
    useState("");

  const [
    reopenReason,
    setReopenReason,
  ] = useState("");

  const [closeBusy, setCloseBusy] =
    useState(false);

  const [
    reopenBusy,
    setReopenBusy,
  ] = useState(false);

  const [
    closeMessage,
    setCloseMessage,
  ] = useState("");

  const [
    periodAuditLog,
    setPeriodAuditLog,
  ] = useState<PeriodAuditRow[]>(
    []
  );

  const [
    currentUserId,
    setCurrentUserId,
  ] = useState("");

  useEffect(() => {
    applyRangeMode(
      rangeMode
    );
  }, [rangeMode]);

  useEffect(() => {
    loadReports();
  }, [
    startDate,
    endDate,
  ]);

  function applyRangeMode(
    mode: RangeMode
  ) {
    if (
      mode ===
      "this_month"
    ) {
      setStartDate(
        firstDayOfMonth()
      );

      setEndDate(
        today()
      );

      return;
    }

    if (
      mode ===
      "last_30_days"
    ) {
      const end =
        new Date();

      const start =
        new Date();

      start.setDate(
        start.getDate() -
          29
      );

      setStartDate(
        toDateInput(start)
      );

      setEndDate(
        toDateInput(end)
      );
    }
  }

  /* =========================================
     LOAD
  ========================================= */

  async function loadReports() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "Please login first."
        );
      }

      setCurrentUserId(
        user.id
      );

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("company_id, role")
        .eq("id", user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      if (
        !profile?.company_id
      ) {
        throw new Error(
          "Company profile not found."
        );
      }

      const companyId =
        Number(
          profile.company_id
        );

      setUserRole(
        String(
          profile.role || ""
        ).toLowerCase()
      );

      const closePeriodStart =
        firstDayOfDate(
          startDate
        );

      const [
        salesResult,
        invoicesResult,
        paymentsResult,
        purchaseResult,
        expensesResult,
        productsResult,
        customersResult,
        suppliersResult,
        supplierBillsResult,
        supplierPaymentsResult,
        reconciliationIssuesResult,
        salesAccountingIssuesResult,
        inventoryCostingIssuesResult,
        manualCostingIssuesResult,
        inventoryValueResult,
        closeReadinessResult,
        monthCloseResult,
        periodAuditResult,
      ] = await Promise.all([
        supabase
          .from("sales_orders")
          .select(`
            id,
            customer_id,
            order_date,
            status,
            is_fulfilled,
            currency,
            total_amount,
            order_source
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
          ),

        supabase
          .from("invoices")
          .select(`
            id,
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
          ),

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
          .order(
            "payment_date",
            {
              ascending:
                false,
            }
          ),

        supabase
          .from(
            "purchase_orders"
          )
          .select(`
            id,
            order_date,
            status,
            currency,
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
          ),

        supabase
          .from("expenses")
          .select(`
            id,
            expense_date,
            status,
            currency,
            total_amount
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
          ),

        supabase
          .from("products")
          .select(`
            id,
            product_name,
            product_code,
            current_stock,
            min_stock,
            cost_price
          `)
          .eq(
            "company_id",
            companyId
          ),

        supabase
          .from("customers")
          .select(`
            id,
            customer_name
          `)
          .eq(
            "company_id",
            companyId
          ),

        supabase
          .from("suppliers")
          .select(`
            id,
            supplier_name
          `)
          .eq(
            "company_id",
            companyId
          ),

        supabase
          .from(
            "supplier_bills"
          )
          .select(`
            id,
            bill_no,
            supplier_id,
            bill_date,
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
            "bill_date",
            startDate
          )
          .lte(
            "bill_date",
            endDate
          ),

        supabase
          .from(
            "supplier_payments"
          )
          .select(`
            id,
            payment_no,
            supplier_id,
            supplier_bill_id,
            payment_date,
            amount,
            payment_method
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
          .order(
            "payment_date",
            {
              ascending:
                false,
            }
          ),

        supabase
          .from(
            "month_end_reconciliation_issues"
          )
          .select(
            "record_id",
            {
              count: "exact",
              head: true,
            }
          ),

        supabase
          .from(
            "sales_accounting_integrity_issues"
          )
          .select(
            "sales_order_id",
            {
              count: "exact",
              head: true,
            }
          ),

        supabase
          .from(
            "inventory_costing_audit_issues"
          )
          .select(
            "movement_id",
            {
              count: "exact",
              head: true,
            }
          ),

        supabase
          .from(
            "inventory_manual_costing_issues"
          )
          .select(
            "movement_id",
            {
              count: "exact",
              head: true,
            }
          ),

        supabase
          .from(
            "inventory_value_reconciliation"
          )
          .select(`
            inventory_value,
            total_units,
            negative_stock_products,
            negative_cost_products
          `)
          .eq(
            "company_id",
            companyId
          )
          .maybeSingle(),

        supabase
          .from(
            "month_end_close_readiness"
          )
          .select(`
            currency,
            ready_to_close,
            reconciliation_issue_count,
            close_id,
            close_status,
            closed_at
          `)
          .eq(
            "company_id",
            companyId
          )
          .eq(
            "period_start",
            closePeriodStart
          ),

        supabase
          .from(
            "accounting_period_closes"
          )
          .select(`
            id,
            period_start,
            period_end,
            status,
            closed_at,
            close_note,
            financial_snapshot,
            inventory_snapshot,
            health_snapshot
          `)
          .eq(
            "company_id",
            companyId
          )
          .eq(
            "period_start",
            closePeriodStart
          )
          .maybeSingle(),

        supabase
          .from(
            "accounting_period_audit_log"
          )
          .select(`
            id,
            accounting_period_close_id,
            period_start,
            period_end,
            action,
            previous_status,
            new_status,
            reason,
            actor_user_id,
            created_at
          `)
          .eq(
            "company_id",
            companyId
          )
          .eq(
            "period_start",
            closePeriodStart
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          )
          .limit(50),
      ]);

      if (salesResult.error)
        throw salesResult.error;

      if (invoicesResult.error)
        throw invoicesResult.error;

      if (paymentsResult.error)
        throw paymentsResult.error;

      if (purchaseResult.error)
        throw purchaseResult.error;

      if (expensesResult.error)
        throw expensesResult.error;

      if (productsResult.error)
        throw productsResult.error;

      if (customersResult.error)
        throw customersResult.error;

      if (suppliersResult.error)
        throw suppliersResult.error;

      if (supplierBillsResult.error)
        throw supplierBillsResult.error;

      if (supplierPaymentsResult.error)
        throw supplierPaymentsResult.error;


      if (
        reconciliationIssuesResult.error
      )
        throw reconciliationIssuesResult.error;

      if (
        salesAccountingIssuesResult.error
      )
        throw salesAccountingIssuesResult.error;

      if (
        inventoryCostingIssuesResult.error
      )
        throw inventoryCostingIssuesResult.error;

      if (
        manualCostingIssuesResult.error
      )
        throw manualCostingIssuesResult.error;

      if (
        inventoryValueResult.error
      )
        throw inventoryValueResult.error;

      if (
        closeReadinessResult.error
      )
        throw closeReadinessResult.error;

      if (
        monthCloseResult.error
      )
        throw monthCloseResult.error;

      if (
        periodAuditResult.error
      )
        throw periodAuditResult.error;

      const sales =
        salesResult.data || [];

      /*
        Revenue recognition policy:
        only fulfilled sales orders are recognized
        in P&L, COGS, margins, customer/product
        profitability, source analysis and trends.
      */
      const recognizedSales =
        sales.filter(
          (order: any) =>
            order.status !==
              "cancelled" &&
            order.is_fulfilled ===
              true
        );

      const invoices =
        invoicesResult.data ||
        [];

      const purchases =
        purchaseResult.data ||
        [];

      const expenses =
        expensesResult.data ||
        [];

      const products =
        productsResult.data ||
        [];

      const customers =
        customersResult.data ||
        [];

      const suppliers =
        suppliersResult.data ||
        [];

      const rawSupplierBills =
        supplierBillsResult.data ||
        [];

      const rawSupplierPayments =
        supplierPaymentsResult.data ||
        [];

      const inventoryValueRow =
        inventoryValueResult.data;

      setCloseReadiness(
        (
          closeReadinessResult.data ||
          []
        ) as CloseReadinessRow[]
      );

      setMonthClose(
        monthCloseResult.data
          ? {
              id:
                Number(
                  monthCloseResult.data.id
                ),
              period_start:
                monthCloseResult.data.period_start,
              period_end:
                monthCloseResult.data.period_end,
              status:
                monthCloseResult.data.status,
              closed_at:
                monthCloseResult.data.closed_at,
              close_note:
                monthCloseResult.data.close_note,

              financial_snapshot:
                Array.isArray(
                  monthCloseResult.data.financial_snapshot
                )
                  ? monthCloseResult.data.financial_snapshot
                  : [],

              inventory_snapshot:
                monthCloseResult.data.inventory_snapshot &&
                typeof monthCloseResult.data.inventory_snapshot === "object"
                  ? monthCloseResult.data.inventory_snapshot
                  : {},

              health_snapshot:
                monthCloseResult.data.health_snapshot &&
                typeof monthCloseResult.data.health_snapshot === "object"
                  ? monthCloseResult.data.health_snapshot
                  : {},
            }
          : null
      );

      setCloseNote(
        monthCloseResult.data?.close_note ||
          ""
      );

      setPeriodAuditLog(
        (
          periodAuditResult.data ||
          []
        ).map(
          (row: any) => ({
            id:
              Number(
                row.id
              ),

            accounting_period_close_id:
              row.accounting_period_close_id ===
              null
                ? null
                : Number(
                    row.accounting_period_close_id
                  ),

            period_start:
              row.period_start,

            period_end:
              row.period_end,

            action:
              row.action,

            previous_status:
              row.previous_status,

            new_status:
              row.new_status,

            reason:
              row.reason,

            actor_user_id:
              row.actor_user_id,

            created_at:
              row.created_at,
          })
        )
      );

      const isClosedSnapshotPeriod =
        monthCloseResult.data?.status ===
          "closed" &&
        isFullCalendarMonth(
          startDate,
          endDate
        ) &&
        firstDayOfDate(
          startDate
        ) ===
          monthCloseResult.data.period_start;

      const storedInventory =
        isClosedSnapshotPeriod &&
        monthCloseResult.data?.inventory_snapshot &&
        typeof monthCloseResult.data.inventory_snapshot ===
          "object"
          ? monthCloseResult.data.inventory_snapshot
          : null;

      const storedHealth =
        isClosedSnapshotPeriod &&
        monthCloseResult.data?.health_snapshot &&
        typeof monthCloseResult.data.health_snapshot ===
          "object"
          ? monthCloseResult.data.health_snapshot
          : null;

      setAccountingHealth({
        reconciliationIssues:
          storedHealth
            ? Number(
                storedHealth.reconciliation_issue_count ||
                  0
              )
            : reconciliationIssuesResult.count ||
              0,

        salesAccountingIssues:
          storedHealth
            ? Number(
                storedHealth.sales_accounting_issue_count ||
                  0
              )
            : salesAccountingIssuesResult.count ||
              0,

        inventoryCostingIssues:
          storedHealth
            ? Number(
                storedHealth.inventory_costing_issue_count ||
                  0
              )
            : inventoryCostingIssuesResult.count ||
              0,

        manualCostingIssues:
          storedHealth
            ? Number(
                storedHealth.legacy_manual_costing_issue_count ||
                  0
              )
            : manualCostingIssuesResult.count ||
              0,

        inventoryValue:
          storedInventory
            ? Number(
                storedInventory.inventory_value ||
                  0
              )
            : Number(
                inventoryValueRow?.inventory_value ||
                  0
              ),

        totalUnits:
          storedInventory
            ? Number(
                storedInventory.total_units ||
                  0
              )
            : Number(
                inventoryValueRow?.total_units ||
                  0
              ),

        negativeStockProducts:
          storedInventory
            ? Number(
                storedInventory.negative_stock_products ||
                  0
              )
            : Number(
                inventoryValueRow?.negative_stock_products ||
                  0
              ),

        negativeCostProducts:
          storedInventory
            ? Number(
                storedInventory.negative_cost_products ||
                  0
              )
            : Number(
                inventoryValueRow?.negative_cost_products ||
                  0
              ),
      });

      /* =========================================
         SALES ITEMS
      ========================================= */

      const salesOrderIds =
        recognizedSales.map(
          (order) =>
            Number(order.id)
        );

      let salesItems: any[] =
        [];

      if (
        salesOrderIds.length >
        0
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

        if (
          salesItemsError
        ) {
          throw salesItemsError;
        }

        salesItems =
          salesItemsData ||
          [];
      }

      /* =========================================
         MAPS
      ========================================= */

      const invoiceById =
        new Map<
          number,
          any
        >();

      for (
        const invoice of
          invoices
      ) {
        invoiceById.set(
          Number(invoice.id),
          invoice
        );
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

      const supplierNameMap =
        new Map<
          number,
          string
        >();

      for (
        const supplier of
          suppliers
      ) {
        supplierNameMap.set(
          Number(
            supplier.id
          ),
          supplier.supplier_name
        );
      }

      const supplierBillById =
        new Map<
          number,
          any
        >();

      for (
        const bill of
          rawSupplierBills
      ) {
        supplierBillById.set(
          Number(bill.id),
          bill
        );
      }

      /* =========================================
         CUSTOMER PAYMENTS
      ========================================= */

      const normalizedPayments:
        PaymentRow[] =
        (
          paymentsResult.data ||
          []
        ).map(
          (payment: any) => {
            const invoice =
              invoiceById.get(
                Number(
                  payment.invoice_id
                )
              );

            return {
              id:
                Number(
                  payment.id
                ),

              payment_no:
                payment.payment_no,

              payment_date:
                payment.payment_date,

              amount:
                Number(
                  payment.amount ||
                    0
                ),

              payment_method:
                payment.payment_method ||
                "-",

              invoice_id:
                Number(
                  payment.invoice_id
                ),

              currency:
                invoice?.currency ||
                "THB",
            };
          }
        );

      setPayments(
        normalizedPayments
      );

      /* =========================================
         SUPPLIER BILLS
      ========================================= */

      const normalizedSupplierBills:
        SupplierBillRow[] =
        rawSupplierBills.map(
          (bill: any) => ({
            id:
              Number(
                bill.id
              ),

            bill_no:
              bill.bill_no,

            supplier_id:
              Number(
                bill.supplier_id
              ),

            supplier_name:
              supplierNameMap.get(
                Number(
                  bill.supplier_id
                )
              ) ||
              `Supplier #${bill.supplier_id}`,

            bill_date:
              bill.bill_date,

            due_date:
              bill.due_date,

            status:
              bill.status ||
              "draft",

            currency:
              bill.currency ||
              "THB",

            total_amount:
              Number(
                bill.total_amount ||
                  0
              ),

            paid_amount:
              Number(
                bill.paid_amount ||
                  0
              ),

            balance_due:
              Number(
                bill.balance_due ||
                  0
              ),
          })
        );

      setSupplierBills(
        normalizedSupplierBills
      );

      /* =========================================
         SUPPLIER PAYMENTS
      ========================================= */

      const normalizedSupplierPayments:
        SupplierPaymentRow[] =
        rawSupplierPayments.map(
          (payment: any) => {
            const bill =
              supplierBillById.get(
                Number(
                  payment.supplier_bill_id
                )
              );

            return {
              id:
                Number(
                  payment.id
                ),

              payment_no:
                payment.payment_no,

              payment_date:
                payment.payment_date,

              amount:
                Number(
                  payment.amount ||
                    0
                ),

              payment_method:
                payment.payment_method ||
                "-",

              supplier_bill_id:
                Number(
                  payment.supplier_bill_id
                ),

              supplier_id:
                Number(
                  payment.supplier_id
                ),

              supplier_name:
                supplierNameMap.get(
                  Number(
                    payment.supplier_id
                  )
                ) ||
                `Supplier #${payment.supplier_id}`,

              currency:
                bill?.currency ||
                "THB",
            };
          }
        );

      setSupplierPayments(
        normalizedSupplierPayments
      );

      /* =========================================
         CURRENCY SET
      ========================================= */

      const currencySet =
        new Set<string>();

      for (
        const row of
          recognizedSales
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
        const payment of
          normalizedPayments
      ) {
        currencySet.add(
          payment.currency
        );
      }

      for (
        const bill of
          normalizedSupplierBills
      ) {
        currencySet.add(
          bill.currency
        );
      }

      for (
        const payment of
          normalizedSupplierPayments
      ) {
        currencySet.add(
          payment.currency
        );
      }

      if (
        currencySet.size === 0
      ) {
        currencySet.add(
          "THB"
        );
      }

      /* =========================================
         COGS
      ========================================= */

      const cogsByCurrency =
        new Map<
          string,
          number
        >();

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

        if (!order) {
          continue;
        }

        if (
          order.status ===
          "cancelled"
        ) {
          continue;
        }

        const currency =
          order.currency ||
          "THB";

        const itemCogs =
          getItemCogs(item);

        cogsByCurrency.set(
          currency,
          (
            cogsByCurrency.get(
              currency
            ) || 0
          ) +
            itemCogs
        );
      }

      /* =========================================
         FINANCIAL TOTALS
      ========================================= */

      const totals:
        CurrencyTotals[] =
        Array.from(
          currencySet
        ).map(
          (currency) => {
            const salesTotal =
              recognizedSales
                .filter(
                  (row) =>
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
                    sum,
                    row
                  ) =>
                    sum +
                    Number(
                      row.total_amount ||
                        0
                    ),
                  0
                );

            const invoiceTotal =
              invoices
                .filter(
                  (row) =>
                    (
                      row.currency ||
                      "THB"
                    ) ===
                    currency
                )
                .reduce(
                  (
                    sum,
                    row
                  ) =>
                    sum +
                    Number(
                      row.total_amount ||
                        0
                    ),
                  0
                );

            const paidTotal =
              normalizedPayments
                .filter(
                  (row) =>
                    row.currency ===
                    currency
                )
                .reduce(
                  (
                    sum,
                    row
                  ) =>
                    sum +
                    row.amount,
                  0
                );

            const outstandingTotal =
              invoices
                .filter(
                  (row) =>
                    (
                      row.currency ||
                      "THB"
                    ) ===
                    currency
                )
                .reduce(
                  (
                    sum,
                    row
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
                  (row) =>
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
                    sum,
                    row
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
                  (row) =>
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
                    sum,
                    row
                  ) =>
                    sum +
                    Number(
                      row.total_amount ||
                        0
                    ),
                  0
                );

            const supplierBilled =
              normalizedSupplierBills
                .filter(
                  (row) =>
                    row.currency ===
                    currency
                )
                .reduce(
                  (
                    sum,
                    row
                  ) =>
                    sum +
                    row.total_amount,
                  0
                );

            const supplierPaid =
              normalizedSupplierPayments
                .filter(
                  (row) =>
                    row.currency ===
                    currency
                )
                .reduce(
                  (
                    sum,
                    row
                  ) =>
                    sum +
                    row.amount,
                  0
                );

            const supplierOutstanding =
              normalizedSupplierBills
                .filter(
                  (row) =>
                    row.currency ===
                    currency
                )
                .reduce(
                  (
                    sum,
                    row
                  ) =>
                    sum +
                    row.balance_due,
                  0
                );

            const supplierOverdue =
              normalizedSupplierBills
                .filter(
                  (row) =>
                    row.currency ===
                      currency &&
                    isSupplierBillOverdue(
                      row
                    )
                )
                .reduce(
                  (
                    sum,
                    row
                  ) =>
                    sum +
                    row.balance_due,
                  0
                );

            const cogs =
              cogsByCurrency.get(
                currency
              ) || 0;

            const grossProfit =
              salesTotal -
              cogs;

            const netProfit =
              grossProfit -
              expenseTotal;

            const grossMargin =
              salesTotal > 0
                ? (grossProfit /
                    salesTotal) *
                  100
                : 0;

            const netMargin =
              salesTotal > 0
                ? (netProfit /
                    salesTotal) *
                  100
                : 0;

            /*
              CASH FLOW

              Customer collections
              - operating expenses
              - supplier payments
            */

            const cashFlow =
              paidTotal -
              expenseTotal -
              supplierPaid;

            return {
              currency,

              sales:
                salesTotal,

              invoiced:
                invoiceTotal,

              paid:
                paidTotal,

              outstanding:
                outstandingTotal,

              purchases:
                purchaseTotal,

              expenses:
                expenseTotal,

              cogs,

              grossProfit,

              netProfit,

              grossMargin,

              netMargin,

              supplierBilled,
              supplierPaid,
              supplierOutstanding,
              supplierOverdue,

              cashFlow,
            };
          }
        );

      const storedFinancialRows =
        isClosedSnapshotPeriod &&
        Array.isArray(
          monthCloseResult.data?.financial_snapshot
        )
          ? monthCloseResult.data.financial_snapshot
          : [];

      const snapshotByCurrency =
        new Map<
          string,
          any
        >();

      for (
        const row of
          storedFinancialRows
      ) {
        snapshotByCurrency.set(
          String(
            row?.currency ||
              "THB"
          ),
          row
        );
      }

      const snapshotAwareTotals =
        totals.map(
          (live) => {
            const stored =
              snapshotByCurrency.get(
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
                stored.gross_profit ||
                  sales - cogs
              );

            const expenses =
              Number(
                stored.posted_expenses ||
                  0
              );

            const netProfit =
              Number(
                stored.net_profit ||
                  grossProfit -
                    expenses
              );

            const paid =
              Number(
                stored.customer_collections ||
                  0
              );

            const supplierPaid =
              Number(
                stored.supplier_payments ||
                  0
              );

            const cashFlow =
              Number(
                stored.net_cash_flow ||
                  paid -
                    expenses -
                    supplierPaid
              );

            const outstanding =
              Number(
                stored.ar_outstanding ||
                  0
              );

            const supplierOutstanding =
              Number(
                stored.ap_outstanding ||
                  0
              );

            return {
              ...live,
              sales,
              paid,
              outstanding,
              expenses,
              cogs,
              grossProfit,
              netProfit,
              grossMargin:
                Number(
                  stored.gross_margin_pct ||
                    0
                ),
              netMargin:
                Number(
                  stored.net_margin_pct ||
                    0
                ),
              supplierPaid,
              supplierOutstanding,
              cashFlow,
            };
          }
        );

      setCurrencyTotals(
        snapshotAwareTotals
      );

      /* =========================================
         CUSTOMERS
      ========================================= */

      const customerNameMap =
        new Map<
          number,
          string
        >();

      for (
        const customer of
          customers
      ) {
        customerNameMap.set(
          Number(
            customer.id
          ),
          customer.customer_name
        );
      }

      const customerMap =
        new Map<
          string,
          CustomerSummary
        >();

      for (
        const order of
          recognizedSales
      ) {
        if (
          order.status ===
          "cancelled"
        ) {
          continue;
        }

        const currency =
          order.currency ||
          "THB";

        const key =
          `${order.customer_id}-${currency}`;

        if (
          !customerMap.has(
            key
          )
        ) {
          customerMap.set(
            key,
            {
              customer_id:
                Number(
                  order.customer_id
                ),

              customer_name:
                customerNameMap.get(
                  Number(
                    order.customer_id
                  )
                ) ||
                `Customer #${order.customer_id}`,

              sales: 0,

              currency,
            }
          );
        }

        customerMap.get(
          key
        )!.sales +=
          Number(
            order.total_amount ||
              0
          );
      }

      setTopCustomers(
        Array.from(
          customerMap.values()
        ).sort(
          (a, b) =>
            b.sales -
            a.sales
        )
      );

      /* =========================================
         PRODUCTS
      ========================================= */

      const productMap =
        new Map<
          string,
          ProductSummary
        >();

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
          order.status ===
            "cancelled"
        ) {
          continue;
        }

        const currency =
          order.currency ||
          "THB";

        const productId =
          Number(
            item.product_id ||
              0
          );

        const key =
          `${productId}-${currency}`;

        if (
          !productMap.has(
            key
          )
        ) {
          productMap.set(
            key,
            {
              product_id:
                productId,

              product_name:
                item.description ||
                `Product #${productId}`,

              qty: 0,
              sales: 0,
              cogs: 0,
              grossProfit:
                0,

              currency,
            }
          );
        }

        const current =
          productMap.get(
            key
          )!;

        const qty =
          Number(
            item.qty || 0
          );

        const lineSales =
          Number(
            item.line_total ||
              0
          );

        const lineCogs =
          getItemCogs(item);

        current.qty +=
          qty;

        current.sales +=
          lineSales;

        current.cogs +=
          lineCogs;

        current.grossProfit +=
          lineSales -
          lineCogs;
      }

      setTopProducts(
        Array.from(
          productMap.values()
        ).sort(
          (a, b) =>
            b.sales -
            a.sales
        )
      );

      /* =========================================
         SOURCE
      ========================================= */

      const sourceMap =
        new Map<
          string,
          SourceRow
        >();

      for (
        const order of
          recognizedSales
      ) {
        if (
          order.status ===
          "cancelled"
        ) {
          continue;
        }

        const currency =
          order.currency ||
          "THB";

        const source =
          sourceLabel(
            order.order_source ||
              "quotation"
          );

        const key =
          `${currency}-${source}`;

        if (
          !sourceMap.has(
            key
          )
        ) {
          sourceMap.set(
            key,
            {
              source,
              orders: 0,
              sales: 0,
              currency,
            }
          );
        }

        const current =
          sourceMap.get(
            key
          )!;

        current.orders +=
          1;

        current.sales +=
          Number(
            order.total_amount ||
              0
          );
      }

      setSourceData(
        Array.from(
          sourceMap.values()
        )
      );

      /* =========================================
         TRENDS
      ========================================= */

      const trendResult:
        Record<
          string,
          TrendRow[]
        > = {};

      for (
        const currency of
          currencySet
      ) {
        const trendMap =
          new Map<
            string,
            TrendRow
          >();

        for (
          const day of
            dateRange(
              startDate,
              endDate
            )
        ) {
          trendMap.set(
            day,
            {
              date: day,
              label:
                shortDate(
                  day
                ),
              revenue: 0,
              expenses: 0,
              grossProfit: 0,
              netProfit: 0,
            }
          );
        }

        for (
          const order of
            recognizedSales
        ) {
          if (
            (
              order.currency ||
              "THB"
            ) !== currency
          ) {
            continue;
          }

          const row =
            trendMap.get(
              order.order_date
            );

          if (row) {
            row.revenue +=
              Number(
                order.total_amount ||
                  0
              );
          }
        }

        for (
          const expense of
            expenses
        ) {
          if (
            expense.status !==
            "posted"
          ) {
            continue;
          }

          if (
            (
              expense.currency ||
              "THB"
            ) !== currency
          ) {
            continue;
          }

          const row =
            trendMap.get(
              expense.expense_date
            );

          if (row) {
            row.expenses +=
              Number(
                expense.total_amount ||
                  0
              );
          }
        }

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
            order.status ===
              "cancelled" ||
            order.is_fulfilled !==
              true
          ) {
            continue;
          }

          if (
            (
              order.currency ||
              "THB"
            ) !== currency
          ) {
            continue;
          }

          const row =
            trendMap.get(
              order.order_date
            );

          if (!row) {
            continue;
          }

          row.grossProfit -=
            getItemCogs(item);
        }

        for (
          const row of
            trendMap.values()
        ) {
          row.grossProfit +=
            row.revenue;

          row.netProfit =
            row.grossProfit -
            row.expenses;
        }

        trendResult[
          currency
        ] = Array.from(
          trendMap.values()
        );
      }

      setTrendDataByCurrency(
        trendResult
      );

      /* =========================================
         INVENTORY
      ========================================= */

      const lowStockRows =
        products
          .filter(
            (product) =>
              Number(
                product.current_stock ||
                  0
              ) <=
              Number(
                product.min_stock ||
                  0
              )
          )
          .map(
            (product) => ({
              id:
                product.id,

              product_name:
                product.product_name,

              product_code:
                product.product_code,

              current_stock:
                Number(
                  product.current_stock ||
                    0
                ),

              min_stock:
                Number(
                  product.min_stock ||
                    0
                ),
            })
          )
          .sort(
            (a, b) =>
              a.current_stock -
              b.current_stock
          );

      setLowStock(
        lowStockRows
      );

      /* =========================================
         COUNTS
      ========================================= */

      const paidSupplierBills =
        normalizedSupplierBills.filter(
          (bill) =>
            bill.status ===
              "paid" ||
            bill.balance_due <=
              0
        );

      const outstandingSupplierBills =
        normalizedSupplierBills.filter(
          (bill) =>
            bill.balance_due >
            0
        );

      const overdueSupplierBills =
        normalizedSupplierBills.filter(
          (bill) =>
            isSupplierBillOverdue(
              bill
            )
        );

      setCounts({
        salesOrders:
          sales.length,

        invoices:
          invoices.length,

        paidInvoices:
          invoices.filter(
            (invoice) =>
              Number(
                invoice.balance_due ||
                  0
              ) <= 0
          ).length,

        purchaseOrders:
          purchases.length,

        postedExpenses:
          expenses.filter(
            (expense) =>
              expense.status ===
              "posted"
          ).length,

        products:
          products.length,

        supplierBills:
          normalizedSupplierBills.length,

        paidSupplierBills:
          paidSupplierBills.length,

        outstandingSupplierBills:
          outstandingSupplierBills.length,

        overdueSupplierBills:
          overdueSupplierBills.length,
      });
    } catch (error) {
      console.error(
        "[reports]",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load reports."
      );
    } finally {
      setLoading(false);
    }
  }

  async function closeSelectedMonth() {
    setCloseMessage("");

    if (
      userRole !== "owner"
    ) {
      setCloseMessage(
        "Only the company owner can close an accounting month."
      );
      return;
    }

    if (
      !isFullCalendarMonth(
        startDate,
        endDate
      )
    ) {
      setCloseMessage(
        "Select one full calendar month before closing."
      );
      return;
    }

    if (
      endDate > today()
    ) {
      setCloseMessage(
        "The accounting month cannot be closed before its period end."
      );
      return;
    }

    if (
      monthClose?.status ===
      "closed"
    ) {
      setCloseMessage(
        "This accounting month is already closed."
      );
      return;
    }

    const ready =
      closeReadiness.length >
        0 &&
      closeReadiness.every(
        (row) =>
          row.ready_to_close ===
            true &&
          Number(
            row.reconciliation_issue_count ||
              0
          ) === 0
      );

    if (!ready) {
      setCloseMessage(
        "Accounting checks are not ready for Month-End Close."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Close accounting month ${formatMonthLabel(
          startDate
        )}? This stores the reconciled financial, inventory and health snapshots.`
      );

    if (!confirmed) {
      return;
    }

    setCloseBusy(true);

    try {
      const { error } =
        await supabase.rpc(
          "close_accounting_month",
          {
            p_period_start:
              firstDayOfDate(
                startDate
              ),
            p_note:
              closeNote.trim() ||
              null,
          }
        );

      if (error) {
        throw error;
      }

      setCloseMessage(
        "Month closed successfully."
      );

      await loadReports();
    } catch (error) {
      console.error(
        "[month-end-close]",
        error
      );

      setCloseMessage(
        error instanceof Error
          ? error.message
          : "Could not close accounting month."
      );
    } finally {
      setCloseBusy(false);
    }
  }

  async function reopenSelectedMonth() {
    setCloseMessage("");

    if (
      userRole !== "owner"
    ) {
      setCloseMessage(
        "Only the company owner can reopen an accounting month."
      );
      return;
    }

    if (
      monthClose?.status !==
      "closed"
    ) {
      setCloseMessage(
        "This accounting month is not currently closed."
      );
      return;
    }

    if (
      !reopenReason.trim()
    ) {
      setCloseMessage(
        "A reopen reason is required."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Reopen accounting month ${formatMonthLabel(
          startDate
        )}? Closed-period transaction locks will be released for this month.`
      );

    if (!confirmed) {
      return;
    }

    setReopenBusy(true);

    try {
      const { error } =
        await supabase.rpc(
          "reopen_accounting_month",
          {
            p_period_start:
              firstDayOfDate(
                startDate
              ),
            p_note:
              reopenReason.trim(),
          }
        );

      if (error) {
        throw error;
      }

      setCloseMessage(
        "Month reopened successfully."
      );

      setReopenReason(
        ""
      );

      await loadReports();
    } catch (error) {
      console.error(
        "[month-end-reopen]",
        error
      );

      setCloseMessage(
        error instanceof Error
          ? error.message
          : "Could not reopen accounting month."
      );
    } finally {
      setReopenBusy(false);
    }
  }

  const fullCalendarMonth =
    isFullCalendarMonth(
      startDate,
      endDate
    );

  const periodEnded =
    endDate <= today();

  const closeReady =
    fullCalendarMonth &&
    closeReadiness.length >
      0 &&
    closeReadiness.every(
      (row) =>
        row.ready_to_close ===
          true &&
        Number(
          row.reconciliation_issue_count ||
            0
        ) === 0
    );

  const alreadyClosed =
    monthClose?.status ===
    "closed";

  const reopened =
    monthClose?.status ===
    "reopened";

  const dateLabel =
    useMemo(
      () =>
        `${formatDate(
          startDate
        )} – ${formatDate(
          endDate
        )}`,
      [
        startDate,
        endDate,
      ]
    );

  const currencies =
    currencyTotals.map(
      (row) =>
        row.currency
    );

  const reportBasis =
    alreadyClosed &&
    fullCalendarMonth
      ? "Closed Snapshot"
      : reopened &&
        fullCalendarMonth
      ? "Reopened • Live"
      : "Live";

  const reportBasisDescription =
    reportBasis ===
    "Closed Snapshot"
      ? "Financial headline metrics use the stored month-end snapshot."
      : reportBasis ===
        "Reopened • Live"
      ? "This reopened month is calculated from live transaction data."
      : "Financial headline metrics are calculated from live transaction data.";

  const executiveMetrics =
    currencyTotals.flatMap(
      (summary) => [
        {
          key: `${summary.currency}-revenue`,
          currency:
            summary.currency,
          label: "Revenue",
          value:
            summary.sales,
          tone:
            "normal" as const,
        },
        {
          key: `${summary.currency}-gp`,
          currency:
            summary.currency,
          label: "Gross Profit",
          value:
            summary.grossProfit,
          tone:
            summary.grossProfit >=
            0
              ? ("positive" as const)
              : ("danger" as const),
        },
        {
          key: `${summary.currency}-np`,
          currency:
            summary.currency,
          label: "Net Profit",
          value:
            summary.netProfit,
          tone:
            summary.netProfit >=
            0
              ? ("positive" as const)
              : ("danger" as const),
        },
        {
          key: `${summary.currency}-cash`,
          currency:
            summary.currency,
          label: "Net Cash Flow",
          value:
            summary.cashFlow,
          tone:
            summary.cashFlow >=
            0
              ? ("positive" as const)
              : ("danger" as const),
        },
      ]
    );

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-gray-500">
        Loading reports...
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* HEADER */}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Reports & Analytics
          </h1>

          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Executive financial performance, profitability, collections,
            purchasing, accounts payable, inventory and month-end controls.
          </p>
        </div>

        <div className="flex flex-col items-start gap-3 xl:items-end">
          <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-gray-500">
            <span className="rounded-lg border border-gray-200 bg-white px-3 py-2">
              Reporting period{" "}
              <strong className="ml-1 text-gray-900">
                {dateLabel}
              </strong>
            </span>

            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                reportBasis === "Closed Snapshot"
                  ? "bg-gray-900 text-white"
                  : reportBasis === "Reopened • Live"
                  ? "bg-blue-50 text-blue-700"
                  : "bg-green-50 text-green-700"
              }`}
            >
              {reportBasis}
            </span>
          </div>

          <ReportsExportActions
            startDate={
              startDate
            }
            endDate={
              endDate
            }
          />
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 print:hidden">
          {message}
        </div>
      )}

      {/* DATE FILTER */}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm print:hidden">
        <div className="border-b border-gray-100 px-5 py-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Reporting Controls
          </div>
        </div>

        <div className="flex flex-col gap-4 p-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-wrap gap-2">
            <RangeButton
              active={
                rangeMode ===
                "this_month"
              }
              onClick={() =>
                setRangeMode(
                  "this_month"
                )
              }
            >
              This Month
            </RangeButton>

            <RangeButton
              active={
                rangeMode ===
                "last_30_days"
              }
              onClick={() =>
                setRangeMode(
                  "last_30_days"
                )
              }
            >
              Last 30 Days
            </RangeButton>

            <RangeButton
              active={
                rangeMode ===
                "custom"
              }
              onClick={() =>
                setRangeMode(
                  "custom"
                )
              }
            >
              Custom
            </RangeButton>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                From
              </div>

              <input
                type="date"
                value={
                  startDate
                }
                onChange={(e) => {
                  setRangeMode(
                    "custom"
                  );

                  setStartDate(
                    e.target.value
                  );
                }}
                className={
                  inputClass
                }
              />
            </label>

            <label>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                To
              </div>

              <input
                type="date"
                value={
                  endDate
                }
                onChange={(e) => {
                  setRangeMode(
                    "custom"
                  );

                  setEndDate(
                    e.target.value
                  );
                }}
                className={
                  inputClass
                }
              />
            </label>
          </div>
        </div>
      </div>

      {alreadyClosed &&
        fullCalendarMonth && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          Financial P&L, collections, A/R, supplier payments, A/P,
          inventory value and accounting-health metrics are shown from the
          stored month-end close snapshot. Operational detail tables remain
          available for drill-down.
        </div>
      )}

      {reopened &&
        fullCalendarMonth && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          This month is reopened, so report totals are live and will be
          snapshotted again when the month is closed.
        </div>
      )}

      {/* PRINT HEADER */}

      <div className="hidden border-b border-gray-300 pb-4 print:block">
        <div className="text-lg font-semibold text-gray-900">
          Business360
        </div>

        <div className="mt-1 text-sm font-medium text-gray-700">
          Management Report
        </div>

        <div className="mt-2 text-xs text-gray-500">
          Reporting period:{" "}
          {dateLabel}
        </div>
      </div>

      {/* EXECUTIVE FINANCIAL SNAPSHOT */}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between print:px-3 print:py-2">
          <div>
            <h2 className="font-semibold text-gray-900 print:text-sm">
              Executive Financial Snapshot
            </h2>

            <p className="mt-1 text-sm text-gray-500 print:text-[9px]">
              Revenue, profitability and operational cash flow by currency.
            </p>
          </div>

          <div className="text-xs text-gray-400 print:hidden">
            {reportBasisDescription}
          </div>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-4 print:p-3">
          {executiveMetrics.map(
            (metric) => (
              <ExecutiveMetric
                key={metric.key}
                label={metric.label}
                currency={metric.currency}
                value={metric.value}
                tone={metric.tone}
              />
            )
          )}
        </div>
      </div>

      {/* COUNTS */}

      <div>
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 print:hidden">
          Operational Activity
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-4 print:gap-2">
        <SummaryCard
          label="Sales Orders"
          value={String(
            counts.salesOrders
          )}
          hint="Orders in period"
        />

        <SummaryCard
          label="Invoices"
          value={String(
            counts.invoices
          )}
          hint={`${counts.paidInvoices} fully paid`}
        />

        <SummaryCard
          label="Purchase Orders"
          value={String(
            counts.purchaseOrders
          )}
          hint="Purchase activity"
        />

        <SummaryCard
          label="Supplier Bills"
          value={String(
            counts.supplierBills
          )}
          hint={`${counts.paidSupplierBills} paid`}
        />

        <SummaryCard
          label="A/P Outstanding"
          value={String(
            counts.outstandingSupplierBills
          )}
          hint="Bills with balance"
        />

        <SummaryCard
          label="A/P Overdue"
          value={String(
            counts.overdueSupplierBills
          )}
          hint="Past supplier due date"
        />

        <SummaryCard
          label="Posted Expenses"
          value={String(
            counts.postedExpenses
          )}
          hint="Included in P&L"
        />

        <SummaryCard
          label="Products"
          value={String(
            counts.products
          )}
          hint={`${lowStock.length} alerts`}
        />
        </div>
      </div>

      {/* ACCOUNTING HEALTH */}

      <Section
        title="Accounting Health"
        description="Month-end reconciliation and costing integrity checks."
      >
        <div className="grid gap-4 xl:grid-cols-[1.1fr_1.9fr] print:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 print:p-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Reconciliation Status
                </div>

                <div className="mt-2 text-2xl font-semibold text-gray-900 print:text-lg">
                  {accountingHealth.reconciliationIssues ===
                    0 &&
                  accountingHealth.salesAccountingIssues ===
                    0 &&
                  accountingHealth.inventoryCostingIssues ===
                    0 &&
                  accountingHealth.negativeStockProducts ===
                    0 &&
                  accountingHealth.negativeCostProducts ===
                    0
                    ? "Healthy"
                    : "Review Required"}
                </div>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  accountingHealth.reconciliationIssues ===
                    0 &&
                  accountingHealth.salesAccountingIssues ===
                    0 &&
                  accountingHealth.inventoryCostingIssues ===
                    0 &&
                  accountingHealth.negativeStockProducts ===
                    0 &&
                  accountingHealth.negativeCostProducts ===
                    0
                    ? "bg-green-50 text-green-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                {accountingHealth.reconciliationIssues ===
                  0 &&
                accountingHealth.salesAccountingIssues ===
                  0 &&
                accountingHealth.inventoryCostingIssues ===
                  0 &&
                accountingHealth.negativeStockProducts ===
                  0 &&
                accountingHealth.negativeCostProducts ===
                  0
                  ? "All checks passed"
                  : "Action needed"}
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-gray-500 print:text-[9px]">
              Revenue, historical COGS, inventory costing,
              A/R and A/P are protected by the reconciliation
              and integrity rules currently enabled in Business360.
            </p>

            {accountingHealth.manualCostingIssues >
              0 && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                {accountingHealth.manualCostingIssues} historical/manual
                inventory movement
                {accountingHealth.manualCostingIssues ===
                1
                  ? ""
                  : "s"}{" "}
                still lack a recorded cost snapshot.
                Legacy rows are kept unchanged rather than
                backfilled with today's cost.
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-2">
            <HealthMetric
              label="Reconciliation Issues"
              value={String(
                accountingHealth.reconciliationIssues
              )}
              healthy={
                accountingHealth.reconciliationIssues ===
                0
              }
            />

            <HealthMetric
              label="Sales Accounting"
              value={String(
                accountingHealth.salesAccountingIssues
              )}
              healthy={
                accountingHealth.salesAccountingIssues ===
                0
              }
            />

            <HealthMetric
              label="Inventory Costing"
              value={String(
                accountingHealth.inventoryCostingIssues
              )}
              healthy={
                accountingHealth.inventoryCostingIssues ===
                0
              }
            />

            <HealthMetric
              label="Legacy Manual Costing"
              value={String(
                accountingHealth.manualCostingIssues
              )}
              healthy={
                accountingHealth.manualCostingIssues ===
                0
              }
              warning={
                accountingHealth.manualCostingIssues >
                0
              }
            />

            <HealthMetric
              label="Inventory Value"
              value={money(
                accountingHealth.inventoryValue,
                "THB"
              )}
              healthy
            />

            <HealthMetric
              label="Units on Hand"
              value={formatQty(
                accountingHealth.totalUnits
              )}
              healthy
            />

            <HealthMetric
              label="Negative Stock"
              value={String(
                accountingHealth.negativeStockProducts
              )}
              healthy={
                accountingHealth.negativeStockProducts ===
                0
              }
            />

            <HealthMetric
              label="Negative Cost"
              value={String(
                accountingHealth.negativeCostProducts
              )}
              healthy={
                accountingHealth.negativeCostProducts ===
                0
              }
            />
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500 print:text-[8px]">
          Accounting basis: fulfilled sales recognize revenue and historical
          COGS; posted expenses reduce profit; customer collections minus
          posted expenses and supplier payments produce operational cash flow.
        </div>
      </Section>

      {/* MONTH-END CLOSE */}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm print:hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">
                Month-End Close
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Store a reconciled month-end snapshot after all accounting checks pass.
              </p>
            </div>

            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                alreadyClosed
                  ? "bg-gray-900 text-white"
                  : reopened
                  ? "bg-blue-50 text-blue-700"
                  : closeReady &&
                    periodEnded
                  ? "bg-green-50 text-green-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {alreadyClosed
                ? "Closed"
                : reopened
                ? "Reopened"
                : closeReady &&
                  periodEnded
                ? "Ready to Close"
                : "Not Ready"}
            </span>
          </div>
        </div>

        <div className="grid gap-5 p-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <CloseMetric
                label="Period"
                value={formatMonthLabel(
                  startDate
                )}
              />

              <CloseMetric
                label="Accounting Health"
                value={
                  accountingHealth.reconciliationIssues ===
                    0 &&
                  accountingHealth.salesAccountingIssues ===
                    0 &&
                  accountingHealth.inventoryCostingIssues ===
                    0
                    ? "Healthy"
                    : "Review"
                }
                positive={
                  accountingHealth.reconciliationIssues ===
                    0 &&
                  accountingHealth.salesAccountingIssues ===
                    0 &&
                  accountingHealth.inventoryCostingIssues ===
                    0
                }
              />

              <CloseMetric
                label="Core Issues"
                value={String(
                  accountingHealth.reconciliationIssues
                )}
                positive={
                  accountingHealth.reconciliationIssues ===
                    0
                }
              />

              <CloseMetric
                label="Inventory Value"
                value={money(
                  accountingHealth.inventoryValue,
                  "THB"
                )}
                positive
              />
            </div>

            {!fullCalendarMonth && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Month-End Close requires one complete calendar month.
              </div>
            )}

            {fullCalendarMonth &&
              !periodEnded && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  This accounting period has not ended yet.
                </div>
              )}

            {alreadyClosed && (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                Closed{" "}
                {monthClose?.closed_at
                  ? `on ${formatDateTime(
                      monthClose.closed_at
                    )}`
                  : ""}
                . Financial, inventory and accounting-health snapshots are stored.
              </div>
            )}

            {reopened && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                This month is reopened. Closed-period transaction locks are released until the month is closed again.
              </div>
            )}
          </div>

          <div>
            {!alreadyClosed ? (
              <>
                <label className="block">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Close Note
                  </div>

                  <textarea
                    value={closeNote}
                    onChange={(event) =>
                      setCloseNote(
                        event.target.value
                      )
                    }
                    disabled={
                      userRole !==
                        "owner"
                    }
                    rows={4}
                    placeholder="Optional month-end note..."
                    className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 outline-none disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </label>

                <button
                  type="button"
                  onClick={
                    closeSelectedMonth
                  }
                  disabled={
                    closeBusy ||
                    userRole !==
                      "owner" ||
                    !closeReady ||
                    !periodEnded
                  }
                  style={{
                    backgroundColor:
                      closeBusy ||
                      userRole !==
                        "owner" ||
                      !closeReady ||
                      !periodEnded
                        ? "#d1d5db"
                        : "#111827",
                    color:
                      "#ffffff",
                  }}
                  className="mt-3 w-full rounded-lg px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed"
                >
                  {closeBusy
                    ? "Closing Month..."
                    : userRole !==
                      "owner"
                    ? "Owner Only"
                    : reopened
                    ? "Close Month Again"
                    : "Close Month"}
                </button>
              </>
            ) : (
              <>
                <label className="block">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Reopen Reason
                  </div>

                  <textarea
                    value={reopenReason}
                    onChange={(event) =>
                      setReopenReason(
                        event.target.value
                      )
                    }
                    disabled={
                      userRole !==
                        "owner"
                    }
                    rows={4}
                    placeholder="Required reason for reopening this closed month..."
                    className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm text-gray-900 outline-none disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </label>

                <button
                  type="button"
                  onClick={
                    reopenSelectedMonth
                  }
                  disabled={
                    reopenBusy ||
                    userRole !==
                      "owner" ||
                    !reopenReason.trim()
                  }
                  style={{
                    backgroundColor:
                      reopenBusy ||
                      userRole !==
                        "owner" ||
                      !reopenReason.trim()
                        ? "#d1d5db"
                        : "#b45309",
                    color:
                      "#ffffff",
                  }}
                  className="mt-3 w-full rounded-lg px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed"
                >
                  {reopenBusy
                    ? "Reopening Month..."
                    : userRole !==
                      "owner"
                    ? "Owner Only"
                    : "Reopen Month"}
                </button>
              </>
            )}

            {closeMessage && (
              <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                {closeMessage}
              </div>
            )}

            <p className="mt-3 text-xs leading-5 text-gray-400">
              Closed months block accounting-impacting transaction changes. Reopening requires an owner reason and releases those locks until the month is closed again.
            </p>
          </div>
        </div>
      </div>

      {/* CLOSE / REOPEN AUDIT HISTORY */}

      {fullCalendarMonth && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm print:hidden">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">
                  Close / Reopen History
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Immutable audit trail for accounting-period close, reopen and status changes.
                </p>
              </div>

              <div className="text-xs font-medium text-gray-400">
                {periodAuditLog.length}{" "}
                {periodAuditLog.length === 1
                  ? "entry"
                  : "entries"}
              </div>
            </div>
          </div>

          {periodAuditLog.length === 0 ? (
            <div className="px-6 py-8">
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center">
                <div className="text-sm font-medium text-gray-700">
                  No audit entries yet
                </div>

                <div className="mt-1 text-xs leading-5 text-gray-400">
                  The immutable audit trail starts from the moment the database audit trigger was installed.
                  The next close or reopen action for this month will appear here automatically.
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <Header>
                      Date / Time
                    </Header>

                    <Header>
                      Action
                    </Header>

                    <Header>
                      Status Change
                    </Header>

                    <Header>
                      Actor
                    </Header>

                    <Header>
                      Reason / Note
                    </Header>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {periodAuditLog.map(
                    (entry) => (
                      <tr key={entry.id}>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                          {formatDateTime(
                            entry.created_at
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <AuditActionBadge
                            action={
                              entry.action
                            }
                          />
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-700">
                          {entry.previous_status ? (
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                                {labelize(
                                  entry.previous_status
                                )}
                              </span>

                              <span className="text-gray-300">
                                →
                              </span>

                              <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-900">
                                {labelize(
                                  entry.new_status ||
                                    "-"
                                )}
                              </span>
                            </div>
                          ) : (
                            <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                              {labelize(
                                entry.new_status ||
                                  "-"
                              )}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-700">
                          <div className="font-medium text-gray-900">
                            {entry.actor_user_id &&
                            entry.actor_user_id ===
                              currentUserId
                              ? "You"
                              : entry.actor_user_id
                              ? `User ${shortId(
                                  entry.actor_user_id
                                )}`
                              : "System"}
                          </div>

                          {entry.actor_user_id && (
                            <div className="mt-1 font-mono text-[10px] text-gray-400">
                              {shortId(
                                entry.actor_user_id,
                                12
                              )}
                            </div>
                          )}
                        </td>

                        <td className="max-w-md px-4 py-4 text-sm text-gray-600">
                          {entry.reason?.trim() ||
                            "—"}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-gray-100 bg-gray-50 px-6 py-3 text-xs leading-5 text-gray-400">
            Audit entries are written automatically by the database trigger and cannot be edited or deleted by normal application users.
          </div>
        </div>
      )}

      {/* P&L */}

      <Section
        title="Business Performance"
        description="Profit & Loss is calculated separately for each currency."
      >
        <div className="grid gap-5 xl:grid-cols-2 print:grid-cols-2">
          {currencyTotals.map(
            (summary) => (
              <div
                key={
                  summary.currency
                }
                className="rounded-xl border border-gray-200 bg-gray-50 p-5 print:p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Profit & Loss
                    </div>

                    <div className="mt-1 text-xl font-semibold text-gray-900">
                      {
                        summary.currency
                      }
                    </div>
                  </div>

                  <ProfitBadge
                    value={
                      summary.netProfit
                    }
                  />
                </div>

                <div className="mt-6 space-y-4 print:mt-3 print:space-y-2">
                  <StatementRow
                    label="Revenue"
                    value={money(
                      summary.sales,
                      summary.currency
                    )}
                    strong
                  />

                  <StatementRow
                    label="Cost of Goods Sold"
                    value={`-${money(
                      summary.cogs,
                      summary.currency
                    )}`}
                  />

                  <div className="border-t border-gray-200 pt-4 print:pt-2">
                    <StatementRow
                      label="Gross Profit"
                      value={money(
                        summary.grossProfit,
                        summary.currency
                      )}
                      positive={
                        summary.grossProfit >=
                        0
                      }
                      danger={
                        summary.grossProfit <
                        0
                      }
                      strong
                    />
                  </div>

                  <StatementRow
                    label="Operating Expenses"
                    value={`-${money(
                      summary.expenses,
                      summary.currency
                    )}`}
                  />

                  <div className="border-t border-gray-300 pt-4 print:pt-2">
                    <StatementRow
                      label="Net Profit"
                      value={moneySigned(
                        summary.netProfit,
                        summary.currency
                      )}
                      positive={
                        summary.netProfit >=
                        0
                      }
                      danger={
                        summary.netProfit <
                        0
                      }
                      large
                    />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 print:mt-3 print:gap-2">
                  <MetricBox
                    label="Gross Margin"
                    value={`${summary.grossMargin.toFixed(
                      1
                    )}%`}
                    tone={
                      summary.grossMargin >=
                      0
                        ? "positive"
                        : "danger"
                    }
                  />

                  <MetricBox
                    label="Net Margin"
                    value={`${summary.netMargin.toFixed(
                      1
                    )}%`}
                    tone={
                      summary.netMargin >=
                      0
                        ? "positive"
                        : "danger"
                    }
                  />
                </div>
              </div>
            )
          )}
        </div>
      </Section>

      {/* ACCOUNTS PAYABLE */}

      <Section
        title="Accounts Payable"
        description="Supplier bills, payments and outstanding balances."
      >
        <div className="grid gap-5 xl:grid-cols-2 print:grid-cols-2">
          {currencyTotals.map(
            (summary) => {
              const progress =
                summary.supplierBilled >
                0
                  ? Math.min(
                      100,
                      Math.max(
                        0,
                        (summary.supplierPaid /
                          summary.supplierBilled) *
                          100
                      )
                    )
                  : 0;

              return (
                <div
                  key={`ap-${summary.currency}`}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-5 print:p-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Accounts Payable
                      </div>

                      <div className="mt-1 text-xl font-semibold">
                        {
                          summary.currency
                        }
                      </div>
                    </div>

                    <Link
                      href="/supplier-bills"
                      className="text-xs font-medium text-gray-500 underline underline-offset-4 print:hidden"
                    >
                      View Bills
                    </Link>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <MetricBox
                      label="Supplier Billed"
                      value={money(
                        summary.supplierBilled,
                        summary.currency
                      )}
                    />

                    <MetricBox
                      label="Supplier Paid"
                      value={money(
                        summary.supplierPaid,
                        summary.currency
                      )}
                      tone="positive"
                    />

                    <MetricBox
                      label="Outstanding"
                      value={money(
                        summary.supplierOutstanding,
                        summary.currency
                      )}
                      tone={
                        summary.supplierOutstanding >
                        0
                          ? "warning"
                          : "positive"
                      }
                    />

                    <MetricBox
                      label="Overdue"
                      value={money(
                        summary.supplierOverdue,
                        summary.currency
                      )}
                      tone={
                        summary.supplierOverdue >
                        0
                          ? "danger"
                          : "positive"
                      }
                    />
                  </div>

                  <div className="mt-5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">
                        Payment Progress
                      </span>

                      <strong>
                        {progress.toFixed(
                          0
                        )}
                        %
                      </strong>
                    </div>

                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-green-500"
                        style={{
                          width: `${progress}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            }
          )}
        </div>
      </Section>

      {/* SCREEN CHARTS */}

      <div className="space-y-7 print:hidden">
        {currencies.map(
          (currency) => {
            const rows =
              trendDataByCurrency[
                currency
              ] || [];

            return (
              <div
                key={`trend-${currency}`}
                className="grid gap-6 xl:grid-cols-2"
              >
                <Section
                  title={`Revenue vs Expenses — ${currency}`}
                  description="Daily revenue and operating expenses."
                >
                  <div className="h-[320px]">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <LineChart
                        data={
                          rows
                        }
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                        />

                        <XAxis
                          dataKey="label"
                          fontSize={
                            12
                          }
                        />

                        <YAxis
                          fontSize={
                            12
                          }
                        />

                        <Tooltip
                          formatter={(value) =>
                            money(
                              Number(value ?? 0),
                              currency
                            )
                          }
                        />

                        <Legend />

                        <Line
                          type="monotone"
                          dataKey="revenue"
                          name="Revenue"
                          stroke="currentColor"
                          strokeWidth={
                            2
                          }
                          dot={
                            false
                          }
                        />

                        <Line
                          type="monotone"
                          dataKey="expenses"
                          name="Expenses"
                          stroke="currentColor"
                          strokeWidth={
                            2
                          }
                          strokeDasharray="5 5"
                          dot={
                            false
                          }
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Section>

                <Section
                  title={`Profit Trend — ${currency}`}
                  description="Gross Profit and Net Profit."
                >
                  <div className="h-[320px]">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <BarChart
                        data={
                          rows
                        }
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                        />

                        <XAxis
                          dataKey="label"
                          fontSize={
                            12
                          }
                        />

                        <YAxis
                          fontSize={
                            12
                          }
                        />

                        <Tooltip
                          formatter={(value) =>
                            money(
                              Number(value ?? 0),
                              currency
                            )
                          }
                        />

                        <Legend />

                        <Bar
                          dataKey="grossProfit"
                          name="Gross Profit"
                          fill="currentColor"
                        />

                        <Bar
                          dataKey="netProfit"
                          name="Net Profit"
                          fill="currentColor"
                          opacity={
                            0.55
                          }
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Section>
              </div>
            );
          }
        )}

        <SourceCharts
          currencies={
            currencies
          }
          sourceData={
            sourceData
          }
        />

        <CustomerCharts
          currencies={
            currencies
          }
          rows={
            topCustomers
          }
        />

        <ProductCharts
          currencies={
            currencies
          }
          rows={
            topProducts
          }
        />
      </div>

      {/* PRINT ANALYTICS */}

      <div className="hidden space-y-4 print:block">
        <PrintSection
          title="Sales by Order Source"
        >
          {currencies.map(
            (currency) => {
              const rows =
                sourceData.filter(
                  (row) =>
                    row.currency ===
                    currency
                );

              if (
                rows.length ===
                0
              ) {
                return null;
              }

              return (
                <PrintCurrencyTable
                  key={`print-source-${currency}`}
                  currency={
                    currency
                  }
                  headers={[
                    "Source",
                    "Orders",
                    "Sales",
                  ]}
                  rows={rows.map(
                    (row) => [
                      row.source,
                      String(
                        row.orders
                      ),
                      money(
                        row.sales,
                        currency
                      ),
                    ]
                  )}
                />
              );
            }
          )}
        </PrintSection>

        <div className="grid grid-cols-2 gap-4">
          <PrintSection
            title="Top Customers"
          >
            {currencies.map(
              (currency) => {
                const rows =
                  topCustomers
                    .filter(
                      (row) =>
                        row.currency ===
                        currency
                    )
                    .slice(
                      0,
                      8
                    );

                if (
                  rows.length ===
                  0
                ) {
                  return null;
                }

                return (
                  <PrintCurrencyTable
                    key={`print-customer-${currency}`}
                    currency={
                      currency
                    }
                    headers={[
                      "#",
                      "Customer",
                      "Sales",
                    ]}
                    rows={rows.map(
                      (
                        row,
                        index
                      ) => [
                        String(
                          index +
                            1
                        ),
                        row.customer_name,
                        money(
                          row.sales,
                          currency
                        ),
                      ]
                    )}
                  />
                );
              }
            )}
          </PrintSection>

          <PrintSection
            title="Top Products"
          >
            {currencies.map(
              (currency) => {
                const rows =
                  topProducts
                    .filter(
                      (row) =>
                        row.currency ===
                        currency
                    )
                    .slice(
                      0,
                      8
                    );

                if (
                  rows.length ===
                  0
                ) {
                  return null;
                }

                return (
                  <PrintCurrencyTable
                    key={`print-product-${currency}`}
                    currency={
                      currency
                    }
                    headers={[
                      "#",
                      "Product",
                      "Qty",
                      "Sales",
                      "GP",
                    ]}
                    rows={rows.map(
                      (
                        row,
                        index
                      ) => [
                        String(
                          index +
                            1
                        ),
                        row.product_name,
                        formatQty(
                          row.qty
                        ),
                        money(
                          row.sales,
                          currency
                        ),
                        money(
                          row.grossProfit,
                          currency
                        ),
                      ]
                    )}
                  />
                );
              }
            )}
          </PrintSection>
        </div>
      </div>

      {/* CASH FLOW */}

      <Section
        title="Cash Flow"
        description="Customer collections minus operating expenses and supplier payments."
      >
        <div className="grid gap-4 xl:grid-cols-2 print:grid-cols-2 print:gap-3">
          {currencyTotals.map(
            (summary) => (
              <div
                key={
                  summary.currency
                }
                className="rounded-xl border border-gray-200 p-5 print:p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-gray-900">
                    {
                      summary.currency
                    }
                  </div>

                  <div
                    className={`text-lg font-semibold ${
                      summary.cashFlow >=
                      0
                        ? "text-green-700"
                        : "text-red-600"
                    }`}
                  >
                    {moneySigned(
                      summary.cashFlow,
                      summary.currency
                    )}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 print:mt-3 print:gap-2">
                  <MetricBox
                    label="Customer Collections"
                    value={money(
                      summary.paid,
                      summary.currency
                    )}
                    tone="positive"
                  />

                  <MetricBox
                    label="Operating Expenses"
                    value={money(
                      summary.expenses,
                      summary.currency
                    )}
                    tone="danger"
                  />

                  <MetricBox
                    label="Supplier Payments"
                    value={money(
                      summary.supplierPaid,
                      summary.currency
                    )}
                    tone="danger"
                  />

                  <MetricBox
                    label="Net Cash Flow"
                    value={moneySigned(
                      summary.cashFlow,
                      summary.currency
                    )}
                    tone={
                      summary.cashFlow >=
                      0
                        ? "positive"
                        : "danger"
                    }
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MetricBox
                    label="Customer Outstanding"
                    value={money(
                      summary.outstanding,
                      summary.currency
                    )}
                    tone={
                      summary.outstanding >
                      0
                        ? "warning"
                        : "positive"
                    }
                  />

                  <MetricBox
                    label="Supplier Outstanding"
                    value={money(
                      summary.supplierOutstanding,
                      summary.currency
                    )}
                    tone={
                      summary.supplierOutstanding >
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
      </Section>

      {/* CUSTOMER COLLECTIONS */}

      <Section
        title="Recent Customer Collections"
        description="Customer payments received during the selected period."
      >
        {payments.length ===
        0 ? (
          <EmptyState text="No customer payments received in this period." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <Header>
                    Date
                  </Header>

                  <Header>
                    Payment
                  </Header>

                  <Header>
                    Method
                  </Header>

                  <Header>
                    Invoice
                  </Header>

                  <Header right>
                    Amount
                  </Header>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {payments
                  .slice(
                    0,
                    12
                  )
                  .map(
                    (payment) => (
                      <tr
                        key={
                          payment.id
                        }
                      >
                        <td className="px-4 py-4 text-sm text-gray-600 print:px-2 print:py-2 print:text-xs">
                          {formatDate(
                            payment.payment_date
                          )}
                        </td>

                        <td className="px-4 py-4 text-sm font-medium text-gray-900 print:px-2 print:py-2 print:text-xs">
                          {
                            payment.payment_no
                          }
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-600 print:px-2 print:py-2 print:text-xs">
                          {methodLabel(
                            payment.payment_method
                          )}
                        </td>

                        <td className="px-4 py-4 print:px-2 print:py-2">
                          <Link
                            href={`/invoices/${payment.invoice_id}`}
                            className="text-sm font-medium text-gray-700 underline underline-offset-4 print:text-xs print:no-underline"
                          >
                            Invoice #
                            {
                              payment.invoice_id
                            }
                          </Link>
                        </td>

                        <td className="px-4 py-4 text-right text-sm font-semibold text-green-700 print:px-2 print:py-2 print:text-xs">
                          {money(
                            payment.amount,
                            payment.currency
                          )}
                        </td>
                      </tr>
                    )
                  )}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* SUPPLIER PAYMENTS */}

      <Section
        title="Recent Supplier Payments"
        description="Payments made to suppliers during the selected period."
      >
        {supplierPayments.length ===
        0 ? (
          <EmptyState text="No supplier payments recorded in this period." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <Header>
                    Date
                  </Header>

                  <Header>
                    Payment
                  </Header>

                  <Header>
                    Supplier
                  </Header>

                  <Header>
                    Method
                  </Header>

                  <Header>
                    Supplier Bill
                  </Header>

                  <Header right>
                    Amount
                  </Header>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {supplierPayments
                  .slice(
                    0,
                    12
                  )
                  .map(
                    (payment) => (
                      <tr
                        key={
                          payment.id
                        }
                      >
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {formatDate(
                            payment.payment_date
                          )}
                        </td>

                        <td className="px-4 py-4 text-sm font-medium text-gray-900">
                          {
                            payment.payment_no
                          }
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-700">
                          {
                            payment.supplier_name
                          }
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-600">
                          {methodLabel(
                            payment.payment_method
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <Link
                            href={`/supplier-bills/${payment.supplier_bill_id}`}
                            className="text-sm font-medium text-gray-700 underline underline-offset-4 print:no-underline"
                          >
                            Bill #
                            {
                              payment.supplier_bill_id
                            }
                          </Link>
                        </td>

                        <td className="px-4 py-4 text-right text-sm font-semibold text-red-600">
                          -
                          {money(
                            payment.amount,
                            payment.currency
                          )}
                        </td>
                      </tr>
                    )
                  )}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* PAYABLE REGISTER */}

      <Section
        title="Accounts Payable Register"
        description="Supplier bills created during the selected period, including payment and overdue position."
      >
        {supplierBills.length ===
        0 ? (
          <EmptyState text="No supplier bills in this period." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <Header>
                    Bill
                  </Header>

                  <Header>
                    Supplier
                  </Header>

                  <Header>
                    Bill Date
                  </Header>

                  <Header>
                    Due Date
                  </Header>

                  <Header>
                    Status
                  </Header>

                  <Header right>
                    Total
                  </Header>

                  <Header right>
                    Paid
                  </Header>

                  <Header right>
                    Balance
                  </Header>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {supplierBills
                  .slice()
                  .sort(
                    (a, b) =>
                      String(
                        b.bill_date
                      ).localeCompare(
                        String(
                          a.bill_date
                        )
                      )
                  )
                  .map(
                    (bill) => {
                      const overdue =
                        isSupplierBillOverdue(
                          bill
                        );

                      return (
                        <tr
                          key={
                            bill.id
                          }
                          className={
                            overdue
                              ? "bg-red-50/30"
                              : ""
                          }
                        >
                          <td className="px-4 py-4">
                            <Link
                              href={`/supplier-bills/${bill.id}`}
                              className="text-sm font-semibold text-gray-900 underline underline-offset-4 print:no-underline"
                            >
                              {
                                bill.bill_no
                              }
                            </Link>
                          </td>

                          <td className="px-4 py-4 text-sm text-gray-700">
                            {
                              bill.supplier_name
                            }
                          </td>

                          <td className="px-4 py-4 text-sm text-gray-600">
                            {formatDate(
                              bill.bill_date
                            )}
                          </td>

                          <td
                            className={`px-4 py-4 text-sm ${
                              overdue
                                ? "font-semibold text-red-600"
                                : "text-gray-600"
                            }`}
                          >
                            {bill.due_date
                              ? formatDate(
                                  bill.due_date
                                )
                              : "-"}
                          </td>

                          <td className="px-4 py-4">
                            <StatusBadge
                              value={
                                overdue
                                  ? "overdue"
                                  : bill.status
                              }
                            />
                          </td>

                          <td className="px-4 py-4 text-right text-sm font-semibold">
                            {money(
                              bill.total_amount,
                              bill.currency
                            )}
                          </td>

                          <td className="px-4 py-4 text-right text-sm font-semibold text-green-700">
                            {money(
                              bill.paid_amount,
                              bill.currency
                            )}
                          </td>

                          <td
                            className={`px-4 py-4 text-right text-sm font-semibold ${
                              overdue
                                ? "text-red-600"
                                : bill.balance_due >
                                  0
                                ? "text-amber-600"
                                : "text-green-700"
                            }`}
                          >
                            {money(
                              bill.balance_due,
                              bill.currency
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
      </Section>

      {/* INVENTORY */}

      <Section
        title="Inventory Alerts"
        description="Products currently at or below minimum stock."
      >
        {lowStock.length ===
        0 ? (
          <div className="rounded-lg bg-green-50 px-4 py-4 text-sm font-medium text-green-700">
            ✓ No low-stock products.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 print:grid-cols-4 print:gap-2">
            {lowStock
              .slice(
                0,
                12
              )
              .map(
                (product) => (
                  <Link
                    key={
                      product.id
                    }
                    href={`/products/${product.id}`}
                    className="rounded-xl border border-gray-200 p-4 transition hover:bg-gray-50 print:p-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900 print:text-xs">
                          {
                            product.product_name
                          }
                        </div>

                        <div className="mt-1 text-xs text-gray-400 print:text-[9px]">
                          {product.product_code ||
                            `Product #${product.id}`}
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          product.current_stock <=
                          0
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {product.current_stock <=
                        0
                          ? "Out"
                          : "Low"}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        Current{" "}
                        <strong className="text-gray-900">
                          {formatQty(
                            product.current_stock
                          )}
                        </strong>
                      </span>

                      <span className="text-gray-500">
                        Minimum{" "}
                        <strong className="text-gray-900">
                          {formatQty(
                            product.min_stock
                          )}
                        </strong>
                      </span>
                    </div>
                  </Link>
                )
              )}
          </div>
        )}
      </Section>

      <div className="hidden border-t border-gray-200 pt-3 text-center text-[9px] text-gray-400 print:block">
        Business360 Management Report • Generated{" "}
        {new Date().toLocaleString()}
      </div>
    </div>
  );
}

/* =========================================
   CHART COMPONENTS
========================================= */

function SourceCharts({
  currencies,
  sourceData,
}: {
  currencies: string[];
  sourceData: SourceRow[];
}) {
  return (
    <Section
      title="Sales by Order Source"
      description="Each currency is shown separately."
    >
      <div className="grid gap-6 xl:grid-cols-2">
        {currencies.map(
          (currency) => {
            const rows =
              sourceData.filter(
                (row) =>
                  row.currency ===
                  currency
              );

            if (
              rows.length === 0
            ) {
              return null;
            }

            return (
              <div
                key={`source-${currency}`}
                className="rounded-xl border border-gray-200 p-5"
              >
                <div className="mb-4 text-lg font-semibold text-gray-900">
                  {currency}
                </div>

                <div className="h-[260px]">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <BarChart
                      data={
                        rows
                      }
                      layout="vertical"
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                      />

                      <XAxis
                        type="number"
                      />

                      <YAxis
                        type="category"
                        dataKey="source"
                        width={
                          100
                        }
                        fontSize={
                          12
                        }
                      />

                      <Tooltip />

                      <Bar
                        dataKey="orders"
                        name="Orders"
                        fill="currentColor"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 space-y-3">
                  {rows.map(
                    (row) => (
                      <div
                        key={`${currency}-${row.source}`}
                        className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3"
                      >
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {
                              row.source
                            }
                          </div>

                          <div className="text-xs text-gray-400">
                            {
                              row.orders
                            }{" "}
                            orders
                          </div>
                        </div>

                        <div className="text-sm font-semibold text-gray-900">
                          {money(
                            row.sales,
                            currency
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>
    </Section>
  );
}

function CustomerCharts({
  currencies,
  rows,
}: {
  currencies: string[];
  rows: CustomerSummary[];
}) {
  return (
    <Section
      title="Top Customers"
      description="Highest sales value, separated by currency."
    >
      <div className="grid gap-6 xl:grid-cols-2">
        {currencies.map(
          (currency) => {
            const items =
              rows
                .filter(
                  (row) =>
                    row.currency ===
                    currency
                )
                .slice(
                  0,
                  8
                );

            if (
              items.length ===
              0
            ) {
              return null;
            }

            return (
              <div
                key={`customers-${currency}`}
                className="rounded-xl border border-gray-200 p-5"
              >
                <div className="mb-4 text-lg font-semibold text-gray-900">
                  {currency}
                </div>

                <div className="h-[280px]">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <BarChart
                      data={
                        items.slice(
                          0,
                          6
                        )
                      }
                      layout="vertical"
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                      />

                      <XAxis
                        type="number"
                      />

                      <YAxis
                        type="category"
                        dataKey="customer_name"
                        width={
                          120
                        }
                        fontSize={
                          12
                        }
                      />

                      <Tooltip
                        formatter={(value) =>
                          money(
                            Number(value ?? 0),
                            currency
                          )
                        }
                      />

                      <Bar
                        dataKey="sales"
                        name="Sales"
                        fill="currentColor"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 divide-y divide-gray-100">
                  {items.map(
                    (
                      customer,
                      index
                    ) => (
                      <div
                        key={`${customer.customer_id}-${currency}`}
                        className="flex items-center justify-between py-3"
                      >
                        <div className="flex items-center gap-3">
                          <Rank
                            value={
                              index +
                              1
                            }
                          />

                          <div className="text-sm font-medium text-gray-900">
                            {
                              customer.customer_name
                            }
                          </div>
                        </div>

                        <div className="text-sm font-semibold text-gray-900">
                          {money(
                            customer.sales,
                            currency
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>
    </Section>
  );
}

function ProductCharts({
  currencies,
  rows,
}: {
  currencies: string[];
  rows: ProductSummary[];
}) {
  return (
    <Section
      title="Top Products"
      description="Sales and gross profit, separated by currency."
    >
      <div className="grid gap-6 xl:grid-cols-2">
        {currencies.map(
          (currency) => {
            const items =
              rows
                .filter(
                  (row) =>
                    row.currency ===
                    currency
                )
                .slice(
                  0,
                  8
                );

            if (
              items.length ===
              0
            ) {
              return null;
            }

            return (
              <div
                key={`products-${currency}`}
                className="rounded-xl border border-gray-200 p-5"
              >
                <div className="mb-4 text-lg font-semibold text-gray-900">
                  {currency}
                </div>

                <div className="h-[280px]">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <BarChart
                      data={
                        items.slice(
                          0,
                          6
                        )
                      }
                      layout="vertical"
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                      />

                      <XAxis
                        type="number"
                      />

                      <YAxis
                        type="category"
                        dataKey="product_name"
                        width={
                          130
                        }
                        fontSize={
                          12
                        }
                      />

                      <Tooltip
                        formatter={(value) =>
                          money(
                            Number(value ?? 0),
                            currency
                          )
                        }
                      />

                      <Bar
                        dataKey="sales"
                        name="Sales"
                        fill="currentColor"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-4 divide-y divide-gray-100">
                  {items.map(
                    (
                      product,
                      index
                    ) => (
                      <div
                        key={`${product.product_id}-${currency}`}
                        className="flex items-center justify-between py-3"
                      >
                        <div className="flex items-center gap-3">
                          <Rank
                            value={
                              index +
                              1
                            }
                          />

                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {
                                product.product_name
                              }
                            </div>

                            <div className="mt-1 text-xs text-gray-400">
                              Qty{" "}
                              {formatQty(
                                product.qty
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-semibold text-gray-900">
                            {money(
                              product.sales,
                              currency
                            )}
                          </div>

                          <div
                            className={`mt-1 text-xs font-medium ${
                              product.grossProfit >=
                              0
                                ? "text-green-700"
                                : "text-red-600"
                            }`}
                          >
                            GP{" "}
                            {money(
                              product.grossProfit,
                              currency
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>
    </Section>
  );
}

/* =========================================
   PRINT COMPONENTS
========================================= */

function PrintSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="break-inside-avoid rounded-lg border border-gray-200 p-3">
      <div className="mb-3 text-sm font-semibold text-gray-900">
        {title}
      </div>

      {children}
    </div>
  );
}

function PrintCurrencyTable({
  currency,
  headers,
  rows,
}: {
  currency: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 text-[10px] font-semibold text-gray-700">
        {currency}
      </div>

      <table className="w-full border-collapse text-[9px]">
        <thead>
          <tr className="border-b border-gray-200">
            {headers.map(
              (header) => (
                <th
                  key={
                    header
                  }
                  className="px-1.5 py-1 text-left font-semibold text-gray-500"
                >
                  {header}
                </th>
              )
            )}
          </tr>
        </thead>

        <tbody>
          {rows.map(
            (
              row,
              rowIndex
            ) => (
              <tr
                key={
                  rowIndex
                }
                className="border-b border-gray-100 last:border-0"
              >
                {row.map(
                  (
                    cell,
                    cellIndex
                  ) => (
                    <td
                      key={
                        cellIndex
                      }
                      className="px-1.5 py-1.5 text-gray-700"
                    >
                      {cell}
                    </td>
                  )
                )}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

/* =========================================
   UI
========================================= */

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
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm print:break-inside-avoid print:shadow-none">
      <div className="border-b border-gray-200 px-6 py-4 print:px-3 print:py-2">
        <h2 className="font-semibold text-gray-900 print:text-sm">
          {title}
        </h2>

        <p className="mt-1 text-sm text-gray-500 print:text-[9px]">
          {description}
        </p>
      </div>

      <div className="p-6 print:p-3">
        {children}
      </div>
    </div>
  );
}

function ExecutiveMetric({
  label,
  currency,
  value,
  tone = "normal",
}: {
  label: string;
  currency: string;
  value: number;
  tone?:
    | "normal"
    | "positive"
    | "danger";
}) {
  const valueClass =
    tone === "positive"
      ? "text-green-700"
      : tone === "danger"
      ? "text-red-600"
      : "text-gray-900";

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 print:p-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium text-gray-500 print:text-[8px]">
          {label}
        </div>

        <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-gray-500 print:p-0">
          {currency}
        </span>
      </div>

      <div className={`mt-3 text-xl font-semibold ${valueClass} print:mt-1 print:text-sm`}>
        {moneySigned(
          value,
          currency
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm print:p-2 print:shadow-none">
      <div className="text-sm text-gray-500 print:text-[9px]">
        {label}
      </div>

      <div className="mt-2 text-2xl font-semibold text-gray-900 print:mt-1 print:text-lg">
        {value}
      </div>

      <div className="mt-2 text-xs text-gray-400 print:mt-1 print:text-[8px]">
        {hint}
      </div>
    </div>
  );
}

function StatementRow({
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
          strong ||
          large
            ? "font-semibold text-gray-900 print:text-[10px]"
            : "text-sm text-gray-500 print:text-[9px]"
        }
      >
        {label}
      </span>

      <span
        className={`font-semibold ${
          large
            ? "text-2xl print:text-lg"
            : strong
            ? "text-lg print:text-xs"
            : "text-sm print:text-[9px]"
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
    | "warning"
    | "danger";
}) {
  const valueClass =
    tone ===
    "positive"
      ? "text-green-700"
      : tone ===
        "warning"
      ? "text-amber-600"
      : tone ===
        "danger"
      ? "text-red-600"
      : "text-gray-900";

  return (
    <div className="rounded-lg bg-white p-4 print:p-2">
      <div className="text-xs uppercase tracking-wide text-gray-400 print:text-[8px]">
        {label}
      </div>

      <div
        className={`mt-2 text-lg font-semibold print:mt-1 print:text-xs ${valueClass}`}
      >
        {value}
      </div>
    </div>
  );
}

function CloseMetric({
  label,
  value,
  positive = false,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </div>

      <div
        className={`mt-2 text-sm font-semibold ${
          positive
            ? "text-green-700"
            : "text-gray-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function HealthMetric({
  label,
  value,
  healthy = false,
  warning = false,
}: {
  label: string;
  value: string;
  healthy?: boolean;
  warning?: boolean;
}) {
  const valueClass =
    warning
      ? "text-amber-600"
      : healthy
      ? "text-green-700"
      : "text-red-600";

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4 print:p-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 print:text-[8px]">
        {label}
      </div>

      <div
        className={`mt-2 text-lg font-semibold print:mt-1 print:text-xs ${valueClass}`}
      >
        {value}
      </div>
    </div>
  );
}

function ProfitBadge({
  value,
}: {
  value: number;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        value >= 0
          ? "bg-green-50 text-green-700"
          : "bg-red-50 text-red-700"
      }`}
    >
      {value >= 0
        ? "Profitable"
        : "Loss"}
    </span>
  );
}

function AuditActionBadge({
  action,
}: {
  action: PeriodAuditRow["action"];
}) {
  const normalized =
    String(
      action || ""
    ).toLowerCase();

  const tone =
    normalized === "closed"
      ? "bg-gray-900 text-white"
      : normalized === "reopened"
      ? "bg-blue-50 text-blue-700"
      : normalized === "created"
      ? "bg-green-50 text-green-700"
      : "bg-amber-50 text-amber-700";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}
    >
      {labelize(
        action
      )}
    </span>
  );
}

function StatusBadge({
  value,
}: {
  value: string;
}) {
  const normalized =
    String(
      value || ""
    ).toLowerCase();

  const tone =
    normalized === "paid"
      ? "bg-green-50 text-green-700"
      : normalized ===
        "partially_paid"
      ? "bg-amber-50 text-amber-700"
      : normalized ===
        "overdue"
      ? "bg-red-50 text-red-700"
      : normalized === "open"
      ? "bg-blue-50 text-blue-700"
      : "bg-gray-100 text-gray-700";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      {labelize(value)}
    </span>
  );
}

function Rank({
  value,
}: {
  value: number;
}) {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
      {value}
    </div>
  );
}

function RangeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2.5 text-sm font-medium ${
        active
          ? "bg-gray-900 text-white"
          : "border border-gray-200 bg-white text-gray-600"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-lg bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
      {text}
    </div>
  );
}

function Header({
  children,
  right = false,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${
        right
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

const inputClass =
  "rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none";

/* =========================================
   HELPERS
========================================= */

function isSupplierBillOverdue(
  bill: SupplierBillRow
) {
  return Boolean(
    bill.due_date &&
      bill.due_date <
        today() &&
      bill.balance_due > 0
  );
}

function today() {
  return toDateInput(
    new Date()
  );
}

function firstDayOfMonth() {
  const date =
    new Date();

  date.setDate(1);

  return toDateInput(
    date
  );
}

function firstDayOfDate(
  value: string
) {
  const date =
    new Date(
      `${value}T00:00:00`
    );

  date.setDate(1);

  return toDateInput(
    date
  );
}

function lastDayOfDateMonth(
  value: string
) {
  const date =
    new Date(
      `${value}T00:00:00`
    );

  date.setMonth(
    date.getMonth() + 1,
    0
  );

  return toDateInput(
    date
  );
}

function isFullCalendarMonth(
  start: string,
  end: string
) {
  if (!start || !end) {
    return false;
  }

  return (
    start ===
      firstDayOfDate(
        start
      ) &&
    end ===
      lastDayOfDateMonth(
        start
      )
  );
}

function formatMonthLabel(
  value: string
) {
  const date =
    new Date(
      `${firstDayOfDate(
        value
      )}T00:00:00`
    );

  return date.toLocaleDateString(
    undefined,
    {
      month: "long",
      year: "numeric",
    }
  );
}

function formatDateTime(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleString();
}

function toDateInput(
  value: Date
) {
  const year =
    value.getFullYear();

  const month =
    String(
      value.getMonth() +
        1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      value.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

function dateRange(
  start: string,
  end: string
) {
  const result: string[] =
    [];

  const current =
    new Date(
      `${start}T00:00:00`
    );

  const endDate =
    new Date(
      `${end}T00:00:00`
    );

  while (
    current <= endDate
  ) {
    result.push(
      toDateInput(current)
    );

    current.setDate(
      current.getDate() +
        1
    );
  }

  return result;
}

function shortDate(
  value: string
) {
  const parts =
    value.split("-");

  if (
    parts.length !== 3
  ) {
    return value;
  }

  return `${parts[2]}/${parts[1]}`;
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

function getItemCogs(
  item: any
) {
  const snapshot =
    Number(
      item?.cogs_amount || 0
    );

  if (snapshot > 0) {
    return snapshot;
  }

  return (
    Number(
      item?.qty || 0
    ) *
    Number(
      item?.unit_cost || 0
    )
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

function shortId(
  value: string,
  length = 8
) {
  const text =
    String(
      value || ""
    );

  if (
    text.length <=
    length
  ) {
    return text;
  }

  return `${text.slice(
    0,
    length
  )}…`;
}

function sourceLabel(
  value: string
) {
  if (
    value ===
    "walk_in"
  ) {
    return "Walk-in";
  }

  if (
    value ===
    "quotation"
  ) {
    return "Quotation";
  }

  return labelize(
    value
  );
}