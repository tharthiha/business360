import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import {
  assignCompanyPlan,
  clearCompanyOverride,
  setCompanyOverride,
} from "../../actions";

export const instant = false;

export default async function CompanyAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const companyId = Number(id);

  if (!Number.isFinite(companyId)) {
    notFound();
  }

  const supabase = await createClient();

  const { data: allowed } = await supabase.rpc("is_platform_admin", {
    p_required_role: null,
  });

  if (allowed !== true) {
    redirect("/dashboard");
  }

  const [detailResult, plansResult] = await Promise.all([
    supabase.rpc("admin_company_detail", { p_company_id: companyId }),
    supabase.rpc("admin_plan_catalog"),
  ]);

  if (detailResult.error) {
    notFound();
  }

  if (plansResult.error) {
    throw new Error("Could not load plan catalog.");
  }

  const data = detailResult.data || {};
  const company = data.company || {};
  const subscription = data.subscription || {};
  const counts = data.counts || {};
  const members = Array.isArray(data.members) ? data.members : [];
  const features = Array.isArray(data.features) ? data.features : [];
  const plans = Array.isArray(plansResult.data) ? plansResult.data : [];

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-7 lg:px-8">
      <div className="mx-auto max-w-[1420px] space-y-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/platform-admin"
            className="text-sm font-semibold text-indigo-700 hover:text-indigo-900"
          >
            ← Back to Control Center
          </Link>

          <div className="text-xs text-slate-400">
            Company #{company.id}
          </div>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-[radial-gradient(circle_at_top_right,_#6366f1,_#312e81_45%,_#0f172a)] p-7 text-white lg:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">
                  Tenant Management
                </div>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                  {company.name}
                </h1>
                <p className="mt-2 text-sm text-indigo-100">
                  {company.country_code || "-"} • {company.default_currency || "-"} • {company.timezone || "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur">
                <div className="text-xs text-indigo-100">Current plan</div>
                <div className="mt-1 text-xl font-semibold">
                  {subscription.plan_name || "No plan"}
                </div>
                <div className="mt-1 text-xs capitalize text-indigo-100">
                  {subscription.billing_source || "-"} • {subscription.status || "-"}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 bg-slate-50 p-5 sm:grid-cols-5">
            <MiniMetric label="Users" value={counts.users} />
            <MiniMetric label="Products" value={counts.products} />
            <MiniMetric label="Customers" value={counts.customers} />
            <MiniMetric label="Invoices" value={counts.invoices} />
            <MiniMetric label="Sales Orders" value={counts.sales_orders} />
          </div>
        </section>

        {query.error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
            {decodeURIComponent(query.error)}
          </div>
        )}

        {query.saved && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
            Company settings updated.
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                Subscription
              </div>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                Plan Assignment
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Upgrade, downgrade or grant a complimentary plan.
              </p>

              <form action={assignCompanyPlan} className="mt-5 space-y-4">
                <input type="hidden" name="company_id" value={company.id} />

                <div>
                  <label className="text-xs font-semibold text-slate-600">Plan</label>
                  <select
                    name="plan_key"
                    defaultValue={subscription.plan_key || "free"}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900"
                  >
                    {plans.map((plan: any) => (
                      <option key={plan.plan_key} value={plan.plan_key}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600">Billing source</label>
                  <select
                    name="billing_source"
                    defaultValue={subscription.billing_source || "complimentary"}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900"
                  >
                    <option value="free">Free</option>
                    <option value="complimentary">Complimentary</option>
                    <option value="manual">Manual</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600">Admin note</label>
                  <input
                    name="reason"
                    defaultValue={subscription.granted_reason || ""}
                    placeholder="Why is this plan being granted?"
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900"
                  />
                </div>

                <button className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">
                  Update Company Plan
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">
                Company Profile
              </h2>
              <dl className="mt-5 space-y-4 text-sm">
                <Detail label="Email" value={company.email || "-"} />
                <Detail label="Phone" value={company.phone || "-"} />
                <Detail label="Country" value={company.country_code || "-"} />
                <Detail label="Currency" value={company.default_currency || "-"} />
                <Detail label="Timezone" value={company.timezone || "-"} />
                <Detail label="Created" value={formatDate(company.created_at)} />
              </dl>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">
                Team Members
              </h2>
              <div className="mt-4 divide-y divide-slate-100">
                {members.map((member: any) => (
                  <div key={member.id} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {member.full_name || member.email || "User"}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {member.email || "-"}
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">
                      {member.role || "staff"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                Company Overrides
              </div>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                Custom Limits & Access
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Override a plan limit for this company only. You can optionally set an expiry date,
                then the company automatically falls back to its plan default.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              {features.map((feature: any) => (
                <div
                  key={feature.feature_key}
                  className={`rounded-2xl border p-5 ${
                    feature.override_id
                      ? "border-indigo-200 bg-indigo-50/40"
                      : "border-slate-200 bg-slate-50/60"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">
                        {feature.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {feature.feature_key} • Plan limit:{" "}
                        {feature.plan_limit_integer == null
                          ? "Unlimited"
                          : feature.plan_limit_integer}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                        Usage: {feature.usage_count}
                      </span>
                      <span className="rounded-full bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white">
                        Effective:{" "}
                        {feature.effective_limit_integer == null
                          ? "Unlimited"
                          : feature.effective_limit_integer}
                      </span>
                    </div>
                  </div>

                  <form action={setCompanyOverride} className="mt-4 grid gap-3 lg:grid-cols-[130px_130px_170px_1fr_90px] lg:items-end">
                    <input type="hidden" name="company_id" value={company.id} />
                    <input type="hidden" name="feature_key" value={feature.feature_key} />

                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Access
                      </label>
                      <select
                        name="enabled_override"
                        defaultValue={
                          feature.enabled_override == null
                            ? ""
                            : feature.enabled_override
                            ? "true"
                            : "false"
                        }
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-900"
                      >
                        <option value="">Use plan</option>
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Custom limit
                      </label>
                      <input
                        type="number"
                        min="0"
                        name="limit_integer_override"
                        defaultValue={feature.limit_integer_override ?? ""}
                        placeholder="Use plan"
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Expiry
                      </label>
                      <input
                        type="datetime-local"
                        name="expires_at"
                        defaultValue={toLocalDateTime(feature.expires_at)}
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Reason
                      </label>
                      <input
                        name="reason"
                        defaultValue={feature.override_reason || ""}
                        placeholder="Promo, support, negotiated allowance..."
                        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-900"
                      />
                    </div>

                    <button className="rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700">
                      Save
                    </button>
                  </form>

                  {feature.override_id && (
                    <form action={clearCompanyOverride} className="mt-3">
                      <input type="hidden" name="company_id" value={company.id} />
                      <input type="hidden" name="feature_key" value={feature.feature_key} />
                      <button className="text-xs font-semibold text-red-600 hover:text-red-700">
                        Reset to plan default
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-slate-950">
        {Number(value || 0).toLocaleString()}
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-5">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
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

function toLocalDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (v: number) => String(v).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
