export default function SignOutButton() {
  return (
    <form action="/auth/sign-out" method="post">
      <button
        type="submit"
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
      >
        Sign Out
      </button>
    </form>
  );
}
