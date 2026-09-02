import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";

export async function AuthButton() {
  const supabase = await createClient();

  const { data } =
    await supabase.auth.getClaims();

  const user = data?.claims;

  return user ? (
    <div className="flex items-center gap-4">
      <span className="text-sm text-gray-600">
        Hey, {user.email}!
      </span>

      <LogoutButton />
    </div>
  ) : (
    <div className="flex gap-2">
      <Link
        href="/auth/login"
        className="inline-flex h-8 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
      >
        Sign in
      </Link>

      <Link
        href="/auth/sign-up"
        className="inline-flex h-8 items-center justify-center rounded-lg bg-gray-900 px-3 text-xs font-medium text-white transition hover:bg-black"
      >
        Sign up
      </Link>
    </div>
  );
}
