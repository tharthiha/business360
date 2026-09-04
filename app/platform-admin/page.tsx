import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import {
  assignCompanyPlan,
  updatePlanFeature,
} from "./actions";

export const instant = false;

type CompanyRow = {
  company_id: number;
  company_name: string;
  country_code?: string | null;
  plan_key?: string | null;
  plan_name?: string | null;
  subscription_status?: string | null;
  billing_source?: string | null;
  user_count: number;
  product_count: number;
  customer_count: number;
  invoice_count: number;
  ai_usage_today: number;
};

type OpsRow = {
  company_id: number;
  last_activity_at?: string | null;
  days_since_activity: number;
  health_score: number;
  health_status: string;
  is_suspended: boolean;
  suspension_reason?: string | null;
  expiry_status: string;
};

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
  ] = await Promise.all([
    supabase.rpc("admin_platform_overview"),
    supabase.rpc("admin_company_list"),
    supabase.rpc("admin_plan_catalog"),
    supabase.rpc("admin_recent_actions", { p_limit: 12 }),
    supabase.rpc("admin_company_operations_summary"),
  ]);

  if (
    overviewResult.error ||
    companiesResult.error ||
    plansResult.error ||
    actionsResult.error ||
    operationsResult.error
  ) {
    throw new Error("Could not load platform administration data.");
  }

  const overview = overviewResult.data || {};
  const companies: CompanyRow[] = companiesResult.data || [];
  const plans = Array.isArray(plansResult.data) ? plansResult.data : [];
  const actions = actionsResult.data || [];
  const operations: OpsRow[] = operationsResult.data || [];

  const opsByCompany = new Map(
    operations.map((row) => [Number(row.company_id), row])
  );

  const query = String(params.q || "").trim().toLowerCase();
  const planFilter = String(params.plan || "").trim();

  const visibleCompanies = companies.filter((company) => {
    const matchesQuery =
      !query ||
      company.company_name.toLowerCase().includes(query) ||
      String(company.company_id).includes(query);

    const matchesPlan =
      !planFilter || company.plan_key === planFilter;

    return matchesQuery && matchesPlan;
  });

  const totalAiToday = companies.reduce(
    (sum, row) => sum + Number(row.ai_usage_today || 0),
    0
  );

  const attentionCount = operations.filter(
    (row) => row.health_status === "at_risk" || row.health_status === "suspended"
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
                Operate tenants, subscriptions, usage, health and support controls from one place.
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

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Companies
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Tenant health, last activity, usage and subscription controls.
              </p>
            </div>

            <form className="flex flex-col gap-2 sm:flex-row">
              <input
                name="q"
                defaultValue={params.q || ""}
                placeholder="Search company or ID..."
                className="min-w-[220px] rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              />
              <select
                name="plan"
                defaultValue={params.plan || ""}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500"
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
                  <th className="px-5 py-3.5">Last Activity</th>
                  <th className="px-5 py-3.5">Plan</th>
                  <th className="px-5 py-3.5">Usage</th>
                  <th className="px-5 py-3.5">Business Data</th>
                  <th className="px-5 py-3.5">Subscription Control</th>
                  <th className="px-5 py-3.5"></th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {visibleCompanies.map((company) => {
                  const ops = opsByCompany.get(Number(company.company_id));

                  return (
                    <tr key={company.company_id} className="transition hover:bg-slate-50/70">
                      <td className="px-6 py-5">
                        <div className="font-semibold text-slate-950">
                          {company.company_name}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          Company #{company.company_id} • {company.country_code || "-"}
                        </div>

                        {ops?.expiry_status && ops.expiry_status !== "ok" && (
                          <div className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase text-amber-700">
                            {labelize(ops.expiry_status)}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-5">
                        <HealthBadge
                          score={ops?.health_score ?? 0}
                          status={ops?.health_status || "unknown"}
                        />
                      </td>

                      <td className="px-5 py-5">
                        <div className="text-sm font-semibold text-slate-800">
                          {ops?.days_since_activity ?? 0}d ago
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {formatDate(ops?.last_activity_at)}
                        </div>
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
                          {company.ai_usage_today}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          AI today
                        </div>
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
                            defaultValue={
                              company.billing_source === "free"
                                ? "free"
                                : company.billing_source || "complimentary"
                            }
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800"
                          >
                            <option value="free">Free</option>
                            <option value="complimentary">Complimentary</option>
                            <option value="manual">Manual</option>
                            <option value="other">Other</option>
                          </select>

                          <input
                            type="hidden"
                            name="reason"
                            value="Platform admin plan change"
                          />

                          <button
                            type="submit"
                            className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                          >
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

                      <button
                        type="submit"
                        className="rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700"
                      >
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
            <p className="mt-1 text-sm text-slate-500">
              Administrative changes are recorded for accountability.
            </p>
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

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: unknown;
  hint: string;
}) {
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

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function HealthBadge({
  score,
  status,
}: {
  score: number;
  status: string;
}) {
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
      <div className="mt-2 text-xs text-slate-400">
        {labelize(status)}
      </div>
    </div>
  );
}

function labelize(value: string) {
  return String(value || "-")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
      new Date(value)
    );
  } catch {
    return value;
  }
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
