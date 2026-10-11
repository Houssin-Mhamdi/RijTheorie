import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Decodes a JWT payload without verifying signature — only used for local env sanity checks.
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

// Catches the "copied the wrong/expired key" class of bug loudly instead of silent 401s later.
function validateSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "[ENV-CHECK] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
    return;
  }
  const urlRef = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  const payload = decodeJwtPayload(key);
  if (!payload) {
    console.error(
      "[ENV-CHECK] SUPABASE_SERVICE_ROLE_KEY is not a valid JWT — copy it again from Supabase Settings > API.",
    );
    return;
  }
  if (payload.role !== "service_role") {
    console.error(
      `[ENV-CHECK] SUPABASE_SERVICE_ROLE_KEY has role="${String(payload.role)}" (expected "service_role") — you likely pasted the anon/publishable key by mistake.`,
    );
  }
  if (urlRef && payload.ref !== urlRef) {
    console.error(
      `[ENV-CHECK] SUPABASE_SERVICE_ROLE_KEY project ref "${String(payload.ref)}" does not match NEXT_PUBLIC_SUPABASE_URL ref "${urlRef}" — you copied a key from the wrong project or mistyped it. Fix .env.local.`,
    );
  }
}

validateSupabaseEnv();

async function getRole(
  userId: string,
): Promise<{ role: string; can_access_exams: boolean } | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/get_profile_for_proxy`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        },
        body: JSON.stringify({ p_user_id: userId }),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.log(
        `[PROXY-PROBE] getRole FAIL status=${res.status} reason=${body.slice(0, 140)}`,
      );
      return null;
    }
    const data = await res.json();
    console.log(
      `[PROXY-PROBE] getRole role=${(data as Record<string, unknown> | null)?.role ?? "null"} canAccessExams=${(data as Record<string, unknown> | null)?.can_access_exams ?? "null"}`,
    );
    return data ?? null;
  } catch (e) {
    console.error("[PROXY] getRole error:", e);
    return null;
  }
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthPage = path === "/login" || path === "/signup";
  const isRoot = path === "/";
  const isAdminRoute =
    path.startsWith("/dashboard") ||
    path.startsWith("/learn") ||
    path.startsWith("/questions") ||
    path.startsWith("/lessons") ||
    path.startsWith("/students") ||
    path.startsWith("/subscriptions") ||
    path.startsWith("/coupons") ||
    path.startsWith("/billing") ||
    path.startsWith("/blog-admin");
  const isStudentRoute =
    path.startsWith("/exams") ||
    path.startsWith("/results") ||
    path.startsWith("/courses");

  if (!user && (isAdminRoute || isStudentRoute)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && (isAuthPage || isRoot)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (user && (isAdminRoute || isStudentRoute)) {
    const profile = await getRole(user.id);
    const role = profile?.role ?? null;
    const canAccessExams = profile?.can_access_exams ?? false;

    if (role === null) {
      if (isAdminRoute) {
        return NextResponse.redirect(new URL("/exams", request.url));
      }
      return supabaseResponse;
    }

    if (isAdminRoute && role !== "admin") {
      return NextResponse.redirect(new URL("/exams", request.url));
    }

    if (
      isStudentRoute &&
      role !== "student" &&
      !(role === "admin" && canAccessExams)
    ) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/learn/:path*",
    "/questions/:path*",
    "/lessons/:path*",
    "/students/:path*",
    "/exams/:path*",
    "/results/:path*",
    "/subscriptions/:path*",
    "/courses/:path*",
    "/coupons/:path*",
    "/billing/:path*",
    "/blog-admin/:path*",
    "/login",
    "/signup",
    "/",
  ],
};
