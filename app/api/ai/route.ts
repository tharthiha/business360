import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canAccessPath, normalizeRole } from "@/lib/role-permissions";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id, role, is_active")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !profile?.company_id ||
      profile.is_active === false
    ) {
      return NextResponse.json(
        { error: "Active company profile not found." },
        { status: 403 }
      );
    }

    const role = normalizeRole(profile.role);

    if (!canAccessPath(role, "/ai")) {
      return NextResponse.json(
        { error: "Your role does not have access to AI Assistant." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const message = String(body?.message || "").trim();

    if (!message) {
      return NextResponse.json(
        { error: "Ask a business question first." },
        { status: 400 }
      );
    }

    const companyId = Number(profile.company_id);

    const [
      companyResult,
      customersResult,
      suppliersResult,
      productsResult,
      salesResult,
      invoicesResult,
      supplierBillsResult,
      expensesResult,
      purchaseResult,
      salesItemsResult,
      purchaseItemsResult,
      movementsResult,
    ] = await Promise.all([
      supabase
        .from("companies")
        .select("name, default_currency")
        .eq("id", companyId)
        .single(),

      supabase
        .from("customers")
        .select("id, customer_name, customer_code, email, phone")
        .eq("company_id", companyId)
        .limit(200),

      supabase
        .from("suppliers")
        .select("id, supplier_name, supplier_code, email, phone")
        .eq("company_id", companyId)
        .limit(200),

      supabase
        .from("products")
        .select(`
          id,
          product_name,
          product_code,
          sku,
          current_stock,
          min_stock,
          cost_price,
          selling_price,
          is_active
        `)
        .eq("company_id", companyId)
        .limit(300),

      supabase
        .from("sales_orders")
        .select("id, status, total_amount, created_at, customer_id")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(100),

      supabase
        .from("invoices")
        .select("id, status, total_amount, paid_amount, due_date, customer_id, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(100),

      supabase
        .from("supplier_bills")
        .select("id, status, total_amount, paid_amount, due_date, supplier_id, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(100),

      supabase
        .from("expenses")
        .select("id, status, amount, expense_date, description, supplier_id")
        .eq("company_id", companyId)
        .order("expense_date", { ascending: false })
        .limit(100),

      supabase
        .from("purchase_orders")
        .select("id, status, total_amount, created_at, supplier_id")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(100),

      supabase
        .from("sales_order_items")
        .select(`
          sales_order_id,
          product_id,
          description,
          qty,
          unit_price,
          line_total
        `)
        .limit(500),

      supabase
        .from("purchase_order_items")
        .select(`
          purchase_order_id,
          product_id,
          description,
          qty,
          received_qty,
          unit_cost,
          line_total
        `)
        .limit(500),

      supabase
        .from("inventory_movements")
        .select(`
          id,
          product_id,
          movement_date,
          movement_type,
          qty_change,
          stock_before,
          stock_after,
          reference_no,
          reason,
          unit_cost,
          cost_amount
        `)
        .order("movement_date", { ascending: false })
        .limit(200),
    ]);

    const queryErrors = [
      companyResult.error,
      customersResult.error,
      suppliersResult.error,
      productsResult.error,
      salesResult.error,
      invoicesResult.error,
      supplierBillsResult.error,
      expensesResult.error,
      purchaseResult.error,
      salesItemsResult.error,
      purchaseItemsResult.error,
      movementsResult.error,
    ].filter(Boolean);

    if (queryErrors.length > 0) {
      console.error("[business360-ai-data]", queryErrors);

      return NextResponse.json(
        {
          error:
            "Business360 could not load all company data required for AI analysis.",
        },
        { status: 500 }
      );
    }

    const customers = customersResult.data || [];
    const suppliers = suppliersResult.data || [];
    const products = productsResult.data || [];
    const salesOrders = salesResult.data || [];
    const invoices = invoicesResult.data || [];
    const supplierBills = supplierBillsResult.data || [];
    const expenses = expensesResult.data || [];
    const purchaseOrders = purchaseResult.data || [];
    const salesItems = salesItemsResult.data || [];
    const purchaseItems = purchaseItemsResult.data || [];
    const movements = movementsResult.data || [];

    const customerById = new Map(
      customers.map((row: any) => [String(row.id), row])
    );

    const supplierById = new Map(
      suppliers.map((row: any) => [String(row.id), row])
    );

    const productById = new Map(
      products.map((row: any) => [String(row.id), row])
    );

    const salesItemsByOrder = groupBy(
      salesItems,
      (row: any) => String(row.sales_order_id)
    );

    const purchaseItemsByOrder = groupBy(
      purchaseItems,
      (row: any) => String(row.purchase_order_id)
    );

    const movementsByProduct = groupBy(
      movements,
      (row: any) => String(row.product_id)
    );

    const readableSalesOrders = salesOrders.map((row: any) => ({
      id: row.id,
      status: row.status,
      total_amount: number(row.total_amount),
      created_at: row.created_at,
      customer:
        customerById.get(String(row.customer_id)) || null,
      items: (salesItemsByOrder.get(String(row.id)) || []).map(
        (item: any) => ({
          product:
            productById.get(String(item.product_id)) || null,
          description: item.description,
          qty: number(item.qty),
          unit_price: number(item.unit_price),
          line_total: number(item.line_total),
        })
      ),
    }));

    const readableInvoices = invoices.map((row: any) => ({
      ...row,
      total_amount: number(row.total_amount),
      paid_amount: number(row.paid_amount),
      outstanding_amount: Math.max(
        0,
        number(row.total_amount) - number(row.paid_amount)
      ),
      customer:
        customerById.get(String(row.customer_id)) || null,
    }));

    const readablePurchaseOrders = purchaseOrders.map((row: any) => ({
      id: row.id,
      status: row.status,
      total_amount: number(row.total_amount),
      created_at: row.created_at,
      supplier:
        supplierById.get(String(row.supplier_id)) || null,
      items: (purchaseItemsByOrder.get(String(row.id)) || []).map(
        (item: any) => {
          const orderedQty = number(item.qty);
          const receivedQty = number(item.received_qty);

          return {
            product:
              productById.get(String(item.product_id)) || null,
            description: item.description,
            ordered_qty: orderedQty,
            received_qty: receivedQty,
            incoming_qty: Math.max(0, orderedQty - receivedQty),
            unit_cost: number(item.unit_cost),
            line_total: number(item.line_total),
          };
        }
      ),
    }));

    const readableSupplierBills = supplierBills.map((row: any) => ({
      ...row,
      total_amount: number(row.total_amount),
      paid_amount: number(row.paid_amount),
      outstanding_amount: Math.max(
        0,
        number(row.total_amount) - number(row.paid_amount)
      ),
      supplier:
        supplierById.get(String(row.supplier_id)) || null,
    }));

    const readableExpenses = expenses.map((row: any) => ({
      ...row,
      amount: number(row.amount),
      supplier:
        row.supplier_id == null
          ? null
          : supplierById.get(String(row.supplier_id)) || null,
    }));

    const inventoryProducts = products.map((row: any) => {
      const currentStock = number(row.current_stock);
      const minStock = number(row.min_stock);

      const openPurchaseLines = readablePurchaseOrders.flatMap(
        (order: any) =>
          ["received", "cancelled", "canceled"].includes(
            String(order.status || "").toLowerCase()
          )
            ? []
            : order.items.filter(
                (item: any) =>
                  String(item.product?.id) === String(row.id)
              )
      );

      const incomingQty = openPurchaseLines.reduce(
        (sum: number, item: any) =>
          sum + number(item.incoming_qty),
        0
      );

      const recentMovements = (
        movementsByProduct.get(String(row.id)) || []
      )
        .slice(0, 12)
        .map((movement: any) => ({
          movement_date: movement.movement_date,
          movement_type: movement.movement_type,
          qty_change: number(movement.qty_change),
          stock_before: number(movement.stock_before),
          stock_after: number(movement.stock_after),
          reference_no: movement.reference_no,
          reason: movement.reason,
          unit_cost:
            movement.unit_cost == null
              ? null
              : number(movement.unit_cost),
          cost_amount:
            movement.cost_amount == null
              ? null
              : number(movement.cost_amount),
        }));

      const soldQty = salesItems.reduce(
        (sum: number, item: any) =>
          String(item.product_id) === String(row.id)
            ? sum + number(item.qty)
            : sum,
        0
      );

      return {
        id: row.id,
        product_name: row.product_name,
        product_code: row.product_code,
        sku: row.sku,
        current_stock: currentStock,
        min_stock: minStock,
        stock_status:
          currentStock <= 0
            ? "out_of_stock"
            : currentStock <= minStock
            ? "low_stock"
            : "healthy",
        cost_price: number(row.cost_price),
        selling_price: number(row.selling_price),
        estimated_stock_value:
          currentStock * number(row.cost_price),
        incoming_purchase_qty: incomingQty,
        ordered_but_not_received: openPurchaseLines,
        sales_order_qty_in_loaded_history: soldQty,
        recent_inventory_movements: recentMovements,
        is_active: row.is_active !== false,
      };
    });

    const businessContext = {
      role,
      company: companyResult.data,
      customers,
      suppliers,
      inventory_summary: {
        total_products: inventoryProducts.length,
        total_units: inventoryProducts.reduce(
          (sum: number, row: any) => sum + row.current_stock,
          0
        ),
        inventory_value: inventoryProducts.reduce(
          (sum: number, row: any) =>
            sum + row.estimated_stock_value,
          0
        ),
        out_of_stock_products: inventoryProducts.filter(
          (row: any) => row.stock_status === "out_of_stock"
        ).length,
        low_stock_products: inventoryProducts.filter(
          (row: any) => row.stock_status === "low_stock"
        ).length,
        total_incoming_purchase_qty: inventoryProducts.reduce(
          (sum: number, row: any) =>
            sum + row.incoming_purchase_qty,
          0
        ),
      },
      products: inventoryProducts,
      sales_orders: readableSalesOrders,
      invoices: readableInvoices,
      supplier_bills: readableSupplierBills,
      expenses: readableExpenses,
      purchase_orders: readablePurchaseOrders,
    };

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured on the server." },
        { status: 500 }
      );
    }

    const model = process.env.OPENAI_MODEL || "gpt-5-mini";

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: [
            {
              role: "developer",
              content:
                "You are Business360 AI Assistant. You are read-only. Answer only from the supplied company data. Prefer customer, supplier and product names over raw IDs. For inventory questions, use product current_stock, min_stock, incoming_purchase_qty, purchase order item quantities, sales item quantities and recent inventory movements. Clearly distinguish current stock from incoming stock. Never invent missing quantities, names, transactions or forecasts. If available data is insufficient, say exactly what is missing. Be concise and practical, and answer in the user's language when possible.",
            },
            {
              role: "user",
              content:
                `BUSINESS DATA:\n${JSON.stringify(
                  businessContext
                )}\n\nQUESTION:\n${message}`,
            },
          ],
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("[business360-ai]", result);

      return NextResponse.json(
        {
          error:
            result?.error?.message ||
            "AI provider request failed.",
        },
        { status: 502 }
      );
    }

    const answer =
      typeof result?.output_text === "string"
        ? result.output_text.trim()
        : extractOutputText(result);

    if (!answer) {
      return NextResponse.json(
        { error: "AI Assistant returned an empty response." },
        { status: 502 }
      );
    }

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("[business360-ai]", error);

    return NextResponse.json(
      {
        error:
          "Unexpected error while analyzing Business360 data.",
      },
      { status: 500 }
    );
  }
}

function groupBy<T>(
  rows: T[],
  keyFn: (row: T) => string
) {
  const map = new Map<string, T[]>();

  for (const row of rows) {
    const key = keyFn(row);
    const current = map.get(key) || [];
    current.push(row);
    map.set(key, current);
  }

  return map;
}

function number(value: unknown) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function extractOutputText(result: any) {
  const output = Array.isArray(result?.output)
    ? result.output
    : [];

  const parts: string[] = [];

  for (const item of output) {
    const content = Array.isArray(item?.content)
      ? item.content
      : [];

    for (const part of content) {
      if (
        part?.type === "output_text" &&
        typeof part?.text === "string"
      ) {
        parts.push(part.text);
      }
    }
  }

  return parts.join("\n").trim();
}
