import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import {
  assignCompanyPlan,
  updatePlanFeature,
} from "./actions";

export const instant = false;

export default async function PlatformAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    saved?: string;
    q?: string;
    plan?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: allowed } = await supabase.rpc("is_platform_admin", {
    p_required_role: null,
  });

  if (allowed !== true) {
    redirect("/dashboard");
  }

  const [
    overviewResult,
    companiesResult,
    plansResult,
    actionsResult,
    operationsResult,
    revenueResult,
    billingResult,
  ] = await Promise.all([
    supabase.rpc("admin_platform_overview"),
    supabase.rpc("admin_company_list"),
    supabase.rpc("admin_plan_catalog"),
    supabase.rpc("admin_recent_actions", { p_limit: 12 }),
    supabase.rpc("admin_company_operations_summary"),
    supabase.rpc("admin_revenue_overview"),
    supabase.rpc("admin_company_billing_summary"),
  ]);

  if (
    overviewResult.error ||
    companiesResult.error ||
    plansResult.error ||
    actionsResult.error ||
    operationsResult.error ||
    revenueResult.error ||
    billingResult.error
  ) {
    throw new Error("Could not load platform administration data.");
  }

  const overview = overviewResult.data || {};
  const companies = companiesResult.data || [];
  const plans = Array.isArray(plansResult.data) ? plansResult.data : [];
  const actions = actionsResult.data || [];
  const operations = operationsResult.data || [];
  const revenue = revenueResult.data || {};
  const billingRows = billingResult.data || [];

  type CompanyOperationsRow = {
    company_id: number | string;
    health_score?: number | null;
    health_status?: string | null;
  };

  type CompanyBillingRow = {
    company_id: number | string;
    normalized_mrr?: number | string | null;
    price_currency?: string | null;
    billing_status?: string | null;
  };

  const opsByCompany = new Map<number, CompanyOperationsRow>(
    (operations as CompanyOperationsRow[]).map((row) => [
      Number(row.company_id),
      row,
    ])
  );

  const billingByCompany = new Map<number, CompanyBillingRow>(
    (billingRows as CompanyBillingRow[]).map((row) => [
      Number(row.company_id),
      row,
    ])
  );

  const query = String(params.q || "").trim().toLowerCase();
  const planFilter = String(params.plan || "").trim();

  const visibleCompanies = companies.filter((company: any) => {
    const matchesQuery =
      !query ||
      company.company_name.toLowerCase().includes(query) ||
      String(company.company_id).includes(query);

    const matchesPlan =
      !planFilter || company.plan_key === planFilter;

    return matchesQuery && matchesPlan;
  });

  const totalAiToday = companies.reduce(
    (sum: number, row: any) => sum + Number(row.ai_usage_today || 0),
    0
  );

  const attentionCount = operations.filter(
    (row: any) =>
      row.health_status === "at_risk" ||
      row.health_status === "suspended"
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-7 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-7">
        <header className="overflow-hidden rounded-3xl border border-indigo-900/20 bg-[radial-gradient(circle_at_top_right,_#4f46e5,_#1e1b4b_45%,_#020617)] p-7 text-white shadow-2xl shadow-indigo-950/15 lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
                NetVilla Platform Administration
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight lg:text-4xl">
                Business360 Control Center
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-indigo-100/90">
                SaaS operations, tenant health, subscriptions, revenue and support controls.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard"
                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/15"
              >
                Open Business360
              </Link>
              <Link
                href="/settings/plan"
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-indigo-50"
              >
                My Plan
              </Link>
            </div>
          </div>
        </header>

        {params.error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
            {decodeURIComponent(params.error)}
          </div>
        )}

        {params.saved && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
            Platform changes saved successfully.
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-8">
          <Metric label="Companies" value={overview.total_companies} hint="Total tenants" />
          <Metric label="Active" value={overview.active_subscriptions} hint="Live subscriptions" />
          <Metric label="Free" value={overview.free_companies} hint="Free tier" />
          <Metric label="Paid / Comp" value={overview.paid_or_complimentary_companies} hint="Non-free plans" />
          <Metric label="Users" value={overview.total_users} hint="Active members" />
          <Metric label="Products" value={overview.total_products} hint="Across tenants" />
          <Metric label="AI Today" value={totalAiToday} hint="Questions used" />
          <Metric label="At Risk" value={attentionCount} hint="Needs attention" />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <RevenueMetric
            label="MRR"
            value={formatMoney(revenue.mrr, "USD")}
            hint="Normalized monthly revenue"
          />
          <RevenueMetric
            label="ARR"
            value={formatMoney(revenue.arr, "USD")}
            hint="Annualized revenue"
          />
          <RevenueMetric
            label="Paid"
            value={revenue.paid_companies}
            hint="Revenue-generating tenants"
          />
          <RevenueMetric
            label="Trials"
            value={revenue.trial_companies}
            hint="Trialing subscriptions"
          />
          <RevenueMetric
            label="Expiring"
            value={revenue.expiring_14d}
            hint="Next 14 days"
          />
          <RevenueMetric
            label="Complimentary"
            value={revenue.complimentary_companies}
            hint="Granted access"
          />
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Companies
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Health, billing readiness, usage and subscription control.
              </p>
            </div>

            <form className="flex flex-col gap-2 sm:flex-row">
              <input
                name="q"
                defaultValue={params.q || ""}
                placeholder="Search company or ID..."
                className="min-w-[220px] rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900"
              />
              <select
                name="plan"
                defaultValue={params.plan || ""}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900"
              >
                <option value="">All plans</option>
                {plans.map((plan: any) => (
                  <option key={plan.plan_key} value={plan.plan_key}>
                    {plan.name}
                  </option>
                ))}
              </select>
              <button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">
                Filter
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                <tr>
                  <th className="px-6 py-3.5">Company</th>
                  <th className="px-5 py-3.5">Health</th>
                  <th className="px-5 py-3.5">Plan</th>
                  <th className="px-5 py-3.5">Billing</th>
                  <th className="px-5 py-3.5">Usage</th>
                  <th className="px-5 py-3.5">Business Data</th>
                  <th className="px-5 py-3.5">Subscription Control</th>
                  <th className="px-5 py-3.5"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {visibleCompanies.map((company: any) => {
                  const ops = opsByCompany.get(Number(company.company_id));
                  const billing = billingByCompany.get(Number(company.company_id));

                  return (
                    <tr key={company.company_id} className="hover:bg-slate-50/70">
                      <td className="px-6 py-5">
                        <div className="font-semibold text-slate-950">
                          {company.company_name}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          Company #{company.company_id} • {company.country_code || "-"}
                        </div>
                      </td>

                      <td className="px-5 py-5">
                        <HealthBadge
                          score={ops?.health_score ?? 0}
                          status={ops?.health_status || "unknown"}
                        />
                      </td>

                      <td className="px-5 py-5">
                        <span className="inline-flex rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                          {company.plan_name || "No plan"}
                        </span>
                        <div className="mt-2 text-xs capitalize text-slate-400">
                          {company.billing_source || "-"} • {company.subscription_status || "-"}
                        </div>
                      </td>

                      <td className="px-5 py-5">
                        <div className="text-sm font-semibold text-slate-900">
                          {formatMoney(
                            billing?.normalized_mrr || 0,
                            billing?.price_currency || "USD"
                          )}
                        </div>
                        <div className="mt-1 text-xs capitalize text-slate-400">
                          {billing?.billing_status || "not connected"}
                        </div>
                      </td>

                      <td className="px-5 py-5">
                        <div className="text-sm font-semibold text-slate-900">
                          {company.ai_usage_today}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">AI today</div>
                      </td>

                      <td className="px-5 py-5">
                        <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-xs">
                          <Stat label="Users" value={company.user_count} />
                          <Stat label="Products" value={company.product_count} />
                          <Stat label="Customers" value={company.customer_count} />
                          <Stat label="Invoices" value={company.invoice_count} />
                        </div>
                      </td>

                      <td className="px-5 py-5">
                        <form action={assignCompanyPlan} className="flex min-w-[330px] flex-wrap gap-2">
                          <input type="hidden" name="company_id" value={company.company_id} />
                          <select
                            name="plan_key"
                            defaultValue={company.plan_key || "free"}
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800"
                          >
                            {plans.map((plan: any) => (
                              <option key={plan.plan_key} value={plan.plan_key}>
                                {plan.name}
                              </option>
                            ))}
                          </select>

                          <select
                            name="billing_source"
                            defaultValue={company.billing_source || "free"}
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800"
                          >
                            <option value="free">Free</option>
                            <option value="complimentary">Complimentary</option>
                            <option value="manual">Manual</option>
                            <option value="other">Other</option>
                          </select>

                          <input type="hidden" name="reason" value="Platform admin plan change" />

                          <button className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white">
                            Save
                          </button>
                        </form>
                      </td>

                      <td className="px-5 py-5 text-right">
                        <Link
                          href={`/platform-admin/companies/${company.company_id}`}
                          className="inline-flex rounded-xl border border-indigo-200 bg-white px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                        >
                          Manage →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">
              Product Configuration
            </div>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              Plan Builder
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Change global plan allowances without redeploying Business360.
            </p>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            {plans.map((plan: any) => (
              <div
                key={plan.plan_key}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/40 px-6 py-5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                    {plan.plan_key}
                  </div>
                  <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                    {plan.name}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {plan.description}
                  </p>
                </div>

                <div className="space-y-3 p-5">
                  {(plan.features || []).map((feature: any) => (
                    <form
                      key={feature.feature_key}
                      action={updatePlanFeature}
                      className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-[1fr_130px_120px_80px] sm:items-center"
                    >
                      <input type="hidden" name="plan_key" value={plan.plan_key} />
                      <input type="hidden" name="feature_key" value={feature.feature_key} />

                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {feature.name}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {feature.feature_key}
                        </div>
                      </div>

                      <select
                        name="enabled"
                        defaultValue={feature.enabled === false ? "false" : "true"}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-medium text-slate-800"
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>

                      {feature.value_type === "integer" ? (
                        <input
                          name="limit_integer"
                          type="number"
                          min="0"
                          defaultValue={feature.limit_integer ?? ""}
                          placeholder="Unlimited"
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-medium text-slate-900"
                        />
                      ) : (
                        <input name="limit_integer" type="hidden" value="" />
                      )}

                      <button className="rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-semibold text-white">
                        Save
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-xl font-semibold text-slate-950">
              Recent Admin Activity
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            {actions.map((item: any) => (
              <div key={item.id} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {labelize(item.action)}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {item.actor_email || "Platform admin"}
                    {item.company_name ? ` • ${item.company_name}` : ""}
                  </div>
                </div>
                <div className="text-xs text-slate-400">
                  {formatDateTime(item.created_at)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, hint }: { label: string; value: unknown; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
        {Number(value || 0).toLocaleString()}
      </div>
      <div className="mt-1 text-xs text-slate-400">{hint}</div>
    </div>
  );
}

function RevenueMetric({ label, value, hint }: { label: string; value: unknown; hint: string }) {
  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/50 p-5 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
        {String(value ?? "0")}
      </div>
      <div className="mt-1 text-xs text-slate-400">{hint}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function HealthBadge({ score, status }: { score: number; status: string }) {
  const cls =
    status === "healthy"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "watch"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : status === "suspended"
      ? "border-slate-300 bg-slate-100 text-slate-700"
      : "border-red-200 bg-red-50 text-red-700";

  return (
    <div>
      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>
        {score}/100
      </span>
      <div className="mt-2 text-xs text-slate-400">{labelize(status)}</div>
    </div>
  );
}

function formatMoney(value: unknown, currency: string) {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "USD"} ${amount.toFixed(2)}`;
  }
}

function labelize(value: string) {
  return String(value || "-")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
