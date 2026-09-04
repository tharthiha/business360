import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export const instant = false;

type Feature = {
  feature_key: string;
  name: string;
  description?: string | null;
  value_type: string;
  unit?: string | null;
  reset_period?: string | null;
  enabled: boolean;
  limit_integer?: number | null;
  limit_numeric?: number | null;
  value_text?: string | null;
  source?: string;
  usage_count?: number;
};

export default async function PlanUsagePage() {
  const supabase = await createClient();

  const { data, error } =
    await supabase.rpc(
      "current_company_plan_usage"
    );

  if (error) {
    throw new Error(
      "Could not load company plan and usage."
    );
  }

  const subscription =
    data?.subscription || {};

  const features: Feature[] =
    Array.isArray(data?.features)
      ? data.features
      : [];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-7 text-white">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-100">
            Subscription
          </div>

          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {subscription.plan_name || "Free"} Plan
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100">
                {subscription.plan_description ||
                  "Your Business360 company subscription and usage limits."}
              </p>
            </div>

            <div className="rounded-xl bg-white/10 px-4 py-3 text-sm ring-1 ring-white/15">
              <div className="text-xs text-indigo-100">
                Status
              </div>
              <div className="mt-1 font-semibold capitalize">
                {subscription.status || "active"}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 border-t border-gray-100 bg-gray-50 p-5 sm:grid-cols-3">
          <Info
            label="Plan"
            value={subscription.plan_name || "Free"}
          />
          <Info
            label="Billing"
            value={labelize(subscription.billing_source || "free")}
          />
          <Info
            label="Current period"
            value={
              subscription.current_period_end
                ? `Until ${formatDate(subscription.current_period_end)}`
                : "No expiry"
            }
          />
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Plan & Usage
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Limits are controlled by your Business360 plan. Company-specific
            overrides may be applied by NetVilla.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard
              key={feature.feature_key}
              feature={feature}
            />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">
              Need higher limits?
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Upgrade options and billing checkout will be connected in a later phase.
            </p>
          </div>

          <Link
            href="/settings"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Settings
          </Link>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  feature,
}: {
  feature: Feature;
}) {
  const usage =
    Number(feature.usage_count || 0);

  const limit =
    feature.limit_integer == null
      ? null
      : Number(feature.limit_integer);

  const percent =
    limit == null || limit <= 0
      ? 0
      : Math.min(
          100,
          Math.max(
            0,
            (usage / limit) * 100
          )
        );

  const booleanFeature =
    feature.value_type === "boolean";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">
            {feature.name}
          </h3>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            {feature.description || feature.feature_key}
          </p>
        </div>

        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${
            feature.enabled
              ? "bg-green-50 text-green-700"
              : "bg-gray-100 text-gray-500"
          }`}
        >
          {feature.enabled ? "Enabled" : "Locked"}
        </span>
      </div>

      {booleanFeature ? (
        <div className="mt-5 text-sm font-semibold text-gray-900">
          {feature.enabled
            ? "Included in your plan"
            : "Not included"}
        </div>
      ) : (
        <>
          <div className="mt-5 flex items-end justify-between">
            <div className="text-2xl font-semibold text-gray-900">
              {usage}
              {limit == null ? "" : ` / ${limit}`}
            </div>

            <div className="text-xs text-gray-400">
              {feature.reset_period &&
              feature.reset_period !== "never"
                ? `per ${feature.reset_period.replace("ly", "")}`
                : feature.unit || ""}
            </div>
          </div>

          {limit != null && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-indigo-600"
                style={{
                  width: `${percent}%`,
                }}
              />
            </div>
          )}

          <div className="mt-3 text-xs text-gray-500">
            {limit == null
              ? "Unlimited"
              : `${Math.max(limit - usage, 0)} remaining`}
            {feature.source === "company_override"
              ? " • Custom company limit"
              : ""}
          </div>
        </>
      )}
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-gray-900">
        {value}
      </div>
    </div>
  );
}

function labelize(value: string) {
  return String(value || "-")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(
      undefined,
      {
        dateStyle: "medium",
      }
    ).format(new Date(value));
  } catch {
    return value;
  }
}
