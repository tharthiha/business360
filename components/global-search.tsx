"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type SearchResult = {
  id: number;
  type: "customer" | "product" | "invoice";
  title: string;
  subtitle: string;
  href: string;
};

export default function GlobalSearch() {
  const router = useRouter();
  const supabase = createClient();

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    const timer = window.setTimeout(() => {
      searchEverything(trimmed);
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  async function searchEverything(searchText: string) {
    setLoading(true);

    try {
      const term = `%${searchText}%`;

      const [
        customerResult,
        productResult,
        invoiceResult,
      ] = await Promise.all([
        supabase
          .from("customers")
          .select(`
            id,
            customer_code,
            customer_name,
            contact_name,
            phone,
            email
          `)
          .or(
            `customer_name.ilike.${term},customer_code.ilike.${term},contact_name.ilike.${term},phone.ilike.${term},email.ilike.${term}`
          )
          .limit(5),

        supabase
          .from("products")
          .select(`
            id,
            product_code,
            sku,
            barcode,
            product_name
          `)
          .or(
            `product_name.ilike.${term},product_code.ilike.${term},sku.ilike.${term},barcode.ilike.${term}`
          )
          .limit(5),

        supabase
          .from("invoices")
          .select(`
            id,
            invoice_no,
            status,
            total_amount,
            currency
          `)
          .ilike("invoice_no", term)
          .limit(5),
      ]);

      const nextResults: SearchResult[] = [];

      if (!customerResult.error) {
        for (const customer of customerResult.data || []) {
          nextResults.push({
            id: customer.id,
            type: "customer",
            title: customer.customer_name,
            subtitle:
              customer.customer_code ||
              customer.phone ||
              customer.email ||
              "Customer",
            href: `/customers/${customer.id}`,
          });
        }
      }

      if (!productResult.error) {
        for (const product of productResult.data || []) {
          nextResults.push({
            id: product.id,
            type: "product",
            title: product.product_name,
            subtitle:
              product.product_code ||
              product.sku ||
              product.barcode ||
              "Product",
            href: `/products/${product.id}`,
          });
        }
      }

      if (!invoiceResult.error) {
        for (const invoice of invoiceResult.data || []) {
          nextResults.push({
            id: invoice.id,
            type: "invoice",
            title: invoice.invoice_no,
            subtitle: `${formatStatus(
              invoice.status
            )} · ${money(
              invoice.total_amount,
              invoice.currency
            )}`,
            href: `/invoices/${invoice.id}`,
          });
        }
      }

      setResults(nextResults);
      setOpen(true);
    } catch (error) {
      console.error("Global search error:", error);
      setResults([]);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  function selectResult(result: SearchResult) {
    setOpen(false);
    setQuery("");
    router.push(result.href);
  }

  return (
    <div
      ref={wrapperRef}
      className="relative w-full max-w-lg"
    >
      <input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
        onFocus={() => {
          if (query.trim().length >= 2) {
            setOpen(true);
          }
        }}
        placeholder="Search customers, products, invoices..."
        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:bg-white"
      />

      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          {loading ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <div className="text-sm font-medium text-gray-900">
                No results found
              </div>

              <div className="mt-1 text-xs text-gray-500">
                Try a customer name, product code or invoice number.
              </div>
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto py-2">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  type="button"
                  onClick={() => selectResult(result)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">
                      {result.title}
                    </div>

                    <div className="mt-1 truncate text-xs text-gray-500">
                      {result.subtitle}
                    </div>
                  </div>

                  <TypeBadge type={result.type} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TypeBadge({
  type,
}: {
  type: SearchResult["type"];
}) {
  const label =
    type === "customer"
      ? "Customer"
      : type === "product"
      ? "Product"
      : "Invoice";

  return (
    <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
      {label}
    </span>
  );
}

function formatStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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

function currencySymbol(currency: string) {
  if (currency === "MMK") return "K ";
  if (currency === "USD") return "$";
  if (currency === "EUR") return "€";
  if (currency === "SGD") return "S$";

  return "฿";
}