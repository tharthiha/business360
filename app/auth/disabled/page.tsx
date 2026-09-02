import Link from "next/link";

export default function DisabledAccountPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-7 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-xl">
          !
        </div>

        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-gray-900">
          Account Access Disabled
        </h1>

        <p className="mt-3 text-sm leading-6 text-gray-500">
          Your Business360 company access is currently inactive. Contact your
          company owner to restore access.
        </p>

        <Link
          href="/auth/login"
          className="mt-6 inline-flex rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Back to Login
        </Link>
      </div>
    </main>
  );
}
