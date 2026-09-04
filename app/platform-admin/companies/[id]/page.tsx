import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import {
  addCompanyNote,
  assignCompanyPlan,
  clearCompanyOverride,
  setCompanyOverride,
  setCompanySuspension,
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

  const [
    detailResult,
    plansResult,
    operationsResult,
    notesResult,
  ] = await Promise.all([
    supabase.rpc("admin_company_detail", { p_company_id: companyId }),
    supabase.rpc("admin_plan_catalog"),
    supabase.rpc("admin_company_operations_summary"),
    supabase.rpc("admin_company_notes", { p_company_id: companyId }),
  ]);

  if (detailResult.error) {
    notFound();
  }

  if (plansResult.error || operationsResult.error || notesResult.error) {
    throw new Error("Could not load company administration data.");
  }

  const data = detailResult.data || {};
  const company = data.company || {};
  const subscription = data.subscription || {};
  const counts = data.counts || {};
  const members = Array.isArray(data.members) ? data.members : [];
  const features = Array.isArray(data.features) ? data.features : [];
  const plans = Array.isArray(plansResult.data) ? plansResult.data : [];
  const notes = notesResult.data || [];

  const operation = (operationsResult.data || []).find(
    (row: any) => Number(row.company_id) === companyId
  ) || {};

  const { data: controls } = await supabase
    .from("company_platform_controls")
    .select("is_suspended, suspension_reason, suspended_at")
    .eq("company_id", companyId)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-7 lg:px-8">
      <div className="mx-auto max-w-[1450px] space-y-7">
        <div className="flex items-center justify-between gap-4">
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

              <div className="flex flex-wrap gap-3">
                <InfoPill
                  label="Health"
                  value={`${operation.health_score ?? 0}/100`}
                  sub={labelize(operation.health_status || "unknown")}
                />
                <InfoPill
                  label="Current plan"
                  value={subscription.plan_name || "No plan"}
                  sub={`${subscription.billing_source || "-"} • ${subscription.status || "-"}`}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 bg-slate-50 p-5 sm:grid-cols-6">
            <MiniMetric label="Users" value={counts.users} />
            <MiniMetric label="Products" value={counts.products} />
            <MiniMetric label="Customers" value={counts.customers} />
            <MiniMetric label="Invoices" value={counts.invoices} />
            <MiniMetric label="Sales Orders" value={counts.sales_orders} />
            <MiniMetric label="Last Activity" value={`${operation.days_since_activity ?? 0}d`} />
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
            <div
              className={`rounded-3xl border p-6 shadow-sm ${
                controls?.is_suspended
                  ? "border-red-200 bg-red-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="text-xs font-semibold uppercase tracking-wider text-red-600">
                Access Control
              </div>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                {controls?.is_suspended ? "Company Suspended" : "Company Active"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Suspension blocks tenant access while keeping company data intact.
              </p>

              {controls?.is_suspended && (
                <div className="mt-4 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700">
                  {controls.suspension_reason || "No suspension reason provided."}
                </div>
              )}

              <form action={setCompanySuspension} className="mt-5 space-y-3">
                <input type="hidden" name="company_id" value={company.id} />
                <input
                  type="hidden"
                  name="is_suspended"
                  value={controls?.is_suspended ? "false" : "true"}
                />

                {!controls?.is_suspended && (
                  <input
                    name="reason"
                    required
                    placeholder="Reason for suspension..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900"
                  />
                )}

                <button
                  className={`w-full rounded-xl px-4 py-3 text-sm font-semibold text-white ${
                    controls?.is_suspended
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {controls?.is_suspended ? "Reactivate Company" : "Suspend Company"}
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                Subscription
              </div>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                Plan Assignment
              </h2>

              <form action={assignCompanyPlan} className="mt-5 space-y-4">
                <input type="hidden" name="company_id" value={company.id} />

                <select
                  name="plan_key"
                  defaultValue={subscription.plan_key || "free"}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900"
                >
                  {plans.map((plan: any) => (
                    <option key={plan.plan_key} value={plan.plan_key}>
                      {plan.name}
                    </option>
                  ))}
                </select>

                <select
                  name="billing_source"
                  defaultValue={subscription.billing_source || "complimentary"}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900"
                >
                  <option value="free">Free</option>
                  <option value="complimentary">Complimentary</option>
                  <option value="manual">Manual</option>
                  <option value="other">Other</option>
                </select>

                <input
                  name="reason"
                  defaultValue={subscription.granted_reason || ""}
                  placeholder="Admin note / reason"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900"
                />

                <button className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
                  Update Company Plan
                </button>
              </form>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">
                Support Notes
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Internal NetVilla notes. Tenant users cannot see these.
              </p>

              <form action={addCompanyNote} className="mt-4">
                <input type="hidden" name="company_id" value={company.id} />
                <textarea
                  name="note"
                  required
                  rows={3}
                  placeholder="Add internal note..."
                  className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900"
                />
                <button className="mt-2 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white">
                  Add Note
                </button>
              </form>

              <div className="mt-5 space-y-3">
                {notes.map((note: any) => (
                  <div key={note.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-sm leading-6 text-slate-700">{note.note}</div>
                    <div className="mt-2 text-xs text-slate-400">
                      {note.actor_email || "Platform admin"} • {formatDateTime(note.created_at)}
                    </div>
                  </div>
                ))}

                {notes.length === 0 && (
                  <div className="text-sm text-slate-400">No support notes yet.</div>
                )}
              </div>
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
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Company Overrides
            </div>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              Custom Limits & Access
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Override this tenant only. Optional expiry returns the feature to its plan default.
            </p>

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

                    <select
                      name="enabled_override"
                      defaultValue={
                        feature.enabled_override == null
                          ? ""
                          : feature.enabled_override
                          ? "true"
                          : "false"
                      }
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-900"
                    >
                      <option value="">Use plan</option>
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>

                    <input
                      type="number"
                      min="0"
                      name="limit_integer_override"
                      defaultValue={feature.limit_integer_override ?? ""}
                      placeholder="Use plan"
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-900"
                    />

                    <input
                      type="datetime-local"
                      name="expires_at"
                      defaultValue={toLocalDateTime(feature.expires_at)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-900"
                    />

                    <input
                      name="reason"
                      defaultValue={feature.override_reason || ""}
                      placeholder="Reason..."
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-900"
                    />

                    <button className="rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-semibold text-white">
                      Save
                    </button>
                  </form>

                  {feature.override_id && (
                    <form action={clearCompanyOverride} className="mt-3">
                      <input type="hidden" name="company_id" value={company.id} />
                      <input type="hidden" name="feature_key" value={feature.feature_key} />
                      <button className="text-xs font-semibold text-red-600">
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

function InfoPill({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur">
      <div className="text-xs text-indigo-100">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-indigo-100">{sub}</div>
    </div>
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
        {typeof value === "number"
          ? Number(value || 0).toLocaleString()
          : String(value ?? "-")}
      </div>
    </div>
  );
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

function toLocalDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (v: number) => String(v).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
