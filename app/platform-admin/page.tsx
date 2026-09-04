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
  created_at?: string | null;
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

export default async function PlatformAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    saved?: string;
  }>;
}) {
  const params =
    await searchParams;

  const supabase =
    await createClient();

  const { data: allowed } =
    await supabase.rpc(
      "is_platform_admin",
      {
        p_required_role: null,
      }
    );

  if (allowed !== true) {
    redirect("/dashboard");
  }

  const [
    overviewResult,
    companiesResult,
    plansResult,
  ] = await Promise.all([
    supabase.rpc(
      "admin_platform_overview"
    ),
    supabase.rpc(
      "admin_company_list"
    ),
    supabase.rpc(
      "admin_plan_catalog"
    ),
  ]);

  if (
    overviewResult.error ||
    companiesResult.error ||
    plansResult.error
  ) {
    throw new Error(
      "Could not load platform administration data."
    );
  }

  const overview =
    overviewResult.data || {};

  const companies: CompanyRow[] =
    companiesResult.data || [];

  const plans =
    Array.isArray(plansResult.data)
      ? plansResult.data
      : [];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-7">
        <header className="overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-800 p-7 text-white shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">
                NetVilla Platform Administration
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                Business360 Control Center
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100">
                Manage companies, plans, limits and platform usage without changing application code.
              </p>
            </div>

            <Link
              href="/dashboard"
              className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold ring-1 ring-white/15 hover:bg-white/15"
            >
              Open Business360 →
            </Link>
          </div>
        </header>

        {params.error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {decodeURIComponent(
              params.error
            )}
          </div>
        )}

        {params.saved && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            Changes saved.
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Metric
            label="Companies"
            value={overview.total_companies}
          />
          <Metric
            label="Active"
            value={overview.active_subscriptions}
          />
          <Metric
            label="Free"
            value={overview.free_companies}
          />
          <Metric
            label="Paid / Comp"
            value={overview.paid_or_complimentary_companies}
          />
          <Metric
            label="Users"
            value={overview.total_users}
          />
          <Metric
            label="Products"
            value={overview.total_products}
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-950">
              Companies
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Tenant counts and current subscription status.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3">Company</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Users</th>
                  <th className="px-5 py-3">Products</th>
                  <th className="px-5 py-3">Customers</th>
                  <th className="px-5 py-3">Invoices</th>
                  <th className="px-5 py-3">AI today</th>
                  <th className="px-5 py-3">Change Plan</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {companies.map(
                  (company) => (
                    <tr key={company.company_id}>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">
                          {company.company_name}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          #{company.company_id} • {company.country_code || "-"}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-800">
                          {company.plan_name || "No plan"}
                        </div>
                        <div className="mt-1 text-xs capitalize text-slate-400">
                          {company.billing_source || "-"}
                        </div>
                      </td>
                      <td className="px-5 py-4">{company.user_count}</td>
                      <td className="px-5 py-4">{company.product_count}</td>
                      <td className="px-5 py-4">{company.customer_count}</td>
                      <td className="px-5 py-4">{company.invoice_count}</td>
                      <td className="px-5 py-4">{company.ai_usage_today}</td>
                      <td className="px-5 py-4">
                        <form
                          action={assignCompanyPlan}
                          className="flex min-w-[290px] gap-2"
                        >
                          <input
                            type="hidden"
                            name="company_id"
                            value={company.company_id}
                          />

                          <select
                            name="plan_key"
                            defaultValue={company.plan_key || "free"}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
                          >
                            {plans.map(
                              (plan: any) => (
                                <option
                                  key={plan.plan_key}
                                  value={plan.plan_key}
                                >
                                  {plan.name}
                                </option>
                              )
                            )}
                          </select>

                          <select
                            name="billing_source"
                            defaultValue={
                              company.billing_source === "free"
                                ? "free"
                                : "complimentary"
                            }
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
                          >
                            <option value="free">Free</option>
                            <option value="complimentary">Complimentary</option>
                            <option value="manual">Manual</option>
                          </select>

                          <input
                            type="hidden"
                            name="reason"
                            value="Platform admin plan change"
                          />

                          <button
                            type="submit"
                            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                          >
                            Save
                          </button>
                        </form>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Plan Builder
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Change plan limits here. No redeploy is required.
            </p>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            {plans.map((plan: any) => (
              <div
                key={plan.plan_key}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                    {plan.plan_key}
                  </div>
                  <h3 className="mt-1 text-xl font-semibold text-slate-950">
                    {plan.name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {plan.description}
                  </p>
                </div>

                <div className="mt-5 space-y-3">
                  {(plan.features || []).map(
                    (feature: any) => (
                      <form
                        key={feature.feature_key}
                        action={updatePlanFeature}
                        className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
                      >
                        <input
                          type="hidden"
                          name="plan_key"
                          value={plan.plan_key}
                        />
                        <input
                          type="hidden"
                          name="feature_key"
                          value={feature.feature_key}
                        />

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
                          defaultValue={
                            feature.enabled === false
                              ? "false"
                              : "true"
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
                        >
                          <option value="true">Enabled</option>
                          <option value="false">Disabled</option>
                        </select>

                        {feature.value_type === "integer" ? (
                          <input
                            name="limit_integer"
                            type="number"
                            min="0"
                            defaultValue={
                              feature.limit_integer ?? ""
                            }
                            placeholder="Unlimited"
                            className="w-28 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
                          />
                        ) : (
                          <input
                            name="limit_integer"
                            type="hidden"
                            value=""
                          />
                        )}

                        <button
                          type="submit"
                          className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
                        >
                          Save
                        </button>
                      </form>
                    )
                  )}
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
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
        {Number(value || 0).toLocaleString()}
      </div>
    </div>
  );
}
