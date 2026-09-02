"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type SupplierBill = {
  id: number;
  company_id: number;
  supplier_id: number;
  purchase_order_id: number | null;

  bill_no: string;
  bill_date: string;
  due_date: string | null;

  status: string;
  currency: string;

  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;

  paid_amount: number;
  balance_due: number;

  supplier_invoice_no: string | null;
  notes: string | null;

  created_at: string;
};

type Supplier = {
  id: number;
  supplier_name: string;
  supplier_code: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
};

type BillItem = {
  id: number;
  supplier_bill_id: number;
  product_id: number | null;
  description: string;
  qty: number;
  unit_cost: number;
  discount_percent: number;
  tax_percent: number;
  line_subtotal: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
  sort_order: number;
  product_name: string | null;
  product_code: string | null;
};

type SupplierPayment = {
  id: number;
  payment_no: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  reference_no: string | null;
  notes: string | null;
  slip_path: string | null;
};

type PeriodStatus =
  | "open"
  | "closed"
  | "reopened";

export default function SupplierBillDetailClient({
  id,
}: {
  id: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [bill, setBill] =
    useState<SupplierBill | null>(
      null
    );

  const [supplier, setSupplier] =
    useState<Supplier | null>(
      null
    );

  const [items, setItems] =
    useState<BillItem[]>([]);

  const [payments, setPayments] =
    useState<
      SupplierPayment[]
    >([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [
    messageType,
    setMessageType,
  ] = useState<
    "success" | "error"
  >("error");

  const [
    showPaymentModal,
    setShowPaymentModal,
  ] = useState(false);

  const [
    paymentAmount,
    setPaymentAmount,
  ] = useState("");

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState("cash");

  const [
    paymentDate,
    setPaymentDate,
  ] = useState(today());

  const [
    paymentPeriodStatus,
    setPaymentPeriodStatus,
  ] = useState<PeriodStatus>(
    "open"
  );

  const [
    paymentPeriodClosedAt,
    setPaymentPeriodClosedAt,
  ] = useState<string | null>(
    null
  );

  const [
    checkingPaymentPeriod,
    setCheckingPaymentPeriod,
  ] = useState(false);

  const [
    paymentReference,
    setPaymentReference,
  ] = useState("");

  const [
    paymentNotes,
    setPaymentNotes,
  ] = useState("");

  const [
    paymentSaving,
    setPaymentSaving,
  ] = useState(false);

  const [
    paymentMessage,
    setPaymentMessage,
  ] = useState("");

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: billData,
        error: billError,
      } = await supabase
        .from("supplier_bills")
        .select("*")
        .eq("id", id)
        .single();

      if (
        billError ||
        !billData
      ) {
        throw new Error(
          billError?.message ||
            "Supplier Bill not found."
        );
      }

      const normalizedBill =
        normalizeBill(
          billData
        );

      setBill(
        normalizedBill
      );

      const [
        supplierResult,
        itemsResult,
        paymentsResult,
      ] = await Promise.all([
        supabase
          .from("suppliers")
          .select(`
            id,
            supplier_name,
            supplier_code,
            contact_name,
            phone,
            email
          `)
          .eq(
            "id",
            billData.supplier_id
          )
          .single(),

        supabase
          .from(
            "supplier_bill_items"
          )
          .select(`
            id,
            supplier_bill_id,
            product_id,
            description,
            qty,
            unit_cost,
            discount_percent,
            tax_percent,
            line_subtotal,
            discount_amount,
            tax_amount,
            line_total,
            sort_order,
            products (
              product_name,
              product_code
            )
          `)
          .eq(
            "supplier_bill_id",
            id
          )
          .order(
            "sort_order",
            {
              ascending: true,
            }
          ),

        supabase
          .from(
            "supplier_payments"
          )
          .select(`
            id,
            payment_no,
            payment_date,
            amount,
            payment_method,
            reference_no,
            notes,
            slip_path
          `)
          .eq(
            "supplier_bill_id",
            id
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
          ),
      ]);

      if (
        supplierResult.error
      ) {
        throw new Error(
          supplierResult.error
            .message ||
            "Could not load supplier."
        );
      }

      if (
        itemsResult.error
      ) {
        throw new Error(
          itemsResult.error
            .message ||
            "Could not load bill items."
        );
      }

      if (
        paymentsResult.error
      ) {
        throw new Error(
          paymentsResult.error
            .message ||
            "Could not load supplier payments."
        );
      }

      setSupplier(
        supplierResult.data as Supplier
      );

      setItems(
        (
          itemsResult.data || []
        ).map(
          (row: any) => {
            const product =
              Array.isArray(
                row.products
              )
                ? row.products[0]
                : row.products;

            return {
              id:
                row.id,

              supplier_bill_id:
                row.supplier_bill_id,

              product_id:
                row.product_id,

              description:
                row.description,

              qty:
                Number(
                  row.qty || 0
                ),

              unit_cost:
                Number(
                  row.unit_cost ||
                    0
                ),

              discount_percent:
                Number(
                  row.discount_percent ||
                    0
                ),

              tax_percent:
                Number(
                  row.tax_percent ||
                    0
                ),

              line_subtotal:
                Number(
                  row.line_subtotal ||
                    0
                ),

              discount_amount:
                Number(
                  row.discount_amount ||
                    0
                ),

              tax_amount:
                Number(
                  row.tax_amount ||
                    0
                ),

              line_total:
                Number(
                  row.line_total ||
                    0
                ),

              sort_order:
                Number(
                  row.sort_order ||
                    0
                ),

              product_name:
                product?.product_name ||
                null,

              product_code:
                product?.product_code ||
                null,
            };
          }
        )
      );

      setPayments(
        (
          paymentsResult.data ||
          []
        ).map(
          (row: any) => ({
            id:
              row.id,

            payment_no:
              row.payment_no,

            payment_date:
              row.payment_date,

            amount:
              Number(
                row.amount ||
                  0
              ),

            payment_method:
              row.payment_method,

            reference_no:
              row.reference_no,

            notes:
              row.notes,

            slip_path:
              row.slip_path,
          })
        )
      );

      setPaymentAmount(
        normalizedBill.balance_due >
          0
          ? String(
              normalizedBill.balance_due
            )
          : ""
      );
    } catch (error) {
      setMessageType("error");

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load Supplier Bill."
      );
    } finally {
      setLoading(false);
    }
  }

  async function checkPaymentPeriod(
    targetDate: string
  ) {
    if (
      !bill ||
      !targetDate
    ) {
      return;
    }

    setCheckingPaymentPeriod(
      true
    );

    try {
      const {
        data,
        error,
      } = await supabase
        .from(
          "accounting_period_closes"
        )
        .select(`
          status,
          closed_at
        `)
        .eq(
          "company_id",
          bill.company_id
        )
        .eq(
          "period_start",
          firstDayOfDate(
            targetDate
          )
        )
        .maybeSingle();

      if (error) {
        throw error;
      }

      setPaymentPeriodStatus(
        data?.status ===
          "closed"
          ? "closed"
          : data?.status ===
            "reopened"
          ? "reopened"
          : "open"
      );

      setPaymentPeriodClosedAt(
        data?.closed_at ||
          null
      );
    } catch (error) {
      setPaymentMessage(
        error instanceof Error
          ? error.message
          : "Could not check payment accounting period."
      );
    } finally {
      setCheckingPaymentPeriod(
        false
      );
    }
  }

  async function markAsOpen() {
    if (!bill) return;

    setSaving(true);
    setMessage("");

    try {
      const { error } =
        await supabase
          .from(
            "supplier_bills"
          )
          .update({
            status: "open",
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            bill.id
          )
          .eq(
            "status",
            "draft"
          );

      if (error) {
        throw error;
      }

      await loadData();

      setMessageType(
        "success"
      );

      setMessage(
        "Supplier Bill is now Open and ready for payment."
      );
    } catch (error) {
      setMessageType("error");

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not open Supplier Bill."
      );
    } finally {
      setSaving(false);
    }
  }

  async function openAndRecordPayment() {
    if (!bill || saving) return;

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("supplier_bills")
        .update({
          status: "open",
          updated_at: new Date().toISOString(),
        })
        .eq("id", bill.id)
        .eq("status", "draft");

      if (error) throw error;

      const openedBill: SupplierBill = {
        ...bill,
        status: "open",
      };

      setBill(openedBill);
      setPaymentAmount(String(openedBill.balance_due));
      setPaymentMethod("cash");

      const defaultPaymentDate = today();
      setPaymentDate(defaultPaymentDate);
      setPaymentPeriodStatus("open");
      setPaymentPeriodClosedAt(null);
      setPaymentReference("");
      setPaymentNotes("");
      setPaymentMessage("");

      await checkPaymentPeriod(defaultPaymentDate);
      setShowPaymentModal(true);
    } catch (error) {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not open Supplier Bill for payment."
      );
    } finally {
      setSaving(false);
    }
  }

  async function backToDraft() {
    if (!bill) return;

    if (
      bill.paid_amount > 0
    ) {
      setMessageType("error");

      setMessage(
        "A bill with recorded payments cannot be returned to Draft."
      );

      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { error } =
        await supabase
          .from(
            "supplier_bills"
          )
          .update({
            status: "draft",
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            bill.id
          );

      if (error) {
        throw error;
      }

      await loadData();

      setMessageType(
        "success"
      );

      setMessage(
        "Supplier Bill returned to Draft."
      );
    } catch (error) {
      setMessageType("error");

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not return bill to Draft."
      );
    } finally {
      setSaving(false);
    }
  }

  async function openPaymentModal() {
    if (!bill) return;

    setPaymentAmount(
      String(
        bill.balance_due
      )
    );

    setPaymentMethod(
      "cash"
    );

    const defaultPaymentDate =
      today();

    setPaymentDate(
      defaultPaymentDate
    );

    setPaymentPeriodStatus(
      "open"
    );

    setPaymentPeriodClosedAt(
      null
    );

    await checkPaymentPeriod(
      defaultPaymentDate
    );

    setPaymentReference(
      ""
    );

    setPaymentNotes(
      ""
    );

    setPaymentMessage(
      ""
    );

    setShowPaymentModal(
      true
    );
  }

  async function saveSupplierPayment() {
    if (!bill) return;

    if (
      checkingPaymentPeriod
    ) {
      setPaymentMessage(
        "Please wait while the payment accounting period is checked."
      );
      return;
    }

    if (
      paymentPeriodStatus ===
      "closed"
    ) {
      setPaymentMessage(
        "The selected payment date belongs to a closed accounting period. Choose another date or reopen that month."
      );
      return;
    }

    const amount =
      Number(
        paymentAmount || 0
      );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setPaymentMessage(
        "Enter a valid payment amount."
      );

      return;
    }

    if (
      amount >
      bill.balance_due
    ) {
      setPaymentMessage(
        "Payment amount cannot exceed the outstanding balance."
      );

      return;
    }

    if (
      (
        paymentMethod ===
          "bank_transfer" ||
        paymentMethod ===
          "qr"
      ) &&
      !paymentReference.trim()
    ) {
      setPaymentMessage(
        "Reference number is required for Bank Transfer or QR payment."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Record supplier payment of ${money(
          amount,
          bill.currency
        )}?`
      );

    if (!confirmed) {
      return;
    }

    setPaymentSaving(
      true
    );

    setPaymentMessage(
      ""
    );

    try {
      const {
        data: paymentCloseData,
        error: paymentCloseError,
      } = await supabase
        .from(
          "accounting_period_closes"
        )
        .select(`
          status,
          closed_at
        `)
        .eq(
          "company_id",
          bill.company_id
        )
        .eq(
          "period_start",
          firstDayOfDate(
            paymentDate
          )
        )
        .maybeSingle();

      if (
        paymentCloseError
      ) {
        throw paymentCloseError;
      }

      if (
        paymentCloseData?.status ===
        "closed"
      ) {
        setPaymentPeriodStatus(
          "closed"
        );

        setPaymentPeriodClosedAt(
          paymentCloseData.closed_at ||
            null
        );

        throw new Error(
          "The selected payment date is now in a closed accounting period. Reopen the month or choose another payment date."
        );
      }

      const paymentNo =
        `SPAY-${Date.now()}`;

      const {
        error:
          paymentError,
      } = await supabase
        .from(
          "supplier_payments"
        )
        .insert({
          company_id:
            bill.company_id,

          supplier_id:
            bill.supplier_id,

          supplier_bill_id:
            bill.id,

          payment_no:
            paymentNo,

          payment_date:
            paymentDate,

          amount,

          payment_method:
            paymentMethod,

          reference_no:
            paymentReference.trim() ||
            null,

          notes:
            paymentNotes.trim() ||
            null,
        });

      if (
        paymentError
      ) {
        throw new Error(
          paymentError.message ||
            "Could not record supplier payment."
        );
      }

      const newPaidAmount =
        bill.paid_amount +
        amount;

      const newBalance =
        Math.max(
          0,
          bill.total_amount -
            newPaidAmount
        );

      const newStatus =
        newBalance <= 0
          ? "paid"
          : "partially_paid";

      const {
        error:
          updateError,
      } = await supabase
        .from(
          "supplier_bills"
        )
        .update({
          paid_amount:
            newPaidAmount,

          balance_due:
            newBalance,

          status:
            newStatus,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          bill.id
        );

      if (
        updateError
      ) {
        throw new Error(
          updateError.message ||
            "Payment was saved but bill balance could not be updated."
        );
      }

      setShowPaymentModal(
        false
      );

      await loadData();

      setMessageType(
        "success"
      );

      setMessage(
        newStatus ===
          "paid"
          ? "Supplier Bill paid in full."
          : "Supplier payment recorded successfully."
      );

      router.refresh();
    } catch (error) {
      setPaymentMessage(
        error instanceof Error
          ? error.message
          : "Could not save supplier payment."
      );
    } finally {
      setPaymentSaving(
        false
      );
    }
  }

  const paymentProgress =
    useMemo(() => {
      if (!bill) {
        return 0;
      }

      if (
        bill.total_amount <= 0
      ) {
        return 0;
      }

      return Math.min(
        100,
        Math.max(
          0,
          (bill.paid_amount /
            bill.total_amount) *
            100
        )
      );
    }, [bill]);

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-gray-500">
        Loading Supplier Bill...
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {message ||
          "Supplier Bill not found."}
      </div>
    );
  }

  const isPaid =
    bill.status === "paid" ||
    bill.balance_due <= 0;

  const canRecordPayment =
    !isPaid &&
    bill.status !== "draft";

  return (
    <>
      <div className="space-y-6">
        {/* HEADER */}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                {bill.bill_no}
              </h1>

              <BillStatusBadge
                status={
                  bill.status
                }
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
              <span>
                Supplier Bill #
                {bill.id}
              </span>

              {bill.purchase_order_id && (
                <>
                  <span>•</span>

                  <Link
                    href={`/purchase/${bill.purchase_order_id}`}
                    className="font-medium text-gray-700 underline underline-offset-4"
                  >
                    From Purchase Order #
                    {
                      bill.purchase_order_id
                    }
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {bill.purchase_order_id && (
              <Link
                href={`/purchase/${bill.purchase_order_id}`}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                View Purchase Order
              </Link>
            )}

            <Link
              href="/supplier-bills"
              className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Back
            </Link>
          </div>
        </div>

        {/* MESSAGE */}

        {message && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              messageType ===
              "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        {/* WORKFLOW */}

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">
                Accounts Payable Workflow
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Open → Payment → Paid
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {bill.status ===
                "draft" && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={openAndRecordPayment}
                  style={{
                    backgroundColor:
                      "#15803d",
                    color:
                      "#ffffff",
                    border:
                      "none",
                    borderRadius:
                      "8px",
                    padding:
                      "10px 16px",
                    fontSize:
                      "14px",
                    fontWeight:
                      600,
                  }}
                >
                  {saving ? "Opening..." : "Open & Record Payment"}
                </button>
              )}

              {canRecordPayment && (
                <button
                  type="button"
                  onClick={
                    openPaymentModal
                  }
                  style={{
                    backgroundColor:
                      "#111827",
                    color:
                      "#ffffff",
                    border:
                      "none",
                    borderRadius:
                      "8px",
                    padding:
                      "10px 16px",
                    fontSize:
                      "14px",
                    fontWeight:
                      600,
                  }}
                >
                  Record Payment
                </button>
              )}

              {isPaid && (
                <span className="rounded-lg bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700">
                  ✓ Fully Paid
                </span>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <WorkflowStep
              number="1"
              label={bill.status === "draft" ? "Draft" : "Open"}
              text={
                bill.status === "draft"
                  ? "Open when ready to pay"
                  : "Ready for payment"
              }
              active={
                bill.status === "draft" ||
                bill.status === "open"
              }
              complete={
                bill.status === "partially_paid" ||
                isPaid
              }
            />

            <WorkflowStep
              number="2"
              label="Payment"
              text={
                bill.paid_amount > 0
                  ? money(bill.paid_amount, bill.currency)
                  : "No payment yet"
              }
              active={bill.status === "partially_paid"}
              complete={isPaid}
            />

            <WorkflowStep
              number="3"
              label="Paid"
              text={
                isPaid
                  ? "Supplier settled"
                  : "Balance remaining"
              }
              active={isPaid}
              complete={isPaid}
            />
          </div>
        </div>

        {/* KPI */}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Bill Total"
            value={money(
              bill.total_amount,
              bill.currency
            )}
            hint={
              bill.currency
            }
          />

          <SummaryCard
            label="Paid"
            value={money(
              bill.paid_amount,
              bill.currency
            )}
            hint={`${paymentProgress.toFixed(
              0
            )}% settled`}
            tone="positive"
          />

          <SummaryCard
            label="Balance Due"
            value={money(
              bill.balance_due,
              bill.currency
            )}
            hint={
              isPaid
                ? "Fully settled"
                : "Amount still payable"
            }
            tone={
              isPaid
                ? "positive"
                : "warning"
            }
          />

          <SummaryCard
            label="Due Date"
            value={
              bill.due_date
                ? formatDate(
                    bill.due_date
                  )
                : "-"
            }
            hint={
              bill.due_date &&
              bill.due_date <
                today() &&
              bill.balance_due > 0
                ? "Overdue"
                : "Payment deadline"
            }
            tone={
              bill.due_date &&
              bill.due_date <
                today() &&
              bill.balance_due > 0
                ? "danger"
                : "normal"
            }
          />
        </div>

        {/* PROGRESS */}

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-gray-900">
                Payment Progress
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Track how much has
                been paid to the
                supplier.
              </p>
            </div>

            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900">
                {paymentProgress.toFixed(
                  0
                )}
                %
              </div>

              <div className="mt-1 text-xs text-gray-400">
                settled
              </div>
            </div>
          </div>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-green-500"
              style={{
                width: `${paymentProgress}%`,
              }}
            />
          </div>
        </div>

        {/* MAIN */}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="font-semibold text-gray-900">
                  Supplier Bill Items
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <Header>
                        Product
                      </Header>

                      <Header right>
                        Qty
                      </Header>

                      <Header right>
                        Unit Cost
                      </Header>

                      <Header right>
                        Discount
                      </Header>

                      <Header right>
                        Tax
                      </Header>

                      <Header right>
                        Total
                      </Header>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {items.map(
                      (item) => (
                        <tr
                          key={
                            item.id
                          }
                        >
                          <td className="px-5 py-4">
                            <div className="font-medium text-gray-900">
                              {item.product_name ||
                                item.description}
                            </div>

                            <div className="mt-1 text-xs text-gray-500">
                              {item.product_code ||
                                item.description}
                            </div>
                          </td>

                          <td className="px-5 py-4 text-right text-sm">
                            {number(
                              item.qty
                            )}
                          </td>

                          <td className="px-5 py-4 text-right text-sm">
                            {money(
                              item.unit_cost,
                              bill.currency
                            )}
                          </td>

                          <td className="px-5 py-4 text-right text-sm">
                            {
                              item.discount_percent
                            }
                            %
                          </td>

                          <td className="px-5 py-4 text-right text-sm">
                            {
                              item.tax_percent
                            }
                            %
                          </td>

                          <td className="px-5 py-4 text-right text-sm font-semibold">
                            {money(
                              item.line_total,
                              bill.currency
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <Section
              title="Supplier Payment History"
              description="Payments recorded against this bill."
            >
              {payments.length ===
              0 ? (
                <div className="rounded-lg bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                  No supplier payments
                  recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <Header>
                          Payment
                        </Header>

                        <Header>
                          Date
                        </Header>

                        <Header>
                          Method
                        </Header>

                        <Header>
                          Reference
                        </Header>

                        <Header right>
                          Amount
                        </Header>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">
                      {payments.map(
                        (
                          payment
                        ) => (
                          <tr
                            key={
                              payment.id
                            }
                          >
                            <td className="px-5 py-4 text-sm font-medium">
                              {
                                payment.payment_no
                              }
                            </td>

                            <td className="px-5 py-4 text-sm text-gray-600">
                              {formatDate(
                                payment.payment_date
                              )}
                            </td>

                            <td className="px-5 py-4 text-sm text-gray-600">
                              {methodLabel(
                                payment.payment_method
                              )}
                            </td>

                            <td className="px-5 py-4 text-sm text-gray-600">
                              {payment.reference_no ||
                                "-"}
                            </td>

                            <td className="px-5 py-4 text-right text-sm font-semibold text-green-700">
                              {money(
                                payment.amount,
                                bill.currency
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
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900">
                Bill Summary
              </h3>

              <div className="mt-5 space-y-4">
                <Metric
                  label="Subtotal"
                  value={money(
                    bill.subtotal,
                    bill.currency
                  )}
                />

                <Metric
                  label="Discount"
                  value={money(
                    bill.discount_amount,
                    bill.currency
                  )}
                />

                <Metric
                  label="Tax"
                  value={money(
                    bill.tax_amount,
                    bill.currency
                  )}
                />

                <div className="border-t border-gray-200 pt-4">
                  <Metric
                    label="Total"
                    value={money(
                      bill.total_amount,
                      bill.currency
                    )}
                    strong
                  />
                </div>

                <Metric
                  label="Paid"
                  value={money(
                    bill.paid_amount,
                    bill.currency
                  )}
                  positive
                />

                <div className="border-t border-gray-200 pt-4">
                  <Metric
                    label="Balance Due"
                    value={money(
                      bill.balance_due,
                      bill.currency
                    )}
                    strong
                  />
                </div>
              </div>

              {canRecordPayment && (
                <button
                  type="button"
                  onClick={
                    openPaymentModal
                  }
                  style={{
                    width:
                      "100%",
                    marginTop:
                      "18px",
                    backgroundColor:
                      "#111827",
                    color:
                      "#ffffff",
                    border:
                      "none",
                    borderRadius:
                      "8px",
                    padding:
                      "10px 16px",
                    fontSize:
                      "14px",
                    fontWeight:
                      600,
                  }}
                >
                  Record Payment
                </button>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900">
                Supplier
              </h3>

              <div className="mt-5 space-y-4">
                <InfoItem
                  label="Supplier"
                  value={
                    supplier?.supplier_name ||
                    "-"
                  }
                />

                <InfoItem
                  label="Code"
                  value={
                    supplier?.supplier_code ||
                    "-"
                  }
                />

                <InfoItem
                  label="Contact"
                  value={
                    supplier?.contact_name ||
                    "-"
                  }
                />

                <InfoItem
                  label="Phone"
                  value={
                    supplier?.phone ||
                    "-"
                  }
                />

                <InfoItem
                  label="Email"
                  value={
                    supplier?.email ||
                    "-"
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PAYMENT MODAL */}

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Record Supplier Payment
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Record money paid
                  against this supplier
                  bill.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowPaymentModal(
                    false
                  )
                }
                className="text-sm font-medium text-gray-500"
              >
                Close
              </button>
            </div>

            <div className="p-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <PaymentSummary
                  label="Bill Total"
                  value={money(
                    bill.total_amount,
                    bill.currency
                  )}
                />

                <PaymentSummary
                  label="Paid"
                  value={money(
                    bill.paid_amount,
                    bill.currency
                  )}
                />

                <PaymentSummary
                  label="Balance"
                  value={money(
                    bill.balance_due,
                    bill.currency
                  )}
                  emphasis
                />
              </div>

              {paymentMessage && (
                <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {
                    paymentMessage
                  }
                </div>
              )}

              <div className="mt-6 space-y-5">
                {paymentPeriodStatus ===
                  "closed" && (
                  <PeriodNotice
                    tone="closed"
                    title="Selected Payment Period Closed"
                    text={`The payment date ${formatDate(
                      paymentDate
                    )} belongs to a closed accounting period${
                      paymentPeriodClosedAt
                        ? ` closed on ${formatDateTime(
                            paymentPeriodClosedAt
                          )}`
                        : ""
                    }. Choose another date or reopen that month before recording payment.`}
                  />
                )}

                {paymentPeriodStatus ===
                  "reopened" && (
                  <PeriodNotice
                    tone="reopened"
                    title="Selected Payment Period Reopened"
                    text="This supplier payment date is in a reopened accounting period. Recording the payment is currently allowed."
                  />
                )}

                <label className="block">
                  <div className="mb-2 text-sm font-medium text-gray-700">
                    Payment Date *
                  </div>

                  <input
                    type="date"
                    value={
                      paymentDate
                    }
                    onChange={async (e) => {
                      const nextDate =
                        e.target.value;

                      setPaymentDate(
                        nextDate
                      );

                      await checkPaymentPeriod(
                        nextDate
                      );
                    }}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
                  />

                  <PaymentPeriodHint
                    status={
                      paymentPeriodStatus
                    }
                    checking={
                      checkingPaymentPeriod
                    }
                  />
                </label>

                <label className="block">
                  <div className="mb-2 text-sm font-medium text-gray-700">
                    Payment Amount *
                  </div>

                 <input
  type="number"
  min="0.01"
  max={bill.balance_due}
  step="0.01"
  value={paymentAmount}
  onChange={(e) =>
    setPaymentAmount(
      e.target.value
    )
  }
  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-400"
/>
                </label>

                <label className="block">
                  <div className="mb-2 text-sm font-medium text-gray-700">
                    Payment Method *
                  </div>

                  <select
  value={paymentMethod}
  onChange={(e) =>
    setPaymentMethod(
      e.target.value
    )
  }
  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
>
                    <option value="cash">
                      Cash
                    </option>

                    <option value="bank_transfer">
                      Bank Transfer
                    </option>

                    <option value="qr">
                      QR / PromptPay
                    </option>

                    <option value="card">
                      Card
                    </option>

                    <option value="other">
                      Other
                    </option>
                  </select>
                </label>

                <label className="block">
                  <div className="mb-2 text-sm font-medium text-gray-700">
                    Reference Number
                  </div>

                  <input
  type="text"
  value={paymentReference}
  onChange={(e) =>
    setPaymentReference(
      e.target.value
    )
  }
  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-400"
  placeholder="Bank / transaction reference"
/>
                </label>

                <label className="block">
                  <div className="mb-2 text-sm font-medium text-gray-700">
                    Notes
                  </div>

                  <textarea
  rows={3}
  value={paymentNotes}
  onChange={(e) =>
    setPaymentNotes(
      e.target.value
    )
  }
  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-400"
/>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
              <button
                type="button"
                disabled={
                  paymentSaving
                }
                onClick={() =>
                  setShowPaymentModal(
                    false
                  )
                }
                className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  paymentSaving ||
                  checkingPaymentPeriod ||
                  paymentPeriodStatus ===
                    "closed"
                }
                onClick={
                  saveSupplierPayment
                }
                style={{
                  backgroundColor:
                    "#111827",
                  color:
                    "#ffffff",
                  border:
                    "none",
                  borderRadius:
                    "8px",
                  padding:
                    "10px 18px",
                  fontSize:
                    "14px",
                  fontWeight:
                    600,
                }}
              >
                {paymentSaving
                  ? "Saving..."
                  : checkingPaymentPeriod
                  ? "Checking Period..."
                  : paymentPeriodStatus ===
                    "closed"
                  ? "Selected Period Closed"
                  : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* UI */

function PeriodNotice({
  tone,
  title,
  text,
}: {
  tone: "closed" | "reopened";
  title: string;
  text: string;
}) {
  const classes =
    tone === "closed"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-blue-200 bg-blue-50 text-blue-800";

  return (
    <div className={`rounded-lg border px-4 py-3 ${classes}`}>
      <div className="text-sm font-semibold">
        {title}
      </div>
      <div className="mt-1 text-sm leading-5">
        {text}
      </div>
    </div>
  );
}

function PaymentPeriodHint({
  status,
  checking,
}: {
  status: PeriodStatus;
  checking: boolean;
}) {
  if (checking) {
    return (
      <div className="mt-2 text-xs text-gray-400">
        Checking accounting period...
      </div>
    );
  }

  if (status === "closed") {
    return (
      <div className="mt-2 text-xs font-medium text-amber-700">
        This payment date is in a closed accounting period.
      </div>
    );
  }

  if (status === "reopened") {
    return (
      <div className="mt-2 text-xs font-medium text-blue-700">
        This payment date is in a reopened accounting period.
      </div>
    );
  }

  return (
    <div className="mt-2 text-xs font-medium text-green-700">
      Accounting period is open.
    </div>
  );
}

function WorkflowStep({
  number,
  label,
  text,
  active,
  complete,
}: {
  number: string;
  label: string;
  text: string;
  active: boolean;
  complete: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        active ||
        complete
          ? "border-gray-900 bg-gray-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            active ||
            complete
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-400"
          }`}
        >
          {complete
            ? "✓"
            : number}
        </div>

        <div>
          <div className="text-sm font-semibold">
            {label}
          </div>

          <div className="mt-1 text-xs text-gray-500">
            {text}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = "normal",
}: {
  label: string;
  value: string;
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
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">
        {label}
      </div>

      <div
        className={`mt-2 text-xl font-semibold ${valueClass}`}
      >
        {value}
      </div>

      <div className="mt-2 text-xs text-gray-400">
        {hint}
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
        <h2 className="font-semibold">
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

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-400">
        {label}
      </div>

      <div className="mt-2 text-sm font-medium">
        {value}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  strong = false,
  positive = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span
        className={
          strong
            ? "font-semibold"
            : "text-sm text-gray-500"
        }
      >
        {label}
      </span>

      <span
        className={`font-semibold ${
          strong
            ? "text-lg"
            : "text-sm"
        } ${
          positive
            ? "text-green-700"
            : ""
        }`}
      >
        {value}
      </span>
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
      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${
        right
          ? "text-right"
          : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function BillStatusBadge({
  status,
}: {
  status: string;
}) {
  const tone =
    status === "paid"
      ? "bg-green-50 text-green-700"
      : status ===
        "partially_paid"
      ? "bg-amber-50 text-amber-700"
      : status ===
        "open"
      ? "bg-blue-50 text-blue-700"
      : "bg-gray-100 text-gray-700";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      {labelize(status)}
    </span>
  );
}

function PaymentSummary({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <div className="text-xs uppercase tracking-wide text-gray-400">
        {label}
      </div>

      <div
        className={`mt-2 font-semibold ${
          emphasis
            ? "text-lg text-amber-600"
            : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

/* FORMAT */

function normalizeBill(
  row: any
): SupplierBill {
  return {
    ...row,
    subtotal:
      Number(
        row.subtotal || 0
      ),
    discount_amount:
      Number(
        row.discount_amount ||
          0
      ),
    tax_amount:
      Number(
        row.tax_amount || 0
      ),
    total_amount:
      Number(
        row.total_amount || 0
      ),
    paid_amount:
      Number(
        row.paid_amount || 0
      ),
    balance_due:
      Number(
        row.balance_due || 0
      ),
  };
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

  return labelize(value);
}

function number(
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

function firstDayOfDate(
  value: string
) {
  return `${String(
    value || ""
  ).slice(0, 7)}-01`;
}

function formatDateTime(
  value: string
) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
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