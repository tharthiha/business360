"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Row = {
  id: number;
  return_no: string;
  return_date: string;
  total_amount: number;
  currency: string;
  reason: string | null;
  invoice_id: number;
  credit_note_id: number | null;
  credit_note_no: string | null;
  credit_status: string | null;
  refund_due: number;
  refunded_amount: number;
};

export default function SalesReturnsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadRows();
  }, []);

  async function loadRows() {
    setLoading(true);
    setError("");

    try {
      const { data: returns, error: returnError } = await supabase
        .from("sales_returns")
        .select(`
          id,
          return_no,
          return_date,
          total_amount,
          currency,
          reason,
          invoice_id
        `)
        .order("return_date", { ascending: false })
        .order("id", { ascending: false });

      if (returnError) throw returnError;

      const ids = (returns || []).map((row: any) => Number(row.id));

      let notes: any[] = [];
      if (ids.length) {
        const { data, error } = await supabase
          .from("credit_notes")
          .select(`
            id,
            sales_return_id,
            credit_note_no,
            status,
            refund_due,
            refunded_amount
          `)
          .in("sales_return_id", ids);

        if (error) throw error;
        notes = data || [];
      }

      const noteMap = new Map(
        notes.map((note: any) => [Number(note.sales_return_id), note])
      );

      setRows(
        (returns || []).map((row: any) => {
          const note = noteMap.get(Number(row.id));

          return {
            id: Number(row.id),
            return_no: row.return_no,
            return_date: row.return_date,
            total_amount: Number(row.total_amount || 0),
            currency: row.currency || "THB",
            reason: row.reason,
            invoice_id: Number(row.invoice_id),
            credit_note_id: note ? Number(note.id) : null,
            credit_note_no: note?.credit_note_no || null,
            credit_status: note?.status || null,
            refund_due: Number(note?.refund_due || 0),
            refunded_amount: Number(note?.refunded_amount || 0),
          };
        })
      );
    } catch (err) {
      setError(formatError(err, "Could not load Sales Returns."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Sales Returns
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Customer returns, Credit Notes and refunds.
          </p>
        </div>

        <Link
          href="/sales-returns/new"
          className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white"
        >
          + New Sales Return
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-500">
            Loading Sales Returns...
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">
            No Sales Returns yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <Header>Return</Header>
                  <Header>Date</Header>
                  <Header>Invoice</Header>
                  <Header>Credit Note</Header>
                  <Header>Status</Header>
                  <Header right>Credit</Header>
                  <Header right>Refund Due</Header>
                  <Header right>Action</Header>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <Cell strong>{row.return_no}</Cell>
                    <Cell>{formatDate(row.return_date)}</Cell>
                    <Cell>
                      <Link
                        href={`/invoices/${row.invoice_id}`}
                        className="underline underline-offset-4"
                      >
                        Invoice #{row.invoice_id}
                      </Link>
                    </Cell>
                    <Cell>{row.credit_note_no || "-"}</Cell>
                    <Cell>{labelize(row.credit_status || "processed")}</Cell>
                    <Cell right>{money(row.total_amount, row.currency)}</Cell>
                    <Cell right>
                      {money(Math.max(row.refund_due - row.refunded_amount, 0), row.currency)}
                    </Cell>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/sales-returns/${row.id}`}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700"
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
    </div>
  );
}

function Header({ children, right = false }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${right ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Cell({
  children,
  strong = false,
  right = false,
}: {
  children: React.ReactNode;
  strong?: boolean;
  right?: boolean;
}) {
  return (
    <td className={`px-5 py-4 text-sm ${strong ? "font-semibold text-gray-900" : "text-gray-600"} ${right ? "text-right" : ""}`}>
      {children}
    </td>
  );
}

function labelize(value: string) {
  return String(value || "-").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  const parts = String(value || "").split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value || "-";
}

function money(value: number, currency: string) {
  if (currency === "MMK") {
    return `K ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }

  const symbol = currency === "USD" ? "$" : currency === "SGD" ? "S$" : currency === "EUR" ? "€" : "฿";
  return `${symbol}${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatError(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message || fallback;
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
}
