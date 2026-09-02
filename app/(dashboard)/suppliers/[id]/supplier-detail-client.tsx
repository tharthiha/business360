"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Supplier = {
  id: number;
  supplier_code: string | null;
  supplier_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  tax_id: string | null;
  payment_terms: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string | null;
};

type PurchaseOrder = {
  id: number;
  purchase_order_no: string;
  order_date: string;
  expected_date: string | null;
  status: string;
  currency: string;
  total_amount: number;
};

export default function SupplierDetailClient({
  id,
}: {
  id: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [supplier, setSupplier] =
    useState<Supplier | null>(null);

  const [orders, setOrders] =
    useState<PurchaseOrder[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [
          supplierResult,
          orderResult,
        ] = await Promise.all([
          supabase
            .from("suppliers")
            .select("*")
            .eq("id", id)
            .single(),

          supabase
            .from("purchase_orders")
            .select(`
              id,
              purchase_order_no,
              order_date,
              expected_date,
              status,
              currency,
              total_amount
            `)
            .eq("supplier_id", id)
            .order("id", {
              ascending: false,
            }),
        ]);

        if (
          supplierResult.error ||
          !supplierResult.data
        ) {
          throw new Error(
            supplierResult.error?.message ||
              "Supplier not found."
          );
        }

        if (orderResult.error) {
          throw orderResult.error;
        }

        setSupplier(
          supplierResult.data as Supplier
        );

        setOrders(
          (orderResult.data || []).map(
            (order) => ({
              ...order,
              total_amount: Number(
                order.total_amount || 0
              ),
            })
          )
        );
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Could not load supplier."
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  async function toggleActive() {
    if (!supplier) return;

    const next =
      !supplier.is_active;

    const { error } =
      await supabase
        .from("suppliers")
        .update({
          is_active: next,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", supplier.id);

    if (error) {
      alert(error.message);
      return;
    }

    setSupplier({
      ...supplier,
      is_active: next,
    });
  }

  const purchaseStats =
    useMemo(() => {
      const totalValue =
        orders.reduce(
          (sum, order) =>
            sum +
            Number(
              order.total_amount || 0
            ),
          0
        );

      const openOrders =
        orders.filter((order) =>
          [
            "draft",
            "ordered",
            "partially_received",
          ].includes(order.status)
        ).length;

      const receivedOrders =
        orders.filter(
          (order) =>
            order.status === "received"
        ).length;

      return {
        totalValue,
        openOrders,
        receivedOrders,
      };
    }, [orders]);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-sm text-gray-500">
        Loading supplier...
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {error || "Supplier not found."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {supplier.supplier_name}
            </h1>

            <StatusBadge
              active={supplier.is_active}
            />
          </div>

          <div className="mt-2 text-sm text-gray-500">
            {supplier.supplier_code ||
              `Supplier #${supplier.id}`}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              router.push("/suppliers")
            }
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>

          <Link
            href={`/purchase/new?supplier_id=${supplier.id}`}
            className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
          >
            + Create Purchase Order
          </Link>

          <Link
            href={`/suppliers/${supplier.id}/edit`}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Edit
          </Link>

          <button
            type="button"
            onClick={toggleActive}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {supplier.is_active
              ? "Make Inactive"
              : "Make Active"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Purchase Orders"
          value={String(orders.length)}
          hint="All supplier POs"
        />

        <SummaryCard
          label="Open Orders"
          value={String(
            purchaseStats.openOrders
          )}
          hint="Still in progress"
        />

        <SummaryCard
          label="Received Orders"
          value={String(
            purchaseStats.receivedOrders
          )}
          hint="Fully received"
        />

        <SummaryCard
          label="Purchase Value"
          value={money(
            purchaseStats.totalValue
          )}
          hint="All PO value"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="font-semibold text-gray-900">
                Purchase Orders
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Purchase history with this supplier.
              </p>
            </div>

            {orders.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <div className="text-sm font-medium text-gray-900">
                  No purchase orders yet
                </div>

                <p className="mt-1 text-sm text-gray-500">
                  Create the first purchase order for this supplier.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <Header>PO No.</Header>
                      <Header>Order Date</Header>
                      <Header>Expected</Header>
                      <Header>Status</Header>
                      <Header right>Total</Header>
                      <Header right>Action</Header>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-5 py-4 text-sm font-medium text-gray-900">
                          {order.purchase_order_no}
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {formatDate(
                            order.order_date
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-600">
                          {order.expected_date
                            ? formatDate(
                                order.expected_date
                              )
                            : "-"}
                        </td>

                        <td className="px-5 py-4">
                          <PurchaseStatus
                            status={order.status}
                          />
                        </td>

                        <td className="px-5 py-4 text-right text-sm font-semibold text-gray-900">
                          {money(
                            order.total_amount,
                            order.currency
                          )}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <Link
                            href={`/purchase/${order.id}`}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Section title="Supplier Information">
            <div className="grid gap-6 md:grid-cols-2">
              <InfoItem
                label="Supplier Name"
                value={supplier.supplier_name}
              />
              <InfoItem
                label="Supplier Code"
                value={supplier.supplier_code}
              />
              <InfoItem
                label="Contact Person"
                value={supplier.contact_name}
              />
              <InfoItem
                label="Phone"
                value={supplier.phone}
              />
              <InfoItem
                label="Email"
                value={supplier.email}
              />
              <InfoItem
                label="Tax ID"
                value={supplier.tax_id}
              />
            </div>
          </Section>

          <Section title="Address">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <InfoItem
                  label="Address"
                  value={supplier.address}
                />
              </div>

              <InfoItem
                label="City"
                value={supplier.city}
              />

              <InfoItem
                label="Country"
                value={supplier.country}
              />
            </div>
          </Section>

          <Section title="Notes">
            <div className="text-sm leading-6 text-gray-700">
              {supplier.notes ||
                "No notes for this supplier."}
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900">
              Commercial
            </h3>

            <div className="mt-5 space-y-4">
              <Metric
                label="Payment Terms"
                value={
                  supplier.payment_terms || "-"
                }
              />

              <Metric
                label="Tax ID"
                value={supplier.tax_id || "-"}
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900">
              Quick Purchase
            </h3>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Create a purchase order directly for this supplier.
            </p>

            <Link
              href={`/purchase/new?supplier_id=${supplier.id}`}
              className="mt-4 block rounded-lg bg-gray-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-black"
            >
              Create Purchase Order
            </Link>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900">
              Record
            </h3>

            <div className="mt-4 space-y-3">
              <Metric
                label="Supplier ID"
                value={`#${supplier.id}`}
              />

              <Metric
                label="Created"
                value={
                  supplier.created_at
                    ? new Date(
                        supplier.created_at
                      ).toLocaleDateString()
                    : "-"
                }
              />
            </div>
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
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-gray-500">
        {label}
      </div>

      <div className="mt-2 text-xl font-semibold text-gray-900">
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
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="font-semibold text-gray-900">
          {title}
        </h2>
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
  value: string | null;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </div>

      <div className="mt-2 text-sm font-medium text-gray-900">
        {value || "-"}
      </div>
    </div>
  );
}

function Metric({
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

      <span className="text-sm font-semibold text-gray-900">
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

function StatusBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        active
          ? "bg-green-50 text-green-700"
          : "bg-gray-100 text-gray-600"
      }`}
    >
      {active
        ? "Active"
        : "Inactive"}
    </span>
  );
}

function PurchaseStatus({
  status,
}: {
  status: string;
}) {
  const label =
    status
      .replaceAll("_", " ")
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase()
      );

  const tone =
    status === "received"
      ? "bg-green-50 text-green-700"
      : status ===
        "partially_received"
      ? "bg-amber-50 text-amber-700"
      : status === "ordered"
      ? "bg-blue-50 text-blue-700"
      : status === "cancelled"
      ? "bg-red-50 text-red-700"
      : "bg-gray-100 text-gray-700";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      {label}
    </span>
  );
}

function formatDate(
  value: string
) {
  const parts =
    value.split("-");

  if (
    parts.length === 3
  ) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  return value;
}

function money(
  value: number,
  currency = "THB"
) {
  const symbol =
    currency === "USD"
      ? "$"
      : currency === "MMK"
      ? "K "
      : currency === "SGD"
      ? "S$"
      : currency === "EUR"
      ? "€"
      : "฿";

  return `${symbol}${Number(
    value || 0
  ).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
