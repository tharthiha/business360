import Link from "next/link";

export default function CompanySuspendedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-white p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-xl font-semibold text-amber-700">
          !
        </div>

        <div className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
          Business360
        </div>

        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
          Company Access Temporarily Suspended
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-500">
          Your company workspace is currently unavailable. Please contact your
          company owner or NetVilla support for assistance.
        </p>

        <Link
          href="/auth/login"
          className="mt-7 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Back to Login
        </Link>
      </div>
    </main>
  );
}
