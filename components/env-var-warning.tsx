export function EnvVarWarning() {
  return (
    <div className="flex items-center gap-4">
      <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-normal text-gray-600">
        Supabase environment variables required
      </span>

      <div className="flex gap-2">
        <button
          type="button"
          disabled
          className="inline-flex h-8 cursor-not-allowed items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-500 opacity-60"
        >
          Sign in
        </button>

        <button
          type="button"
          disabled
          className="inline-flex h-8 cursor-not-allowed items-center justify-center rounded-lg bg-gray-300 px-3 text-xs font-medium text-white opacity-60"
        >
          Sign up
        </button>
      </div>
    </div>
  );
}
