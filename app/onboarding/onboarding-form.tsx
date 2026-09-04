"use client";

import { useMemo, useState } from "react";

import { completeOnboarding } from "./actions";

type CountryOption = {
  code: string;
  name: string;
  currency: string;
  timezone: string;
};

const COUNTRIES: CountryOption[] = [
  { code: "TH", name: "Thailand", currency: "THB", timezone: "Asia/Bangkok" },
  { code: "MM", name: "Myanmar", currency: "MMK", timezone: "Asia/Yangon" },
  { code: "SG", name: "Singapore", currency: "SGD", timezone: "Asia/Singapore" },
  { code: "MY", name: "Malaysia", currency: "MYR", timezone: "Asia/Kuala_Lumpur" },
  { code: "VN", name: "Vietnam", currency: "VND", timezone: "Asia/Ho_Chi_Minh" },
  { code: "US", name: "United States", currency: "USD", timezone: "UTC" },
  { code: "GB", name: "United Kingdom", currency: "GBP", timezone: "UTC" },
  { code: "AU", name: "Australia", currency: "AUD", timezone: "UTC" },
];

export default function OnboardingForm({
  fullName,
}: {
  fullName: string;
}) {
  const [countryCode, setCountryCode] = useState("TH");
  const country = useMemo(
    () => COUNTRIES.find((item) => item.code === countryCode) ?? COUNTRIES[0],
    [countryCode]
  );
  const [currency, setCurrency] = useState("THB");
  const [timezone, setTimezone] = useState("Asia/Bangkok");

  function handleCountryChange(value: string) {
    setCountryCode(value);
    const next = COUNTRIES.find((item) => item.code === value);

    if (next) {
      setCurrency(next.currency);
      setTimezone(next.timezone);
    }
  }

  const fieldClass =
    "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100";

  return (
    <form action={completeOnboarding} className="space-y-6">
      <div>
        <label htmlFor="full_name" className="text-sm font-medium text-slate-700">
          Your name
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          required
          defaultValue={fullName}
          autoComplete="name"
          className={fieldClass}
          style={{ colorScheme: "light" }}
        />
      </div>

      <div>
        <label htmlFor="company_name" className="text-sm font-medium text-slate-700">
          Company name
        </label>
        <input
          id="company_name"
          name="company_name"
          type="text"
          required
          autoComplete="organization"
          placeholder="Your company"
          className={fieldClass}
          style={{ colorScheme: "light" }}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="country_code" className="text-sm font-medium text-slate-700">
            Country
          </label>
          <select
            id="country_code"
            name="country_code"
            value={countryCode}
            onChange={(event) => handleCountryChange(event.target.value)}
            className={fieldClass}
            style={{ colorScheme: "light", backgroundColor: "#ffffff", color: "#0f172a" }}
          >
            {COUNTRIES.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="default_currency" className="text-sm font-medium text-slate-700">
            Currency
          </label>
          <select
            id="default_currency"
            name="default_currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className={fieldClass}
            style={{ colorScheme: "light", backgroundColor: "#ffffff", color: "#0f172a" }}
          >
            {Array.from(new Set(COUNTRIES.map((item) => item.currency))).map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="timezone" className="text-sm font-medium text-slate-700">
            Timezone
          </label>
          <select
            id="timezone"
            name="timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className={fieldClass}
            style={{ colorScheme: "light", backgroundColor: "#ffffff", color: "#0f172a" }}
          >
            {Array.from(new Set(COUNTRIES.map((item) => item.timezone))).map((item) => (
              <option key={item} value={item}>
                {item.replace("Asia/", "").replaceAll("_", " ")}
              </option>
            ))}
            <option value="UTC">UTC</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 shadow-sm">
              Free plan
            </span>
            <span className="text-sm font-medium text-slate-900">Start at no cost</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Your workspace starts on Free. Limits and upgrades are managed from
            the Business360 plan system.
          </p>
        </div>

        <div className="text-xs leading-5 text-slate-500 sm:text-right">
          <div>AI: 3 questions/day</div>
          <div>Users: 2</div>
          <div>Products: 50</div>
        </div>
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200"
      >
        Create Company & Continue
      </button>
    </form>
  );
}
