import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { hasEnvVars } from "../utils";
import { canAccessPath, normalizeRole } from "../role-permissions";

const PUBLIC_PREFIXES = [
  "/auth",
  "/login",
];

const ONBOARDING_PREFIX = "/onboarding";

const SELF_AUTHORIZED_API_PREFIXES = [
  "/api/ai",
  "/api/settings/users/invite",
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  if (!hasEnvVars) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          supabaseResponse = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  const pathname = request.nextUrl.pathname;

  const isPublic =
    pathname === "/" ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  const isOnboarding =
    pathname === ONBOARDING_PREFIX ||
    pathname.startsWith(`${ONBOARDING_PREFIX}/`);

  const isSelfAuthorizedApi =
    SELF_AUTHORIZED_API_PREFIXES.some((prefix) =>
      pathname.startsWith(prefix)
    );

  if (!user) {
    if (isPublic || isSelfAuthorizedApi) {
      return supabaseResponse;
    }

    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isPublic || isSelfAuthorizedApi) {
    return supabaseResponse;
  }

  const userId =
    typeof user.sub === "string"
      ? user.sub
      : "";

  if (!userId) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, role, is_active")
    .eq("id", userId)
    .maybeSingle();

  // An existing inactive profile is truly disabled.
  if (profile?.is_active === false) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/disabled";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // A verified/authenticated first-time user may not have a profile or
  // company yet. That user belongs in onboarding, not disabled access.
  if (!profile || !profile.company_id) {
    if (isOnboarding) {
      return supabaseResponse;
    }

    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Already-onboarded users should not remain on onboarding.
  if (isOnboarding) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const role = normalizeRole(profile.role);

  if (!canAccessPath(role, pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.set("access", "denied");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}