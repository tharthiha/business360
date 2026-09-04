import Link from "next/link";
import { Suspense } from "react";

import { signUp } from "./actions";

type SignUpSearchParams = Promise<{
  error?: string;
  check_email?: string;
}>;

export default function SignUpPage({
  searchParams,
}: {
  searchParams: SignUpSearchParams;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <Suspense fallback={<SignUpCardFallback />}>
        <SignUpContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SignUpContent({
  searchParams,
}: {
  searchParams: SignUpSearchParams;
}) {
  const params = await searchParams;
  const error = params.error ? decodeURIComponent(params.error) : "";
  const checkEmail = params.check_email
    ? decodeURIComponent(params.check_email)
    : "";

  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <Brand />

      {checkEmail ? (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Check your email
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            We sent a verification link to{" "}
            <span className="font-medium text-gray-900">{checkEmail}</span>.
            Verify your email, then continue to Business360.
          </p>

          <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
            After verification, you&apos;ll create your company and your account
            will become the company Owner on the Free plan.
          </div>

          <Link
            href="/auth/login"
            className="mt-6 flex w-full items-center justify-center rounded-lg bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            Back to Login
          </Link>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Start your Business360 company workspace.
          </p>

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form action={signUp} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="full_name"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Your name
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                autoComplete="name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900"
                placeholder="Your full name"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Work email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label
                htmlFor="confirm_password"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                Confirm password
              </label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900"
                placeholder="Enter password again"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Create Account
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="font-medium text-gray-900 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </>
      )}
    </div>
  );
}

function Brand() {
  return (
    <div className="mb-8">
      <div className="text-xl font-semibold tracking-tight text-gray-900">
        Business360
      </div>
      <div className="mt-1 text-sm text-gray-500">
        Business Operating System
      </div>
    </div>
  );
}

function SignUpCardFallback() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <Brand />
      <div className="h-7 w-48 animate-pulse rounded bg-gray-100" />
      <div className="mt-3 h-4 w-64 animate-pulse rounded bg-gray-100" />
      <div className="mt-8 space-y-4">
        <div className="h-11 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-11 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-11 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-11 animate-pulse rounded-lg bg-gray-100" />
      </div>
    </div>
  );
}
