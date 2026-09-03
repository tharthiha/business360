"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);

    try {
      const supabase = createClient();
      await supabase.auth.signOut();

      router.replace("/auth/login");
      router.refresh();
    } catch (error) {
      console.error("[sign-out]", error);
      setSigningOut(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={signingOut}
      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {signingOut ? "Signing out..." : "Sign Out"}
    </button>
  );
}
