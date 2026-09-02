import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  let next = url.searchParams.get("next") || "/auth/invite";

  if (!next.startsWith("/")) next = "/auth/invite";

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL("/auth/login?error=invalid_invite_link", url.origin)
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    console.error("[auth-confirm]", error.message);
    return NextResponse.redirect(
      new URL("/auth/login?error=invite_verification_failed", url.origin)
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
