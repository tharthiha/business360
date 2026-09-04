"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function redirectWithError(message: string): never {
  redirect(`/auth/sign-up?error=${encodeURIComponent(message)}`);
}

export async function signUp(formData: FormData) {
  const fullName = clean(formData.get("full_name"));
  const email = clean(formData.get("email")).toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!fullName) {
    redirectWithError("Please enter your name.");
  }

  if (!email || !email.includes("@")) {
    redirectWithError("Please enter a valid email address.");
  }

  if (password.length < 8) {
    redirectWithError("Password must be at least 8 characters.");
  }

  if (password !== confirmPassword) {
    redirectWithError("Passwords do not match.");
  }

  const requestHeaders = await headers();
  const origin =
    requestHeaders.get("origin") ||
    (() => {
      const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
      const proto = requestHeaders.get("x-forwarded-proto") || "https";
      return host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_SITE_URL || "";
    })();

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: origin ? `${origin}/auth/confirm?next=/onboarding` : undefined,
    },
  });

  if (error) {
    redirectWithError(error.message);
  }

  redirect(`/auth/sign-up?check_email=${encodeURIComponent(email)}`);
}
